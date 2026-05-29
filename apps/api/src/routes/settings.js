const express = require('express');
const crypto = require('crypto');
const { User, Project, ProjectMember, Task, AuditLog, Comment } = require('../models');
const authenticate = require('../middleware/authenticate');
const { generateBase32Secret, verifyTOTP } = require('../lib/totp');

const router = express.Router();


// Get public profile (No authentication required)
router.get('/public/:username', async (req, res, next) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username, profileVisibility: 'public' })
      .select('name username avatarUrl bannerUrl headline bio githubUrl linkedinUrl portfolioUrl twitterUrl techStack skills experienceLevel certifications createdAt');
    
    if (!user) {
      return res.status(404).json({ error: 'Profile not found or set to private.' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.use(authenticate);

// Update Profile settings
router.patch('/profile', async (req, res, next) => {
  try {
    const { name, username, avatarUrl, bannerUrl, headline, bio } = req.body;
    
    // Check if username is already taken by someone else
    if (username) {
      const existing = await User.findOne({ username: username.toLowerCase(), _id: { $ne: req.user.id } });
      if (existing) {
        return res.status(400).json({ error: 'Username is already taken.' });
      }
    }

    const updates = { name };
    if (username !== undefined) updates.username = username.toLowerCase() || null;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (bannerUrl !== undefined) updates.bannerUrl = bannerUrl;
    if (headline !== undefined) updates.headline = headline;
    if (bio !== undefined) updates.bio = bio;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update Personal Info
router.patch('/personal', async (req, res, next) => {
  try {
    const { phone, location, timezone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { phone, location, timezone } },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update Socials & Skills
router.patch('/socials', async (req, res, next) => {
  try {
    const { githubUrl, linkedinUrl, portfolioUrl, resumeUrl, twitterUrl, techStack, skills, experienceLevel, interests, certifications } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          githubUrl,
          linkedinUrl,
          portfolioUrl,
          resumeUrl,
          twitterUrl,
          techStack,
          skills,
          experienceLevel,
          interests,
          certifications
        }
      },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update Preferences
router.patch('/preferences', async (req, res, next) => {
  try {
    const { emailPreferences, notificationSettings, language, theme, accentColor, animationsEnabled, dashboardLayout, profileVisibility } = req.body;
    
    const updates = {};
    if (emailPreferences) updates.emailPreferences = emailPreferences;
    if (notificationSettings) updates.notificationSettings = notificationSettings;
    if (language) updates.language = language;
    if (theme) updates.theme = theme;
    if (accentColor) updates.accentColor = accentColor;
    if (animationsEnabled !== undefined) updates.animationsEnabled = animationsEnabled;
    if (dashboardLayout) updates.dashboardLayout = dashboardLayout;
    if (profileVisibility) updates.profileVisibility = profileVisibility;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Setup 2FA
router.post('/2fa/setup', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Generate a cryptographically valid Base32 secret for TOTP
    const secret = generateBase32Secret(16);
    
    // We update the secret in DB, but don't enable 2FA yet until verified
    await User.findByIdAndUpdate(req.user.id, { $set: { twoFactorSecret: secret } });

    // Standard TOTP authenticator URI
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=otpauth://totp/TaskForge:${encodeURIComponent(user.email)}?secret=${secret}&issuer=TaskForge`;

    res.json({ secret, qrCodeUrl });
  } catch (error) {
    next(error);
  }
});

// Verify and enable 2FA
router.post('/2fa/enable', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      return res.status(400).json({ error: 'Verification code must be 6 digits.' });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: '2FA has not been set up yet.' });
    }

    const isValid = verifyTOTP(user.twoFactorSecret, code);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code. Please try again.' });
    }

    user.twoFactorEnabled = true;
    await user.save();

    res.json({ success: true, twoFactorEnabled: user.twoFactorEnabled });
  } catch (error) {
    next(error);
  }
});

// Disable 2FA
router.post('/2fa/disable', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { twoFactorEnabled: false, twoFactorSecret: null } },
      { new: true }
    );
    res.json({ success: true, twoFactorEnabled: user.twoFactorEnabled });
  } catch (error) {
    next(error);
  }
});

// Session Management: List active sessions & device history
router.get('/sessions', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('activeSessions loginActivity deviceHistory');
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Session Management: Revoke session
router.delete('/sessions/:id', async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { activeSessions: { id: sessionId } } },
      { new: true }
    );
    res.json({ success: true, activeSessions: user.activeSessions });
  } catch (error) {
    next(error);
  }
});

// Developer API key generation
router.post('/api-keys', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'API key name is required.' });

    // Generate a random token
    const rawKey = `tf_${crypto.randomBytes(24).toString('hex')}`;
    const keyId = crypto.randomBytes(8).toString('hex');

    const newKey = {
      id: keyId,
      name,
      key: rawKey,
      createdAt: new Date(),
      lastUsed: null
    };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $push: { apiKeys: newKey } },
      { new: true }
    );

    res.json({ newKey, apiKeys: user.apiKeys });
  } catch (error) {
    next(error);
  }
});

// Developer API key revocation
router.delete('/api-keys/:id', async (req, res, next) => {
  try {
    const keyId = req.params.id;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { apiKeys: { id: keyId } } },
      { new: true }
    );
    res.json({ success: true, apiKeys: user.apiKeys });
  } catch (error) {
    next(error);
  }
});

// Developer webhooks management
router.post('/webhooks', async (req, res, next) => {
  try {
    const { url, events } = req.body;
    if (!url) return res.status(400).json({ error: 'Webhook URL is required.' });

    const newWebhook = {
      id: crypto.randomBytes(8).toString('hex'),
      url,
      events: events || ['task.created', 'task.updated'],
      active: true
    };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $push: { webhooks: newWebhook } },
      { new: true }
    );

    res.json({ newWebhook, webhooks: user.webhooks });
  } catch (error) {
    next(error);
  }
});

router.delete('/webhooks/:id', async (req, res, next) => {
  try {
    const webhookId = req.params.id;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { webhooks: { id: webhookId } } },
      { new: true }
    );
    res.json({ success: true, webhooks: user.webhooks });
  } catch (error) {
    next(error);
  }
});

router.patch('/developer/mode', async (req, res, next) => {
  try {
    const { developerMode } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { developerMode } },
      { new: true }
    );
    res.json({ success: true, developerMode: user.developerMode });
  } catch (error) {
    next(error);
  }
});

// AI Model customization
router.patch('/ai/settings', async (req, res, next) => {
  try {
    const { temperature, maxTokens, systemPrompt } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          'customModelSettings.temperature': temperature,
          'customModelSettings.maxTokens': maxTokens,
          'customModelSettings.systemPrompt': systemPrompt
        }
      },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.post('/ai/prompts', async (req, res, next) => {
  try {
    const { name, prompt } = req.body;
    if (!name || !prompt) return res.status(400).json({ error: 'Name and prompt text are required.' });

    const newPrompt = {
      id: crypto.randomBytes(8).toString('hex'),
      name,
      prompt
    };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $push: { savedPrompts: newPrompt } },
      { new: true }
    );

    res.json({ savedPrompts: user.savedPrompts });
  } catch (error) {
    next(error);
  }
});

router.delete('/ai/prompts/:id', async (req, res, next) => {
  try {
    const promptId = req.params.id;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { savedPrompts: { id: promptId } } },
      { new: true }
    );
    res.json({ success: true, savedPrompts: user.savedPrompts });
  } catch (error) {
    next(error);
  }
});

// Data Export
router.get('/export', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const [user, memberRoles, comments, auditLogs] = await Promise.all([
      User.findById(userId),
      ProjectMember.find({ userId }).populate('projectId'),
      Comment.find({ userId }),
      AuditLog.find({ userId })
    ]);

    const projectIds = memberRoles.map(m => m.projectId?._id);
    const projects = memberRoles.map(m => m.projectId).filter(Boolean);
    const tasks = await Task.find({ projectId: { $in: projectIds } });

    const exportData = {
      exportedAt: new Date(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        bio: user.bio,
        headline: user.headline,
        createdAt: user.createdAt,
        techStack: user.techStack,
        skills: user.skills,
        experienceLevel: user.experienceLevel,
        certifications: user.certifications
      },
      projects: projects.map(p => ({
        id: p._id,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt
      })),
      tasks: tasks.map(t => ({
        id: t._id,
        projectId: t.projectId,
        title: t.title,
        description: t.description,
        status: t.status,
        dueDate: t.dueDate,
        createdAt: t.createdAt
      })),
      commentsCount: comments.length,
      auditLogsCount: auditLogs.length
    };

    res.setHeader('Content-disposition', 'attachment; filename=taskforge_user_export.json');
    res.setHeader('Content-type', 'application/json');
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    next(error);
  }
});

// GET /api/settings/activity - Retrieve dynamic timeline of logged-in user's activity
router.get('/activity', async (req, res, next) => {
  try {
    const [user, auditLogs] = await Promise.all([
      User.findById(req.user.id).select('loginActivity'),
      AuditLog.find({ userId: req.user.id })
        .populate('projectId', 'name')
        .populate('taskId', 'title')
        .sort({ createdAt: -1 })
        .limit(30)
    ]);

    const timeline = [];

    // Add login activities
    if (user && user.loginActivity) {
      user.loginActivity.forEach(item => {
        timeline.push({
          id: `login-${item._id || Math.random().toString()}`,
          type: 'LOGIN',
          title: item.success ? 'Logged into System' : 'Failed login attempt',
          timestamp: item.timestamp,
          details: `Device: ${item.browser || 'Unknown Device'} • IP: ${item.ip || '127.0.0.1'}`
        });
      });
    }

    // Add audit logs
    auditLogs.forEach(log => {
      let actionTitle = log.action.replace(/_/g, ' ');
      actionTitle = actionTitle.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

      let detailsStr = '';
      if (log.details) {
        try {
          const parsed = JSON.parse(log.details);
          if (parsed.title) {
            detailsStr = `Task: "${parsed.title}"`;
          } else if (parsed.status) {
            detailsStr = `Task status updated to ${parsed.status.replace(/_/g, ' ')}`;
          } else {
            detailsStr = typeof parsed === 'object' ? JSON.stringify(parsed) : String(parsed);
          }
        } catch (e) {
          detailsStr = log.details;
        }
      }

      if (log.projectId?.name) {
        detailsStr = detailsStr ? `${detailsStr} • Project: ${log.projectId.name}` : `Project: ${log.projectId.name}`;
      }

      timeline.push({
        id: log.id || log._id.toString(),
        type: log.action,
        title: actionTitle,
        timestamp: log.createdAt,
        details: detailsStr || 'TaskForge activity synced'
      });
    });

    // Sort by timestamp descending
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json(timeline.slice(0, 30));
  } catch (error) {
    next(error);
  }
});

// Danger Zone: Delete Account
router.delete('/account', async (req, res, next) => {
  try {
    const userId = req.user.id;

    await Promise.all([
      ProjectMember.deleteMany({ userId }),
      Comment.deleteMany({ userId }),
      AuditLog.deleteMany({ userId }),
      User.findByIdAndDelete(userId)
    ]);

    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

// GET /api/settings/analytics - Retrieve dynamic operational analytics for settings page
router.get('/analytics', async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Projects count
    const projectsCount = await ProjectMember.countDocuments({ userId });

    // 2. Audit logs count
    const auditLogsCount = await AuditLog.countDocuments({ userId });

    // 3. Comments count
    const commentsCount = await Comment.countDocuments({ userId });

    // 4. API Calls estimate
    const loginCount = req.user.loginActivity?.length || 1;
    const apiCalls = (auditLogsCount * 12) + (commentsCount * 6) + (loginCount * 18) + 120;

    // 5. AI Runs
    const aiRuns = req.user.promptHistory?.length || 0;

    // 6. Storage footprint estimate
    const [memberRoles, userComments, userAuditLogs] = await Promise.all([
      ProjectMember.find({ userId }).populate('projectId'),
      Comment.find({ userId }),
      AuditLog.find({ userId })
    ]);
    const projectIds = memberRoles.map(m => m.projectId?._id);
    const userTasks = await Task.find({ projectId: { $in: projectIds } });

    const footprintData = {
      user: {
        name: req.user.name,
        email: req.user.email,
        username: req.user.username,
        techStack: req.user.techStack,
        skills: req.user.skills
      },
      projectsCount: memberRoles.length,
      tasksCount: userTasks.length,
      commentsCount: userComments.length,
      auditLogsCount: userAuditLogs.length
    };

    const sizeInBytes = Buffer.byteLength(JSON.stringify(footprintData));
    const storageKB = (sizeInBytes / 1024).toFixed(2);
    const storageStr = `${storageKB} KB`;

    // 7. Monthly operational traffic (30 days grouped into 4 weeks)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentLogs = await AuditLog.find({
      userId,
      createdAt: { $gte: thirtyDaysAgo }
    }).select('createdAt');

    // Count by week
    const weeks = [0, 0, 0, 0];
    const now = new Date();

    recentLogs.forEach(log => {
      const diffTime = Math.abs(now - new Date(log.createdAt));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) weeks[3]++;
      else if (diffDays <= 14) weeks[2]++;
      else if (diffDays <= 21) weeks[1]++;
      else if (diffDays <= 30) weeks[0]++;
    });

    if (req.user.loginActivity) {
      req.user.loginActivity.forEach(log => {
        const logDate = new Date(log.timestamp);
        if (logDate >= thirtyDaysAgo) {
          const diffTime = Math.abs(now - logDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays <= 7) weeks[3]++;
          else if (diffDays <= 14) weeks[2]++;
          else if (diffDays <= 21) weeks[1]++;
          else if (diffDays <= 30) weeks[0]++;
        }
      });
    }

    const trafficData = [
      { name: 'Week 1', traffic: weeks[0] + 12 },
      { name: 'Week 2', traffic: weeks[1] + 18 },
      { name: 'Week 3', traffic: weeks[2] + 15 },
      { name: 'Week 4', traffic: weeks[3] + 25 }
    ];

    res.json({
      projectsCount,
      apiCalls,
      aiRuns,
      storageStr,
      trafficData
    });
  } catch (error) {
    next(error);
  }
});

const { z } = require('zod');
const validate = require('../middleware/validate');

// OpenRouter AI models for global settings chat (guaranteed 100% free models, prioritized for speed and uptime)
const OPENROUTER_MODELS = [
  'openrouter/free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
];

const callOpenRouterAPI = async (apiKey, model, systemPrompt, userPrompt) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
        'X-Title': 'TaskForge',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const err = await response.text();
      console.error(`OpenRouter settings chat error (${model}, HTTP ${response.status}):`, err);
      throw new Error(`Model ${model} failed with HTTP ${response.status}`);
    }
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const TASKFORGE_KB = `
TaskForge User Guide, Help Documentation & Feature Reference:

1. How to create a project:
   - Go to the "All Projects" dashboard page (/app/dashboard or /app).
   - Click the "New Project" button in the upper right.
   - Enter a Project Name and description, then click "Create Project".
   - Project cards display sequential sequential numbers (e.g. #1, #2) and dynamic member count badges.

2. Project Views & Setup:
   - Navigate into any project from your Dashboard.
   - "Board" Tab (Kanban Board): Displays tasks in TODO, IN_PROGRESS, and DONE columns. You can drag and drop cards to change statuses, or double-click to view task details.
   - "Terminal" Tab (System Log): Shows live logs and audit trails of all actions (task creation, updates, comments) performed in this project.
   - "Stats" Tab (Admin Only): Visualizes project KPIs (Total Tasks, Completion Rate, Average Completion Days, Hours Tracked), project health scores, task status distribution, priority breakdowns, and weekly trends.

3. Task Details & Time Tracker:
   - Double-clicking a task on the Kanban board opens the Task Details modal.
   - It displays the title, description, priority, status, assignee, due date, labels, comments, and attachments.
   - "Time Tracker": Inside the Task Details panel, a built-in stopwatch lets you track time spent on a task. Use the Play/Pause buttons to start or stop the timer, which logs time entries in the task history.

4. AI Standup:
   - What it is: A tool that evaluates a user's cross-project activity over the last 24 hours (completed tasks, current queue, blockers, overdue items) and uses AI to generate a daily standup report.
   - How to use: Click the "AI Standup" button in the left sidebar (visible on pages like "My Tasks" or "Settings") to open the standup modal. Click "Generate Standup Report" to run the analysis.
   - Clickable Tasks: Task titles inside the generated report are rendered as clickable red links. Clicking them closes the modal and navigates you directly to that task's board page, auto-opening the Task Details modal.
   - Options: You can copy the generated report to the clipboard or click "Regenerate" to fetch a fresh report.

5. My Tasks Page:
   - Accessed via "My Tasks" in the left sidebar (/app/my-tasks).
   - Lists all tasks assigned to you across all workspaces. Clicking any task card navigates to the project view and auto-opens that task details modal.

6. Command Palette:
   - Access it by pressing Cmd+K (on macOS) or Ctrl+K (on Windows/Linux) anywhere on the app.
   - Allows you to search tasks, quickly navigate pages, execute commands, or toggle themes.

7. Account Settings (/app/settings):
   - "Basic Profile": Display name, username handle, professional headline, bio, avatar, and cover banner.
   - "Personal Info": Phone number, location, and timezone.
   - "Social & Portfolio": GitHub, LinkedIn, portfolio link, resume, tech stack, experience level, and certifications.
   - "Dashboard Stats": Displays dynamic Operational Analytics (total projects, estimated API calls, AI runs, and storage footprint) and monthly operational traffic graphs.
   - "Preferences": Configure email preferences, push/email notifications, language, theme (switching between Light Mode and Dark Mode), default layout, and profile visibility (public or private).
   - "Security & 2FA": Change your password, set up Two-Factor Authentication (2FA) with a QR code scanner, and monitor or revoke active sessions.
   - "Developer SDK": Generate API keys and configure webhooks.
   - "Workspaces": Manage project workspaces and invite new members by email.
   - "Activity Log": View your personal audit log history.
   - "AI Configuration": Customize your AI credits, Gemini AI model parameters (temperature, max tokens), and system prompts.
   - "Billing & Plan": View active subscription plans (FREE, PRO, ENTERPRISE) and billing history.
   - "Data & Danger Zone": Export your full account data in JSON format, or delete your account completely.

8. AI Task Generator (Analyze & Execute):
   - What it is: A tool that allows project Admins to auto-generate multiple formatted tasks from a single natural language description or prompt.
   - How to use: Go to any project view. If you are an Admin, click the "Analyze & Execute" button in the upper right (next to "New Task"). Enter a prompt describing the tasks you need (e.g. "Create subtasks for setting up auth"), and click to generate. Review the generated list, edit assignees or dates, and click "Deploy Tasks" to instantly create them on the Kanban board.
`;

const chatSchema = z.object({ message: z.string().min(1).max(1000) });

// POST /api/settings/chat - Global user settings/nav assistant chat
router.post('/chat', validate(chatSchema), async (req, res, next) => {
  try {
    const { message } = req.body;

    // Fetch user's projects
    const memberships = await ProjectMember.find({ userId: req.user.id });
    const projectIds = memberships.map(m => m.projectId);
    const projects = await Project.find({ _id: { $in: projectIds } });
    
    let projectsSummary = "Your Projects:\n";
    projects.forEach(p => {
      projectsSummary += `- ${p.name} (ID: ${p.id})\n`;
    });

    // Fetch user's assigned tasks
    const tasks = await Task.find({ assigneeId: req.user.id }).populate('projectId', 'name');
    let tasksSummary = "Your Assigned Tasks:\n";
    tasks.forEach(t => {
      tasksSummary += `- [${t.status}] ${t.title} (Project: ${t.projectId?.name || 'Unknown'}, Priority: ${t.priority}, Due: ${t.dueDate ? t.dueDate.toDateString() : 'None'}, ID: ${t.id})\n`;
    });

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!openRouterApiKey) {
      return res.status(500).json({ error: 'AI features are not configured.' });
    }

    let replyText = '';
    let lastError;
    const systemPrompt = `You are the TaskForge AI Assistant. You help users navigate the platform, answer questions about how to use TaskForge, and provide updates about their projects and tasks.
The user is ${req.user.name}.

Here is the user's active workspace context:
${projectsSummary || 'User is not currently a member of any projects.'}

${tasksSummary || 'No tasks are currently assigned to the user.'}

Here is the general TaskForge Help documentation for navigating/using the app:
${TASKFORGE_KB}

Answer the user's question concisely, naturally, and helpfully in natural language using the provided workspace context and help documentation.`;

    for (const model of OPENROUTER_MODELS) {
      try {
        console.log(`[Settings Chat] Trying model: ${model}`);
        const data = await callOpenRouterAPI(openRouterApiKey, model, systemPrompt, message);
        replyText = data.choices?.[0]?.message?.content || '';
        if (replyText.trim()) {
          console.log(`[Settings Chat] Succeeded with model: ${model}`);
          break;
        } else {
          lastError = new Error('Empty response from model');
        }
      } catch (err) {
        console.error(`[Settings Chat] Model ${model} failed:`, err.message);
        lastError = err;
      }
    }

    if (!replyText.trim()) {
      replyText = `I apologize, but my AI core is currently unresponsive. I am built to help you with projects, setup, settings, and other features of TaskForge. Please try again in a few moments.`;
    } else {
      replyText = replyText.replace(/<\/?(?:assistant|system|user|thought|chat|im_end|assistant_response)>/gi, '').trim();
    }

    res.json({ reply: replyText });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

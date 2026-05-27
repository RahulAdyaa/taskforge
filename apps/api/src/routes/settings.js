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

module.exports = router;

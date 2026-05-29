const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { Project, ProjectMember, Task, User, AuditLog, Label, Comment, TimeEntry } = require('../models');
const authenticate = require('../middleware/authenticate');
const requireProjectRole = require('../middleware/requireProjectRole');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

// OpenRouter AI models (guaranteed 100% free models, prioritized for speed and uptime)
const OPENROUTER_MODELS = [
  'openrouter/free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
];

const callOpenRouterAPI = async (apiKey, model, systemPrompt, userPrompt) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout for models

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
      console.error(`OpenRouter API error (${model}, HTTP ${response.status}):`, err);
      throw new Error(`Model ${model} failed with HTTP ${response.status}`);
    }
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

// GET all projects for user
router.get('/', async (req, res, next) => {
  try {
    const memberships = await ProjectMember.find({ userId: req.user.id }).select('projectId').lean();
    const projectIds = memberships.map(m => m.projectId);
    const projects = await Project.find({ _id: { $in: projectIds } }).lean();
    const allMembers = await ProjectMember.find({ projectId: { $in: projectIds } }).lean();

    const result = projects.map(p => {
      const pObj = {
        id: p._id.toString(),
        name: p.name,
        description: p.description,
        inviteToken: p.inviteToken,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
      pObj.members = allMembers
        .filter(m => m.projectId.toString() === pObj.id)
        .map(m => ({
          id: m._id.toString(),
          role: m.role,
          userId: m.userId.toString(),
          projectId: m.projectId.toString()
        }));
      return pObj;
    });
    res.json(result);
  } catch (error) { next(error); }
});

// POST create project
router.post('/', validate(createProjectSchema), async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const project = await Project.create({ name, description });
    await ProjectMember.create({ userId: req.user.id, projectId: project.id, role: 'ADMIN' });
    res.status(201).json(project);
  } catch (error) { next(error); }
});

// POST join by project ID
const joinProjectSchema = z.object({ projectId: z.string().min(1) });
router.post('/join', validate(joinProjectSchema), async (req, res, next) => {
  try {
    const { projectId } = req.body;
    
    // Support prefix matching (e.g. first 8 characters) or full 24-character ID
    let project;
    if (mongoose.Types.ObjectId.isValid(projectId)) {
      project = await Project.findById(projectId);
    } else {
      project = await Project.findOne({
        $expr: {
          $eq: [
            { $substrCP: [ { $toString: "$_id" }, 0, projectId.length ] },
            projectId.toLowerCase()
          ]
        }
      });
    }

    if (!project) return res.status(404).json({ error: 'Project not found with that ID.' });
    
    const existing = await ProjectMember.findOne({ userId: req.user.id, projectId: project.id });
    if (existing) return res.status(400).json({ error: 'You are already a member of this project.' });
    
    const membership = await ProjectMember.create({ userId: req.user.id, projectId: project.id, role: 'MEMBER' });
    res.status(201).json(membership);
  } catch (error) { next(error); }
});

// POST join by invite token
router.post('/join-invite/:token', async (req, res, next) => {
  try {
    const project = await Project.findOne({ inviteToken: req.params.token });
    if (!project) return res.status(404).json({ error: 'Invalid or expired invite token.' });
    const existing = await ProjectMember.findOne({ userId: req.user.id, projectId: project.id });
    if (existing) return res.status(400).json({ error: 'You are already a member of this project.' });
    const membership = await ProjectMember.create({ userId: req.user.id, projectId: project.id, role: 'MEMBER' });
    res.status(201).json({ project, membership });
  } catch (error) { next(error); }
});

// GET single project with members
router.get('/:id', requireProjectRole(['ADMIN', 'MEMBER']), async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const members = await ProjectMember.find({ projectId: req.params.id }).populate('userId', 'name email').lean();
    const pObj = project.toJSON();
    pObj.members = members.filter(m => m.userId).map(m => ({
      id: m._id.toString(), role: m.role, userId: m.userId._id.toString(), projectId: m.projectId.toString(),
      user: { id: m.userId._id.toString(), name: m.userId.name, email: m.userId.email },
    }));
    res.json(pObj);
  } catch (error) { next(error); }
});

// POST generate invite token
router.post('/:id/invite', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    let inviteToken = project.inviteToken;
    if (!inviteToken) {
      inviteToken = crypto.randomBytes(16).toString('hex');
      await Project.findByIdAndUpdate(req.params.id, { inviteToken });
    }
    res.json({ inviteToken });
  } catch (error) { next(error); }
});

// GET dashboard stats (also mounted via parent)
router.get('/:id/dashboard', requireProjectRole(['ADMIN', 'MEMBER']), async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const tasks = await Task.find({ projectId }).populate('assigneeId', 'name email');
    const timeEntries = await TimeEntry.find({ 
      taskId: { $in: tasks.map(t => t._id) },
      endTime: { $ne: null }
    }).populate('userId', 'name');

    const totalTasks = tasks.length;
    const now = new Date();

    // --- Status breakdown ---
    const byStatus = {
      TODO: tasks.filter(t => t.status === 'TODO').length,
      IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      DONE: tasks.filter(t => t.status === 'DONE').length,
    };

    // --- Priority breakdown ---
    const byPriority = {
      LOW: tasks.filter(t => t.priority === 'LOW').length,
      MEDIUM: tasks.filter(t => t.priority === 'MEDIUM').length,
      HIGH: tasks.filter(t => t.priority === 'HIGH').length,
      URGENT: tasks.filter(t => t.priority === 'URGENT').length,
    };

    // --- Overdue ---
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE').length;

    // --- Completion rate ---
    const completionRate = totalTasks > 0 ? Math.round((byStatus.DONE / totalTasks) * 100) : 0;

    // --- Average completion time (days) ---
    const completedTasks = tasks.filter(t => t.status === 'DONE' && t.updatedAt && t.createdAt);
    let avgCompletionDays = 0;
    if (completedTasks.length > 0) {
      const totalDays = completedTasks.reduce((sum, t) => {
        const diff = (new Date(t.updatedAt) - new Date(t.createdAt)) / (1000 * 60 * 60 * 24);
        return sum + diff;
      }, 0);
      avgCompletionDays = Math.round((totalDays / completedTasks.length) * 10) / 10;
    }

    // --- Total time tracked (hours) ---
    let totalTrackedMs = 0;
    timeEntries.forEach(te => {
      if (te.startTime && te.endTime) {
        totalTrackedMs += new Date(te.endTime) - new Date(te.startTime);
      }
    });
    const totalTrackedHours = Math.round((totalTrackedMs / (1000 * 60 * 60)) * 10) / 10;

    // --- Per-member KPI ---
    const memberMap = {};
    tasks.forEach(t => {
      const name = t.assigneeId ? t.assigneeId.name : 'Unassigned';
      const id = t.assigneeId ? t.assigneeId._id.toString() : 'unassigned';
      if (!memberMap[id]) {
        memberMap[id] = { name, total: 0, done: 0, overdue: 0, trackedMs: 0 };
      }
      memberMap[id].total++;
      if (t.status === 'DONE') memberMap[id].done++;
      if (t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE') memberMap[id].overdue++;
    });
    // Add time tracking per member
    timeEntries.forEach(te => {
      if (te.userId && te.startTime && te.endTime) {
        const id = te.userId._id.toString();
        if (memberMap[id]) {
          memberMap[id].trackedMs += new Date(te.endTime) - new Date(te.startTime);
        }
      }
    });
    const byUser = Object.values(memberMap).map(m => ({
      name: m.name,
      taskCount: m.total,
      completed: m.done,
      overdue: m.overdue,
      completionRate: m.total > 0 ? Math.round((m.done / m.total) * 100) : 0,
      hoursTracked: Math.round((m.trackedMs / (1000 * 60 * 60)) * 10) / 10,
    }));

    // --- Weekly trend (last 8 weeks) ---
    const weeklyTrend = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const created = tasks.filter(t => {
        const d = new Date(t.createdAt);
        return d >= weekStart && d < weekEnd;
      }).length;

      const completed = tasks.filter(t => {
        if (t.status !== 'DONE' || !t.updatedAt) return false;
        const d = new Date(t.updatedAt);
        return d >= weekStart && d < weekEnd;
      }).length;

      const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      weeklyTrend.push({ week: label, created, completed });
    }

    res.json({
      totalTasks,
      byStatus,
      byPriority,
      byUser,
      overdue,
      completionRate,
      avgCompletionDays,
      totalTrackedHours,
      weeklyTrend,
    });
  } catch (error) { next(error); }
});

// DELETE project (cascade)
router.delete('/:id', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const taskIds = (await Task.find({ projectId }).select('_id')).map(t => t._id);

    // Broadcast project deletion to all members before database deletion
    req.emitEvent(`project_${projectId}`, 'project_deleted', { projectId });

    await Promise.all([
      AuditLog.deleteMany({ projectId }),
      Label.deleteMany({ projectId }),
      ProjectMember.deleteMany({ projectId }),
    ]);
    if (taskIds.length > 0) {
      await Promise.all([
        Comment.deleteMany({ taskId: { $in: taskIds } }),
        TimeEntry.deleteMany({ taskId: { $in: taskIds } }),
      ]);
    }
    await Task.deleteMany({ projectId });
    await Project.findByIdAndDelete(projectId);
    res.status(204).send();
  } catch (error) { next(error); }
});

// POST add member
const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});
router.post('/:id/members', requireProjectRole(['ADMIN']), validate(addMemberSchema), async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const membership = await ProjectMember.create({ userId: user.id, projectId: req.params.id, role });
    res.status(201).json(membership);
  } catch (error) { next(error); }
});

// DELETE remove member
router.delete('/:id/members/:userId', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    const result = await ProjectMember.findOneAndDelete({ userId: req.params.userId, projectId: req.params.id });
    if (!result) return res.status(404).json({ error: 'Member not found' });
    res.status(204).send();
  } catch (error) { next(error); }
});

// GET audit logs
router.get('/:id/logs', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ projectId: req.params.id })
      .sort({ createdAt: -1 }).limit(50).populate('userId', 'name email').lean();
    const result = logs.filter(l => l.userId).map(l => {
      const obj = {
        id: l._id.toString(),
        action: l.action,
        details: l.details,
        projectId: l.projectId.toString(),
        taskId: l.taskId?.toString() || null,
        createdAt: l.createdAt,
        user: { name: l.userId.name, email: l.userId.email },
        userId: l.userId._id.toString(),
      };
      return obj;
    });
    res.json(result);
  } catch (error) { next(error); }
});

// Labels
const createLabelSchema = z.object({
  name: z.string().min(1).max(30),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#E8E4DD'),
});
router.get('/:id/labels', requireProjectRole(['ADMIN', 'MEMBER']), async (req, res, next) => {
  try {
    const labels = await Label.find({ projectId: req.params.id }).sort({ name: 1 });
    res.json(labels);
  } catch (error) { next(error); }
});
router.post('/:id/labels', requireProjectRole(['ADMIN']), validate(createLabelSchema), async (req, res, next) => {
  try {
    const { name, color } = req.body;
    const existing = await Label.findOne({ name, projectId: req.params.id });
    if (existing) return res.status(400).json({ error: 'Label with this name already exists' });
    const label = await Label.create({ name, color, projectId: req.params.id });
    res.status(201).json(label);
  } catch (error) { next(error); }
});

// Chat
const chatSchema = z.object({ message: z.string().min(1).max(1000) });
router.post('/:id/chat', requireProjectRole(['ADMIN', 'MEMBER']), validate(chatSchema), async (req, res, next) => {
  try {
    const { message } = req.body;

    // Fetch project details
    const project = await Project.findById(req.params.id);
    const projectName = project ? project.name : 'Unknown';
    const projectDesc = project ? (project.description || 'No description provided') : 'No description';

    // Fetch tasks in this project
    const tasks = await Task.find({ projectId: req.params.id })
      .populate('assigneeId', 'name email')
      .sort({ createdAt: -1 });

    // Count statistics and build summary
    const stats = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
    let tasksListSummary = "";
    tasks.forEach(t => {
      if (stats[t.status] !== undefined) {
        stats[t.status]++;
      }
      tasksListSummary += `- [${t.status}] ${t.title} (Priority: ${t.priority}, Assignee: ${t.assigneeId?.name || 'Unassigned'}, Due: ${t.dueDate ? t.dueDate.toDateString() : 'None'}, ID: ${t.id})\n`;
    });

    let summary = `Project Name: ${projectName}\n`;
    summary += `Project Description: ${projectDesc}\n\n`;
    summary += `Project Status Counts:\n`;
    summary += `- TODO: ${stats.TODO} tasks\n`;
    summary += `- IN_PROGRESS: ${stats.IN_PROGRESS} tasks\n`;
    summary += `- DONE: ${stats.DONE} tasks\n\n`;
    summary += `Detailed Task List:\n${tasksListSummary || 'No tasks found.'}\n`;

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!openRouterApiKey) {
      return res.status(500).json({ error: 'AI features are not configured.' });
    }

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
`;

    let replyText = '';
    let lastError;
    const systemPrompt = `You are the TaskForge AI Assistant. You help users manage their projects and navigate the platform.
The user is ${req.user.name}.
Here is the current project status context:
${summary}

Here is the general TaskForge Help documentation for navigating/using the app:
${TASKFORGE_KB}

Answer the user's question concisely, naturally, and helpfully in natural language using the provided documentation.`;

    for (const model of OPENROUTER_MODELS) {
      try {
        console.log(`[Project Chat] Trying model: ${model}`);
        const data = await callOpenRouterAPI(openRouterApiKey, model, systemPrompt, message);
        replyText = data.choices?.[0]?.message?.content || '';
        if (replyText.trim()) {
          console.log(`[Project Chat] Succeeded with model: ${model}`);
          break;
        } else {
          lastError = new Error('Empty response from model');
        }
      } catch (err) {
        console.error(`[Project Chat] Model ${model} failed:`, err.message);
        lastError = err;
      }
    }

    if (!replyText.trim()) {
      replyText = `I apologize, but my AI core is currently unresponsive. Here is a quick status summary of this workspace:\n\n${summary}`;
    } else {
      replyText = replyText.replace(/<\/?(?:assistant|system|user|thought|chat|im_end|assistant_response)>/gi, '').trim();
    }

    res.json({ reply: replyText });
  } catch (error) { next(error); }
});

module.exports = router;

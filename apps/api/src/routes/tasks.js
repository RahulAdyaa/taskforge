const express = require('express');
const { z } = require('zod');
const { Task, AuditLog, Notification, Comment } = require('../models');
const authenticate = require('../middleware/authenticate');
const requireProjectRole = require('../middleware/requireProjectRole');
const validate = require('../middleware/validate');

const router = express.Router({ mergeParams: true });
router.use(authenticate);
router.use(requireProjectRole(['ADMIN', 'MEMBER']));

// GET all tasks for project
router.get('/', async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const membership = req.projectMembership;
    const filter = { projectId };
    if (membership.role !== 'ADMIN') {
      filter.$or = [
        { assigneeId: req.user.id },
        { creatorId: req.user.id }
      ];
    }

    const tasks = await Task.find(filter)
      .populate('assigneeId', 'name email')
      .populate('creatorId', 'name email')
      .populate('blockedBy', 'status')
      .populate('labels')
      .lean();

    // Transform populated refs to match frontend shape
    const result = tasks.map(t => {
      const obj = {
        id: t._id.toString(),
        title: t.title,
        description: t.description,
        dueDate: t.dueDate,
        priority: t.priority,
        status: t.status,
        projectId: t.projectId?.toString(),
        assigneeId: t.assigneeId?._id?.toString() || t.assigneeId?.toString() || null,
        creatorId: t.creatorId?._id?.toString() || t.creatorId?.toString(),
        deadlineNotificationStatus: t.deadlineNotificationStatus,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        labels: (t.labels || []).map(l => ({ id: l._id?.toString() || l.id, name: l.name, color: l.color, projectId: l.projectId?.toString() })),
        blockedBy: (t.blockedBy || []).map(b => ({ id: b._id?.toString() || b.id, status: b.status }))
      };
      obj.assignee = t.assigneeId && typeof t.assigneeId === 'object' && t.assigneeId.name
        ? { id: t.assigneeId._id?.toString() || t.assigneeId.id, name: t.assigneeId.name, email: t.assigneeId.email } : null;
      obj.creator = t.creatorId && typeof t.creatorId === 'object' && t.creatorId.name
        ? { id: t.creatorId._id?.toString() || t.creatorId.id, name: t.creatorId.name, email: t.creatorId.email } : null;
      return obj;
    });
    res.json(result);
  } catch (error) { next(error); }
});

const createTaskSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assigneeId: z.string().optional().nullable(),
  labelIds: z.array(z.string()).optional(),
});

const aiGenerateSchema = z.object({
  prompt: z.string().min(5).max(500),
  tasks: z.array(z.object({
    title: z.string().min(1).max(120),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    assigneeId: z.string().optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
  })).optional(),
});

// OpenRouter AI models (100% free models, prioritized for speed and stability)
const OPENROUTER_MODELS = [
  'openrouter/free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'qwen/qwen-2.5-coder-32b-instruct:free',
  'google/gemma-2-9b-it:free',
];

const callOpenRouterAPI = async (apiKey, model, systemPrompt, prompt) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout for free models

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
          { role: 'user', content: `User objective: "${prompt}"` },
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

const generateSubtasksWithAI = async (prompt) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  const systemPrompt = `You are a project management AI. Given a user's objective, break it down into actionable subtasks. Use your judgment to decide how many subtasks are necessary to fully cover the objective (typically between 3 to 15 subtasks depending on the complexity of the objective).

Rules:
- Each task must be specific, actionable, and clear
- Assign priority: URGENT, HIGH, MEDIUM, or LOW
- Return ONLY valid JSON array, no markdown, no explanation
- Format: [{"title": "task description", "priority": "HIGH"}, ...]

Example input: "Build a user authentication system"
Example output: [{"title":"Design database schema for users table with email, password hash, and roles","priority":"HIGH"},{"title":"Implement bcrypt password hashing and JWT token generation","priority":"URGENT"},{"title":"Create REST API endpoints for signup, login, and logout","priority":"HIGH"},{"title":"Build React login and signup forms with client-side validation","priority":"MEDIUM"},{"title":"Add forgot password flow with email verification","priority":"LOW"}]`;

  let lastError;
  for (const model of OPENROUTER_MODELS) {
    try {
      console.log(`Trying OpenRouter model: ${model}`);
      const data = await callOpenRouterAPI(apiKey, model, systemPrompt, prompt);
      const text = data.choices?.[0]?.message?.content || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) { lastError = new Error('Could not parse AI response'); continue; }
      const tasks = JSON.parse(jsonMatch[0]);
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      console.log(`AI generation succeeded with model: ${model}`);
      return tasks
        .filter(t => t.title && typeof t.title === 'string')
        .map(t => ({ title: t.title.substring(0, 120), priority: validPriorities.includes(t.priority) ? t.priority : 'MEDIUM' }))
        .slice(0, 20);
    } catch (err) {
      console.error(`Model ${model} failed:`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error('All OpenRouter models failed');
};

const fallbackVoiceParser = (transcript, tasks, members, now = new Date()) => {
  const text = (transcript || '').toLowerCase();
  const updates = [];
  const numberWords = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  
  (tasks || []).forEach((task, idx) => {
    const taskNum = idx + 1;
    const wordNum = numberWords[idx] || `task ${taskNum}`;
    
    const isTargeted = text.includes(wordNum) || text.includes(`task ${taskNum}`) || text.includes(`item ${taskNum}`) || (tasks.length === 1);
    
    let assigneeId = task.assigneeId || null;
    let dueDate = task.dueDate || null;
    let priority = task.priority || 'MEDIUM';

    (members || []).forEach(m => {
      const userObj = m.user || m;
      const nameParts = (userObj.name || '').toLowerCase().split(' ');
      if (nameParts.some(part => part.length > 2 && text.includes(part))) {
        if (isTargeted || (tasks.length <= 3 && !text.includes('first') && !text.includes('second'))) {
          assigneeId = userObj.id || userObj._id?.toString();
        }
      }
    });

    if (isTargeted || tasks.length === 1) {
      if (text.includes('urgent')) priority = 'URGENT';
      else if (text.includes('high')) priority = 'HIGH';
      else if (text.includes('medium')) priority = 'MEDIUM';
      else if (text.includes('low')) priority = 'LOW';

      if (text.includes('tomorrow')) {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        if (text.includes('5pm') || text.includes('5 pm')) d.setHours(17, 0, 0, 0);
        else if (text.includes('9am') || text.includes('9 am')) d.setHours(9, 0, 0, 0);
        else d.setHours(18, 0, 0, 0);
        dueDate = d.toISOString();
      } else if (text.includes('today')) {
        const d = new Date(now);
        if (text.includes('5pm') || text.includes('5 pm')) d.setHours(17, 0, 0, 0);
        else d.setHours(18, 0, 0, 0);
        dueDate = d.toISOString();
      } else if (text.includes('next week') || text.includes('next monday')) {
        const d = new Date(now);
        d.setDate(d.getDate() + 7);
        dueDate = d.toISOString();
      }
    }

    updates.push({
      _id: task._id !== undefined ? task._id : idx,
      assigneeId,
      dueDate,
      priority,
      enabled: true
    });
  });

  return updates;
};

const parseVoiceCommandsWithAI = async (transcript, tasks, members) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const now = new Date();
  const dateContext = `Current Time: ${now.toISOString()} (${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})`;

  const memberListForPrompt = (members || []).map(m => {
    const userObj = m.user || m;
    return { id: userObj.id || userObj._id?.toString(), name: userObj.name, email: userObj.email };
  });

  const taskListForPrompt = (tasks || []).map((t, idx) => ({
    _id: t._id !== undefined ? t._id : idx,
    index: idx + 1,
    title: t.title,
    currentPriority: t.priority || 'MEDIUM',
    currentAssigneeId: t.assigneeId || null,
    currentDueDate: t.dueDate || null,
  }));

  const systemPrompt = `You are an AI Voice Command Assistant for task management.
${dateContext}

The user is speaking natural language commands to update/assign tasks in a project breakdown modal.

Tasks currently listed:
${JSON.stringify(taskListForPrompt, null, 2)}

Available project team members:
${JSON.stringify(memberListForPrompt, null, 2)}

INSTRUCTIONS:
1. Parse the voice transcript and identify instructions for each task (e.g., "First task...", "Task 2...", "Task assigned to Rahul", "deadline tomorrow 5pm", "priority urgent").
2. Match spoken member names (e.g. "Rahul", "Sarah") to the exact member "id" from the list above. If unassigned or not mentioned, preserve or set null.
3. Convert relative dates (e.g., "tomorrow", "tomorrow 5pm", "next Monday", "in 3 days", "next Friday at 10am") into ISO 8601 strings (e.g. "2026-07-30T17:00:00.000Z") based on Current Time.
4. Priority must be one of: "LOW", "MEDIUM", "HIGH", "URGENT".
5. Return ONLY a valid JSON array of updated tasks in this exact structure:
[
  {
    "_id": 0,
    "assigneeId": "member_id_or_null",
    "dueDate": "ISO_string_or_null",
    "priority": "HIGH",
    "enabled": true
  }
]

Do NOT include markdown wrapping or explanation. Return raw JSON array only.`;

  if (apiKey) {
    for (const model of OPENROUTER_MODELS) {
      try {
        console.log(`Trying OpenRouter model for voice command parsing: ${model}`);
        const data = await callOpenRouterAPI(apiKey, model, systemPrompt, transcript);
        const text = data.choices?.[0]?.message?.content || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const updates = JSON.parse(jsonMatch[0]);
          return updates;
        }
      } catch (err) {
        console.error(`Model ${model} for voice parsing failed:`, err.message);
      }
    }
  }

  // Fallback parser if API call fails or key is missing
  return fallbackVoiceParser(transcript, tasks, members, now);
};

// AI preview
router.post('/ai-preview', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (!prompt || prompt.length < 5) return res.status(400).json({ error: 'Prompt must be at least 5 characters' });
    const generatedTasks = await generateSubtasksWithAI(prompt);
    res.json({ tasks: generatedTasks });
  } catch (error) { next(error); }
});

// AI Voice Command Parser
router.post('/ai-voice-parse', requireProjectRole(['ADMIN', 'MEMBER']), async (req, res, next) => {
  try {
    const { transcript, tasks, members } = req.body;
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Transcript string is required' });
    }
    const updates = await parseVoiceCommandsWithAI(transcript, tasks, members);
    res.json({ updates });
  } catch (error) { next(error); }
});

// AI generate + create tasks
router.post('/ai-generate', requireProjectRole(['ADMIN']), validate(aiGenerateSchema), async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const { prompt, tasks: taskOverrides } = req.body;
    let tasksToCreate = taskOverrides?.length > 0 ? taskOverrides : await generateSubtasksWithAI(prompt);

    const createdTasks = [];
    for (const taskData of tasksToCreate) {
      const task = await Task.create({
        title: taskData.title,
        description: `AI-generated for: "${prompt}"`,
        priority: taskData.priority || 'MEDIUM',
        status: 'TODO',
        projectId,
        creatorId: req.user.id,
        assigneeId: taskData.assigneeId || null,
        dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
      });
      const populated = await Task.findById(task.id).populate('assigneeId', 'name email');
      const obj = populated.toJSON();
      obj.assignee = populated.assigneeId && typeof populated.assigneeId === 'object' && populated.assigneeId.name
        ? { id: populated.assigneeId._id?.toString() || populated.assigneeId.id, name: populated.assigneeId.name, email: populated.assigneeId.email } : null;
      obj.assigneeId = populated.assigneeId?._id?.toString() || populated.assigneeId?.toString() || null;
      createdTasks.push(obj);

      req.emitEvent(`project_${projectId}`, 'task_created', obj);

      await AuditLog.create({
        action: 'TASK_CREATED_BY_AI',
        details: JSON.stringify({ title: task.title }),
        projectId, userId: req.user.id, taskId: task.id,
      });

      if (taskData.assigneeId && taskData.assigneeId !== req.user.id) {
        try {
          const notification = await Notification.create({
            userId: taskData.assigneeId, type: 'TASK_ASSIGNED',
            message: `AI assigned you to "${task.title}"`, link: `/app/projects/${projectId}?task=${task.id}`,
          });
          req.emitEvent(`user_${taskData.assigneeId}`, 'new_notification', notification);
        } catch (e) { console.error('Failed to send AI assignment notification:', e); }
      }
    }
    res.status(201).json({ message: 'Tasks generated successfully', tasks: createdTasks });
  } catch (error) { next(error); }
});

// POST create task
router.post('/', requireProjectRole(['ADMIN', 'MEMBER']), validate(createTaskSchema), async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const { title, description, dueDate, priority, assigneeId, labelIds } = req.body;

    const trimmedTitle = title.trim();
    const existingTask = await Task.findOne({
      projectId,
      title: { $regex: new RegExp(`^${trimmedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existingTask) {
      return res.status(400).json({ error: 'A task with this title already exists in this project' });
    }

    const task = await Task.create({
      title: trimmedTitle, description, dueDate, priority, status: 'TODO',
      projectId, assigneeId, creatorId: req.user.id,
      labels: labelIds || [],
    });
    const populated = await Task.findById(task.id).populate('assigneeId', 'name email').populate('labels');
    const obj = populated.toJSON();
    obj.assignee = populated.assigneeId && typeof populated.assigneeId === 'object' && populated.assigneeId.name
      ? { id: populated.assigneeId._id?.toString() || populated.assigneeId.id, name: populated.assigneeId.name, email: populated.assigneeId.email } : null;
    obj.assigneeId = populated.assigneeId?._id?.toString() || populated.assigneeId?.toString() || null;

    req.emitEvent(`project_${projectId}`, 'task_created', obj);

    if (task.assigneeId && task.assigneeId.toString() !== req.user.id) {
      const notification = await Notification.create({
        userId: task.assigneeId, type: 'TASK_ASSIGNED',
        message: `You were assigned a new task: ${task.title}`, link: `/app/projects/${projectId}?task=${task.id}`,
      });
      req.emitEvent(`user_${task.assigneeId}`, 'notification', notification);
    }

    await AuditLog.create({
      action: 'TASK_CREATED', details: JSON.stringify({ title }),
      projectId, userId: req.user.id, taskId: task.id,
    });
    res.status(201).json(obj);
  } catch (error) { next(error); }
});

// GET single task
router.get('/:taskId', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId)
      .populate('assigneeId', 'name email')
      .populate('creatorId', 'name email')
      .populate('blockedBy', 'title status')
      .populate('labels')
      .lean();
    if (!task || task.projectId.toString() !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const isAssignee = task.assigneeId?._id?.toString() === req.user.id || task.assigneeId?.toString() === req.user.id;
    const isCreator = task.creatorId?._id?.toString() === req.user.id || task.creatorId?.toString() === req.user.id;
    if (req.projectMembership.role !== 'ADMIN' && !isAssignee && !isCreator) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this task' });
    }
    const obj = {
      id: task._id.toString(),
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.status,
      projectId: task.projectId?.toString(),
      assigneeId: task.assigneeId?._id?.toString() || task.assigneeId?.toString() || null,
      creatorId: task.creatorId?._id?.toString() || task.creatorId?.toString(),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      labels: (task.labels || []).map(l => ({ id: l._id?.toString() || l.id, name: l.name, color: l.color, projectId: l.projectId?.toString() })),
      blockedBy: (task.blockedBy || []).map(b => ({ id: b._id?.toString() || b.id, title: b.title, status: b.status }))
    };
    obj.assignee = task.assigneeId && typeof task.assigneeId === 'object' && task.assigneeId.name
      ? { id: task.assigneeId._id?.toString() || task.assigneeId.id, name: task.assigneeId.name, email: task.assigneeId.email } : null;
    obj.creator = task.creatorId && typeof task.creatorId === 'object' && task.creatorId.name
      ? { id: task.creatorId._id?.toString() || task.creatorId.id, name: task.creatorId.name, email: task.creatorId.email } : null;
    res.json(obj);
  } catch (error) { next(error); }
});

// PATCH update task
const updateTaskSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  assigneeId: z.string().optional().nullable(),
  labelIds: z.array(z.string()).optional(),
});

router.patch('/:taskId', validate(updateTaskSchema), async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task || task.projectId.toString() !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const isMember = req.projectMembership.role === 'ADMIN' || req.projectMembership.role === 'MEMBER';
    if (!isMember) return res.status(403).json({ error: 'Forbidden' });

    const { labelIds, ...rest } = req.body;
    let updateData = rest;
    if (labelIds !== undefined) updateData.labels = labelIds;
    if (req.body.dueDate !== undefined) {
      updateData.deadlineNotificationStatus = 'NONE';
    }

    if (updateData.title) {
      const trimmedTitle = updateData.title.trim();
      const duplicate = await Task.findOne({
        _id: { $ne: req.params.taskId },
        projectId: req.params.projectId,
        title: { $regex: new RegExp(`^${trimmedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      if (duplicate) {
        return res.status(400).json({ error: 'A task with this title already exists in this project' });
      }
      updateData.title = trimmedTitle;
    }

    // Check dependency blockers
    if (updateData.status === 'DONE') {
      const taskWithBlockers = await Task.findById(req.params.taskId).populate('blockedBy');
      const incomplete = taskWithBlockers.blockedBy.filter(t => t.status !== 'DONE');
      if (incomplete.length > 0) {
        return res.status(400).json({ error: 'Cannot complete task. It is blocked by incomplete dependencies.', incompleteBlockers: incomplete });
      }
    }

    const updatedTask = await Task.findByIdAndUpdate(req.params.taskId, updateData, { new: true })
      .populate('assigneeId', 'name email').populate('labels');
    const obj = updatedTask.toJSON();
    obj.assignee = updatedTask.assigneeId && typeof updatedTask.assigneeId === 'object' && updatedTask.assigneeId.name
      ? { id: updatedTask.assigneeId._id?.toString() || updatedTask.assigneeId.id, name: updatedTask.assigneeId.name, email: updatedTask.assigneeId.email } : null;
    obj.assigneeId = updatedTask.assigneeId?._id?.toString() || updatedTask.assigneeId?.toString() || null;

    req.emitEvent(`project_${req.params.projectId}`, 'task_updated', obj);

    // Notify creator if completed by someone else
    if (task.status !== 'DONE' && updatedTask.status === 'DONE' && updatedTask.creatorId.toString() !== req.user.id) {
      const notification = await Notification.create({
        userId: updatedTask.creatorId, type: 'TASK_COMPLETED',
        message: `Task completed: ${updatedTask.title}`, link: `/app/projects/${req.params.projectId}?task=${updatedTask.id}`,
      });
      req.emitEvent(`user_${updatedTask.creatorId}`, 'notification', notification);
    }
    // Notify assignee if reassigned
    if (updatedTask.assigneeId && updatedTask.assigneeId.toString() !== task.assigneeId?.toString() && updatedTask.assigneeId.toString() !== req.user.id) {
      const notification = await Notification.create({
        userId: updatedTask.assigneeId, type: 'TASK_ASSIGNED',
        message: `You were assigned a task: ${updatedTask.title}`, link: `/app/projects/${req.params.projectId}?task=${updatedTask.id}`,
      });
      req.emitEvent(`user_${updatedTask.assigneeId}`, 'notification', notification);
    }

    await AuditLog.create({
      action: 'TASK_UPDATED', details: JSON.stringify(updateData),
      projectId: req.params.projectId, userId: req.user.id, taskId: task.id,
    });
    res.json(obj);
  } catch (error) { next(error); }
});

// DELETE task
router.delete('/:taskId', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task || task.projectId.toString() !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    await Task.findByIdAndDelete(req.params.taskId);
    res.status(204).send();
  } catch (error) { next(error); }
});

// POST add blocker
router.post('/:taskId/blockers', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    const { blockerId } = req.body;
    const task = await Task.findByIdAndUpdate(
      req.params.taskId,
      { $addToSet: { blockedBy: blockerId } },
      { new: true }
    ).populate('blockedBy');
    req.emitEvent(`project_${req.params.projectId}`, 'task_updated', task);
    res.json(task);
  } catch (error) { next(error); }
});

// DELETE remove blocker
router.delete('/:taskId/blockers/:blockerId', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.taskId,
      { $pull: { blockedBy: req.params.blockerId } },
      { new: true }
    ).populate('blockedBy');
    req.emitEvent(`project_${req.params.projectId}`, 'task_updated', task);
    res.json(task);
  } catch (error) { next(error); }
});

// GET activity timeline
router.get('/:taskId/activity', async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ taskId: req.params.taskId })
      .populate('userId', 'name')
      .sort({ createdAt: -1 }).limit(30);
    const result = logs.map(l => {
      const obj = l.toJSON();
      obj.user = { id: l.userId._id.toString(), name: l.userId.name };
      obj.userId = l.userId._id.toString();
      return obj;
    });
    res.json(result);
  } catch (error) { next(error); }
});

// Comments
const commentSchema = z.object({ content: z.string().min(1).max(5000) });

router.get('/:taskId/comments', async (req, res, next) => {
  try {
    const comments = await Comment.find({ taskId: req.params.taskId })
      .populate('userId', 'name email').sort({ createdAt: 1 });
    const result = comments.map(c => {
      const obj = c.toJSON();
      obj.user = { id: c.userId._id.toString(), name: c.userId.name, email: c.userId.email };
      obj.userId = c.userId._id.toString();
      return obj;
    });
    res.json(result);
  } catch (error) { next(error); }
});

router.post('/:taskId/comments', validate(commentSchema), async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task || task.projectId.toString() !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const comment = await Comment.create({
      content: req.body.content, taskId: req.params.taskId, userId: req.user.id,
    });
    const populated = await Comment.findById(comment.id).populate('userId', 'name email');
    const obj = populated.toJSON();
    obj.user = { id: populated.userId._id.toString(), name: populated.userId.name, email: populated.userId.email };
    obj.userId = populated.userId._id.toString();

    req.emitEvent(`project_${req.params.projectId}`, 'task_updated', task);
    req.emitEvent(`project_${req.params.projectId}`, 'comment_added', { taskId: req.params.taskId, comment: obj });

    await AuditLog.create({
      action: 'COMMENT_ADDED', details: JSON.stringify({ taskId: task.id }),
      projectId: req.params.projectId, userId: req.user.id, taskId: task.id,
    });
    res.status(201).json(obj);
  } catch (error) { next(error); }
});

// PATCH edit comment
router.patch('/:taskId/comments/:commentId', validate(commentSchema), async (req, res, next) => {
  try {
    const { taskId, commentId } = req.params;
    const comment = await Comment.findById(commentId);
    if (!comment || comment.taskId.toString() !== taskId) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    if (comment.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only edit your own comments' });
    }

    comment.content = req.body.content;
    comment.isEdited = true;
    await comment.save();

    const populated = await Comment.findById(comment.id).populate('userId', 'name email');
    const obj = populated.toJSON();
    obj.user = { id: populated.userId._id.toString(), name: populated.userId.name, email: populated.userId.email };
    obj.userId = populated.userId._id.toString();

    // Broadcast update
    req.emitEvent(`thread_${taskId}`, 'comment_updated', { taskId, comment: obj });
    req.emitEvent(`project_${req.params.projectId}`, 'comment_updated', { taskId, comment: obj });

    await AuditLog.create({
      action: 'COMMENT_EDITED',
      details: JSON.stringify({ taskId, commentId }),
      projectId: req.params.projectId,
      userId: req.user.id,
      taskId,
    });

    res.json(obj);
  } catch (error) { next(error); }
});

// DELETE comment
router.delete('/:taskId/comments/:commentId', async (req, res, next) => {
  try {
    const { taskId, commentId } = req.params;
    const comment = await Comment.findById(commentId);
    if (!comment || comment.taskId.toString() !== taskId) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const isAdmin = req.projectMembership.role === 'ADMIN';
    if (comment.userId.toString() !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own comments unless you are an admin' });
    }

    await Comment.findByIdAndDelete(commentId);

    // Broadcast deletion
    req.emitEvent(`thread_${taskId}`, 'comment_deleted', { taskId, commentId });
    req.emitEvent(`project_${req.params.projectId}`, 'comment_deleted', { taskId, commentId });

    await AuditLog.create({
      action: 'COMMENT_DELETED',
      details: JSON.stringify({ taskId, commentId }),
      projectId: req.params.projectId,
      userId: req.user.id,
      taskId,
    });

    res.status(204).send();
  } catch (error) { next(error); }
});

// Mount time tracking sub-router
const timeEntriesRoutes = require('./time-entries');
router.use('/:taskId/time-entries', timeEntriesRoutes);

module.exports = router;

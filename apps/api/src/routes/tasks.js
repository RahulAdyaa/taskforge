const express = require('express');
const { z } = require('zod');
const { Task, AuditLog, Notification, Comment } = require('../models');
const authenticate = require('../middleware/authenticate');
const requireProjectRole = require('../middleware/requireProjectRole');
const validate = require('../middleware/validate');

const { getDagDecompositionPrompt } = require('../config/prompts');

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
      .populate('blockedBy', 'title status assigneeId')
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
        estimatedHours: t.estimatedHours || 2,
        autoTriageReason: t.autoTriageReason || null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        labels: (t.labels || []).map(l => ({ id: l._id?.toString() || l.id, name: l.name, color: l.color, projectId: l.projectId?.toString() })),
        blockedBy: (t.blockedBy || []).map(b => ({ id: b._id?.toString() || b.id, title: b.title || 'Untitled Task', status: b.status, assigneeId: b.assigneeId?.toString() || null })),
        attachments: (t.attachments || []).map(a => ({ id: a._id?.toString() || a.id, filename: a.filename, fileUrl: a.fileUrl, fileType: a.fileType, fileSize: a.fileSize, uploadedAt: a.uploadedAt }))
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
  estimatedHours: z.number().min(0.5).max(100).optional(),
  blockedByIds: z.array(z.string()).optional(),
});

const aiGenerateSchema = z.object({
  prompt: z.string().min(5).max(500),
  tasks: z.array(z.object({
    title: z.string().min(1).max(120),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    assigneeId: z.string().optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
    estimatedHours: z.number().optional(),
    dependsOnIndices: z.array(z.number()).optional(),
    blockedByIds: z.array(z.string()).optional(),
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

  const systemPrompt = getDagDecompositionPrompt();

  let lastError;
  for (const model of OPENROUTER_MODELS) {
    try {
      console.log(`Trying OpenRouter model for DAG breakdown: ${model}`);
      const data = await callOpenRouterAPI(apiKey, model, systemPrompt, prompt);
      const text = data.choices?.[0]?.message?.content || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) { lastError = new Error('Could not parse AI response'); continue; }
      const tasks = JSON.parse(jsonMatch[0]);
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      console.log(`AI DAG generation succeeded with model: ${model}`);
      return tasks
        .filter(t => t.title && typeof t.title === 'string')
        .map((t, idx) => ({
          _id: idx,
          title: t.title.substring(0, 120),
          priority: validPriorities.includes(t.priority) ? t.priority : 'MEDIUM',
          estimatedHours: typeof t.estimatedHours === 'number' && t.estimatedHours > 0 ? t.estimatedHours : 2,
          dependsOnIndices: Array.isArray(t.dependsOnIndices) ? t.dependsOnIndices.filter(i => typeof i === 'number' && i < idx) : [],
        }))
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
    const createdDocIds = [];

    // Step 1: Create initial Task documents
    for (const taskData of tasksToCreate) {
      const task = await Task.create({
        title: taskData.title,
        description: `AI Auto-Pilot generated for: "${prompt}"`,
        priority: taskData.priority || 'MEDIUM',
        status: 'TODO',
        projectId,
        creatorId: req.user.id,
        assigneeId: taskData.assigneeId || null,
        dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
        estimatedHours: taskData.estimatedHours || 2,
      });
      createdTasks.push({ doc: task, taskData });
      createdDocIds.push(task._id);
    }

    // Step 2: Link DAG dependencies
    const resultTasks = [];
    for (let i = 0; i < createdTasks.length; i++) {
      const { doc, taskData } = createdTasks[i];
      let blockedByDocIds = [];

      if (Array.isArray(taskData.dependsOnIndices)) {
        blockedByDocIds = taskData.dependsOnIndices
          .filter(idx => idx >= 0 && idx < createdDocIds.length && idx !== i)
          .map(idx => createdDocIds[idx]);
      } else if (Array.isArray(taskData.blockedByIds)) {
        blockedByDocIds = taskData.blockedByIds;
      }

      if (blockedByDocIds.length > 0) {
        doc.blockedBy = blockedByDocIds;
        await doc.save();
      }

      const populated = await Task.findById(doc.id)
        .populate('assigneeId', 'name email')
        .populate('blockedBy', 'title status assigneeId');
      const obj = populated.toJSON();
      obj.assignee = populated.assigneeId && typeof populated.assigneeId === 'object' && populated.assigneeId.name
        ? { id: populated.assigneeId._id?.toString() || populated.assigneeId.id, name: populated.assigneeId.name, email: populated.assigneeId.email } : null;
      obj.assigneeId = populated.assigneeId?._id?.toString() || populated.assigneeId?.toString() || null;
      obj.blockedBy = (populated.blockedBy || []).map(b => ({ id: b._id?.toString() || b.id, title: b.title, status: b.status, assigneeId: b.assigneeId?.toString() || null }));
      obj.estimatedHours = populated.estimatedHours || 2;

      resultTasks.push(obj);

      req.emitEvent(`project_${projectId}`, 'task_created', obj);

      await AuditLog.create({
        action: 'TASK_CREATED_BY_AI',
        details: JSON.stringify({ title: doc.title, estimatedHours: doc.estimatedHours }),
        projectId, userId: req.user.id, taskId: doc.id,
      });

      if (taskData.assigneeId && taskData.assigneeId !== req.user.id) {
        try {
          const notification = await Notification.create({
            userId: taskData.assigneeId, type: 'TASK_ASSIGNED',
            message: `AI assigned you to "${doc.title}"`, link: `/app/projects/${projectId}?task=${doc.id}`,
          });
          req.emitEvent(`user_${taskData.assigneeId}`, 'new_notification', notification);
        } catch (e) { console.error('Failed to send AI assignment notification:', e); }
      }
    }

    res.status(201).json({ message: 'Tasks generated successfully', tasks: resultTasks });
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

const detectDAGCycle = async (taskId, newBlockedByIds) => {
  if (!newBlockedByIds || newBlockedByIds.length === 0) return false;
  const taskIdStr = taskId.toString();
  
  if (newBlockedByIds.some(id => id.toString() === taskIdStr)) {
    return true;
  }
  
  const queue = [...newBlockedByIds.map(id => id.toString())];
  const visited = new Set(queue);

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (currentId === taskIdStr) return true;

    const currentTask = await Task.findById(currentId).select('blockedBy').lean();
    if (currentTask && currentTask.blockedBy && currentTask.blockedBy.length > 0) {
      for (const nextId of currentTask.blockedBy) {
        const nextIdStr = nextId.toString();
        if (nextIdStr === taskIdStr) return true;
        if (!visited.has(nextIdStr)) {
          visited.add(nextIdStr);
          queue.push(nextIdStr);
        }
      }
    }
  }
  return false;
};

// GET single task
router.get('/:taskId', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId)
      .populate('assigneeId', 'name email')
      .populate('creatorId', 'name email')
      .populate('blockedBy', 'title status assigneeId')
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
      estimatedHours: task.estimatedHours || 2,
      autoTriageReason: task.autoTriageReason || null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      labels: (task.labels || []).map(l => ({ id: l._id?.toString() || l.id, name: l.name, color: l.color, projectId: l.projectId?.toString() })),
      blockedBy: (task.blockedBy || []).map(b => ({ id: b._id?.toString() || b.id, title: b.title || 'Untitled Task', status: b.status, assigneeId: b.assigneeId?.toString() || null })),
      attachments: (task.attachments || []).map(a => ({ id: a._id?.toString() || a.id, filename: a.filename, fileUrl: a.fileUrl, fileType: a.fileType, fileSize: a.fileSize, uploadedAt: a.uploadedAt }))
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
  estimatedHours: z.number().min(0.5).max(100).optional(),
  blockedByIds: z.array(z.string()).optional(),
  autoTriageReason: z.string().optional().nullable(),
});

router.patch('/:taskId', validate(updateTaskSchema), async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task || task.projectId.toString() !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const isMember = req.projectMembership.role === 'ADMIN' || req.projectMembership.role === 'MEMBER';
    if (!isMember) return res.status(403).json({ error: 'Forbidden' });

    const { labelIds, blockedByIds, ...rest } = req.body;
    let updateData = rest;
    if (labelIds !== undefined) updateData.labels = labelIds;
    if (req.body.dueDate !== undefined) {
      updateData.deadlineNotificationStatus = 'NONE';
    }

    if (blockedByIds !== undefined) {
      const hasCycle = await detectDAGCycle(req.params.taskId, blockedByIds);
      if (hasCycle) {
        return res.status(400).json({ error: 'Cannot set dependency: Circular DAG dependency detected' });
      }
      updateData.blockedBy = blockedByIds;
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

    // Check dependency blockers on IN_PROGRESS or DONE
    if (updateData.status === 'IN_PROGRESS' || updateData.status === 'DONE') {
      const taskWithBlockers = await Task.findById(req.params.taskId).populate('blockedBy', 'title status');
      const incomplete = (taskWithBlockers.blockedBy || []).filter(t => t.status !== 'DONE');
      if (incomplete.length > 0) {
        return res.status(400).json({
          error: `Cannot transition task. It is blocked by ${incomplete.length} incomplete dependency task(s).`,
          incompleteBlockers: incomplete.map(t => ({ id: t._id?.toString() || t.id, title: t.title, status: t.status })),
        });
      }
    }

    const updatedTask = await Task.findByIdAndUpdate(req.params.taskId, updateData, { new: true })
      .populate('assigneeId', 'name email').populate('labels').populate('blockedBy', 'title status assigneeId');
    const obj = updatedTask.toJSON();
    obj.assignee = updatedTask.assigneeId && typeof updatedTask.assigneeId === 'object' && updatedTask.assigneeId.name
      ? { id: updatedTask.assigneeId._id?.toString() || updatedTask.assigneeId.id, name: updatedTask.assigneeId.name, email: updatedTask.assigneeId.email } : null;
    obj.assigneeId = updatedTask.assigneeId?._id?.toString() || updatedTask.assigneeId?.toString() || null;
    obj.blockedBy = (updatedTask.blockedBy || []).map(b => ({ id: b._id?.toString() || b.id, title: b.title || 'Untitled Task', status: b.status, assigneeId: b.assigneeId?.toString() || null }));
    obj.estimatedHours = updatedTask.estimatedHours || 2;
    obj.autoTriageReason = updatedTask.autoTriageReason || null;
    obj.attachments = (updatedTask.attachments || []).map(a => ({ id: a._id?.toString() || a.id, filename: a.filename, fileUrl: a.fileUrl, fileType: a.fileType, fileSize: a.fileSize, uploadedAt: a.uploadedAt }));

    req.emitEvent(`project_${req.params.projectId}`, 'task_updated', obj);

    // Notify creator if completed by someone else
    if (task.status !== 'DONE' && updatedTask.status === 'DONE' && updatedTask.creatorId.toString() !== req.user.id) {
      const notification = await Notification.create({
        userId: updatedTask.creatorId, type: 'TASK_COMPLETED',
        message: `Task completed: ${updatedTask.title}`, link: `/app/projects/${req.params.projectId}?task=${updatedTask.id}`,
      });
      req.emitEvent(`user_${updatedTask.creatorId}`, 'notification', notification);
    }
    // Notify assignee ONLY if actually reassigned to a new user
    const newAssigneeIdStr = updatedTask.assigneeId?._id?.toString() || updatedTask.assigneeId?.toString() || null;
    const oldAssigneeIdStr = task.assigneeId?._id?.toString() || task.assigneeId?.toString() || null;
    if (newAssigneeIdStr && newAssigneeIdStr !== oldAssigneeIdStr && newAssigneeIdStr !== req.user.id) {
      const notification = await Notification.create({
        userId: newAssigneeIdStr, type: 'TASK_ASSIGNED',
        message: `You were assigned a task: ${updatedTask.title}`, link: `/app/projects/${req.params.projectId}?task=${updatedTask.id}`,
      });
      req.emitEvent(`user_${newAssigneeIdStr}`, 'notification', notification);
    }

    await AuditLog.create({
      action: 'TASK_UPDATED', details: JSON.stringify(updateData),
      projectId: req.params.projectId, userId: req.user.id, taskId: task.id,
    });
    res.json(obj);
  } catch (error) { next(error); }
});

// POST Auto-Pilot Workload Triage
router.post('/auto-triage', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const projectTasks = await Task.find({ projectId }).populate('blockedBy', 'status').lean();
    const { ProjectMember } = require('../models');
    const members = await ProjectMember.find({ projectId }).populate('userId', 'name email').lean();

    if (members.length === 0) {
      return res.status(400).json({ error: 'No team members available for triage' });
    }

    const memberWorkloads = new Map();
    members.forEach(m => {
      if (m.userId) {
        memberWorkloads.set(m.userId._id.toString(), {
          user: m.userId,
          activeHours: 0,
          assignedCount: 0,
        });
      }
    });

    if (memberWorkloads.size === 0) {
      return res.status(400).json({ error: 'No valid user profiles found for triage' });
    }

    projectTasks.forEach(t => {
      if (t.assigneeId && t.status !== 'DONE') {
        const uId = t.assigneeId.toString();
        if (memberWorkloads.has(uId)) {
          const entry = memberWorkloads.get(uId);
          entry.activeHours += t.estimatedHours || 2;
          entry.assignedCount += 1;
        }
      }
    });

    const triagedTasks = [];
    const unassignedTasks = projectTasks.filter(t => t.status === 'TODO');

    for (const t of unassignedTasks) {
      let bestMember = null;
      let minHours = Infinity;

      for (const [uId, data] of memberWorkloads.entries()) {
        if (data.activeHours < minHours) {
          minHours = data.activeHours;
          bestMember = data;
        }
      }

      if (bestMember) {
        const isBlocked = (t.blockedBy || []).some(b => b.status !== 'DONE');
        const reason = `Auto-Pilot: Assigned to ${bestMember.user.name} (Lowest current workload: ${bestMember.activeHours}h)${isBlocked ? ' - Waiting on dependencies' : ''}`;

        const updated = await Task.findByIdAndUpdate(
          t._id,
          { assigneeId: bestMember.user._id, autoTriageReason: reason },
          { new: true }
        ).populate('assigneeId', 'name email').populate('blockedBy', 'title status assigneeId');

        bestMember.activeHours += updated.estimatedHours || 2;
        bestMember.assignedCount += 1;

        const obj = updated.toJSON();
        obj.assignee = updated.assigneeId && typeof updated.assigneeId === 'object' && updated.assigneeId.name
          ? { id: updated.assigneeId._id?.toString() || updated.assigneeId.id, name: updated.assigneeId.name, email: updated.assigneeId.email } : null;
        obj.assigneeId = updated.assigneeId?._id?.toString() || updated.assigneeId?.toString() || null;
        obj.blockedBy = (updated.blockedBy || []).map(b => ({ id: b._id?.toString() || b.id, title: b.title, status: b.status }));
        obj.estimatedHours = updated.estimatedHours || 2;
        obj.autoTriageReason = updated.autoTriageReason;

        triagedTasks.push(obj);
        req.emitEvent(`project_${projectId}`, 'task_updated', obj);
      }
    }

    res.json({ message: `Auto-Pilot triaged ${triagedTasks.length} tasks successfully`, triagedTasks });
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

// POST upload attachment (accepts base64 payload)
router.post('/:taskId/attachments', async (req, res, next) => {
  try {
    const { taskId, projectId } = req.params;
    const { filename, fileData, fileType } = req.body;

    if (!filename || !fileData) {
      return res.status(400).json({ error: 'Filename and base64 fileData are required' });
    }

    const task = await Task.findById(taskId);
    if (!task || task.projectId.toString() !== projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Clean base64 header if present (e.g. data:image/png;base64,...)
    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const safeExt = path.extname(filename) || '';
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${safeExt}`;
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, uniqueName);
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/${uniqueName}`;
    const newAttachment = {
      filename,
      fileUrl,
      fileType: fileType || 'application/octet-stream',
      fileSize: buffer.length,
      uploadedAt: new Date()
    };

    task.attachments = task.attachments || [];
    task.attachments.push(newAttachment);
    await task.save();

    const populated = await Task.findById(taskId)
      .populate('assigneeId', 'name email')
      .populate('creatorId', 'name email')
      .populate('blockedBy', 'title status assigneeId')
      .populate('labels')
      .lean();

    const obj = {
      ...populated,
      id: populated._id.toString(),
      attachments: (populated.attachments || []).map(a => ({
        id: a._id.toString(),
        filename: a.filename,
        fileUrl: a.fileUrl,
        fileType: a.fileType,
        fileSize: a.fileSize,
        uploadedAt: a.uploadedAt
      }))
    };

    req.emitEvent(`project_${projectId}`, 'task_updated', obj);

    await AuditLog.create({
      action: 'ATTACHMENT_ADDED',
      details: JSON.stringify({ filename, fileSize: buffer.length }),
      projectId, userId: req.user.id, taskId,
    });

    res.status(201).json(obj);
  } catch (error) { next(error); }
});

// DELETE attachment
router.delete('/:taskId/attachments/:attachmentId', async (req, res, next) => {
  try {
    const { taskId, projectId, attachmentId } = req.params;
    const task = await Task.findById(taskId);
    if (!task || task.projectId.toString() !== projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    task.attachments = (task.attachments || []).filter(a => a._id.toString() !== attachmentId);
    await task.save();

    const populated = await Task.findById(taskId)
      .populate('assigneeId', 'name email')
      .populate('creatorId', 'name email')
      .populate('blockedBy', 'title status assigneeId')
      .populate('labels')
      .lean();

    const obj = {
      ...populated,
      id: populated._id.toString(),
      attachments: (populated.attachments || []).map(a => ({
        id: a._id.toString(),
        filename: a.filename,
        fileUrl: a.fileUrl,
        fileType: a.fileType,
        fileSize: a.fileSize,
        uploadedAt: a.uploadedAt
      }))
    };

    req.emitEvent(`project_${projectId}`, 'task_updated', obj);

    res.json(obj);
  } catch (error) { next(error); }
});

// Mount time tracking sub-router
const timeEntriesRoutes = require('./time-entries');
router.use('/:taskId/time-entries', timeEntriesRoutes);

module.exports = router;


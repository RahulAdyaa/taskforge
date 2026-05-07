const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authenticate = require('../middleware/authenticate');
const requireProjectRole = require('../middleware/requireProjectRole');
const validate = require('../middleware/validate');

const router = express.Router({ mergeParams: true }); // Access projectId from parent router

router.use(authenticate);
router.use(requireProjectRole(['ADMIN', 'MEMBER']));

router.get('/', async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const membership = req.projectMembership;

    const whereClause = { projectId };
    if (membership.role !== 'ADMIN') {
      whereClause.assigneeId = req.user.id;
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
        blockedBy: { select: { id: true, status: true } },
        labels: true
      },
    });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

const createTaskSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assigneeId: z.string().cuid().optional().nullable(),
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

// AI Task Decomposition Engine — uses OpenRouter with free model fallback chain
const OPENROUTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',   // Best quality free model
  'nvidia/nemotron-3-super-120b-a12b:free',    // Large context fallback
  'qwen/qwen3-coder:free',                     // Great at structured JSON
  'openai/gpt-oss-120b:free',                  // OpenAI-style fallback
];

const callOpenRouterAPI = async (apiKey, model, systemPrompt, prompt) => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://taskforge-app-production-f996.up.railway.app',
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
  });

  if (!response.ok) {
    const err = await response.text();
    const status = response.status;
    console.error(`OpenRouter API error (${model}, HTTP ${status}):`, err);
    throw new Error(`Model ${model} failed with HTTP ${status}`);
  }

  return response.json();
};

const generateSubtasksWithAI = async (prompt) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const systemPrompt = `You are a project management AI. Given a user's objective, break it down into 3-6 actionable subtasks.

Rules:
- Each task must be specific, actionable, and clear
- Assign priority: URGENT, HIGH, MEDIUM, or LOW
- Return ONLY valid JSON array, no markdown, no explanation
- Format: [{"title": "task description", "priority": "HIGH"}, ...]

Example input: "Build a user authentication system"
Example output: [{"title":"Design database schema for users table with email, password hash, and roles","priority":"HIGH"},{"title":"Implement bcrypt password hashing and JWT token generation","priority":"URGENT"},{"title":"Create REST API endpoints for signup, login, and logout","priority":"HIGH"},{"title":"Build React login and signup forms with client-side validation","priority":"MEDIUM"},{"title":"Add forgot password flow with email verification","priority":"LOW"}]`;

  // Try each model in order until one works
  let lastError;
  for (const model of OPENROUTER_MODELS) {
    try {
      console.log(`Trying OpenRouter model: ${model}`);
      const data = await callOpenRouterAPI(apiKey, model, systemPrompt, prompt);
      const text = data.choices?.[0]?.message?.content || '';

      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error(`Failed to parse response from ${model}:`, text);
        lastError = new Error('Could not parse AI response');
        continue;
      }

      const tasks = JSON.parse(jsonMatch[0]);

      // Validate and sanitize
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      console.log(`AI generation succeeded with model: ${model}`);
      return tasks
        .filter(t => t.title && typeof t.title === 'string')
        .map(t => ({
          title: t.title.substring(0, 120),
          priority: validPriorities.includes(t.priority) ? t.priority : 'MEDIUM'
        }))
        .slice(0, 6);
    } catch (err) {
      console.error(`Model ${model} failed:`, err.message);
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('All OpenRouter models failed');
};

router.post('/ai-preview', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (!prompt || prompt.length < 5) {
      return res.status(400).json({ error: 'Prompt must be at least 5 characters' });
    }

    let generatedTasks;
    try {
      generatedTasks = await generateSubtasksWithAI(prompt);
    } catch (aiError) {
      console.error('AI preview failed:', aiError.message);
      return res.status(500).json({ error: `AI generation failed: ${aiError.message}` });
    }

    res.json({ tasks: generatedTasks });
  } catch (error) {
    next(error);
  }
});

router.post('/ai-generate', requireProjectRole(['ADMIN']), validate(aiGenerateSchema), async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const { prompt, tasks: taskOverrides } = req.body;

    let tasksToCreate;
    if (taskOverrides && taskOverrides.length > 0) {
      // Use the reviewed/edited tasks from the frontend
      tasksToCreate = taskOverrides;
    } else {
      // Legacy path: generate and create in one shot
      try {
        tasksToCreate = await generateSubtasksWithAI(prompt);
      } catch (aiError) {
        console.error('AI generation failed after all retries:', aiError.message);
        const userMessage = aiError.message.includes('not configured')
          ? 'AI task generation failed. Please check OPENROUTER_API_KEY configuration.'
          : `AI task generation failed: ${aiError.message}. Please try again.`;
        return res.status(500).json({ error: userMessage });
      }
    }
    
    const createdTasks = [];
    for (const taskData of tasksToCreate) {
      const task = await prisma.task.create({
        data: {
          title: taskData.title,
          description: `AI-generated for: "${prompt}"`,
          priority: taskData.priority || 'MEDIUM',
          status: 'TODO',
          projectId,
          creatorId: req.user.id,
          assigneeId: taskData.assigneeId || null,
          dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
        },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
        }
      });
      createdTasks.push(task);
      
      req.io.to(`project_${projectId}`).emit('task_created', task);
      
      await prisma.auditLog.create({
        data: {
          action: 'TASK_CREATED_BY_AI',
          details: JSON.stringify({ title: task.title }),
          projectId,
          userId: req.user.id,
          taskId: task.id,
        }
      });

      // If assigned, send notification
      if (taskData.assigneeId && taskData.assigneeId !== req.user.id) {
        try {
          const notification = await prisma.notification.create({
            data: {
              userId: taskData.assigneeId,
              type: 'TASK_ASSIGNED',
              message: `AI assigned you to "${task.title}"`,
              link: `/app/projects/${projectId}`,
            }
          });
          req.io.to(`user_${taskData.assigneeId}`).emit('new_notification', notification);
        } catch (e) {
          console.error('Failed to send AI assignment notification:', e);
        }
      }
    }

    res.status(201).json({ message: 'Tasks generated successfully', tasks: createdTasks });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireProjectRole(['ADMIN']), validate(createTaskSchema), async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const { title, description, dueDate, priority, assigneeId, labelIds } = req.body;

    const taskData = {
      title,
      description,
      dueDate,
      priority,
      status: 'TODO',
      projectId,
      assigneeId,
      creatorId: req.user.id,
    };

    if (labelIds && labelIds.length > 0) {
      taskData.labels = {
        connect: labelIds.map(id => ({ id }))
      };
    }

    const task = await prisma.task.create({
      data: taskData,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        labels: true,
      }
    });

    req.io.to(`project_${projectId}`).emit('task_created', task);

    if (task.assigneeId && task.assigneeId !== req.user.id) {
      const notification = await prisma.notification.create({
        data: {
          userId: task.assigneeId,
          type: 'TASK_ASSIGNED',
          message: `You were assigned a new task: ${task.title}`,
          link: `/app/projects/${projectId}`
        }
      });
      req.io.to(`user_${task.assigneeId}`).emit('notification', notification);
    }

    await prisma.auditLog.create({
      data: {
        action: 'TASK_CREATED',
        details: JSON.stringify({ title }),
        projectId,
        userId: req.user.id,
        taskId: task.id,
      }
    });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

router.get('/:taskId', async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
        blockedBy: { select: { id: true, title: true, status: true } },
        labels: true,
      },
    });

    if (!task || task.projectId !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (req.projectMembership.role !== 'ADMIN' && task.assigneeId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this task' });
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  assigneeId: z.string().cuid().optional().nullable(),
  labelIds: z.array(z.string()).optional(),
});

router.patch('/:taskId', validate(updateTaskSchema), async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    if (!task || task.projectId !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const isAdmin = req.projectMembership.role === 'ADMIN';
    const isAssignee = task.assigneeId === req.user.id;

    if (!isAdmin && !isAssignee) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let updateData = {};
    if (isAdmin) {
      updateData = req.body;
      if (req.body.labelIds !== undefined) {
        updateData.labels = {
          set: req.body.labelIds.map(id => ({ id }))
        };
        delete updateData.labelIds;
      }
    } else {
      if (req.body.status) updateData.status = req.body.status;
    }

    // Check dependency blockers
    if (updateData.status === 'DONE') {
      const taskWithBlockers = await prisma.task.findUnique({
        where: { id: req.params.taskId },
        include: { blockedBy: true }
      });
      const incompleteBlockers = taskWithBlockers.blockedBy.filter(t => t.status !== 'DONE');
      if (incompleteBlockers.length > 0) {
        return res.status(400).json({ error: 'Cannot complete task. It is blocked by incomplete dependencies.', incompleteBlockers });
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: req.params.taskId },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        labels: true,
      }
    });

    req.io.to(`project_${req.params.projectId}`).emit('task_updated', updatedTask);

    // Notify creator if task was completed by someone else
    if (task.status !== 'DONE' && updatedTask.status === 'DONE' && updatedTask.creatorId !== req.user.id) {
      const notification = await prisma.notification.create({
        data: {
          userId: updatedTask.creatorId,
          type: 'TASK_COMPLETED',
          message: `Task completed: ${updatedTask.title}`,
          link: `/app/projects/${req.params.projectId}`
        }
      });
      req.io.to(`user_${updatedTask.creatorId}`).emit('notification', notification);
    }

    // Notify assignee if reassigned
    if (updatedTask.assigneeId && updatedTask.assigneeId !== task.assigneeId && updatedTask.assigneeId !== req.user.id) {
      const notification = await prisma.notification.create({
        data: {
          userId: updatedTask.assigneeId,
          type: 'TASK_ASSIGNED',
          message: `You were assigned a task: ${updatedTask.title}`,
          link: `/app/projects/${req.params.projectId}`
        }
      });
      req.io.to(`user_${updatedTask.assigneeId}`).emit('notification', notification);
    }

    await prisma.auditLog.create({
      data: {
        action: 'TASK_UPDATED',
        details: JSON.stringify(updateData),
        projectId: req.params.projectId,
        userId: req.user.id,
        taskId: task.id,
      }
    });

    res.json(updatedTask);
  } catch (error) {
    next(error);
  }
});

router.delete('/:taskId', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    if (!task || task.projectId !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.task.delete({ where: { id: req.params.taskId } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/:taskId/blockers', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    const { blockerId } = req.body;
    const task = await prisma.task.update({
      where: { id: req.params.taskId },
      data: {
        blockedBy: {
          connect: { id: blockerId }
        }
      },
      include: { blockedBy: true }
    });
    req.io.to(`project_${req.params.projectId}`).emit('task_updated', task);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.delete('/:taskId/blockers/:blockerId', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    const task = await prisma.task.update({
      where: { id: req.params.taskId },
      data: {
        blockedBy: {
          disconnect: { id: req.params.blockerId }
        }
      },
      include: { blockedBy: true }
    });
    req.io.to(`project_${req.params.projectId}`).emit('task_updated', task);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

// GET per-task activity timeline
router.get('/:taskId/activity', async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { taskId: req.params.taskId },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

const commentSchema = z.object({
  content: z.string().min(1).max(5000),
});

router.get('/:taskId/comments', async (req, res, next) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { taskId: req.params.taskId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(comments);
  } catch (error) {
    next(error);
  }
});

router.post('/:taskId/comments', validate(commentSchema), async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    if (!task || task.projectId !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const comment = await prisma.comment.create({
      data: {
        content: req.body.content,
        taskId: req.params.taskId,
        userId: req.user.id,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      }
    });

    req.io.to(`project_${req.params.projectId}`).emit('task_updated', task);
    req.io.to(`project_${req.params.projectId}`).emit('comment_added', { taskId: req.params.taskId, comment });

    await prisma.auditLog.create({
      data: {
        action: 'COMMENT_ADDED',
        details: JSON.stringify({ taskId: task.id }),
        projectId: req.params.projectId,
        userId: req.user.id,
        taskId: task.id,
      }
    });

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
});

// Mount time tracking sub-router
const timeEntriesRoutes = require('./time-entries');
router.use('/:taskId/time-entries', timeEntriesRoutes);

module.exports = router;

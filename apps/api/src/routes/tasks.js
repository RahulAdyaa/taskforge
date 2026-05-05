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
        blockedBy: { select: { id: true, status: true } }
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
});

const aiGenerateSchema = z.object({
  prompt: z.string().min(5).max(500),
});

// Real AI Task Decomposition Engine (Google Gemini)
const generateSubtasksWithAI = async (prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const systemPrompt = `You are a project management AI. Given a user's objective, break it down into 3-6 actionable subtasks.

Rules:
- Each task must be specific, actionable, and clear
- Assign priority: URGENT, HIGH, MEDIUM, or LOW
- Return ONLY valid JSON array, no markdown, no explanation
- Format: [{"title": "task description", "priority": "HIGH"}, ...]

Example input: "Build a user authentication system"
Example output: [{"title":"Design database schema for users table with email, password hash, and roles","priority":"HIGH"},{"title":"Implement bcrypt password hashing and JWT token generation","priority":"URGENT"},{"title":"Create REST API endpoints for signup, login, and logout","priority":"HIGH"},{"title":"Build React login and signup forms with client-side validation","priority":"MEDIUM"},{"title":"Add forgot password flow with email verification","priority":"LOW"}]`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nUser objective: "${prompt}"` }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error('Gemini API error:', err);
    throw new Error('Gemini API request failed');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Extract JSON from the response (handle markdown code blocks)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('Failed to parse Gemini response:', text);
    throw new Error('Could not parse AI response');
  }

  const tasks = JSON.parse(jsonMatch[0]);
  
  // Validate and sanitize
  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  return tasks
    .filter(t => t.title && typeof t.title === 'string')
    .map(t => ({
      title: t.title.substring(0, 120),
      priority: validPriorities.includes(t.priority) ? t.priority : 'MEDIUM'
    }))
    .slice(0, 6);
};

router.post('/ai-generate', requireProjectRole(['ADMIN']), validate(aiGenerateSchema), async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const { prompt } = req.body;

    let generatedTasks;
    try {
      generatedTasks = await generateSubtasksWithAI(prompt);
    } catch (aiError) {
      console.error('AI generation failed:', aiError.message);
      return res.status(500).json({ error: 'AI task generation failed. Please check GEMINI_API_KEY configuration.' });
    }
    
    const createdTasks = [];
    for (const taskData of generatedTasks) {
      const task = await prisma.task.create({
        data: {
          title: taskData.title,
          description: `AI-generated for: "${prompt}"`,
          priority: taskData.priority,
          status: 'TODO',
          projectId,
          creatorId: req.user.id,
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
    }

    res.status(201).json({ message: 'Tasks generated successfully', tasks: createdTasks });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireProjectRole(['ADMIN']), validate(createTaskSchema), async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const { title, description, dueDate, priority, assigneeId } = req.body;

    const task = await prisma.task.create({
      data: {
        title,
        description,
        dueDate,
        priority,
        status: 'TODO',
        projectId,
        assigneeId,
        creatorId: req.user.id,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      }
    });

    req.io.to(`project_${projectId}`).emit('task_created', task);

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
      }
    });

    req.io.to(`project_${req.params.projectId}`).emit('task_updated', updatedTask);

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

    req.io.to(`project_${req.params.projectId}`).emit('task_updated', task); // Trigger re-render or notification

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

module.exports = router;

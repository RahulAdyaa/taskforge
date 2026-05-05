const express = require('express');
const { z } = require('zod');
const { Ollama } = require('ollama');
const prisma = require('../lib/prisma');
const authenticate = require('../middleware/authenticate');
const requireProjectRole = require('../middleware/requireProjectRole');
const validate = require('../middleware/validate');

const ollama = new Ollama({ host: 'http://localhost:11434' });
const router = express.Router();

router.use(authenticate);

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: {
            userId: req.user.id,
          },
        },
      },
      include: {
        members: true,
      },
    });
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

router.post('/', validate(createProjectSchema), async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const project = await prisma.project.create({
      data: {
        name,
        description,
        members: {
          create: {
            userId: req.user.id,
            role: 'ADMIN',
          },
        },
      },
    });
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

const joinProjectSchema = z.object({
  projectId: z.string().min(1)
});

router.post('/join', validate(joinProjectSchema), async (req, res, next) => {
  try {
    const { projectId } = req.body;
    
    // Check if project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found with that ID.' });
    }

    // Check if already a member
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: req.user.id
        }
      }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'You are already a member of this project.' });
    }

    const membership = await prisma.projectMember.create({
      data: {
        userId: req.user.id,
        projectId,
        role: 'MEMBER'
      }
    });

    res.status(201).json(membership);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireProjectRole(['ADMIN', 'MEMBER']), async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });
    res.json(project);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/dashboard', requireProjectRole(['ADMIN', 'MEMBER']), async (req, res, next) => {
  try {
    const projectId = req.params.id;

    // Total tasks and by status
    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: { assignee: true }
    });

    const totalTasks = tasks.length;
    const byStatus = {
      TODO: tasks.filter(t => t.status === 'TODO').length,
      IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      DONE: tasks.filter(t => t.status === 'DONE').length,
    };

    // Tasks per user format expected: [{ name: 'User', taskCount: 1 }]
    const userMap = {};
    tasks.forEach(t => {
      const name = t.assignee ? t.assignee.name : 'Unassigned';
      userMap[name] = (userMap[name] || 0) + 1;
    });
    const byUser = Object.keys(userMap).map(key => ({ name: key, taskCount: userMap[key] }));

    // Overdue tasks
    const now = new Date();
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE').length;

    res.json({
      totalTasks,
      byStatus,
      byUser,
      overdue,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    await prisma.project.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

router.post('/:id/members', requireProjectRole(['ADMIN']), validate(addMemberSchema), async (req, res, next) => {
  try {
    const { email, role } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const membership = await prisma.projectMember.create({
      data: {
        userId: user.id,
        projectId: req.params.id,
        role,
      },
    });
    res.status(201).json(membership);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/members/:userId', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    await prisma.projectMember.delete({
      where: {
        userId_projectId: {
          userId: req.params.userId,
          projectId: req.params.id,
        },
      },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/:id/logs', requireProjectRole(['ADMIN', 'MEMBER']), async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { projectId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { name: true, email: true } }
      }
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

const chatSchema = z.object({
  message: z.string().min(1).max(1000),
});

router.post('/:id/chat', requireProjectRole(['ADMIN', 'MEMBER']), validate(chatSchema), async (req, res, next) => {
  try {
    const { message } = req.body;
    
    const stats = await prisma.task.groupBy({
      by: ['status'],
      where: { projectId: req.params.id },
      _count: true
    });
    let summary = "Project Status:\n";
    stats.forEach(s => {
      summary += `- ${s.status}: ${s._count} tasks\n`;
    });

    const systemPrompt = `You are the TaskForge AI Assistant. You help users manage their projects. 
The user is ${req.user.name}.
Here is the current project status context:
${summary}
Answer the user's question concisely and helpfully.`;

    const response = await ollama.chat({
      model: 'llama3:latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    });

    res.json({ reply: response.message.content });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

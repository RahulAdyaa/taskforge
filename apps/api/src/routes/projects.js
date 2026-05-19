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

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

// GET all projects for user
router.get('/', async (req, res, next) => {
  try {
    const memberships = await ProjectMember.find({ userId: req.user.id }).select('projectId');
    const projectIds = memberships.map(m => m.projectId);
    const projects = await Project.find({ _id: { $in: projectIds } });
    const allMembers = await ProjectMember.find({ projectId: { $in: projectIds } });

    const result = projects.map(p => {
      const pObj = p.toJSON();
      pObj.members = allMembers.filter(m => m.projectId.toString() === p.id).map(m => m.toJSON());
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
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found with that ID.' });
    const existing = await ProjectMember.findOne({ userId: req.user.id, projectId });
    if (existing) return res.status(400).json({ error: 'You are already a member of this project.' });
    const membership = await ProjectMember.create({ userId: req.user.id, projectId, role: 'MEMBER' });
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
    const members = await ProjectMember.find({ projectId: req.params.id }).populate('userId', 'name email');
    const pObj = project.toJSON();
    pObj.members = members.map(m => ({
      id: m.id, role: m.role, userId: m.userId._id.toString(), projectId: m.projectId.toString(),
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
    const tasks = await Task.find({ projectId }).populate('assigneeId', 'name');
    const totalTasks = tasks.length;
    const byStatus = {
      TODO: tasks.filter(t => t.status === 'TODO').length,
      IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      DONE: tasks.filter(t => t.status === 'DONE').length,
    };
    const userMap = {};
    tasks.forEach(t => {
      const name = t.assigneeId ? t.assigneeId.name : 'Unassigned';
      userMap[name] = (userMap[name] || 0) + 1;
    });
    const byUser = Object.keys(userMap).map(key => ({ name: key, taskCount: userMap[key] }));
    const now = new Date();
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE').length;
    res.json({ totalTasks, byStatus, byUser, overdue });
  } catch (error) { next(error); }
});

// DELETE project (cascade)
router.delete('/:id', requireProjectRole(['ADMIN']), async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const taskIds = (await Task.find({ projectId }).select('_id')).map(t => t._id);
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
router.get('/:id/logs', requireProjectRole(['ADMIN', 'MEMBER']), async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ projectId: req.params.id })
      .sort({ createdAt: -1 }).limit(50).populate('userId', 'name email');
    const result = logs.map(l => {
      const obj = l.toJSON();
      obj.user = { name: l.userId.name, email: l.userId.email };
      obj.userId = l.userId._id.toString();
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
    const stats = await Task.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(req.params.id) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    let summary = "Project Status:\n";
    stats.forEach(s => { summary += `- ${s._id}: ${s.count} tasks\n`; });

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) return res.status(500).json({ error: 'AI features are not configured.' });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openRouterApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [
          { role: 'system', content: `You are the TaskForge AI Assistant. You help users manage their projects.\nThe user is ${req.user.name}.\nHere is the current project status context:\n${summary}\nAnswer the user's question concisely and helpfully.` },
          { role: 'user', content: message }
        ]
      })
    });
    if (!response.ok) throw new Error('Failed to generate response from OpenRouter');
    const data = await response.json();
    res.json({ reply: data.choices[0].message.content });
  } catch (error) { next(error); }
});

module.exports = router;

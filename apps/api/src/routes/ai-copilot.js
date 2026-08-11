const express = require('express');
const { Project, ProjectMember, Task, AuditLog, Comment } = require('../models');
const authenticate = require('../middleware/authenticate');
const requireProjectRole = require('../middleware/requireProjectRole');

const { getCoPilotPrompt } = require('../config/prompts');

const router = express.Router({ mergeParams: true });
router.use(authenticate);
router.use(requireProjectRole());

const OPENROUTER_MODELS = [
  'openrouter/free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'qwen/qwen-2.5-coder-32b-instruct:free',
  'google/gemma-2-9b-it:free',
];

const callOpenRouterAPI = async (apiKey, model, systemPrompt, chatMessages) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 28000);

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
        'X-Title': 'TaskForge AI Co-Pilot',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        max_tokens: 1600,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.text();
      console.error(`OpenRouter Co-Pilot error (${model}, HTTP ${response.status}):`, err);
      throw new Error(`Model ${model} failed with HTTP ${response.status}`);
    }
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// POST /api/projects/:projectId/ai-copilot
router.post('/', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { query, chatHistory = [] } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Query string is required' });
    }

    const project = await Project.findById(projectId).lean();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const projectMembers = await ProjectMember.find({ projectId })
      .populate('userId', 'name email')
      .lean();

    const tasks = await Task.find({ projectId })
      .populate('assigneeId', 'name email')
      .populate('creatorId', 'name email')
      .populate('blockedBy', 'title status assigneeId')
      .populate('labels')
      .lean();

    const auditLogs = await AuditLog.find({ projectId })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    // Workload calculation
    const workloadMap = {};
    projectMembers.forEach(m => {
      if (m.userId) {
        const uId = m.userId._id?.toString() || m.userId.toString();
        workloadMap[uId] = {
          name: m.userId.name || 'Team Member',
          email: m.userId.email || '',
          role: m.role || 'MEMBER',
          activeTasks: 0,
          totalEstHours: 0,
        };
      }
    });

    const taskDetails = tasks.map(t => {
      const assigneeName = t.assigneeId?.name || 'Unassigned';
      const assigneeIdStr = t.assigneeId?._id?.toString() || t.assigneeId?.toString();
      
      if (assigneeIdStr && workloadMap[assigneeIdStr] && t.status !== 'DONE') {
        workloadMap[assigneeIdStr].activeTasks += 1;
        workloadMap[assigneeIdStr].totalEstHours += (t.estimatedHours || 2);
      }

      const blockers = (t.blockedBy || []).map(b => `${b.title} (${b.status})`);
      const attachments = (t.attachments || []).map(a => `${a.filename} (${a.fileType}, ${(a.fileSize / 1024).toFixed(1)}KB)`);

      return `- Task ID: ${t._id.toString().slice(0, 6)} | Title: "${t.title}" | Status: ${t.status} | Priority: ${t.priority} | Est: ${t.estimatedHours || 2}h | Assignee: ${assigneeName}${blockers.length ? ` | BLOCKED BY: [${blockers.join(', ')}]` : ''}${attachments.length ? ` | ATTACHMENTS: [${attachments.join(', ')}]` : ''} | Full Desc: "${t.description || 'No additional description provided'}"`;
    });

    const customUserPrompt = req.user.customModelSettings?.systemPrompt;
    const projectContextPrompt = getCoPilotPrompt({
      project,
      workloadMap,
      tasks,
      taskDetails,
      auditLogs,
      customUserPrompt,
    });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenRouter API key is missing' });
    }

    const messagesToPass = [
      ...chatHistory.slice(-6),
      { role: 'user', content: query }
    ];

    let aiResult = null;
    let usedModel = null;
    let lastError = null;

    for (const model of OPENROUTER_MODELS) {
      try {
        console.log(`[Ask Project AI] Attempting response with model: ${model}`);
        const data = await callOpenRouterAPI(apiKey, model, projectContextPrompt, messagesToPass);
        const reply = data?.choices?.[0]?.message?.content;
        if (reply && reply.trim()) {
          aiResult = reply.trim();
          usedModel = model;
          console.log(`[Ask Project AI] Succeeded with model: ${model}`);
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Ask Project AI] Model ${model} failed, trying next fallback...`);
      }
    }

    if (!aiResult) {
      throw lastError || new Error('All AI models failed to respond');
    }

    // ─── AI Agentic Task Creation Interceptor ───────────────────────
    let createdTask = null;
    const createTaskRegex = /```json:create_task\s*([\s\S]*?)\s*```/i;
    const taskMatch = aiResult.match(createTaskRegex);

    if (taskMatch) {
      try {
        const rawJson = taskMatch[1].trim();
        const parsed = JSON.parse(rawJson);
        
        let assignedUser = req.user;
        if (parsed.assigneeName && parsed.assigneeName !== 'Unassigned') {
          const match = projectMembers.find(m => 
            m.userId?.name?.toLowerCase().includes(parsed.assigneeName.toLowerCase()) ||
            m.userId?.email?.toLowerCase().includes(parsed.assigneeName.toLowerCase())
          );
          if (match && match.userId) {
            assignedUser = match.userId;
          }
        }

        const maxPosTask = await Task.findOne({ projectId }).sort({ position: -1 }).lean();
        const newPos = maxPosTask ? (maxPosTask.position || 0) + 1 : 0;

        const taskDoc = await Task.create({
          projectId,
          title: parsed.title || 'New Task',
          description: parsed.description || `Created via Ask Project AI on request of ${req.user.name}`,
          status: ['TODO', 'IN_PROGRESS', 'DONE'].includes(parsed.status) ? parsed.status : 'TODO',
          priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(parsed.priority) ? parsed.priority : 'MEDIUM',
          estimatedHours: Number(parsed.estimatedHours) || 2,
          assigneeId: assignedUser._id || assignedUser.id,
          creatorId: req.user.id,
          position: newPos,
        });

        createdTask = await Task.findById(taskDoc._id)
          .populate('assigneeId', 'name email')
          .populate('creatorId', 'name email')
          .lean();

        // Broadcast Socket.io event for real-time live board update!
        const io = req.app.get('io');
        if (io) {
          io.to(`project:${projectId}`).emit('task:created', createdTask);
        }

        // Log audit trail
        await AuditLog.create({
          action: 'TASK_CREATED_BY_AI',
          details: JSON.stringify({ title: createdTask.title, taskId: createdTask._id, assignee: assignedUser.name }),
          projectId,
          userId: req.user.id,
        });

        // Replace the raw JSON code block in aiResult with a beautiful execution card
        aiResult = aiResult.replace(createTaskRegex, '').trim() + `\n\n` + 
          `---\n` +
          `### ⚡ Task Created Live on Board!\n` +
          `| Property | Details |\n` +
          `| :--- | :--- |\n` +
          `| **Task Title** | **${createdTask.title}** |\n` +
          `| **Assignee** | 👤 ${createdTask.assigneeId?.name || 'Unassigned'} |\n` +
          `| **Status** | 🟢 \`${createdTask.status}\` |\n` +
          `| **Priority** | 🔥 \`${createdTask.priority}\` |\n` +
          `| **Estimated** | ⏱️ ${createdTask.estimatedHours}h |\n` +
          `| **Task ID** | \`${createdTask._id.toString().slice(0, 6)}\` |\n\n` +
          `*The task card has been created in MongoDB and live-synced to your Kanban board!*`;

      } catch (e) {
        console.error('Failed to parse or create AI task:', e);
      }
    }

    await AuditLog.create({
      action: 'ASK_PROJECT_AI_QUERIED',
      details: JSON.stringify({ query: query.slice(0, 100), model: usedModel, taskCreated: Boolean(createdTask) }),
      projectId,
      userId: req.user.id,
    });

    res.json({
      answer: aiResult,
      model: usedModel,
      createdTask,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

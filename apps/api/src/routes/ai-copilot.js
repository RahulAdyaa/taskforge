const express = require('express');
const { Project, Task, AuditLog, Comment } = require('../models');
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

    const project = await Project.findById(projectId)
      .populate('members.user', 'name email')
      .lean();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

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
    (project.members || []).forEach(m => {
      if (m.user) {
        workloadMap[m.user._id.toString()] = {
          name: m.user.name,
          email: m.user.email,
          role: m.role,
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

    await AuditLog.create({
      action: 'ASK_PROJECT_AI_QUERIED',
      details: JSON.stringify({ query: query.slice(0, 100), model: usedModel }),
      projectId,
      userId: req.user.id,
    });

    res.json({
      answer: aiResult,
      model: usedModel,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

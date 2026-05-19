const express = require('express');
const { AuditLog, Task } = require('../models');
const authenticate = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

// OpenRouter fallback chain (same models as task decomposition)
const OPENROUTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-coder:free',
  'openai/gpt-oss-120b:free',
];

const callOpenRouterAPI = async (apiKey, model, systemPrompt, userPrompt) => {
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
      temperature: 0.5,
      max_tokens: 1500,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    console.error(`OpenRouter standup error (${model}, HTTP ${response.status}):`, err);
    throw new Error(`Model ${model} failed with HTTP ${response.status}`);
  }
  return response.json();
};

// POST /api/standup/generate
router.post('/generate', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Recent audit logs (last 24h)
    const recentLogs = await AuditLog.find({
      userId,
      createdAt: { $gte: yesterday },
      action: { $in: ['TASK_CREATED', 'TASK_UPDATED', 'TASK_CREATED_BY_AI', 'COMMENT_ADDED'] },
    })
      .populate('taskId', 'title status priority')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
      .limit(30);

    // 2. Current open tasks
    const openTasks = await Task.find({
      assigneeId: userId,
      status: { $in: ['TODO', 'IN_PROGRESS'] },
    })
      .populate('projectId', 'name')
      .populate('blockedBy', 'title status')
      .sort({ priority: -1, dueDate: 1 })
      .limit(15);

    // 3. Recently completed tasks
    const completedTasks = await Task.find({
      assigneeId: userId,
      status: 'DONE',
      updatedAt: { $gte: yesterday },
    })
      .populate('projectId', 'name')
      .limit(10);

    // 4. Identify blockers
    const blockedTasks = openTasks.filter(t =>
      t.blockedBy && t.blockedBy.some(b => b.status !== 'DONE')
    );

    // 5. Overdue tasks
    const overdueTasks = openTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);

    const contextData = {
      userName: req.user.name,
      date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      completedYesterday: completedTasks.map(t => ({
        title: t.title, project: t.projectId?.name || 'Unknown', priority: t.priority,
      })),
      currentQueue: openTasks.map(t => ({
        title: t.title, status: t.status, project: t.projectId?.name || 'Unknown', priority: t.priority,
        dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : null,
        isOverdue: t.dueDate ? new Date(t.dueDate) < now : false,
      })),
      blockers: blockedTasks.map(t => ({
        title: t.title, project: t.projectId?.name || 'Unknown',
        blockedBy: t.blockedBy.filter(b => b.status !== 'DONE').map(b => b.title),
      })),
      recentActivity: recentLogs.slice(0, 10).map(l => ({
        action: l.action, project: l.projectId?.name, task: l.taskId?.title,
      })),
      stats: {
        completedCount: completedTasks.length, openCount: openTasks.length,
        blockedCount: blockedTasks.length, overdueCount: overdueTasks.length,
      },
    };

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });

    const systemPrompt = `You are a daily standup report generator for a project management tool called TaskForge. 
Given a developer's task data, generate a concise, professional daily standup report.

The report MUST follow this exact markdown structure:

## 🗓 Daily Standup — {date}
**{userName}**

### ✅ What I completed
- List completed tasks with project names. If none, say "No tasks completed in the last 24 hours."

### 🔄 What I'm working on today
- List the top priority open tasks (max 5). Include status and project name.
- Flag any overdue items with ⚠️

### 🚧 Blockers & Risks
- List any blocked tasks and what they're waiting on. If none, say "No blockers at this time."

### 📊 Quick Stats
- X tasks completed | Y tasks in queue | Z blockers | W overdue

Keep it concise and professional. Use bullet points. Don't invent tasks that aren't in the data.
Return ONLY the markdown report, nothing else.`;

    const userPrompt = `Generate my daily standup report from this data:\n\n${JSON.stringify(contextData, null, 2)}`;

    let lastError;
    for (const model of OPENROUTER_MODELS) {
      try {
        console.log(`[Standup] Trying model: ${model}`);
        const data = await callOpenRouterAPI(apiKey, model, systemPrompt, userPrompt);
        const text = data.choices?.[0]?.message?.content || '';
        if (!text.trim()) { lastError = new Error('Empty response from AI'); continue; }
        console.log(`[Standup] Succeeded with model: ${model}`);
        return res.json({ standup: text.trim(), generatedAt: now.toISOString(), model, context: contextData.stats });
      } catch (err) {
        console.error(`[Standup] Model ${model} failed:`, err.message);
        lastError = err;
      }
    }

    // Fallback template
    return res.json({
      standup: generateFallbackReport(contextData),
      generatedAt: now.toISOString(), model: 'fallback-template', context: contextData.stats,
    });
  } catch (error) { next(error); }
});

function generateFallbackReport(ctx) {
  const lines = [];
  lines.push(`## 🗓 Daily Standup — ${ctx.date}`);
  lines.push(`**${ctx.userName}**\n`);
  lines.push(`### ✅ What I completed`);
  if (ctx.completedYesterday.length === 0) {
    lines.push(`- No tasks completed in the last 24 hours.\n`);
  } else {
    ctx.completedYesterday.forEach(t => lines.push(`- **${t.title}** (${t.project}) [${t.priority}]`));
    lines.push('');
  }
  lines.push(`### 🔄 What I'm working on today`);
  if (ctx.currentQueue.length === 0) {
    lines.push(`- No open tasks in queue.\n`);
  } else {
    ctx.currentQueue.slice(0, 5).forEach(t => {
      const overdue = t.isOverdue ? ' ⚠️ OVERDUE' : '';
      const due = t.dueDate ? ` — due ${t.dueDate}` : '';
      lines.push(`- **${t.title}** (${t.project}) [${t.status}]${due}${overdue}`);
    });
    lines.push('');
  }
  lines.push(`### 🚧 Blockers & Risks`);
  if (ctx.blockers.length === 0) {
    lines.push(`- No blockers at this time.\n`);
  } else {
    ctx.blockers.forEach(t => lines.push(`- **${t.title}** (${t.project}) — blocked by: ${t.blockedBy.join(', ')}`));
    lines.push('');
  }
  lines.push(`### 📊 Quick Stats`);
  lines.push(`- ${ctx.stats.completedCount} tasks completed | ${ctx.stats.openCount} tasks in queue | ${ctx.stats.blockedCount} blockers | ${ctx.stats.overdueCount} overdue`);
  return lines.join('\n');
}

module.exports = router;

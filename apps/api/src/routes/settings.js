const express = require('express');
const crypto = require('crypto');
const { User, Project, ProjectMember, Task, AuditLog, Comment } = require('../models');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// Get public profile (No authentication required)
router.get('/public/:username', async (req, res, next) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username, profileVisibility: 'public' })
      .select('name username avatarUrl bannerUrl headline bio githubUrl linkedinUrl portfolioUrl twitterUrl techStack skills experienceLevel certifications createdAt');
    
    if (!user) {
      return res.status(404).json({ error: 'Profile not found or set to private.' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.use(authenticate);

// Update Profile settings
router.patch('/profile', async (req, res, next) => {
  try {
    const { name, username, avatarUrl, bannerUrl, headline, bio } = req.body;
    
    // Check if username is already taken by someone else
    if (username) {
      const existing = await User.findOne({ username: username.toLowerCase(), _id: { $ne: req.user.id } });
      if (existing) {
        return res.status(400).json({ error: 'Username is already taken.' });
      }
    }

    const updates = { name };
    if (username !== undefined) updates.username = username.toLowerCase() || null;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (bannerUrl !== undefined) updates.bannerUrl = bannerUrl;
    if (headline !== undefined) updates.headline = headline;
    if (bio !== undefined) updates.bio = bio;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update Personal Info
router.patch('/personal', async (req, res, next) => {
  try {
    const { phone, location, timezone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { phone, location, timezone } },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update Socials & Skills
router.patch('/socials', async (req, res, next) => {
  try {
    const { githubUrl, linkedinUrl, portfolioUrl, resumeUrl, twitterUrl, techStack, skills, experienceLevel, interests, certifications } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          githubUrl,
          linkedinUrl,
          portfolioUrl,
          resumeUrl,
          twitterUrl,
          techStack,
          skills,
          experienceLevel,
          interests,
          certifications
        }
      },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update Preferences
router.patch('/preferences', async (req, res, next) => {
  try {
    const { emailPreferences, notificationSettings, language, theme, accentColor, animationsEnabled, dashboardLayout, profileVisibility } = req.body;
    
    const updates = {};
    if (emailPreferences) updates.emailPreferences = emailPreferences;
    if (notificationSettings) updates.notificationSettings = notificationSettings;
    if (language) updates.language = language;
    if (theme) updates.theme = theme;
    if (accentColor) updates.accentColor = accentColor;
    if (animationsEnabled !== undefined) updates.animationsEnabled = animationsEnabled;
    if (dashboardLayout) updates.dashboardLayout = dashboardLayout;
    if (profileVisibility) updates.profileVisibility = profileVisibility;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Setup 2FA (Mock setup for standard verification)
router.post('/2fa/setup', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Generate a mock secret if not already set
    const secret = user.twoFactorSecret || crypto.randomBytes(10).toString('hex').toUpperCase();
    
    // We update the secret in DB, but don't enable 2FA yet until verified
    await User.findByIdAndUpdate(req.user.id, { $set: { twoFactorSecret: secret } });

    // Mock authenticator URI pointing to qrserver API
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=otpauth://totp/TaskForge:${encodeURIComponent(user.email)}?secret=${secret}&issuer=TaskForge`;

    res.json({ secret, qrCodeUrl });
  } catch (error) {
    next(error);
  }
});

// Verify and enable 2FA
router.post('/2fa/enable', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Verification code must be 6 digits.' });
    }

    if (!/^\d+$/.test(code)) {
      return res.status(400).json({ error: 'Invalid verification code format.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { twoFactorEnabled: true } },
      { new: true }
    );
    res.json({ success: true, twoFactorEnabled: user.twoFactorEnabled });
  } catch (error) {
    next(error);
  }
});

// Disable 2FA
router.post('/2fa/disable', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { twoFactorEnabled: false, twoFactorSecret: null } },
      { new: true }
    );
    res.json({ success: true, twoFactorEnabled: user.twoFactorEnabled });
  } catch (error) {
    next(error);
  }
});

// Session Management: List active sessions & device history
router.get('/sessions', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('activeSessions loginActivity deviceHistory');
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Session Management: Revoke session
router.delete('/sessions/:id', async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { activeSessions: { id: sessionId } } },
      { new: true }
    );
    res.json({ success: true, activeSessions: user.activeSessions });
  } catch (error) {
    next(error);
  }
});

// Developer API key generation
router.post('/api-keys', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'API key name is required.' });

    // Generate a random token
    const rawKey = `tf_${crypto.randomBytes(24).toString('hex')}`;
    const keyId = crypto.randomBytes(8).toString('hex');

    const newKey = {
      id: keyId,
      name,
      key: rawKey,
      createdAt: new Date(),
      lastUsed: null
    };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $push: { apiKeys: newKey } },
      { new: true }
    );

    res.json({ newKey, apiKeys: user.apiKeys });
  } catch (error) {
    next(error);
  }
});

// Developer API key revocation
router.delete('/api-keys/:id', async (req, res, next) => {
  try {
    const keyId = req.params.id;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { apiKeys: { id: keyId } } },
      { new: true }
    );
    res.json({ success: true, apiKeys: user.apiKeys });
  } catch (error) {
    next(error);
  }
});

// Developer webhooks management
router.post('/webhooks', async (req, res, next) => {
  try {
    const { url, events } = req.body;
    if (!url) return res.status(400).json({ error: 'Webhook URL is required.' });

    const newWebhook = {
      id: crypto.randomBytes(8).toString('hex'),
      url,
      events: events || ['task.created', 'task.updated'],
      active: true
    };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $push: { webhooks: newWebhook } },
      { new: true }
    );

    res.json({ newWebhook, webhooks: user.webhooks });
  } catch (error) {
    next(error);
  }
});

router.delete('/webhooks/:id', async (req, res, next) => {
  try {
    const webhookId = req.params.id;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { webhooks: { id: webhookId } } },
      { new: true }
    );
    res.json({ success: true, webhooks: user.webhooks });
  } catch (error) {
    next(error);
  }
});

router.patch('/developer/mode', async (req, res, next) => {
  try {
    const { developerMode } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { developerMode } },
      { new: true }
    );
    res.json({ success: true, developerMode: user.developerMode });
  } catch (error) {
    next(error);
  }
});

// AI Model customization
router.patch('/ai/settings', async (req, res, next) => {
  try {
    const { temperature, maxTokens, systemPrompt } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          'customModelSettings.temperature': temperature,
          'customModelSettings.maxTokens': maxTokens,
          'customModelSettings.systemPrompt': systemPrompt
        }
      },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.post('/ai/prompts', async (req, res, next) => {
  try {
    const { name, prompt } = req.body;
    if (!name || !prompt) return res.status(400).json({ error: 'Name and prompt text are required.' });

    const newPrompt = {
      id: crypto.randomBytes(8).toString('hex'),
      name,
      prompt
    };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $push: { savedPrompts: newPrompt } },
      { new: true }
    );

    res.json({ savedPrompts: user.savedPrompts });
  } catch (error) {
    next(error);
  }
});

router.delete('/ai/prompts/:id', async (req, res, next) => {
  try {
    const promptId = req.params.id;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { savedPrompts: { id: promptId } } },
      { new: true }
    );
    res.json({ success: true, savedPrompts: user.savedPrompts });
  } catch (error) {
    next(error);
  }
});

// Data Export
router.get('/export', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const [user, memberRoles, comments, auditLogs] = await Promise.all([
      User.findById(userId),
      ProjectMember.find({ userId }).populate('projectId'),
      Comment.find({ userId }),
      AuditLog.find({ userId })
    ]);

    const projectIds = memberRoles.map(m => m.projectId?._id);
    const projects = memberRoles.map(m => m.projectId).filter(Boolean);
    const tasks = await Task.find({ projectId: { $in: projectIds } });

    const exportData = {
      exportedAt: new Date(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        bio: user.bio,
        headline: user.headline,
        createdAt: user.createdAt,
        techStack: user.techStack,
        skills: user.skills,
        experienceLevel: user.experienceLevel,
        certifications: user.certifications
      },
      projects: projects.map(p => ({
        id: p._id,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt
      })),
      tasks: tasks.map(t => ({
        id: t._id,
        projectId: t.projectId,
        title: t.title,
        description: t.description,
        status: t.status,
        dueDate: t.dueDate,
        createdAt: t.createdAt
      })),
      commentsCount: comments.length,
      auditLogsCount: auditLogs.length
    };

    res.setHeader('Content-disposition', 'attachment; filename=taskforge_user_export.json');
    res.setHeader('Content-type', 'application/json');
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    next(error);
  }
});

// Danger Zone: Delete Account
router.delete('/account', async (req, res, next) => {
  try {
    const userId = req.user.id;

    await Promise.all([
      ProjectMember.deleteMany({ userId }),
      Comment.deleteMany({ userId }),
      AuditLog.deleteMany({ userId }),
      User.findByIdAndDelete(userId)
    ]);

    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

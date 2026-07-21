const express = require('express');
const { checkDeadlines } = require('../lib/scheduler');

const router = express.Router();

router.get('/deadlines', async (req, res, next) => {
  try {
    // Vercel automatically passes the CRON_SECRET as a Bearer token in the Authorization header
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.warn('⚠️ [CRON] CRON_SECRET is not configured in environment variables');
      return res.status(500).json({ error: 'Server misconfiguration: CRON_SECRET missing' });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ [CRON] Unauthorized cron execution attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('⏰ [CRON] Triggering deadline check via Vercel Cron...');
    
    // Pass null for io as WebSockets don't persist in serverless environments
    await checkDeadlines(null);
    
    res.status(200).json({ success: true, message: 'Deadline check completed' });
  } catch (error) {
    console.error('❌ [CRON] Error during deadline check:', error);
    next(error);
  }
});

module.exports = router;

const connectDB = require('../apps/api/src/lib/database');
const app = require('../apps/api/src/index');

module.exports = async (req, res) => {
  try {
    await connectDB();

    // Ensure req.url starts with '/api' for Express route matching on Vercel
    if (req.url && !req.url.startsWith('/api')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }

    return app(req, res);
  } catch (err) {
    console.error('[Vercel Serverless Function Error]:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: err.message || 'Database Connection or Server Error',
      message: err.message || 'Failed to initialize serverless function',
    }));
  }
};


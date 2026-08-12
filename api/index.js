const connectDB = require('../apps/api/src/lib/database');
const app = require('../apps/api/src/index');

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[Vercel Serverless DB Error]:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ 
      error: 'Database Connection Error',
      details: err.message || 'Unable to connect to MongoDB Atlas. Ensure MONGODB_URI is configured in Vercel settings and MongoDB IP Whitelist includes 0.0.0.0/0.'
    }));
  }
  return app(req, res);
};

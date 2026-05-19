const connectDB = require('../apps/api/src/lib/database');
const app = require('../apps/api/src/index');

// Ensure DB is connected before handling requests
let dbReady = false;

module.exports = async (req, res) => {
  if (!dbReady) {
    await connectDB();
    dbReady = true;
  }
  return app(req, res);
};

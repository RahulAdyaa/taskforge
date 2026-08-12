const connectDB = require('../apps/api/src/lib/database');
const app = require('../apps/api/src/index');

module.exports = async (req, res) => {
  await connectDB();
  return app(req, res);
};


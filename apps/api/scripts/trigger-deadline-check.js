require('dotenv').config({ path: 'apps/api/.env' });
const connectDB = require('../src/lib/database');
const { checkDeadlines } = require('../src/lib/scheduler');

async function run() {
  console.log('Connecting to database...');
  await connectDB();
  console.log('Running checkDeadlines()...');
  await checkDeadlines(null);
  console.log('Finished!');
  process.exit(0);
}

run();

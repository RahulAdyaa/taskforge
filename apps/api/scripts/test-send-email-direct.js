require('dotenv').config({ path: 'apps/api/.env' });
const { sendDeadlineEmail } = require('../src/lib/mailer');

async function test() {
  console.log('Testing sendDeadlineEmail to rahuladyayt@gmail.com...');
  console.log('SMTP Config:');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('Port:', process.env.SMTP_PORT);
  console.log('User:', process.env.SMTP_USER);

  try {
    const info = await sendDeadlineEmail('rahuladyayt@gmail.com', 'Rahul adya', 'TEST TASK FOR DEADLINE', new Date(), 'overdue');
    console.log('✅ Email successfully sent via Nodemailer!');
    console.log('Response:', info);
  } catch (err) {
    console.error('❌ Email sending failed with error:', err);
  }
  process.exit(0);
}
test();

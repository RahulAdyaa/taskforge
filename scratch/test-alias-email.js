const nodemailer = require('nodemailer');
require('dotenv').config({ path: './apps/api/.env' });

async function test() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log("Sending test email from:", process.env.SMTP_USER);

  // Send to alias email
  const info = await transporter.sendMail({
    from: `"TaskForge Notifications" <${process.env.SMTP_USER}>`,
    to: "rahuladyayt+taskforge@gmail.com",
    subject: "⏰ [URGENT] Task Deadline Passed: Test Task",
    text: "Hello! This is a test deadline notification email from TaskForge.",
    html: `<div style="padding: 20px; font-family: sans-serif; background: #FAF9F6; color: #111;"><h2>⏰ Task Deadline Passed</h2><p>Your task deadline has ended!</p></div>`
  });

  console.log("Sent successfully! Response:", info);
}

test();

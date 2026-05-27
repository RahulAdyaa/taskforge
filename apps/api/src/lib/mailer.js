const nodemailer = require('nodemailer');

let transporter;

const getTransporter = async () => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    // Real SMTP configuration from .env
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Ethereal fallback: create a real test SMTP account automatically
    console.log('🤖 [MAILER] No SMTP configuration found in .env. Creating temporary Ethereal account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      // Store test credentials so they can be viewed if needed
      transporter.isTest = true;
      transporter.testAccount = testAccount;
    } catch (err) {
      console.error('Failed to create Ethereal SMTP account, using standard console logger: ', err);
      // Null transporter fallback
      transporter = {
        sendMail: async (options) => {
          console.log(`\n==================================================`);
          console.log(`📬 [MOCK EMAIL] TO: ${options.to}`);
          console.log(`SUBJECT: ${options.subject}`);
          console.log(`BODY:\n${options.text}`);
          console.log(`==================================================\n`);
          return { messageId: 'mock-id-' + Date.now(), previewUrl: 'console-only' };
        }
      };
    }
  }
  return transporter;
};

const sendResetOtpEmail = async (email, name, otp) => {
  const mailTransporter = await getTransporter();
  
  const subject = 'Reset Your Password';
  const text = `Hello ${name},\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, ignore this email.\n\nBest regards,\nTaskForge Security Team`;
  
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 30px; border: 1px solid #E8E4DD; border-radius: 24px; background-color: #FAF9F6; color: #18181B;">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; border-bottom: 3px solid #E63B2E; padding-bottom: 6px; text-transform: uppercase;">TASKFORGE</span>
      </div>
      
      <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 12px; color: #111111; text-align: center;">Reset Your Password</h2>
      
      <p style="font-size: 14px; line-height: 1.6; color: #52525B;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #52525B;">We received a request to reset your password. Use the verification code below to continue:</p>
      
      <div style="background-color: #EEEBE4; border: 2px solid #E4E2DC; border-radius: 16px; padding: 20px; text-align: center; margin: 28px 0;">
        <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #E63B2E;">${otp}</span>
      </div>
      
      <p style="font-size: 13px; line-height: 1.5; color: #71717A; text-align: center; margin-bottom: 20px;">
        This code expires in <strong>10 minutes</strong>.
      </p>
      
      <div style="border-top: 1px solid #E8E4DD; padding-top: 18px; margin-top: 10px;">
        <p style="font-size: 11px; line-height: 1.5; color: #A1A1AA; text-align: center;">
          ⚠️ If you did not request this password reset, please ignore this email. Your account remains secure.
        </p>
      </div>
    </div>
  `;

  try {
    const info = await mailTransporter.sendMail({
      from: process.env.EMAIL_FROM || '"TaskForge Security" <security@taskforge.com>',
      to: email,
      subject,
      text,
      html,
    });

    if (mailTransporter.isTest) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`\n==================================================`);
      console.log(`📬 [ETHEREAL SMTP] Email sent to: ${email}`);
      console.log(`🔗 [PREVIEW LINK]: ${previewUrl}`);
      console.log(`==================================================\n`);
      return { ...info, previewUrl };
    }
    
    return info;
  } catch (error) {
    console.error('Mailer send error:', error);
    throw error;
  }
};

module.exports = {
  sendResetOtpEmail
};

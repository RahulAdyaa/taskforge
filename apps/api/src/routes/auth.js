const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const { User } = require('../models');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { generateTokens, verifyRefreshToken } = require('../lib/jwt');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const { sendResetOtpEmail } = require('../lib/mailer');
const { verifyTOTP } = require('../lib/totp');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const router = express.Router();

async function recordSession(user, req, isSuccess = true) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown Browser';
  
  let browser = 'Unknown Browser';
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edge')) browser = 'Edge';

  let device = 'Desktop Device';
  if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
    device = 'Mobile Device';
  }

  let location = 'Local Network';
  if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
    location = 'Remote Access';
  }

  user.loginActivity.push({
    ip,
    success: isSuccess,
    timestamp: new Date(),
    browser: `${browser} on ${device === 'Mobile Device' ? 'Mobile' : 'Desktop'}`
  });

  let sessionId = null;
  if (isSuccess) {
    sessionId = crypto.randomBytes(16).toString('hex');
    user.activeSessions.push({
      id: sessionId,
      device: `${device} (${browser})`,
      ip,
      location,
      lastActive: new Date()
    });
    
    if (user.activeSessions.length > 5) {
      user.activeSessions.shift();
    }
  }

  await user.save();
  return sessionId;
}

const signupSchema = z.object({
  name: z.string().min(2),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, { message: "Username must be lowercase letters, numbers, or underscores only" }),
  email: z.string().email(),
  password: z.string().min(8).regex(/[0-9]/, { message: "Password must contain at least one number" }),
});

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string(),
  code: z.string().optional(),
});

const googleLoginSchema = z.object({
  token: z.string()
});

router.post('/signup', validate(signupSchema), async (req, res, next) => {
  try {
    const { name, username, email, password } = req.body;

    // Check email uniqueness
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Check username uniqueness
    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(409).json({ error: 'This username is already taken.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      username: username.toLowerCase(),
    });

    // Record session
    const sessionId = await recordSession(user, req, true);

    const { accessToken, refreshToken } = generateTokens(user.id, sessionId);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.twoFactorSecret;

    res.status(201).json({ accessToken, user: userObj });
  } catch (error) {
    next(error);
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { identifier, password, code } = req.body;
    const lowerIdentifier = identifier.toLowerCase().trim();

    // Look up by email OR username
    const user = await User.findOne({
      $or: [{ email: lowerIdentifier }, { username: lowerIdentifier }]
    });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await recordSession(user, req, false); // Log failed attempt
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Enforce 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!code) {
        // Prompt for code without logging a failed session
        return res.json({ twoFactorRequired: true });
      }
      
      const isValid = verifyTOTP(user.twoFactorSecret, code);
      if (!isValid) {
        await recordSession(user, req, false);
        return res.status(401).json({ error: 'Invalid 2FA code.' });
      }
    }

    // Record session
    const sessionId = await recordSession(user, req, true);

    const { accessToken, refreshToken } = generateTokens(user.id, sessionId);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.twoFactorSecret;

    res.json({ accessToken, user: userObj });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const payload = verifyRefreshToken(token);
    
    // Validate user still exists
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    // Verify session is still active
    if (payload.sessionId) {
      const isSessionActive = user.activeSessions.some(s => s.id === payload.sessionId);
      if (!isSessionActive) {
        return res.status(401).json({ error: 'Session has been revoked or expired' });
      }
    }

    // Perform Refresh Token Rotation (RTR): generate new access AND refresh tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, payload.sessionId);

    // Set rotated refresh token cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({ accessToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password -twoFactorSecret');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.post('/google', validate(googleLoginSchema), async (req, res, next) => {
  try {
    const { token } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      const baseUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
      const rand = Math.floor(1000 + Math.random() * 9000);
      const username = `${baseUsername}_${rand}`;

      user = await User.create({
        email,
        name,
        googleId,
        username,
      });
    } else if (!user.googleId) {
      user = await User.findOneAndUpdate(
        { email },
        { googleId },
        { new: true }
      );
    }

    // Record session
    const sessionId = await recordSession(user, req, true);

    const { accessToken, refreshToken } = generateTokens(user.id, sessionId);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.twoFactorSecret;

    res.json({ accessToken, user: userObj });
  } catch (error) {
    console.error("Google verify error:", error);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

// Update profile (name)
router.patch('/profile', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name },
      { new: true }
    );
    res.json({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    next(error);
  }
});

// Change password
router.patch('/password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new passwords are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const user = await User.findById(req.user.id);
    if (!user.password) {
      return res.status(400).json({ error: 'Account uses Google Sign-In. Password cannot be changed.' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(req.user.id, { password: hashedPassword });

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    next(error);
  }
});

// ─── Forgot Password Reset Flow ───────────────────────────────────

// Helper: hash OTP with SHA-256
function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

// 1. Submit email or username to request OTP
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: 'Email or username is required.' });

    const lowerIdentifier = identifier.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: lowerIdentifier }, { username: lowerIdentifier }]
    });

    // Always return success to prevent user enumeration
    if (!user) {
      return res.json({ message: 'If an account exists, a verification code has been sent.' });
    }

    // Generate secure 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    
    // Store hashed OTP, expiration, and reset attempt counter
    user.resetPasswordOtp = hashOtp(otp);
    user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    user.resetPasswordOtpAttempts = 0;
    user.resetPasswordOtpLockedUntil = null;
    // Clear any prior reset token
    user.resetPasswordToken = null;
    user.resetPasswordTokenExpires = null;

    await user.save();

    // Log OTP to console in development mode
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔑 [DEV OTP] Generated verification code for ${user.email}: ${otp}`);
      try {
        const fs = require('fs');
        const path = require('path');
        const scratchDir = path.join(__dirname, '../../../../scratch');
        if (!fs.existsSync(scratchDir)) {
          fs.mkdirSync(scratchDir, { recursive: true });
        }
        fs.writeFileSync(path.join(scratchDir, 'last-otp.txt'), otp, 'utf8');
      } catch (err) {
        console.error('Failed to write dev OTP to scratch file:', err);
      }
    }

    // Send OTP via actual mail transporter (SMTP or Ethereal test mailer)
    await sendResetOtpEmail(user.email, user.name, otp);

    res.json({ message: 'If an account exists, a verification code has been sent.' });
  } catch (error) {
    next(error);
  }
});

// 2. Verify OTP code and issue reset token
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) {
      return res.status(400).json({ error: 'Identifier and OTP code are required.' });
    }

    const lowerIdentifier = identifier.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: lowerIdentifier }, { username: lowerIdentifier }]
    });

    if (!user || !user.resetPasswordOtp) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    // Check brute-force lockout
    if (user.resetPasswordOtpLockedUntil && user.resetPasswordOtpLockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.resetPasswordOtpLockedUntil - Date.now()) / 60000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${minutesLeft} minute(s).` });
    }

    // Check expiry
    if (user.resetPasswordOtpExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Compare hashed OTP
    if (user.resetPasswordOtp !== hashOtp(otp)) {
      user.resetPasswordOtpAttempts = (user.resetPasswordOtpAttempts || 0) + 1;

      // Lock out after 5 failed attempts for 15 minutes
      if (user.resetPasswordOtpAttempts >= 5) {
        user.resetPasswordOtpLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await user.save();
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    // OTP is valid — generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    
    // Invalidate OTP
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpires = null;
    user.resetPasswordOtpAttempts = 0;
    user.resetPasswordOtpLockedUntil = null;
    
    await user.save();

    res.json({ resetToken });
  } catch (error) {
    next(error);
  }
});

// 3. Reset password using valid token
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Reset token and new password are required.' });
    }

    // Password complexity: min 8 chars, 1 uppercase, 1 lowercase, 1 number
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter.' });
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one lowercase letter.' });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one number.' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordTokenExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Password reset link is invalid or has expired.' });
    }

    // Hash and update password
    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordTokenExpires = null;
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpires = null;
    user.resetPasswordOtpAttempts = 0;
    user.resetPasswordOtpLockedUntil = null;
    
    // Clear active sessions to force re-login
    user.activeSessions = [];

    await user.save();

    res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

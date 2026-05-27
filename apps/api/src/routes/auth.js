const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const { User } = require('../models');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { generateTokens, verifyRefreshToken } = require('../lib/jwt');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

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

  if (isSuccess) {
    const sessionId = crypto.randomBytes(16).toString('hex');
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
}

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).regex(/[0-9]/, { message: "Password must contain at least one number" }),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const googleLoginSchema = z.object({
  token: z.string()
});

router.post('/signup', validate(signupSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate a default unique username handle
    const baseUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
    const rand = Math.floor(1000 + Math.random() * 9000);
    const username = `${baseUsername}_${rand}`;

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      username,
    });

    // Record session
    await recordSession(user, req, true);

    const { accessToken, refreshToken } = generateTokens(user.id);

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
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await recordSession(user, req, false); // Log failed attempt
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Record session
    await recordSession(user, req, true);

    const { accessToken, refreshToken } = generateTokens(user.id);

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
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const payload = verifyRefreshToken(refreshToken);
    const { accessToken } = generateTokens(payload.userId);

    res.json({ accessToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
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
    await recordSession(user, req, true);

    const { accessToken, refreshToken } = generateTokens(user.id);

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

// 1. Submit email to request OTP
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Email is not registered.' });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry

    await user.save();

    console.log(`🚀 [PASSWORD RESET OTP] For: ${email} -> CODE: ${otp}`);

    const isDev = process.env.NODE_ENV !== 'production';
    res.json({
      message: 'Password reset OTP code sent to your email.',
      ...(isDev ? { devOtp: otp } : {})
    });
  } catch (error) {
    next(error);
  }
});

// 2. Verify OTP code and issue reset token
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP code are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || user.resetPasswordOtp !== otp) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    if (user.resetPasswordOtpExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Generate secure token for resetting password
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry
    
    // Clear OTP
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpires = null;
    
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
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
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
    
    await user.save();

    res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

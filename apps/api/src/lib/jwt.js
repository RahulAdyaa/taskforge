const jwt = require('jsonwebtoken');

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET)) {
  console.warn('⚠️ WARNING: JWT_SECRET or JWT_REFRESH_SECRET is not explicitly set in environment variables. Using fallback secrets.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';

const generateTokens = (userId, sessionId) => {
  const accessToken = jwt.sign({ userId, sessionId }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId, sessionId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
};

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
};

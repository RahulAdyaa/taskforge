const { verifyAccessToken } = require('../lib/jwt');
const { User } = require('../models');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    // Check if the session associated with the token is still active (if sessionId is present)
    if (payload.sessionId) {
      const isSessionActive = user.activeSessions.some(s => s.id === payload.sessionId);
      if (!isSessionActive) {
        return res.status(401).json({ error: 'Unauthorized: Session has been revoked or expired' });
      }

      // Asynchronously update the session's lastActive timestamp
      const session = user.activeSessions.find(s => s.id === payload.sessionId);
      if (session) {
        session.lastActive = new Date();
        user.save().catch(err => console.error('Failed to update session activity:', err));
      }
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

module.exports = authenticate;

require('dotenv').config(); // Trigger nodemon restart after freeing port 3001
// Trigger Vercel redeployment to load newly saved SMTP settings
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./lib/database');
const { requireDB } = require('./lib/database');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const dashboardRoutes = require('./routes/dashboard');
const myTasksRoutes = require('./routes/my-tasks');
const notificationsRoutes = require('./routes/notifications');
const standupRoutes = require('./routes/standup');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Fix Express v5 strict Forwarded header validation on Vercel ───
// Vercel's proxy injects a 'Forwarded' header that Express v5 rejects
// with "ValidationError: The 'Forwarded' header". Strip it early.
app.use((req, res, next) => {
  if (req.headers['forwarded']) {
    delete req.headers['forwarded'];
  }
  next();
});

// CORS — allow frontend origin
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o.replace(/\/$/, '')))) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Safe event emitter (no-op when Socket.IO unavailable) ─────────
/**
 * Safely emit a Socket.IO event. Falls back to no-op in serverless
 * environments where Socket.IO is not initialized.
 */
function emitEvent(req, room, event, data) {
  try {
    if (req.io) {
      req.io.to(room).emit(event, data);
    }
  } catch (e) {
    // Silently ignore — sockets are optional
  }
}

// Attach emitEvent helper to every request
app.use((req, res, next) => {
  req.emitEvent = (room, event, data) => emitEvent(req, room, event, data);
  next();
});

// ─── Socket.IO setup (local dev only, skipped on Vercel) ───────────
let server;
let io;

if (!process.env.VERCEL) {
  const http = require('http');
  const { initSockets } = require('./lib/sockets');

  server = http.createServer(app);
  io = initSockets(server, allowedOrigins);

  // Pass io to routes via req
  app.use((req, res, next) => {
    req.io = io;
    next();
  });
}

// ─── Routes ────────────────────────────────────────────────────────
// Health check — always works even if DB is down
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Guard all API routes: return 503 while DB is reconnecting
app.use('/api', requireDB);

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/my-tasks', myTasksRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/standup', standupRoutes);
app.use('/api/settings', settingsRoutes);

// Tasks and dashboard routes are nested under projects
projectRoutes.use('/:projectId/tasks', taskRoutes);
projectRoutes.use('/:projectId/dashboard', dashboardRoutes);

// In production (non-Vercel), serve the Vite frontend build
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const path = require('path');
  const distPath = path.resolve(__dirname, '../../web/dist');
  app.use(express.static(distPath));

  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      next();
    }
  });
}

app.use(errorHandler);

// ─── Start server (local dev / self-hosted only) ───────────────────
// Start listening IMMEDIATELY, then connect to MongoDB in the background.
// If MongoDB is temporarily unreachable (e.g. IP not whitelisted),
// the server stays up and keeps retrying automatically.
if (!process.env.VERCEL) {
  const listener = server || app;
  listener.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    // Connect to MongoDB in the background (retries automatically)
    connectDB().catch(() => {
      // connectDB handles its own retries — this catch prevents
      // unhandled-rejection noise if all retries are exhausted.
    });
  });
}

// Export for Vercel serverless
module.exports = app;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./lib/database');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const dashboardRoutes = require('./routes/dashboard');
const myTasksRoutes = require('./routes/my-tasks');
const notificationsRoutes = require('./routes/notifications');
const standupRoutes = require('./routes/standup');

const app = express();
const PORT = process.env.PORT || 3001;

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
  const { Server } = require('socket.io');

  server = http.createServer(app);
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  // Pass io to routes via req
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  io.on('connection', (socket) => {
    socket.on('register_user', (userId) => {
      socket.join(`user_${userId}`);
    });
    socket.on('join_project', (projectId) => {
      socket.join(`project_${projectId}`);
    });
    socket.on('leave_project', (projectId) => {
      socket.leave(`project_${projectId}`);
    });
  });
}

// ─── Routes ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/my-tasks', myTasksRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/standup', standupRoutes);

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
if (!process.env.VERCEL) {
  connectDB().then(() => {
    const listener = server || app;
    listener.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
}

// Export for Vercel serverless
module.exports = app;

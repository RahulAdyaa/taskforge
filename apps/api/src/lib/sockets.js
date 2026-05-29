const { Server } = require('socket.io');
const { verifyAccessToken } = require('./jwt');
const { Comment, Task, AuditLog, ProjectMember, User } = require('../models');

// Track online users globally
// Maps userId -> Set of socketIds
const onlineUsers = new Map();

function initSockets(server, allowedOrigins) {
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }
    try {
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.userId).select('name');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      socket.userId = payload.userId;
      socket.userName = user.name;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Setup Redis Adapter if REDIS_URL is provided
  let redisClient = null;
  if (process.env.REDIS_URL) {
    try {
      const { createClient } = require('redis');
      const { createAdapter } = require('@socket.io/redis-adapter');
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      
      Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        redisClient = pubClient;
        console.log('✅ Socket.IO Redis adapter configured');
      }).catch(err => {
        console.error('❌ Failed to connect to Redis for Socket.IO:', err);
      });
    } catch (e) {
      console.error('❌ Redis adapter could not be loaded:', e);
    }
  }

  // Helper to get online users
  async function getOnlineUsers() {
    if (redisClient && redisClient.isOpen) {
      try {
        return await redisClient.sMembers('online_users');
      } catch (e) {
        console.error('Redis presence fetch failed, falling back to local map:', e);
      }
    }
    return Array.from(onlineUsers.keys());
  }

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    
    // Add user to local onlineUsers map
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Redis presence track
    if (redisClient && redisClient.isOpen) {
      try {
        const key = `user:presence:${userId}`;
        const count = await redisClient.incr(key);
        await redisClient.expire(key, 86400); // 24h expiration safety
        if (count === 1) {
          await redisClient.sAdd('online_users', userId);
        }
      } catch (e) {
        console.error('Redis presence track failed:', e);
      }
    }

    // Broadcast updated list of online users to everyone
    const onlineIds = await getOnlineUsers();
    io.emit('presence_update', onlineIds);

    socket.on('register_user', (userIdParam) => {
      socket.join(`user_${userIdParam}`);
    });

    socket.on('join_project', async (projectId) => {
      socket.join(`project_${projectId}`);
      // Send the current list of online users on join
      const currentOnline = await getOnlineUsers();
      socket.emit('presence_update', currentOnline);
    });

    socket.on('leave_project', (projectId) => {
      socket.leave(`project_${projectId}`);
    });

    // Thread room events
    socket.on('join_thread', ({ taskId, projectId }) => {
      socket.join(`thread_${taskId}`);
    });

    socket.on('leave_thread', ({ taskId }) => {
      socket.leave(`thread_${taskId}`);
    });

    // Real-time message delivery over WS
    socket.on('send_message', async ({ taskId, projectId, content }) => {
      try {
        // Authenticate user has access to task/project
        const member = await ProjectMember.findOne({ userId, projectId });
        if (!member) {
          return socket.emit('error_message', 'Not authorized to post in this project');
        }

        const task = await Task.findById(taskId);
        if (!task || task.projectId.toString() !== projectId) {
          return socket.emit('error_message', 'Task not found');
        }

        // Create comment in Mongoose
        const comment = await Comment.create({
          content,
          taskId,
          userId,
        });

        const populated = await Comment.findById(comment.id).populate('userId', 'name email');
        const obj = populated.toJSON();
        obj.user = { id: populated.userId._id.toString(), name: populated.userId.name, email: populated.userId.email };
        obj.userId = populated.userId._id.toString();

        // Broadcast comment to everyone in the thread room (including the sender)
        io.to(`thread_${taskId}`).emit('new_comment', { taskId, comment: obj });

        // Broadcast to project room that task has been updated (e.g. for logs or project-wide counts)
        io.to(`project_${projectId}`).emit('task_updated', task);
        io.to(`project_${projectId}`).emit('comment_added', { taskId, comment: obj });

        // Save Audit Log
        await AuditLog.create({
          action: 'COMMENT_ADDED',
          details: JSON.stringify({ taskId: task.id }),
          projectId,
          userId,
          taskId,
        });
      } catch (err) {
        console.error('Error handling send_message socket event:', err);
        socket.emit('error_message', 'Failed to save and deliver message');
      }
    });

    // Real-time message edit over WS
    socket.on('edit_message', async ({ taskId, projectId, commentId, content }) => {
      try {
        const member = await ProjectMember.findOne({ userId, projectId });
        if (!member) {
          return socket.emit('error_message', 'Not authorized in this project');
        }

        const comment = await Comment.findById(commentId);
        if (!comment || comment.taskId.toString() !== taskId) {
          return socket.emit('error_message', 'Comment not found');
        }

        if (comment.userId.toString() !== userId) {
          return socket.emit('error_message', 'Not authorized to edit this comment');
        }

        comment.content = content;
        comment.isEdited = true;
        await comment.save();

        const populated = await Comment.findById(comment.id).populate('userId', 'name email');
        const obj = populated.toJSON();
        obj.user = { id: populated.userId._id.toString(), name: populated.userId.name, email: populated.userId.email };
        obj.userId = populated.userId._id.toString();

        // Broadcast updated comment to everyone in the thread and project
        io.to(`thread_${taskId}`).emit('comment_updated', { taskId, comment: obj });
        io.to(`project_${projectId}`).emit('comment_updated', { taskId, comment: obj });

        // Save Audit Log
        await AuditLog.create({
          action: 'COMMENT_EDITED',
          details: JSON.stringify({ taskId, commentId }),
          projectId,
          userId,
          taskId,
        });
      } catch (err) {
        console.error('Error handling edit_message socket event:', err);
        socket.emit('error_message', 'Failed to edit message');
      }
    });

    // Real-time message delete over WS
    socket.on('delete_message', async ({ taskId, projectId, commentId }) => {
      try {
        const member = await ProjectMember.findOne({ userId, projectId });
        if (!member) {
          return socket.emit('error_message', 'Not authorized in this project');
        }

        const comment = await Comment.findById(commentId);
        if (!comment || comment.taskId.toString() !== taskId) {
          return socket.emit('error_message', 'Comment not found');
        }

        const isAdmin = member.role === 'ADMIN';
        if (comment.userId.toString() !== userId && !isAdmin) {
          return socket.emit('error_message', 'Not authorized to delete this comment');
        }

        await Comment.findByIdAndDelete(commentId);

        // Broadcast deletion to everyone in the thread and project
        io.to(`thread_${taskId}`).emit('comment_deleted', { taskId, commentId });
        io.to(`project_${projectId}`).emit('comment_deleted', { taskId, commentId });

        // Save Audit Log
        await AuditLog.create({
          action: 'COMMENT_DELETED',
          details: JSON.stringify({ taskId, commentId }),
          projectId,
          userId,
          taskId,
        });
      } catch (err) {
        console.error('Error handling delete_message socket event:', err);
        socket.emit('error_message', 'Failed to delete message');
      }
    });

    // Typing indicators
    socket.on('typing_start', ({ taskId, projectId }) => {
      socket.to(`thread_${taskId}`).emit('typing_status', { 
        taskId, 
        userId, 
        userName: socket.userName, 
        isTyping: true 
      });
    });

    socket.on('typing_end', ({ taskId, projectId }) => {
      socket.to(`thread_${taskId}`).emit('typing_status', { 
        taskId, 
        userId, 
        userName: socket.userName, 
        isTyping: false 
      });
    });

    // Disconnect handling
    socket.on('disconnect', async () => {
      // Local untrack
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
        }
      }

      // Redis untrack
      if (redisClient && redisClient.isOpen) {
        try {
          const key = `user:presence:${userId}`;
          const count = await redisClient.decr(key);
          if (count <= 0) {
            await redisClient.del(key);
            await redisClient.sRem('online_users', userId);
          }
        } catch (e) {
          console.error('Redis presence untrack failed:', e);
        }
      }

      // Broadcast updated online users
      const currentOnline = await getOnlineUsers();
      io.emit('presence_update', currentOnline);
    });
  });

  return io;
}

module.exports = { initSockets };

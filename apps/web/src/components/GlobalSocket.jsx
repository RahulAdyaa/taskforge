import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import toast from 'react-hot-toast';

export let globalSocket = null;

// Check if WebSocket is available (VITE_WS_URL set or local dev)
const WS_URL = import.meta.env.VITE_WS_URL || (!import.meta.env.PROD ? 'http://localhost:3001' : '');

export default function GlobalSocket() {
  const { user, isAuthenticated } = useAuthStore();
  const { fetchNotifications, addNotification, isInitialized } = useNotificationStore();
  const pollRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Always fetch notifications on mount
    if (!isInitialized) {
      fetchNotifications();
    }

    // If WebSocket URL is available, use Socket.IO
    if (WS_URL) {
      import('socket.io-client').then(({ io }) => {
        globalSocket = io(WS_URL, { withCredentials: true });

        globalSocket.on('connect', () => {
          globalSocket.emit('register_user', user.id);
        });

        globalSocket.on('notification', (notification) => {
          addNotification(notification);
          toast.success(notification.message, {
            icon: '🔔',
            style: {
              borderRadius: '10px',
              background: '#111',
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: '12px',
            },
          });
        });
      });
    } else {
      // Polling fallback — check for new notifications every 10 seconds
      pollRef.current = setInterval(() => {
        fetchNotifications();
      }, 10000);
    }

    return () => {
      if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isAuthenticated, user]);

  return null;
}

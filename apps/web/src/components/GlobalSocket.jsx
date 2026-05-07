import React, { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import toast from 'react-hot-toast';

export let globalSocket = null;

export default function GlobalSocket() {
  const { user, isAuthenticated } = useAuthStore();
  const { fetchNotifications, addNotification, isInitialized } = useNotificationStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (!isInitialized) {
        fetchNotifications();
      }

      globalSocket = io(import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/' : 'http://localhost:3001'), {
        withCredentials: true,
      });

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
            fontSize: '12px'
          },
        });
      });

      return () => {
        globalSocket.disconnect();
        globalSocket = null;
      };
    }
  }, [isAuthenticated, user]);

  return null;
}

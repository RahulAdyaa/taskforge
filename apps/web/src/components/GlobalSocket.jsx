import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

export let globalSocket = null;

export default function GlobalSocket() {
  const { user, isAuthenticated } = useAuthStore();
  const { fetchNotifications, addNotification, isInitialized } = useNotificationStore();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pollRef = useRef(null);

  // Sync globalSocket export reference for backwards compatibility
  useEffect(() => {
    globalSocket = socket;
    return () => {
      globalSocket = null;
    };
  }, [socket]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Always fetch notifications on mount
    if (!isInitialized) {
      fetchNotifications();
    }

    if (!socket) {
      // Polling fallback — check for new notifications every 10 seconds
      pollRef.current = setInterval(() => {
        fetchNotifications();
      }, 10000);
    } else {
      const handleNotification = (notification) => {
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
      };

      const handleProjectDeleted = ({ projectId }) => {
        queryClient.invalidateQueries(['projects']);
        const currentPath = window.location.pathname;
        if (currentPath.includes(`/app/projects/${projectId}`)) {
          toast.error('This project has been deleted.');
          navigate('/app');
        }
      };

      socket.on('notification', handleNotification);
      socket.on('project_deleted', handleProjectDeleted);

      return () => {
        socket.off('notification', handleNotification);
        socket.off('project_deleted', handleProjectDeleted);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isAuthenticated, user, socket, isInitialized, queryClient, navigate]);

  return null;
}

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

const SocketContext = createContext(null);

const WS_URL = import.meta.env.VITE_WS_URL || (!import.meta.env.PROD ? 'http://localhost:3001' : '');

export function SocketProvider({ children }) {
  const { user, isAuthenticated } = useAuthStore();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    if (!WS_URL) {
      console.warn('⚠️ VITE_WS_URL is not configured; real-time operations will fall back.');
      return;
    }

    let socketInstance;
    import('socket.io-client').then(({ io }) => {
      // Clean up previous instance just in case
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      socketInstance = io(WS_URL, {
        auth: (cb) => {
          cb({ token: localStorage.getItem('accessToken') });
        },
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socketRef.current = socketInstance;
      setSocket(socketInstance);

      socketInstance.on('connect', () => {
        console.log('⚡ Socket connected successfully');
        setIsConnected(true);
        socketInstance.emit('register_user', user.id);
      });

      socketInstance.on('disconnect', (reason) => {
        console.warn('🔌 Socket disconnected:', reason);
        setIsConnected(false);
      });

      socketInstance.on('connect_error', async (err) => {
        console.error('❌ Socket connection error:', err.message, err.context || err);
        
        // If authentication error, try to refresh the token and reconnect the socket
        if (err.message && (err.message.includes('Authentication error') || err.message.includes('token'))) {
          console.log('🔄 Attempting to refresh token for Socket.IO connection recovery...');
          try {
            const axios = (await import('axios')).default;
            const refreshUrl = import.meta.env.VITE_API_URL 
              ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/auth/refresh`
              : (import.meta.env.PROD ? '/api/auth/refresh' : 'http://localhost:3001/api/auth/refresh');
              
            const { data } = await axios.post(refreshUrl, {}, { withCredentials: true });
            if (data && data.accessToken) {
              console.log('✅ Token refreshed successfully for Socket.IO reconnection');
              localStorage.setItem('accessToken', data.accessToken);
              // Reconnect the socket
              socketInstance.connect();
            }
          } catch (refreshErr) {
            console.error('❌ Failed to refresh token for Socket.IO connection:', refreshErr);
          }
        }
      });

      socketInstance.on('presence_update', (onlineIds) => {
        setOnlineUsers(new Set(onlineIds));
      });
    }).catch(err => {
      console.error('Failed to load socket.io-client dynamically:', err);
    });

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

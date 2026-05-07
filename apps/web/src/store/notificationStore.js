import { create } from 'zustand';
import api from '../lib/axios';

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isInitialized: false,

  fetchNotifications: async () => {
    try {
      const { data } = await api.get('/notifications');
      set({ 
        notifications: data, 
        unreadCount: data.filter(n => !n.read).length,
        isInitialized: true 
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  },

  addNotification: (notification) => {
    set(state => {
      // Prevent duplicates just in case
      if (state.notifications.some(n => n.id === notification.id)) {
        return state;
      }
      const newNotifications = [notification, ...state.notifications];
      return {
        notifications: newNotifications,
        unreadCount: state.unreadCount + 1
      };
    });
  },

  markAsRead: async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      set(state => {
        const newNotifications = state.notifications.map(n => 
          n.id === id ? { ...n, read: true } : n
        );
        return {
          notifications: newNotifications,
          unreadCount: newNotifications.filter(n => !n.read).length
        };
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      await api.post('/notifications/read-all');
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  },
}));

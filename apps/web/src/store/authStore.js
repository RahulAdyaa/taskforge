import { create } from 'zustand';
import { useNotificationStore } from './notificationStore';

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  setAuth: (user, token) => {
    localStorage.setItem('accessToken', token);
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    set({ user: null, isAuthenticated: false });
    useNotificationStore.getState().clearNotifications();
  },
}));

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuthStore } from './authStore';
import api from '../lib/axios';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const user = useAuthStore(state => state.user);
  const setAuth = useAuthStore(state => state.setAuth);

  // Initialize theme: user profile -> localStorage -> system prefers-color-scheme
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('taskforge-theme');
      if (savedTheme) return savedTheme;

      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });

  // Sync React state if database user theme preference loads and changes
  useEffect(() => {
    if (user?.theme && user.theme !== theme) {
      setTheme(user.theme);
    }
  }, [user?.theme]);

  // Apply HTML class and write to local storage whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('taskforge-theme', theme);
  }, [theme]);

  // Reactive listener to adapt to OS system theme changes (if user is logged out)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (!user) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [user]);

  const toggleTheme = async () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);

    if (user) {
      try {
        const { data } = await api.patch('/settings/preferences', { theme: nextTheme });
        setAuth(data, localStorage.getItem('accessToken'));
      } catch (err) {
        console.error('Failed to sync theme preference to database.', err);
      }
    }
  };

  const setThemeExplicitly = async (newTheme) => {
    setTheme(newTheme);
    if (user && user.theme !== newTheme) {
      try {
        const { data } = await api.patch('/settings/preferences', { theme: newTheme });
        setAuth(data, localStorage.getItem('accessToken'));
      } catch (err) {
        console.error('Failed to save theme choice to profile.', err);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setThemeExplicitly }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

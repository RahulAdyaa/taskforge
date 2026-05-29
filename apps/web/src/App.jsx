import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ProjectView from './pages/ProjectView';
import Settings from './pages/Settings';
import AccountSettings from './pages/AccountSettings';
import MyTasks from './pages/MyTasks';
import PublicProfile from './pages/PublicProfile';
import ForgotPassword from './pages/ForgotPassword';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import { useAuthStore } from './store/authStore';
import api from './lib/axios';

import CommandPalette from './components/CommandPalette';
import GlobalSocket from './components/GlobalSocket';
import { ThemeProvider } from './store/themeStore';
import { SocketProvider } from './context/SocketContext';
import ChatWidget from './components/ChatWidget';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  const { setAuth, logout, isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        const currentToken = localStorage.getItem('accessToken') || token;
        setAuth(data, currentToken);
      } catch (error) {
        logout();
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-off-white font-mono text-xs">Initializing Session...</div>;
  }

  return (
    <ThemeProvider>
      <SocketProvider>
        <Router>
          <GlobalSocket />
          <CommandPalette />
          {isAuthenticated && <ChatWidget />}
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            
            <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/app/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/app/my-tasks" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
            <Route path="/app/projects/:id" element={<ProtectedRoute><ProjectView /></ProtectedRoute>} />
            <Route path="/app/projects/:id/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/app/settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
            <Route path="/profile/:username" element={<PublicProfile />} />
          </Routes>
        </Router>
      </SocketProvider>
    </ThemeProvider>
  );
}

export default App;

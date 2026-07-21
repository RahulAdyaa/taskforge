import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LayoutGrid, CheckCircle2, Settings as SettingsIcon, LogOut, Sparkles } from 'lucide-react';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import { useAuthStore } from '../store/authStore';
import api from '../lib/axios';

export default function MobileHeader({ projects = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {}
    logout();
  };

  const isNavActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile Top Navigation Bar (Visible on screens < lg) */}
      <header className="lg:hidden bg-white dark:bg-[#121215] border-b border-[#E8E4DD] dark:border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 text-black dark:text-white hover:bg-off-white dark:hover:bg-white/5 rounded-xl border border-[#E8E4DD] dark:border-white/10 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/app" className="font-display text-xl font-bold text-black dark:text-white hover:text-signal-red transition-colors">
            TASKFORGE
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
        </div>
      </header>

      {/* Slide-out Mobile Overlay & Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-4/5 max-w-xs bg-[#F5F3EE] dark:bg-[#09090B] border-r border-[#E8E4DD] dark:border-white/10 flex flex-col p-6 h-full shadow-2xl z-10 transition-transform animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mb-8">
              <Link 
                to="/" 
                onClick={() => setIsOpen(false)}
                className="font-display text-2xl font-bold text-black dark:text-white hover:text-signal-red transition-colors"
              >
                TASKFORGE
              </Link>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-xl border border-[#E8E4DD] dark:border-white/10 text-black dark:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto">
              <Link 
                to="/app/dashboard"
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  isNavActive('/app') || isNavActive('/app/dashboard')
                    ? 'bg-white dark:bg-[#121215] border-[#E8E4DD] dark:border-white/10 text-black dark:text-white font-medium shadow-sm'
                    : 'border-transparent text-black/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/5'
                }`}
              >
                <LayoutGrid className="w-5 h-5" />
                <span>All Projects</span>
              </Link>

              <Link 
                to="/app/my-tasks"
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  isNavActive('/app/my-tasks')
                    ? 'bg-white dark:bg-[#121215] border-[#E8E4DD] dark:border-white/10 text-black dark:text-white font-medium shadow-sm'
                    : 'border-transparent text-black/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/5'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>My Tasks</span>
              </Link>

              <Link 
                to="/app/settings"
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  isNavActive('/app/settings')
                    ? 'bg-white dark:bg-[#121215] border-[#E8E4DD] dark:border-white/10 text-black dark:text-white font-medium shadow-sm'
                    : 'border-transparent text-black/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/5'
                }`}
              >
                <SettingsIcon className="w-5 h-5" />
                <span>Account Settings</span>
              </Link>

              {/* Projects List Section in Drawer */}
              {projects.length > 0 && (
                <div className="pt-4 border-t border-[#E8E4DD] dark:border-white/10">
                  <div className="px-4 text-[10px] font-mono font-bold uppercase tracking-wider text-black/50 dark:text-white/50 mb-2">
                    Projects ({projects.length})
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {projects.map(p => (
                      <Link
                        key={p.id}
                        to={`/app/projects/${p.id}`}
                        onClick={() => setIsOpen(false)}
                        className="block px-4 py-2 text-sm rounded-lg text-black/80 dark:text-white/80 hover:bg-white/60 dark:hover:bg-white/5 truncate transition-colors"
                      >
                        {p.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom User info & logout */}
            <div className="pt-4 border-t border-[#E8E4DD] dark:border-white/10">
              <div className="mb-3 px-2">
                <p className="font-medium text-sm text-black dark:text-white truncate">{user?.name}</p>
                <p className="font-mono text-xs text-black/50 dark:text-white/50 truncate">{user?.email}</p>
              </div>
              <button 
                onClick={() => {
                  setIsOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-signal-red hover:bg-red-500/20 rounded-xl font-medium text-sm transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

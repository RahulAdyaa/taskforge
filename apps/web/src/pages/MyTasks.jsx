import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Settings as SettingsIcon, LogOut, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';
import StandupModal from '../components/StandupModal';

export default function MyTasks() {
  const [showStandup, setShowStandup] = useState(false);
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      const { data } = await api.get('/my-tasks');
      return data;
    }
  });

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {}
    logout();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'TODO': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'IN_PROGRESS': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'DONE': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'LOW': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'MEDIUM': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'HIGH': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'URGENT': return 'bg-signal-red text-white border-red-700';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-off-white flex">
      {/* Sidebar */}
      <div className="w-64 bg-[#F5F3EE] border-r border-[#E8E4DD] flex flex-col p-6 fixed h-full">
        <Link to="/" className="font-display text-2xl font-bold mb-12 block hover:text-signal-red transition-colors">TASKFORGE</Link>
        
        <div className="flex-1 space-y-2">
          <Link to="/app/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-black/60 hover:text-black hover:bg-white/50 transition-all font-medium">
            <LayoutGrid className="w-5 h-5" />
            <span>All Projects</span>
          </Link>
          <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-[#E8E4DD] text-black font-medium">
            <CheckCircle2 className="w-5 h-5" />
            <span>My Tasks</span>
          </div>
          <Link to="/app/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl text-black/60 hover:text-black hover:bg-white/50 transition-all font-medium">
            <SettingsIcon className="w-5 h-5" />
            <span>Settings</span>
          </Link>
          <button 
            onClick={() => setShowStandup(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-black/60 hover:text-black hover:bg-white/50 transition-all font-medium w-full text-left"
          >
            <Sparkles className="w-5 h-5" />
            <span>AI Standup</span>
          </button>
        </div>

        <div className="mt-auto border-t border-[#E8E4DD] pt-6">
          <div className="font-sans font-medium mb-1">{user?.name}</div>
          <div className="font-mono text-xs text-black/50 mb-4">{user?.email}</div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-black/60 hover:text-signal-red transition-colors text-sm font-medium">
            <LogOut className="w-4 h-4" />
            <span>Terminate Session</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-64 p-12">
        <div className="flex justify-between items-end mb-12 border-b border-[#E8E4DD] pb-6">
          <div>
            <h1 className="font-display italic text-5xl mb-2">My Tasks</h1>
            <p className="font-mono text-sm text-black/50">Your cross-project assignments</p>
          </div>
          <div className="flex items-center">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>

        {isLoading ? (
          <div className="font-mono animate-pulse">Loading assignments...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks?.map(task => (
              <Link 
                key={task.id} 
                to={`/app/projects/${task.projectId}`}
                className="bg-white p-6 rounded-2xl border border-[#E8E4DD] hover:border-black transition-colors shadow-sm group flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-sans font-bold text-lg leading-tight line-clamp-2">{task.title}</h3>
                </div>
                
                <div className="mt-auto pt-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <span className={`text-[10px] font-mono px-2 py-1 rounded-full border ${getStatusColor(task.status)}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-1 rounded-full border ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    {task.labels?.map(label => (
                      <span key={label.id} className="text-[10px] font-mono px-2 py-1 rounded-full border border-black/10 tracking-widest uppercase" style={{ backgroundColor: label.color, color: '#000' }}>
                        {label.name}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-[#E8E4DD] pt-4 font-mono text-xs text-black/50">
                    <span className="truncate pr-2 border-r border-[#E8E4DD] mr-2">
                      {task.project.name}
                    </span>
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      {task.dueDate ? (
                        <>
                          <Clock className="w-3 h-3" />
                          <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                        </>
                      ) : (
                        <span>No Due Date</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {tasks?.length === 0 && (
              <div className="col-span-full py-12 text-center font-mono text-black/50 border border-dashed border-[#E8E4DD] rounded-2xl">
                You have no assigned tasks.
              </div>
            )}
          </div>
        )}
      </div>

      {showStandup && <StandupModal onClose={() => setShowStandup(false)} />}
    </div>
  );
}

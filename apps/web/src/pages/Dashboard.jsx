import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, LayoutGrid, LogOut, ArrowRightToLine, Settings as SettingsIcon, CheckCircle2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import NotificationBell from '../components/NotificationBell';
import StandupModal from '../components/StandupModal';
import ThemeToggle from '../components/ThemeToggle';

export default function Dashboard() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showStandup, setShowStandup] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [joinProjectId, setJoinProjectId] = useState('');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await api.get('/projects');
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (name) => {
      const { data } = await api.post('/projects', { name });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['projects']);
      setIsCreating(false);
      setNewProjectName('');
      toast.success('Project initialized.');
    },
    onError: () => toast.error('Failed to initialize project.')
  });

  const joinMutation = useMutation({
    mutationFn: async (projectId) => {
      const { data } = await api.post('/projects/join', { projectId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['projects']);
      setIsJoining(false);
      setJoinProjectId('');
      toast.success('Successfully joined project.');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to join project.')
  });

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const joinToken = searchParams.get('join');

  const joinInviteMutation = useMutation({
    mutationFn: async (token) => {
      const { data } = await api.post(`/projects/join-invite/${token}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['projects']);
      toast.success('Successfully joined via invite link.');
      window.history.replaceState({}, '', '/app/dashboard');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to join via invite link.');
      window.history.replaceState({}, '', '/app/dashboard');
    }
  });

  React.useEffect(() => {
    if (joinToken && !joinInviteMutation.isPending) {
      joinInviteMutation.mutate(joinToken);
    }
  }, [joinToken]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {}
    logout();
  };

  return (
    <div className="min-h-screen bg-off-white flex">
      {/* Sidebar */}
      <div className="w-64 bg-[#F5F3EE] border-r border-[#E8E4DD] flex flex-col p-6 fixed h-full">
        <Link to="/" className="font-display text-2xl font-bold mb-12 block hover:text-signal-red transition-colors">TASKFORGE</Link>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-[#E8E4DD] text-black font-medium">
            <LayoutGrid className="w-5 h-5" />
            <span>All Projects</span>
          </div>
          <Link to="/app/my-tasks" className="flex items-center gap-3 px-4 py-3 rounded-xl text-black/60 hover:text-black hover:bg-white/50 transition-all font-medium">
            <CheckCircle2 className="w-5 h-5" />
            <span>My Tasks</span>
          </Link>
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
            <h1 className="font-display italic text-5xl mb-2">Projects</h1>
            <p className="font-mono text-sm text-black/50">Active Operational Zones</p>
          </div>
          <div className="flex gap-4 items-center">
            <ThemeToggle />
            <NotificationBell />
            <button 
              onClick={() => { setIsJoining(true); setIsCreating(false); }}
              className="btn-brutal bg-white border border-[#E8E4DD] text-black px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:border-black transition-colors"
            >
              <ArrowRightToLine className="w-4 h-4 relative z-10" />
              <span className="relative z-10">Join Project</span>
            </button>
            <button 
              onClick={() => { setIsCreating(true); setIsJoining(false); }}
              className="btn-brutal bg-black text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4 relative z-10" />
              <span className="relative z-10">New Project</span>
            </button>
          </div>
        </div>

        {isCreating && (
          <div className="mb-8 bg-white p-6 rounded-2xl border border-[#E8E4DD] shadow-sm flex items-center gap-4">
            <input 
              type="text" 
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Enter Project Designation..."
              className="flex-1 bg-off-white border border-[#E8E4DD] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-signal-red"
              autoFocus
            />
            <button 
              onClick={() => createMutation.mutate(newProjectName)}
              disabled={!newProjectName.trim() || createMutation.isPending}
              className="bg-signal-red text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
            >
              Initialize
            </button>
            <button 
              onClick={() => setIsCreating(false)}
              className="text-black/60 px-4 py-3 font-medium hover:text-black"
            >
              Cancel
            </button>
          </div>
        )}

        {isJoining && (
          <div className="mb-8 bg-white p-6 rounded-2xl border border-[#E8E4DD] shadow-sm flex items-center gap-4">
            <input 
              type="text" 
              value={joinProjectId}
              onChange={(e) => setJoinProjectId(e.target.value)}
              placeholder="Enter Project ID (e.g. clk123abc0000)..."
              className="flex-1 bg-off-white border border-[#E8E4DD] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-black"
              autoFocus
            />
            <button 
              onClick={() => joinMutation.mutate(joinProjectId)}
              disabled={!joinProjectId.trim() || joinMutation.isPending}
              className="bg-black text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
            >
              Join Project
            </button>
            <button 
              onClick={() => setIsJoining(false)}
              className="text-black/60 px-4 py-3 font-medium hover:text-black"
            >
              Cancel
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="font-mono animate-pulse">Scanning database...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map(project => (
              <Link 
                key={project.id} 
                to={`/app/projects/${project.id}`}
                className="bg-white p-6 rounded-2xl border border-[#E8E4DD] hover:border-black transition-colors shadow-sm group"
              >
                <div className="flex justify-between items-start mb-8">
                  <h3 className="font-sans font-bold text-xl">{project.name}</h3>
                  <div className="w-8 h-8 rounded-full bg-off-white flex items-center justify-center border border-[#E8E4DD] group-hover:bg-signal-red group-hover:text-white group-hover:border-signal-red transition-all">
                    <span className="font-mono text-xs">{project.members.length}</span>
                  </div>
                </div>
                <div className="font-mono text-xs text-black/50 tracking-widest flex items-center justify-between">
                  <span>ID: {project.id.slice(0, 8)}</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-signal-red">ENTER →</span>
                </div>
              </Link>
            ))}
            {projects?.length === 0 && !isCreating && !isJoining && (
              <div className="col-span-full py-12 text-center font-mono text-black/50 border border-dashed border-[#E8E4DD] rounded-2xl">
                No active projects found.
              </div>
            )}
          </div>
        )}
      </div>

      {showStandup && <StandupModal onClose={() => setShowStandup(false)} />}
    </div>
  );
}

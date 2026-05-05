import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, LayoutDashboard, Plus, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import KanbanBoard from '../components/KanbanBoard';
import ChatWidget from '../components/ChatWidget';
import { useAuthStore } from '../store/authStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { io } from 'socket.io-client';

export default function ProjectView() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban' | 'dashboard'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/' : 'http://localhost:3001'), {
      withCredentials: true,
    });

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_project', id);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('task_created', () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', id] });
      queryClient.invalidateQueries({ queryKey: ['logs', id] });
    });

    socket.on('task_updated', () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', id] });
      queryClient.invalidateQueries({ queryKey: ['logs', id] });
    });

    return () => {
      socket.emit('leave_project', id);
      socket.disconnect();
    };
  }, [id, queryClient]);

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}`);
      return data;
    }
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/dashboard`);
      return data;
    },
    enabled: activeTab === 'dashboard'
  });

  const { data: logsData } = useQuery({
    queryKey: ['logs', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/logs`);
      return data;
    },
    enabled: activeTab === 'terminal'
  });

  const { data: tasks } = useQuery({
    queryKey: ['tasks', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/tasks`);
      return data;
    }
  });

  const userRole = project?.members?.find(m => m.user.id === user?.id)?.role;
  const isAdmin = userRole === 'ADMIN';

  const COLORS = ['#E8E4DD', '#111111', '#E63B2E'];
  const pieData = dashboardData ? [
    { name: 'Todo', value: dashboardData.byStatus.TODO },
    { name: 'In Progress', value: dashboardData.byStatus.IN_PROGRESS },
    { name: 'Done', value: dashboardData.byStatus.DONE },
  ] : [];

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#E8E4DD] px-8 py-4 flex items-center justify-between z-10 sticky top-0">
        <div className="flex items-center gap-6">
          <Link to="/app" className="p-2 hover:bg-off-white rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-sans font-bold text-xl">{project?.name || 'Loading...'}</h1>
              {isConnected && (
                <div className="flex items-center gap-1 bg-[#E63B2E]/10 px-2 py-0.5 rounded border border-[#E63B2E]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E63B2E] animate-pulse"></div>
                  <span className="font-mono text-[10px] text-[#E63B2E] font-bold uppercase tracking-wider">Live</span>
                </div>
              )}
            </div>
            <p className="font-mono text-xs text-black/50">PROJECT_ID: {id.slice(0,8)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-[#F5F3EE] p-1 rounded-xl border border-[#E8E4DD]">
            <button 
              onClick={() => setActiveTab('kanban')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'kanban' ? 'bg-white shadow-sm' : 'text-black/60 hover:text-black'}`}
            >
              Board
            </button>
            <button 
              onClick={() => setActiveTab('terminal')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${activeTab === 'terminal' ? 'bg-white shadow-sm' : 'text-black/60 hover:text-black'}`}
            >
              Terminal
            </button>
            {isAdmin && (
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-white shadow-sm' : 'text-black/60 hover:text-black'}`}
              >
                <LayoutDashboard className="w-4 h-4" /> Stats
              </button>
            )}
          </div>
          
          {isAdmin && (
             <Link to={`/app/projects/${id}/settings`} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-black/60 hover:text-black hover:bg-[#F5F3EE] rounded-xl transition-all border border-[#E8E4DD]">
               <SettingsIcon className="w-4 h-4" />
               <span>Settings</span>
             </Link>
          )}

          {isAdmin && (
            <div className="flex gap-2">
              <button 
                onClick={() => setShowAIModal(true)}
                className="btn-brutal bg-[#111111] text-[#E8E4DD] px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-[#E63B2E] transition-colors"
              >
                <span className="font-mono text-xs text-[#E63B2E] font-bold group-hover:text-white">AI</span>
                <span className="relative z-10">Analyze & Execute</span>
              </button>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="btn-brutal bg-signal-red text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4 relative z-10" />
                <span className="relative z-10">New Task</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'kanban' && (
          <KanbanBoard projectId={id} tasks={tasks || []} isAdmin={isAdmin} members={project?.members || []} />
        )}
        {activeTab === 'terminal' && (
          <div className="h-full bg-[#111111] text-[#E8E4DD] p-8 overflow-y-auto font-mono text-sm shadow-inner relative">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#E8E4DD]/20">
                <h2 className="text-[#E63B2E] uppercase tracking-widest font-bold">System Log Terminal</h2>
                <div className="text-[#E8E4DD]/50 text-xs">V 1.0.4 - LIVE</div>
              </div>
              <div className="space-y-4">
                {logsData?.length === 0 && (
                  <div className="text-[#E8E4DD]/50 italic">No activity detected.</div>
                )}
                {logsData?.map(log => (
                  <div key={log.id} className="flex flex-col md:flex-row md:items-start gap-4 p-4 bg-[#1A1A1A] rounded border border-[#E8E4DD]/10 hover:border-[#E63B2E]/50 transition-colors">
                    <div className="text-[#E63B2E] w-48 shrink-0">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-[#E8E4DD] text-[#111111] px-2 py-0.5 rounded text-xs font-bold">{log.action}</span>
                        <span className="text-[#E8E4DD]/50">by</span>
                        <span className="text-white">{log.user.name}</span>
                      </div>
                      {log.details && (
                        <div className="text-[#E8E4DD]/70 text-xs mt-2 bg-[#111111] p-3 rounded overflow-x-auto border border-[#E8E4DD]/10">
                          {log.details}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'dashboard' && (
          <div className="p-12 overflow-y-auto h-full max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatCard title="Total Tasks" value={dashboardData?.totalTasks || 0} />
              <StatCard title="Todo" value={dashboardData?.byStatus.TODO || 0} />
              <StatCard title="Done" value={dashboardData?.byStatus.DONE || 0} />
              <StatCard title="Overdue" value={dashboardData?.overdue || 0} isAlert />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-white p-8 rounded-[2rem] border border-[#E8E4DD] shadow-sm">
                 <h3 className="font-display italic text-2xl mb-6">Status Distribution</h3>
                 <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                         {pieData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                         ))}
                       </Pie>
                       <Tooltip />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
               </div>

               <div className="bg-white p-8 rounded-[2rem] border border-[#E8E4DD] shadow-sm">
                 <h3 className="font-display italic text-2xl mb-6">Workload per Member</h3>
                 <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={dashboardData?.byUser || []}>
                       <XAxis dataKey="name" tick={{fontFamily: 'Space Mono', fontSize: 10}} />
                       <YAxis allowDecimals={false} />
                       <Tooltip />
                       <Bar dataKey="taskCount" fill="#111111" radius={[4, 4, 0, 0]} />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal 
          projectId={id} 
          members={project?.members || []} 
          onClose={() => setShowCreateModal(false)} 
        />
      )}

      {showAIModal && (
        <AITaskModal 
          projectId={id}
          onClose={() => setShowAIModal(false)}
        />
      )}

      <ChatWidget projectId={id} />
    </div>
  );
}

function StatCard({ title, value, isAlert }) {
  return (
    <div className={`bg-white p-6 rounded-2xl border ${isAlert ? 'border-signal-red' : 'border-[#E8E4DD]'} shadow-sm`}>
      <h4 className="font-mono text-xs text-black/50 uppercase tracking-widest mb-2">{title}</h4>
      <div className={`font-display text-5xl ${isAlert ? 'text-signal-red' : 'text-black'}`}>{value}</div>
    </div>
  );
}

function AITaskModal({ projectId, onClose }) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  
  const aiMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.post(`/projects/${projectId}/tasks/ai-generate`, data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['tasks', projectId]);
      toast.success(`AI Generated ${data.tasks.length} tasks.`);
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'AI Generation failed');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    aiMutation.mutate({ prompt });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#111111] text-[#E8E4DD] rounded-3xl shadow-2xl p-8 border border-[#E63B2E]/20 animate-[slideIn_0.3s_ease-out]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-[#E63B2E] font-bold bg-[#E63B2E]/10 px-2 py-1 rounded">AI ENGINE</span>
            <h2 className="font-display italic text-2xl">Task Decomposition</h2>
          </div>
          <button onClick={onClose} className="text-[#E8E4DD]/50 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-mono text-sm mb-2 text-[#E8E4DD]/70">Master Objective</label>
            <textarea 
              autoFocus
              value={prompt} 
              onChange={e => setPrompt(e.target.value)} 
              placeholder="e.g. Build the authentication system with Google Login..."
              className="w-full bg-black border border-[#E8E4DD]/20 p-4 rounded-xl focus:border-[#E63B2E] outline-none h-32 resize-none font-mono text-sm" 
            />
          </div>
          
          <div className="pt-4 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="px-6 py-3 font-mono text-sm text-[#E8E4DD]/50 hover:text-white transition-colors">
              Abort
            </button>
            <button 
              type="submit" 
              disabled={aiMutation.isPending || !prompt.trim()}
              className="bg-[#E63B2E] text-white px-8 py-3 rounded-xl font-medium font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600 transition-colors flex items-center gap-2"
            >
              {aiMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Analyzing...
                </>
              ) : 'Execute Breakdown'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateTaskModal({ projectId, members, onClose }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');

  const createMutation = useMutation({
    mutationFn: async (data) => {
      await api.post(`/projects/${projectId}/tasks`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
      toast.success('Task deployed.');
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to create task');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      title,
      description,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      priority,
      assigneeId: assigneeId || null
    });
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-md bg-white h-full border-l border-[#E8E4DD] shadow-2xl p-8 animate-[slideIn_0.3s_ease-out]">
        <div className="flex justify-between items-center mb-8">
          <h2 className="font-display italic text-3xl">New Protocol</h2>
          <button onClick={onClose} className="text-black/50 hover:text-black">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-mono text-sm mb-2">Designation</label>
            <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-[#E8E4DD] p-3 rounded-xl focus:border-black outline-none" />
          </div>
          <div>
            <label className="block font-mono text-sm mb-2">Parameters (Optional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-[#E8E4DD] p-3 rounded-xl focus:border-black outline-none h-24 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-sm mb-2">Deadline</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border border-[#E8E4DD] p-3 rounded-xl focus:border-black outline-none" />
            </div>
            <div>
              <label className="block font-mono text-sm mb-2">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full border border-[#E8E4DD] p-3 rounded-xl focus:border-black outline-none bg-white">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-mono text-sm mb-2">Assignee</label>
            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="w-full border border-[#E8E4DD] p-3 rounded-xl focus:border-black outline-none bg-white">
              <option value="">Unassigned</option>
              {members.map(m => (
                <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
              ))}
            </select>
          </div>
          
          <div className="pt-4 mt-auto">
            <button type="submit" className="w-full bg-black text-white p-4 rounded-xl font-medium" disabled={createMutation.isPending}>
              Deploy Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

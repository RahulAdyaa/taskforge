import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, LayoutDashboard, Plus, ArrowLeft, Link as LinkIcon, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import KanbanBoard from '../components/KanbanBoard';
import ChatWidget from '../components/ChatWidget';
import { useAuthStore } from '../store/authStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import NotificationBell from '../components/NotificationBell';
import TaskFilters, { applyFilters } from '../components/TaskFilters';
import ThemeToggle from '../components/ThemeToggle';

// Check if WebSocket is available
const WS_URL = import.meta.env.VITE_WS_URL || (!import.meta.env.PROD ? 'http://localhost:3001' : '');

export default function ProjectView() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban' | 'dashboard'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [filters, setFilters] = useState({ search: '', assignee: '', priority: '', label: '', dueDate: '' });
  const socketRef = useRef(null);

  useEffect(() => {
    if (WS_URL) {
      // Use WebSocket when available (local dev)
      import('socket.io-client').then(({ io }) => {
        const socket = io(WS_URL, { withCredentials: true });
        socketRef.current = socket;

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

        socket.on('comment_added', (data) => {
          if (data?.taskId) {
            queryClient.invalidateQueries({ queryKey: ['comments', data.taskId] });
          }
        });
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_project', id);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
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
    enabled: activeTab === 'dashboard',
    refetchInterval: WS_URL ? false : 15000, // Poll every 15s when no WebSocket
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
    },
    refetchInterval: WS_URL ? false : 5000, // Poll every 5s when no WebSocket
  });

  const { data: labels } = useQuery({
    queryKey: ['labels', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/labels`);
      return data;
    }
  });

  const userRole = project?.members?.find(m => m.user.id === user?.id)?.role;
  const isAdmin = userRole === 'ADMIN';

  const [inviteToken, setInviteToken] = useState(null);
  
  const generateInviteMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/projects/${id}/invite`);
      return data;
    },
    onSuccess: (data) => {
      setInviteToken(data.inviteToken);
      const inviteUrl = `${window.location.origin}/app/dashboard?join=${data.inviteToken}`;
      navigator.clipboard.writeText(inviteUrl);
      toast.success('Invite link copied to clipboard!');
    },
    onError: () => toast.error('Failed to generate invite link')
  });

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
            <div className="flex gap-2">
              <button 
                onClick={() => generateInviteMutation.mutate()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-black/60 hover:text-black hover:bg-[#F5F3EE] rounded-xl transition-all border border-[#E8E4DD]"
                title="Copy Invite Link"
              >
                <LinkIcon className="w-4 h-4" />
                <span>Invite</span>
              </button>
              <Link to={`/app/projects/${id}/settings`} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-black/60 hover:text-black hover:bg-[#F5F3EE] rounded-xl transition-all border border-[#E8E4DD]">
                <SettingsIcon className="w-4 h-4" />
                <span>Settings</span>
              </Link>
            </div>
          )}

          <div className="flex items-center">
            <ThemeToggle />
            <NotificationBell />
          </div>

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
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'kanban' && (
          <>
            <TaskFilters
              members={project?.members || []}
              labels={labels || []}
              filters={filters}
              onFilterChange={setFilters}
            />
            <div className="flex-1 overflow-hidden">
              <KanbanBoard projectId={id} tasks={applyFilters(tasks, filters)} isAdmin={isAdmin} members={project?.members || []} labels={labels || []} />
            </div>
          </>
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
          labels={labels || []}
          onClose={() => setShowCreateModal(false)} 
        />
      )}

      {showAIModal && (
        <AITaskModal 
          projectId={id}
          members={project?.members || []}
          labels={labels || []}
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

function AITaskModal({ projectId, members, labels, onClose }) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [step, setStep] = useState('input'); // 'input' | 'review'
  const [generatedTasks, setGeneratedTasks] = useState([]);

  // Step 1: Preview — get AI suggestions without creating
  const previewMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.post(`/projects/${projectId}/tasks/ai-preview`, data);
      return res.data;
    },
    onSuccess: (data) => {
      const tasksWithMeta = data.tasks.map((t, i) => ({
        ...t,
        _id: i,
        _enabled: true,
        assigneeId: '',
        dueDate: '',
      }));
      setGeneratedTasks(tasksWithMeta);
      setStep('review');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'AI Preview failed');
    }
  });

  // Step 2: Execute — create the reviewed tasks
  const executeMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.post(`/projects/${projectId}/tasks/ai-generate`, data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['tasks', projectId]);
      toast.success(`🚀 Deployed ${data.tasks.length} tasks!`);
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Task creation failed');
    }
  });

  const handlePreview = (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    previewMutation.mutate({ prompt });
  };

  const handleExecute = () => {
    const enabledTasks = generatedTasks
      .filter(t => t._enabled)
      .map(t => ({
        title: t.title,
        priority: t.priority,
        assigneeId: t.assigneeId || null,
        dueDate: t.dueDate || null,
      }));
    
    if (enabledTasks.length === 0) {
      toast.error('Select at least one task to deploy.');
      return;
    }

    executeMutation.mutate({ prompt, tasks: enabledTasks });
  };

  const updateTask = (id, field, value) => {
    setGeneratedTasks(prev => prev.map(t => t._id === id ? { ...t, [field]: value } : t));
  };

  const toggleTask = (id) => {
    setGeneratedTasks(prev => prev.map(t => t._id === id ? { ...t, _enabled: !t._enabled } : t));
  };

  const enabledCount = generatedTasks.filter(t => t._enabled).length;

  const priorityColors = {
    LOW: 'bg-blue-100 text-blue-700 border-blue-200',
    MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
    URGENT: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-[#111111] text-[#E8E4DD] rounded-3xl shadow-2xl border border-[#E63B2E]/20 animate-[slideIn_0.3s_ease-out] overflow-hidden flex flex-col ${step === 'review' ? 'w-full max-w-4xl max-h-[85vh]' : 'w-full max-w-xl'}`}>
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-[#E8E4DD]/10 shrink-0 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-[#E63B2E] font-bold bg-[#E63B2E]/10 px-2 py-1 rounded">AI ENGINE</span>
            <h2 className="font-display italic text-2xl">{step === 'input' ? 'Task Decomposition' : 'Review & Configure'}</h2>
          </div>
          <div className="flex items-center gap-3">
            {step === 'review' && (
              <button 
                onClick={() => setStep('input')} 
                className="font-mono text-xs text-[#E8E4DD]/50 hover:text-white transition-colors"
              >
                ← Back
              </button>
            )}
            <button onClick={onClose} className="text-[#E8E4DD]/50 hover:text-white">✕</button>
          </div>
        </div>

        {/* Step 1: Prompt Input */}
        {step === 'input' && (
          <form onSubmit={handlePreview} className="p-8 space-y-6">
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
            <p className="font-mono text-[10px] text-[#E8E4DD]/30">
              The AI will generate tasks, then you can assign teammates, set due dates, and adjust priorities before deploying.
            </p>
            <div className="pt-4 flex justify-end gap-4">
              <button type="button" onClick={onClose} className="px-6 py-3 font-mono text-sm text-[#E8E4DD]/50 hover:text-white transition-colors">
                Abort
              </button>
              <button 
                type="submit" 
                disabled={previewMutation.isPending || !prompt.trim()}
                className="bg-[#E63B2E] text-white px-8 py-3 rounded-xl font-medium font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                {previewMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Analyzing...
                  </>
                ) : 'Analyze →'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Review & Configure */}
        {step === 'review' && (
          <>
            {/* Prompt reminder */}
            <div className="px-8 py-3 bg-[#1A1A1A] border-b border-[#E8E4DD]/10 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-[#E8E4DD]/40 uppercase tracking-widest">Objective:</span>
                <span className="font-mono text-xs text-[#E8E4DD]/70 truncate">{prompt}</span>
              </div>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {generatedTasks.map((task) => (
                <div 
                  key={task._id} 
                  className={`rounded-2xl border transition-all ${task._enabled ? 'bg-[#1A1A1A] border-[#E8E4DD]/20' : 'bg-[#0D0D0D] border-[#E8E4DD]/5 opacity-40'}`}
                >
                  {/* Task Title Row */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    <button
                      onClick={() => toggleTask(task._id)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${task._enabled ? 'bg-[#E63B2E] border-[#E63B2E] text-white' : 'border-[#E8E4DD]/30 hover:border-[#E8E4DD]/60'}`}
                    >
                      {task._enabled && <span className="text-xs">✓</span>}
                    </button>
                    
                    <input
                      type="text"
                      value={task.title}
                      onChange={(e) => updateTask(task._id, 'title', e.target.value)}
                      disabled={!task._enabled}
                      className="flex-1 bg-transparent border-none outline-none font-sans text-sm text-[#E8E4DD] disabled:text-[#E8E4DD]/30 placeholder-[#E8E4DD]/20"
                    />

                    <span className={`font-mono text-[10px] px-2 py-1 rounded border shrink-0 ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                  </div>

                  {/* Config Row — only shown if enabled */}
                  {task._enabled && (
                    <div className="px-5 pb-4 pt-0 flex items-center gap-3 flex-wrap">
                      {/* Priority */}
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9px] text-[#E8E4DD]/30 uppercase tracking-widest">Priority</span>
                        <select
                          value={task.priority}
                          onChange={(e) => updateTask(task._id, 'priority', e.target.value)}
                          className="bg-black border border-[#E8E4DD]/20 text-[#E8E4DD] text-xs px-2 py-1.5 rounded-lg outline-none focus:border-[#E63B2E]"
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                          <option value="URGENT">Urgent</option>
                        </select>
                      </div>

                      {/* Assignee */}
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9px] text-[#E8E4DD]/30 uppercase tracking-widest">Assign</span>
                        <select
                          value={task.assigneeId}
                          onChange={(e) => updateTask(task._id, 'assigneeId', e.target.value)}
                          className="bg-black border border-[#E8E4DD]/20 text-[#E8E4DD] text-xs px-2 py-1.5 rounded-lg outline-none focus:border-[#E63B2E]"
                        >
                          <option value="">Unassigned</option>
                          {members.map(m => (
                            <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Due Date */}
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9px] text-[#E8E4DD]/30 uppercase tracking-widest">Due</span>
                        <input
                          type="date"
                          value={task.dueDate}
                          onChange={(e) => updateTask(task._id, 'dueDate', e.target.value)}
                          className="bg-black border border-[#E8E4DD]/20 text-[#E8E4DD] text-xs px-2 py-1.5 rounded-lg outline-none focus:border-[#E63B2E]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="px-8 py-5 border-t border-[#E8E4DD]/10 shrink-0 flex items-center justify-between bg-[#0D0D0D]">
              <span className="font-mono text-xs text-[#E8E4DD]/40">
                {enabledCount} of {generatedTasks.length} tasks selected
              </span>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setStep('input'); setGeneratedTasks([]); }}
                  className="px-5 py-2.5 font-mono text-xs text-[#E8E4DD]/50 hover:text-white border border-[#E8E4DD]/10 rounded-xl transition-colors"
                >
                  Regenerate
                </button>
                <button
                  onClick={handleExecute}
                  disabled={executeMutation.isPending || enabledCount === 0}
                  className="bg-[#E63B2E] text-white px-8 py-2.5 rounded-xl font-medium font-mono text-sm disabled:opacity-50 hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  {executeMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Deploying...
                    </>
                  ) : `Deploy ${enabledCount} Tasks`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CreateTaskModal({ projectId, members, labels, onClose }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [selectedLabels, setSelectedLabels] = useState([]);

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
      assigneeId: assigneeId || null,
      labelIds: selectedLabels
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

          <div>
            <label className="block font-mono text-sm mb-2">Labels</label>
            <div className="flex flex-wrap gap-2">
              {labels.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setSelectedLabels(prev => 
                      prev.includes(l.id) ? prev.filter(id => id !== l.id) : [...prev, l.id]
                    )
                  }}
                  className={`font-mono text-[10px] px-3 py-1.5 rounded-full tracking-widest uppercase transition-all ${selectedLabels.includes(l.id) ? 'ring-2 ring-black' : 'opacity-70 hover:opacity-100'}`}
                  style={{ backgroundColor: l.color, color: '#000' }}
                >
                  {l.name}
                </button>
              ))}
              {labels.length === 0 && <span className="font-mono text-xs text-black/40">No labels in this project.</span>}
            </div>
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

import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, LayoutDashboard, Plus, ArrowLeft, Link as LinkIcon, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import KanbanBoard from '../components/KanbanBoard';
import { useAuthStore } from '../store/authStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, CartesianGrid } from 'recharts';
import NotificationBell from '../components/NotificationBell';
import TaskFilters, { applyFilters } from '../components/TaskFilters';
import ThemeToggle from '../components/ThemeToggle';
import { useSocket } from '../context/SocketContext';

const WS_URL = import.meta.env.VITE_WS_URL || (!import.meta.env.PROD ? 'http://localhost:3001' : '');

export default function ProjectView() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban' | 'dashboard'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [filters, setFilters] = useState({ search: '', assignee: '', priority: '', label: '', dueDate: '' });
  
  const { socket, isConnected, onlineUsers } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.emit('join_project', id);

    const handleTaskCreated = (newTask) => {
      queryClient.setQueryData(['tasks', id], (oldTasks = []) => {
        if (oldTasks.some(t => t.id === newTask.id)) return oldTasks;
        return [...oldTasks, newTask];
      });
    };
    const handleTaskUpdated = (updatedTask) => {
      queryClient.setQueryData(['tasks', id], (oldTasks = []) => {
        return oldTasks.map(t => t.id === updatedTask.id ? updatedTask : t);
      });
      // Invalidate dashboard/logs
      queryClient.invalidateQueries(['dashboard', id]);
      queryClient.invalidateQueries(['logs', id]);
    };
    const handleCommentAdded = () => {
      queryClient.invalidateQueries(['logs', id]);
    };
    const handleProjectDeleted = () => {
      toast.error('This project has been deleted.');
      navigate('/app');
    };

    socket.on('task_created', handleTaskCreated);
    socket.on('task_updated', handleTaskUpdated);
    socket.on('comment_added', handleCommentAdded);
    socket.on('project_deleted', handleProjectDeleted);

    return () => {
      socket.emit('leave_project', id);
      socket.off('task_created', handleTaskCreated);
      socket.off('task_updated', handleTaskUpdated);
      socket.off('comment_added', handleCommentAdded);
      socket.off('project_deleted', handleProjectDeleted);
    };
  }, [socket, id, queryClient, navigate]);

  const { data: project, isLoading: isProjectLoading, error: projectError } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}`);
      return data;
    },
    retry: false
  });

  useEffect(() => {
    if (projectError) {
      toast.error('Project not found or access denied.');
      navigate('/app');
    }
  }, [projectError, navigate]);

  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['dashboard', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/dashboard`);
      return data;
    },
    enabled: activeTab === 'dashboard',
    refetchInterval: WS_URL ? false : 15000, // Poll every 15s when no WebSocket
  });

  const { data: logsData, isLoading: isLogsLoading } = useQuery({
    queryKey: ['logs', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/logs`);
      return data;
    },
    enabled: activeTab === 'terminal'
  });

  const { data: tasks, isLoading: isTasksLoading } = useQuery({
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

  if (isProjectLoading) {
    return (
      <div className="min-h-screen bg-off-white flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-[#E8E4DD] px-8 py-4 flex items-center justify-between z-10 sticky top-0">
          <div className="flex items-center gap-6">
            <Link to="/app" className="p-2 hover:bg-off-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-sans font-bold text-xl">&nbsp;</h1>
              <p className="font-mono text-xs text-black/50">
                PROJECT_ID: {id.slice(0,8)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-signal-red/20 animate-ping"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-signal-red border-r-signal-red animate-spin"></div>
            </div>
            <p className="font-mono text-sm text-black/60 dark:text-white/60 animate-pulse">Initializing Board...</p>
          </div>
        </main>
      </div>
    );
  }

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
              <h1 className="font-sans font-bold text-xl">
                {project?.name || 'Unknown Project'}
              </h1>
              {isConnected && (
                <div className="flex items-center gap-1 bg-[#E63B2E]/10 px-2 py-0.5 rounded border border-[#E63B2E]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E63B2E] animate-pulse"></div>
                  <span className="font-mono text-[10px] text-[#E63B2E] font-bold uppercase tracking-wider">Live</span>
                </div>
              )}
            </div>
            <p 
              onClick={() => {
                navigator.clipboard.writeText(id);
                toast.success('Full Project ID copied!');
              }}
              title="Click to copy full Project ID"
              className="font-mono text-xs text-black/50 hover:text-black hover:underline cursor-pointer select-none"
            >
              PROJECT_ID: {id.slice(0,8)} (click to copy full)
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Real-time Project Members Presence */}
          <div className="flex items-center -space-x-2 mr-2">
            {project?.members?.map((member) => {
              const isOnline = onlineUsers.has(member.user.id);
              const initials = member.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div 
                  key={member.user.id} 
                  className="relative group cursor-pointer"
                  title={`${member.user.name} (${member.role}) - ${isOnline ? 'Online' : 'Offline'}`}
                >
                  <div className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                    isOnline 
                      ? 'bg-black text-white font-bold border-black' 
                      : 'bg-[#E8E4DD] text-black/50 border-white'
                  }`}>
                    {initials}
                  </div>
                  {/* Status dot */}
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                    isOnline ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                </div>
              );
            })}
          </div>

          <div className="flex bg-[#F5F3EE] p-1 rounded-xl border border-[#E8E4DD]">
            <button 
              onClick={() => setActiveTab('kanban')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'kanban' ? 'bg-white shadow-sm' : 'text-black/60 hover:text-black'}`}
            >
              Board
            </button>
            {isAdmin && (
              <>
                <button 
                  onClick={() => setActiveTab('terminal')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${activeTab === 'terminal' ? 'bg-white shadow-sm' : 'text-black/60 hover:text-black'}`}
                >
                  Terminal
                </button>
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-white shadow-sm' : 'text-black/60 hover:text-black'}`}
                >
                  <LayoutDashboard className="w-4 h-4" /> Stats
                </button>
              </>
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
              <KanbanBoard projectId={id} tasks={applyFilters(tasks, filters)} isAdmin={isAdmin} members={project?.members || []} labels={labels || []} isLoading={isTasksLoading} />
            </div>
          </>
        )}
        {activeTab === 'terminal' && isAdmin && (
          <div className="h-full bg-[#111111] text-[#E8E4DD] p-8 overflow-y-auto font-mono text-sm shadow-inner relative">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#E8E4DD]/20">
                <h2 className="text-[#E63B2E] uppercase tracking-widest font-bold">System Log Terminal</h2>
                <div className="text-[#E8E4DD]/50 text-xs">V 1.0.4 - LIVE</div>
              </div>
              <div className="space-y-4">
                {isLogsLoading ? (
                  [...Array(4)].map((_, i) => (
                    <div key={i} className="flex flex-col md:flex-row md:items-start gap-4 p-4 bg-[#1A1A1A] rounded border border-[#E8E4DD]/10 opacity-70">
                      <div className="w-48 shrink-0 h-5 rounded skeleton-loading opacity-20" />
                      <div className="flex-1 space-y-2">
                        <div className="h-5 w-1/3 rounded skeleton-loading opacity-20" />
                        <div className="h-12 w-full rounded skeleton-loading opacity-10" />
                      </div>
                    </div>
                  ))
                ) : logsData?.length === 0 ? (
                  <div className="text-[#E8E4DD]/50 italic">No activity detected.</div>
                ) : (
                  logsData?.map(log => (
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
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'dashboard' && (
          <div className="p-6 md:p-8 overflow-y-auto h-full space-y-6">
            {isDashboardLoading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-[#121215] p-5 rounded-2xl border border-[#E8E4DD] dark:border-white/10 shadow-sm space-y-3">
                      <div className="h-3 w-1/2 rounded skeleton-loading" />
                      <div className="h-10 w-2/3 rounded skeleton-loading" />
                    </div>
                  ))}
                </div>
                <div className="h-64 rounded-2xl border border-[#E8E4DD] dark:border-white/10 bg-white dark:bg-[#121215] p-6 space-y-4">
                  <div className="h-6 w-1/4 rounded skeleton-loading" />
                  <div className="h-2 w-full rounded skeleton-loading" />
                  <div className="h-36 w-full rounded skeleton-loading" />
                </div>
              </div>
            ) : (
              <>
                {/* KPI Summary Cards - Row 1 (visible to everyone) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Total Tasks" value={dashboardData?.totalTasks || 0} />
                  <StatCard title="Completed" value={dashboardData?.byStatus?.DONE || 0} accent />
                  <StatCard title="In Progress" value={dashboardData?.byStatus?.IN_PROGRESS || 0} />
                  <StatCard title="Overdue" value={dashboardData?.overdue || 0} isAlert />
                </div>

            {/* KPI Summary Cards - Row 2 (Admin only) */}
            {isAdmin && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="Completion Rate" value={`${dashboardData?.completionRate || 0}%`} />
                <StatCard title="Avg. Completion" value={`${dashboardData?.avgCompletionDays || 0}d`} subtitle="days per task" />
                <StatCard title="Hours Tracked" value={dashboardData?.totalTrackedHours || 0} subtitle="total hours" />
                <StatCard title="Todo" value={dashboardData?.byStatus?.TODO || 0} />
              </div>
            )}

            {/* Admin: Project Health Score */}
            {isAdmin && dashboardData && (
              <div className="bg-white p-6 rounded-2xl border border-[#E8E4DD] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-lg">Project Health</h3>
                  {(() => {
                    const total = dashboardData.totalTasks || 1;
                    const overdueRatio = (dashboardData.overdue || 0) / total;
                    const completionRatio = (dashboardData.byStatus?.DONE || 0) / total;
                    const score = Math.max(0, Math.min(100, Math.round((completionRatio * 60) + ((1 - overdueRatio) * 40))));
                    const color = score >= 75 ? 'text-green-600' : score >= 45 ? 'text-amber-500' : 'text-red-600';
                    const label = score >= 75 ? 'Healthy' : score >= 45 ? 'Needs Attention' : 'At Risk';
                    return (
                      <div className="flex items-center gap-3">
                        <span className={`font-display text-3xl font-bold ${color}`}>{score}</span>
                        <div>
                          <span className={`font-mono text-xs font-bold ${color}`}>{label}</span>
                          <p className="font-mono text-[10px] text-black/40">out of 100</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="w-full bg-black/5 h-2 rounded-full overflow-hidden">
                  {(() => {
                    const total = dashboardData.totalTasks || 1;
                    const overdueRatio = (dashboardData.overdue || 0) / total;
                    const completionRatio = (dashboardData.byStatus?.DONE || 0) / total;
                    const score = Math.max(0, Math.min(100, Math.round((completionRatio * 60) + ((1 - overdueRatio) * 40))));
                    const color = score >= 75 ? 'bg-green-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500';
                    return <div className={`h-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />;
                  })()}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="font-mono text-[10px] text-black/40">{dashboardData.overdue || 0} overdue tasks dragging score down</span>
                  <span className="font-mono text-[10px] text-black/40">{dashboardData.completionRate || 0}% completed</span>
                </div>
              </div>
            )}

            {/* Charts Row (Admin only) */}
            {isAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status Distribution */}
                <div className="bg-white p-6 rounded-2xl border border-[#E8E4DD] shadow-sm">
                  <h3 className="font-display font-bold text-lg mb-4">Status Distribution</h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontFamily: 'Space Mono', fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Priority Breakdown */}
                <div className="bg-white p-6 rounded-2xl border border-[#E8E4DD] shadow-sm">
                  <h3 className="font-display font-bold text-lg mb-4">Priority Breakdown</h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={[
                            { name: 'Low', value: dashboardData?.byPriority?.LOW || 0 },
                            { name: 'Medium', value: dashboardData?.byPriority?.MEDIUM || 0 },
                            { name: 'High', value: dashboardData?.byPriority?.HIGH || 0 },
                            { name: 'Urgent', value: dashboardData?.byPriority?.URGENT || 0 },
                          ]}
                          cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value"
                        >
                          <Cell fill="#86efac" />
                          <Cell fill="#93c5fd" />
                          <Cell fill="#fdba74" />
                          <Cell fill="#E63B2E" />
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontFamily: 'Space Mono', fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Weekly Trend */}
                <div className="bg-white p-6 rounded-2xl border border-[#E8E4DD] shadow-sm">
                  <h3 className="font-display font-bold text-lg mb-4">Weekly Trend</h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dashboardData?.weeklyTrend || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DD" />
                        <XAxis dataKey="week" tick={{ fontFamily: 'Space Mono', fontSize: 9 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontFamily: 'Space Mono', fontSize: 10 }} />
                        <Line type="monotone" dataKey="created" stroke="#111111" strokeWidth={2} dot={{ r: 3 }} name="Created" />
                        <Line type="monotone" dataKey="completed" stroke="#E63B2E" strokeWidth={2} dot={{ r: 3 }} name="Completed" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Admin: Workload + Member Performance */}
            {isAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Workload Chart */}
                <div className="bg-white p-6 rounded-2xl border border-[#E8E4DD] shadow-sm">
                  <h3 className="font-display font-bold text-lg mb-4">Workload per Member</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData?.byUser || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DD" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontFamily: 'Space Mono', fontSize: 10 }} width={100} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontFamily: 'Space Mono', fontSize: 10 }} />
                        <Bar dataKey="completed" fill="#111111" radius={[0, 4, 4, 0]} name="Completed" stackId="a" />
                        <Bar dataKey="overdue" fill="#E63B2E" radius={[0, 4, 4, 0]} name="Overdue" stackId="a" />
                        <Bar dataKey="taskCount" fill="#E8E4DD" radius={[0, 4, 4, 0]} name="Total" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Member Performance Table */}
                <div className="bg-white p-6 rounded-2xl border border-[#E8E4DD] shadow-sm">
                  <h3 className="font-display font-bold text-lg mb-4">Member Performance</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[#E8E4DD]">
                          <th className="font-mono text-[10px] uppercase tracking-widest text-black/50 pb-3 pr-4">Member</th>
                          <th className="font-mono text-[10px] uppercase tracking-widest text-black/50 pb-3 pr-4 text-center">Tasks</th>
                          <th className="font-mono text-[10px] uppercase tracking-widest text-black/50 pb-3 pr-4 text-center">Done</th>
                          <th className="font-mono text-[10px] uppercase tracking-widest text-black/50 pb-3 pr-4 text-center">Rate</th>
                          <th className="font-mono text-[10px] uppercase tracking-widest text-black/50 pb-3 text-center">Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(dashboardData?.byUser || []).map((m, i) => (
                          <tr key={i} className="border-b border-[#E8E4DD]/50 last:border-0">
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center font-mono text-[10px]">
                                  {m.name.substring(0, 2).toUpperCase()}
                                </div>
                                <span className="font-sans text-sm font-medium truncate max-w-[120px]">{m.name}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-center font-mono text-sm">{m.taskCount}</td>
                            <td className="py-3 pr-4 text-center font-mono text-sm">{m.completed}</td>
                            <td className="py-3 pr-4 text-center">
                              <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${
                                m.completionRate >= 75 ? 'bg-green-100 text-green-800' :
                                m.completionRate >= 40 ? 'bg-amber-100 text-amber-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {m.completionRate}%
                              </span>
                            </td>
                            <td className="py-3 text-center font-mono text-sm">{m.hoursTracked}h</td>
                          </tr>
                        ))}
                        {(!dashboardData?.byUser || dashboardData.byUser.length === 0) && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center font-mono text-xs text-black/40">No member data available</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Member View: Personal Stats Only */}
            {!isAdmin && (
              <div className="bg-white p-6 rounded-2xl border border-[#E8E4DD] shadow-sm">
                <h3 className="font-display font-bold text-lg mb-4">Your Performance</h3>
                {(() => {
                  const currentUser = useAuthStore.getState().user;
                  const myStats = dashboardData?.byUser?.find(u => u.name === currentUser?.name);
                  if (!myStats) {
                    return <p className="font-mono text-xs text-black/40 py-6 text-center">No tasks assigned to you yet.</p>;
                  }
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-[#F5F3EE] p-4 rounded-xl text-center">
                        <p className="font-mono text-[10px] text-black/50 uppercase tracking-widest mb-1">Assigned</p>
                        <p className="font-display text-3xl font-bold">{myStats.taskCount}</p>
                      </div>
                      <div className="bg-[#F5F3EE] p-4 rounded-xl text-center">
                        <p className="font-mono text-[10px] text-black/50 uppercase tracking-widest mb-1">Completed</p>
                        <p className="font-display text-3xl font-bold">{myStats.completed}</p>
                      </div>
                      <div className="bg-[#F5F3EE] p-4 rounded-xl text-center">
                        <p className="font-mono text-[10px] text-black/50 uppercase tracking-widest mb-1">Rate</p>
                        <p className={`font-display text-3xl font-bold ${
                          myStats.completionRate >= 75 ? 'text-green-600' :
                          myStats.completionRate >= 40 ? 'text-amber-500' : 'text-red-600'
                        }`}>{myStats.completionRate}%</p>
                      </div>
                      <div className="bg-[#F5F3EE] p-4 rounded-xl text-center">
                        <p className="font-mono text-[10px] text-black/50 uppercase tracking-widest mb-1">Hours</p>
                        <p className="font-display text-3xl font-bold">{myStats.hoursTracked}h</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
              </>
            )}
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
    </div>
  );
}

function StatCard({ title, value, isAlert, accent, subtitle }) {
  return (
    <div className={`bg-white p-5 rounded-2xl border ${isAlert ? 'border-signal-red' : accent ? 'border-black' : 'border-[#E8E4DD]'} shadow-sm`}>
      <h4 className="font-mono text-[10px] text-black/50 uppercase tracking-widest mb-1">{title}</h4>
      <div className={`font-display text-4xl font-bold ${isAlert ? 'text-signal-red' : accent ? 'text-black' : 'text-black'}`}>{value}</div>
      {subtitle && <p className="font-mono text-[10px] text-black/30 mt-1">{subtitle}</p>}
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
            <h2 className="font-display font-bold text-2xl">{step === 'input' ? 'Task Decomposition' : 'Review & Configure'}</h2>
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
          <h2 className="font-display font-extrabold text-3xl tracking-tight">New Protocol</h2>
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

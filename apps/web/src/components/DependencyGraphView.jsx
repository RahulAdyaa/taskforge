import React, { useMemo, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import gsap from 'gsap';
import { 
  GitMerge, 
  Clock, 
  CheckCircle2, 
  PlayCircle, 
  User, 
  Zap,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

export default function DependencyGraphView({ projectId, tasks = [], isAdmin, members = [] }) {
  const queryClient = useQueryClient();

  // Calculate DAG execution waves
  const { waves, totalHours, blockedCount, readyCount } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return { waves: [], totalHours: 0, blockedCount: 0, readyCount: 0 };
    }

    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const waveAssignments = new Map();
    let totalEst = 0;
    let blocked = 0;
    let ready = 0;

    // Helper to compute max depth of dependencies
    const computeDepth = (taskId, visited = new Set()) => {
      if (visited.has(taskId)) return 0; // Prevent cycle loops
      visited.add(taskId);
      const task = taskMap.get(taskId);
      if (!task || !task.blockedBy || task.blockedBy.length === 0) return 0;

      let maxParentDepth = 0;
      for (const b of task.blockedBy) {
        const parentId = typeof b === 'object' ? b.id : b;
        const parentTask = taskMap.get(parentId);
        if (parentTask && parentTask.status !== 'DONE') {
          maxParentDepth = Math.max(maxParentDepth, 1 + computeDepth(parentId, new Set(visited)));
        }
      }
      return maxParentDepth;
    };

    tasks.forEach(t => {
      totalEst += t.estimatedHours || 2;
      const incompleteBlockers = (t.blockedBy || []).filter(b => {
        const bId = typeof b === 'object' ? b.id : b;
        const parent = taskMap.get(bId);
        return !parent || parent.status !== 'DONE';
      });

      if (t.status === 'DONE') {
        // Done tasks
      } else if (incompleteBlockers.length > 0) {
        blocked++;
      } else {
        ready++;
      }

      const depth = computeDepth(t.id);
      waveAssignments.set(t.id, depth);
    });

    // Group tasks into wave arrays
    const waveGroups = {};
    tasks.forEach(t => {
      const depth = waveAssignments.get(t.id) || 0;
      if (!waveGroups[depth]) waveGroups[depth] = [];
      waveGroups[depth].push(t);
    });

    const sortedWaveKeys = Object.keys(waveGroups).map(Number).sort((a, b) => a - b);
    const waveList = sortedWaveKeys.map(k => ({
      waveNumber: k + 1,
      name: k === 0 ? 'Wave 1: Immediate & Independent' : `Wave ${k + 1}: Dependent Pipeline`,
      tasks: waveGroups[k]
    }));

    return { waves: waveList, totalHours: totalEst, blockedCount: blocked, readyCount: ready };
  }, [tasks]);

  const triageMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/projects/${projectId}/tasks/auto-triage`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['tasks', projectId]);
      toast.success(data.message || 'Auto-Pilot workload triage completed!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Auto-Triage failed');
    }
  });

  const dagContainerRef = useRef(null);

  useEffect(() => {
    if (dagContainerRef.current) {
      gsap.fromTo(
        dagContainerRef.current.children,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.1, ease: 'power2.out' }
      );
    }
  }, [waves.length]);

  if (!tasks || tasks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-black/50 dark:text-white/50">
        <GitMerge className="w-12 h-12 mb-3 stroke-1 text-[#E63B2E]" />
        <h3 className="text-base font-semibold mb-1">No Task Dependencies Yet</h3>
        <p className="text-xs max-w-md">Use the AI Analyze button to break objectives down into structured execution waves, or set task dependencies manually inside task details.</p>
      </div>
    );
  }

  return (
    <div ref={dagContainerRef} className="h-full overflow-y-auto p-4 sm:p-6 bg-[#F8F6F0] dark:bg-[#121212] space-y-6">
      {/* Auto-Pilot Header Bar */}
      <div className="bg-white dark:bg-[#1A1A1A] p-4 sm:p-5 rounded-2xl border border-[#E8E4DD] dark:border-white/10 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-signal-red/10 border border-signal-red/20 flex items-center justify-center text-signal-red">
            <GitMerge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm sm:text-base text-black dark:text-white uppercase tracking-wider">DAG Execution Pipeline</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#E63B2E]/10 text-signal-red">AUTO-PILOT LIVE</span>
            </div>
            <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">
              {waves.length} Execution Waves • {totalHours}h Total Workload • {readyCount} Ready to Run
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => triageMutation.mutate()}
            disabled={triageMutation.isPending}
            className="btn-brutal bg-[#111111] dark:bg-white/10 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 hover:bg-signal-red transition-all shrink-0 shadow-sm disabled:opacity-50"
          >
            <Zap className="w-4 h-4 text-signal-red fill-signal-red" />
            <span>{triageMutation.isPending ? 'Triaging Workloads...' : 'Auto-Pilot Triage'}</span>
          </button>
        )}
      </div>

      {/* DAG Waves */}
      <div className="space-y-6">
        {waves.map((wave) => (
          <div key={wave.waveNumber} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-black/40 dark:text-white/40 uppercase tracking-wider">
                  {wave.name}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#E8E4DD] dark:bg-white/10 text-black/60 dark:text-white/60">
                  {wave.tasks.length} {wave.tasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {wave.tasks.map((task) => {
                const incompleteBlockers = (task.blockedBy || []).filter(b => {
                  const bId = typeof b === 'object' ? b.id : b;
                  const parent = tasks.find(t => t.id === bId);
                  return !parent || parent.status !== 'DONE';
                });
                const isBlocked = task.status !== 'DONE' && incompleteBlockers.length > 0;

                return (
                  <div
                    key={task.id}
                    className={`bg-white dark:bg-[#1A1A1A] p-4 rounded-xl border transition-all hover:shadow-md relative flex flex-col justify-between ${
                      task.status === 'DONE' 
                        ? 'border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-500/5'
                        : isBlocked
                        ? 'border-amber-500/40 dark:border-amber-500/30 bg-amber-500/5'
                        : task.status === 'IN_PROGRESS'
                        ? 'border-blue-500/40 dark:border-blue-500/30 bg-blue-500/5'
                        : 'border-[#E8E4DD] dark:border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          task.priority === 'URGENT' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                          task.priority === 'HIGH' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' :
                          'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                        }`}>
                          {task.priority}
                        </span>

                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          task.status === 'DONE'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : isBlocked
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : task.status === 'IN_PROGRESS'
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                            : 'bg-gray-500/15 text-gray-600 dark:text-gray-400'
                        }`}>
                          {task.status === 'DONE' && <CheckCircle2 className="w-3 h-3" />}
                          {isBlocked && <ShieldAlert className="w-3 h-3" />}
                          {task.status === 'IN_PROGRESS' && <PlayCircle className="w-3 h-3" />}
                          {task.status === 'TODO' && !isBlocked && <Clock className="w-3 h-3" />}
                          <span>{task.status === 'DONE' ? 'DONE' : isBlocked ? 'BLOCKED' : task.status}</span>
                        </span>
                      </div>

                      <h4 className="font-semibold text-xs sm:text-sm text-black dark:text-white line-clamp-2 mb-2">
                        {task.title}
                      </h4>

                      {task.autoTriageReason && (
                        <p className="text-[10px] font-mono text-black/50 dark:text-white/40 mb-3 bg-[#F5F3EE] dark:bg-white/5 p-1.5 rounded border border-[#E8E4DD] dark:border-white/5">
                          💡 {task.autoTriageReason}
                        </p>
                      )}

                      {/* Dependencies preview */}
                      {task.blockedBy && task.blockedBy.length > 0 && (
                        <div className="mb-3 space-y-1">
                          <span className="text-[9px] font-mono text-black/40 dark:text-white/40 uppercase font-semibold block">
                            Blocked By ({task.blockedBy.length}):
                          </span>
                          <div className="space-y-1">
                            {task.blockedBy.map((b, idx) => {
                              const bTitle = typeof b === 'object' ? b.title : 'Task';
                              const bStatus = typeof b === 'object' ? b.status : 'UNKNOWN';
                              return (
                                <div key={idx} className="flex items-center gap-1.5 text-[10px] text-black/70 dark:text-white/70">
                                  <ArrowRight className="w-2.5 h-2.5 text-black/30" />
                                  <span className="truncate max-w-[180px]">{bTitle}</span>
                                  <span className={`text-[8px] font-mono px-1 rounded ${bStatus === 'DONE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {bStatus}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[#E8E4DD] dark:border-white/10 flex items-center justify-between text-[11px] text-black/60 dark:text-white/60">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-black/40" />
                        <span className="font-mono text-[10px]">{task.estimatedHours || 2}h est</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-black/40" />
                        <span className="truncate max-w-[100px] text-[10px]">
                          {task.assignee?.name || 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Square, Clock, Pause } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useSocket } from '../context/SocketContext';

export function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

// Compact timer for KanbanBoard task cards
export function TaskCardTimer({ taskId, projectId }) {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [timerData, setTimerData] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [otherElapsed, setOtherElapsed] = useState(0);
  const intervalRef = useRef(null);

  const fetchTimer = async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/tasks/${taskId}/time-entries`);
      setTimerData(data);
      if (data.activeEntry) {
        const startMs = new Date(data.activeEntry.startTime).getTime();
        setElapsed(Math.floor((Date.now() - startMs) / 1000));
      }
    } catch (err) {
      // silently fail on card-level fetches
    }
  };

  // Fetch time entries for this task
  useEffect(() => {
    fetchTimer();
  }, [taskId, projectId]);

  // Listen to live WebSocket events to synchronize timer state
  useEffect(() => {
    if (!socket) return;
    const handleTimerEvent = (data) => {
      if (data.taskId === taskId) {
        fetchTimer();
      }
    };
    socket.on('timer_started', handleTimerEvent);
    socket.on('timer_stopped', handleTimerEvent);
    return () => {
      socket.off('timer_started', handleTimerEvent);
      socket.off('timer_stopped', handleTimerEvent);
    };
  }, [socket, taskId]);

  // Live ticking clock when timer is active
  useEffect(() => {
    if (timerData?.activeEntry) {
      intervalRef.current = setInterval(() => {
        const startMs = new Date(timerData.activeEntry.startTime).getTime();
        setElapsed(Math.floor((Date.now() - startMs) / 1000));
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerData?.activeEntry]);

  // Live ticking clock for other members' timers
  const otherActive = timerData?.otherActiveEntries?.[0];
  useEffect(() => {
    let otherInterval;
    if (otherActive) {
      const tick = () => {
        const startMs = new Date(otherActive.startTime).getTime();
        setOtherElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
      };
      tick();
      otherInterval = setInterval(tick, 1000);
    }
    return () => {
      if (otherInterval) clearInterval(otherInterval);
    };
  }, [otherActive]);

  const startMutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/tasks/${taskId}/time-entries/start`),
    onSuccess: ({ data }) => {
      setTimerData(prev => ({ ...prev, activeEntry: data }));
      setElapsed(0);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to start timer'),
  });

  const stopMutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/tasks/${taskId}/time-entries/stop`),
    onSuccess: () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setTimerData(prev => ({ 
        ...prev, 
        activeEntry: null,
        totalSeconds: (prev?.totalSeconds || 0) + elapsed,
      }));
      setElapsed(0);
      queryClient.invalidateQueries(['tasks', projectId]);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to stop timer'),
  });

  const isRunning = !!timerData?.activeEntry;
  const totalLogged = timerData?.totalSeconds || 0;

  return (
    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      {isRunning ? (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); stopMutation.mutate(); }}
            disabled={stopMutation.isPending}
            className="w-5 h-5 rounded bg-[#E63B2E] flex items-center justify-center hover:bg-red-700 transition-colors"
            title="Stop timer"
          >
            <Square className="w-2.5 h-2.5 text-white fill-white" />
          </button>
          <span className="font-mono text-[10px] text-[#E63B2E] font-bold tabular-nums animate-pulse">
            {formatDuration(elapsed)}
          </span>
        </>
      ) : otherActive ? (
        <div 
          className="flex items-center gap-1 bg-[#E63B2E]/10 border border-[#E63B2E]/20 text-[#E63B2E] px-1.5 py-0.5 rounded text-[9px] font-mono font-bold animate-pulse" 
          title={`${otherActive.user.name} is currently tracking time`}
        >
          <Clock className="w-2.5 h-2.5" />
          <span>{otherActive.user.name.split(' ')[0]}: {formatDuration(otherElapsed)}</span>
        </div>
      ) : (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); startMutation.mutate(); }}
            disabled={startMutation.isPending}
            className="w-5 h-5 rounded bg-[#E8E4DD] dark:bg-[#2A2A2A] text-black dark:text-white flex items-center justify-center hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors group"
            title="Start timer"
          >
            <Play className="w-2.5 h-2.5 fill-current" />
          </button>
          {totalLogged > 0 && (
            <span className="font-mono text-[10px] text-black/40 dark:text-white/40 tabular-nums">
              {formatDuration(totalLogged)}
            </span>
          )}
        </>
      )}
    </div>
  );
}

// Full timer panel for TaskDetailsModal
export function TaskTimeTracker({ taskId, projectId }) {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [timerData, setTimerData] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [otherElapsed, setOtherElapsed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [accumulatedTime, setAccumulatedTime] = useState(0);
  const intervalRef = useRef(null);

  const fetchTimer = async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/tasks/${taskId}/time-entries`);
      setTimerData(data);
      if (data.activeEntry) {
        const startMs = new Date(data.activeEntry.startTime).getTime();
        setElapsed(Math.floor((Date.now() - startMs) / 1000));
        setIsPaused(false);
      }
    } catch (err) {
      console.error('Failed to fetch time entries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTimer();
  }, [taskId, projectId]);

  // Listen to live WebSocket events to synchronize timer state
  useEffect(() => {
    if (!socket) return;
    const handleTimerEvent = (data) => {
      if (data.taskId === taskId) {
        fetchTimer();
      }
    };
    socket.on('timer_started', handleTimerEvent);
    socket.on('timer_stopped', handleTimerEvent);
    return () => {
      socket.off('timer_started', handleTimerEvent);
      socket.off('timer_stopped', handleTimerEvent);
    };
  }, [socket, taskId]);

  useEffect(() => {
    if (timerData?.activeEntry) {
      intervalRef.current = setInterval(() => {
        const startMs = new Date(timerData.activeEntry.startTime).getTime();
        setElapsed(Math.floor((Date.now() - startMs) / 1000));
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerData?.activeEntry]);

  // Live ticking clock for other members' timers
  const otherActive = timerData?.otherActiveEntries?.[0];
  useEffect(() => {
    let otherInterval;
    if (otherActive) {
      const tick = () => {
        const startMs = new Date(otherActive.startTime).getTime();
        setOtherElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
      };
      tick();
      otherInterval = setInterval(tick, 1000);
    }
    return () => {
      if (otherInterval) clearInterval(otherInterval);
    };
  }, [otherActive]);

  const startMutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/tasks/${taskId}/time-entries/start`),
    onSuccess: ({ data }) => {
      setTimerData(prev => ({ ...prev, activeEntry: data }));
      setElapsed(0);
      setIsPaused(false);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to start timer'),
  });

  const stopMutation = useMutation({
    mutationFn: (vars) => api.post(`/projects/${projectId}/tasks/${taskId}/time-entries/stop`),
    onSuccess: (res, vars) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      
      const isPausing = vars?.isPausing;
      
      setTimerData(prev => ({
        ...prev,
        activeEntry: null,
        totalSeconds: (prev?.totalSeconds || 0) + elapsed,
      }));

      if (isPausing) {
        setIsPaused(true);
        setAccumulatedTime(prev => prev + elapsed);
      } else {
        setIsPaused(false);
        setAccumulatedTime(0);
      }
      
      setElapsed(0);
      fetchTimer(); // refresh full list
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to stop timer'),
  });

  const isRunning = !!timerData?.activeEntry;
  const totalLogged = timerData?.totalSeconds || 0;
  const otherRunningTime = otherActive ? otherElapsed : 0;

  const displayTime = isRunning 
    ? accumulatedTime + elapsed 
    : isPaused 
      ? accumulatedTime 
      : 0;

  if (isLoading) {
    return (
      <div className="border border-[#E8E4DD] rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-[#E8E4DD] rounded w-24 mb-2"></div>
        <div className="h-8 bg-[#E8E4DD] rounded w-32"></div>
      </div>
    );
  }

  return (
    <div className="border border-[#E8E4DD] dark:border-[#2A2A2A] rounded-xl overflow-hidden">
      {/* Timer Header */}
      <div className={`p-4 flex items-center justify-between ${isRunning ? 'bg-[#E63B2E]/5 border-b border-[#E63B2E]/10' : 'bg-[#F5F3EE] dark:bg-[#1C1C1C] border-b border-[#E8E4DD] dark:border-[#2A2A2A]'}`}>
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${isRunning ? 'text-[#E63B2E]' : 'text-black/40 dark:text-white/40'}`} />
          <span className="font-mono text-xs uppercase tracking-widest text-black/50 dark:text-white/50 font-bold">Time Tracker</span>
        </div>
        <div className="font-mono text-xs text-black/40 dark:text-white/40">
          Total: <strong className="text-black dark:text-white">{formatDuration(totalLogged + (isRunning ? elapsed : isPaused ? accumulatedTime : otherRunningTime))}</strong>
        </div>
      </div>

      {/* Live Timer Display */}
      <div className="p-6 text-center bg-white dark:bg-[#141414]">
        {otherActive && (
          <div className="mb-4 p-3 bg-[#E63B2E]/5 border border-[#E63B2E]/20 text-[#E63B2E] rounded-xl text-xs font-mono font-bold animate-pulse flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{otherActive.user.name} is currently tracking time: {formatDuration(otherElapsed)}</span>
          </div>
        )}

        <div className={`font-display text-5xl tabular-nums mb-4 ${(isRunning || isPaused) ? 'text-[#E63B2E]' : 'text-black/20 dark:text-white/20'}`}>
          {isRunning || isPaused ? formatDuration(displayTime) : '0m 00s'}
        </div>

        <div className="flex items-center justify-center gap-3">
          {isRunning ? (
            <>
              <button
                onClick={() => stopMutation.mutate({ isPausing: true })}
                disabled={stopMutation.isPending}
                className="inline-flex items-center gap-2 bg-[#EEEBE4] dark:bg-[#2A2A2A] text-black dark:text-white px-6 py-3 rounded-xl font-medium hover:bg-[#E8E4DD] dark:hover:bg-[#3F3F46] transition-colors disabled:opacity-50"
              >
                <Pause className="w-4 h-4 fill-current text-black dark:text-white" />
                Pause Timer
              </button>
              <button
                onClick={() => stopMutation.mutate({ isPausing: false })}
                disabled={stopMutation.isPending}
                className="inline-flex items-center gap-2 bg-[#E63B2E] text-white px-6 py-3 rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Square className="w-4 h-4 fill-white" />
                Stop Timer
              </button>
            </>
          ) : isPaused ? (
            <>
              <button
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="inline-flex items-center gap-2 bg-black dark:bg-[#E8E4DD] text-white dark:text-black px-6 py-3 rounded-xl font-medium hover:bg-[#E63B2E] dark:hover:bg-[#E63B2E] dark:hover:text-white transition-colors disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current dark:fill-black" />
                Resume Timer
              </button>
              <button
                onClick={() => {
                  setIsPaused(false);
                  setAccumulatedTime(0);
                }}
                className="inline-flex items-center gap-2 bg-[#E63B2E] text-white px-6 py-3 rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                <Square className="w-4 h-4 fill-white" />
                Stop/Reset
              </button>
            </>
          ) : (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="inline-flex items-center gap-2 bg-black dark:bg-[#E8E4DD] text-white dark:text-black px-6 py-3 rounded-xl font-medium hover:bg-[#E63B2E] dark:hover:bg-[#E63B2E] dark:hover:text-white transition-colors disabled:opacity-50"
              style={{ display: otherActive ? 'none' : 'inline-flex' }}
            >
              <Play className="w-4 h-4 fill-current dark:fill-black" />
              Start Timer
            </button>
          )}
        </div>
      </div>

      {/* Recent Sessions */}
      {timerData?.entries?.length > 0 && (
        <div className="border-t border-[#E8E4DD] dark:border-[#2A2A2A] p-4 bg-white dark:bg-[#141414]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-black/40 dark:text-white/40 font-bold mb-3">
            Recent Sessions
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {timerData.entries
              .filter(e => e.endTime)
              .slice(0, 5)
              .map(entry => {
                const dur = Math.floor((new Date(entry.endTime) - new Date(entry.startTime)) / 1000);
                return (
                  <div key={entry.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-black/40 dark:text-white/40">
                        {new Date(entry.startTime).toLocaleDateString()}
                      </span>
                      <span className="text-black/60 dark:text-white/60">{entry.user.name}</span>
                    </div>
                    <span className="font-mono font-bold text-black dark:text-white">{formatDuration(dur)}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

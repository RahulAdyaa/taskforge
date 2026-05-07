import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitCommit } from 'lucide-react';
import api from '../lib/axios';

const ACTION_META = {
  TASK_CREATED:       { label: 'Created task',           icon: '✦', color: 'bg-green-500' },
  TASK_CREATED_BY_AI: { label: 'AI generated task',      icon: '✧', color: 'bg-[#E63B2E]' },
  TASK_UPDATED:       { label: 'Updated task',           icon: '✎', color: 'bg-blue-500' },
  TASK_DELETED:       { label: 'Deleted task',            icon: '✕', color: 'bg-red-500' },
  COMMENT_ADDED:      { label: 'Added a comment',        icon: '💬', color: 'bg-yellow-500' },
  STATUS_CHANGED:     { label: 'Changed status',         icon: '→', color: 'bg-purple-500' },
};

function parseDetails(detailsStr) {
  if (!detailsStr) return null;
  try {
    return JSON.parse(detailsStr);
  } catch {
    return null;
  }
}

function formatTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function ActivityTimeline({ taskId, projectId }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activity', taskId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/tasks/${taskId}/activity`);
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-[#E8E4DD]"></div>
            <div className="flex-1">
              <div className="h-3 bg-[#E8E4DD] rounded w-3/4 mb-2"></div>
              <div className="h-2 bg-[#E8E4DD] rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-6">
        <GitCommit className="w-8 h-8 text-black/10 mx-auto mb-2" />
        <p className="font-mono text-xs text-black/30">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-3 top-3 bottom-3 w-px bg-[#E8E4DD]"></div>

      <div className="space-y-4">
        {logs.map((log, i) => {
          const meta = ACTION_META[log.action] || { label: log.action, icon: '•', color: 'bg-gray-400' };
          const details = parseDetails(log.details);

          return (
            <div key={log.id} className="flex gap-3 relative">
              {/* Timeline dot */}
              <div className={`w-6 h-6 rounded-full ${meta.color} flex items-center justify-center text-white text-[10px] shrink-0 z-10 ring-2 ring-white`}>
                {meta.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-sans text-sm font-semibold text-black">
                    {log.user?.name || 'System'}
                  </span>
                  <span className="font-mono text-xs text-black/50">
                    {meta.label}
                  </span>
                </div>

                {/* Detail chips */}
                {details && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {details.title && (
                      <span className="font-mono text-[10px] bg-[#F5F3EE] border border-[#E8E4DD] px-2 py-0.5 rounded text-black/60 truncate max-w-[200px]">
                        {details.title}
                      </span>
                    )}
                    {details.changes && Object.entries(details.changes).map(([key, val]) => (
                      <span key={key} className="font-mono text-[10px] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-blue-700">
                        {key}: {typeof val === 'object' ? `${val.from} → ${val.to}` : String(val)}
                      </span>
                    ))}
                  </div>
                )}

                <span className="font-mono text-[10px] text-black/30 mt-1 block">
                  {formatTimeAgo(log.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { TaskTimeTracker } from './TimeTracker';
import ActivityTimeline from './ActivityTimeline';

export default function TaskDetailsModal({ task, projectId, labels, onClose }) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const user = useAuthStore(state => state.user);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#E8E4DD');
  const chatEndRef = useRef(null);

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', task.id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/tasks/${task.id}/comments`);
      return data;
    }
  });

  const { data: projectTasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/tasks`);
      return data;
    }
  });

  const addBlockerMutation = useMutation({
    mutationFn: async (blockerId) => {
      const { data } = await api.post(`/projects/${projectId}/tasks/${task.id}/blockers`, { blockerId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
      toast.success('Dependency added');
    }
  });

  const removeBlockerMutation = useMutation({
    mutationFn: async (blockerId) => {
      const { data } = await api.delete(`/projects/${projectId}/tasks/${task.id}/blockers/${blockerId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
      toast.success('Dependency removed');
    }
  });

  // Re-fetch the active task from projectTasks to ensure we have fresh blockedBy data
  const activeTask = projectTasks.find(t => t.id === task.id) || task;
  const availableTasks = projectTasks.filter(t => t.id !== activeTask.id && !activeTask.blockedBy?.find(b => b.id === t.id));

  const commentMutation = useMutation({
    mutationFn: async (content) => {
      const { data } = await api.post(`/projects/${projectId}/tasks/${task.id}/comments`, { content });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['comments', task.id]);
      setNewComment('');
    },
    onError: (err) => {
      toast.error('Failed to post comment');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/projects/${projectId}/tasks/${task.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
      queryClient.invalidateQueries(['dashboard', projectId]);
      toast.success('Task deleted');
      onClose();
    },
    onError: () => {
      toast.error('Failed to delete task');
    }
  });

  const updateLabelsMutation = useMutation({
    mutationFn: async (labelIds) => {
      const { data } = await api.patch(`/projects/${projectId}/tasks/${task.id}`, { labelIds });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
    },
    onError: () => toast.error('Failed to update labels')
  });

  const createLabelMutation = useMutation({
    mutationFn: async ({ name, color }) => {
      const { data } = await api.post(`/projects/${projectId}/labels`, { name, color });
      return data;
    },
    onSuccess: (newLabel) => {
      queryClient.invalidateQueries(['labels', projectId]);
      setNewLabelName('');
      setShowLabelDropdown(false);
      // Auto-assign new label to task
      const currentLabelIds = activeTask.labels?.map(l => l.id) || [];
      updateLabelsMutation.mutate([...currentLabelIds, newLabel.id]);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create label')
  });

  const toggleLabel = (labelId) => {
    const currentLabelIds = activeTask.labels?.map(l => l.id) || [];
    if (currentLabelIds.includes(labelId)) {
      updateLabelsMutation.mutate(currentLabelIds.filter(id => id !== labelId));
    } else {
      updateLabelsMutation.mutate([...currentLabelIds, labelId]);
    }
  };

  const handleCreateLabel = (e) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    createLabelMutation.mutate({ name: newLabelName, color: newLabelColor });
  };

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    commentMutation.mutate(newComment);
  };

  // Auto-scroll to bottom of chat when new comments arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'URGENT': return 'bg-signal-red text-white';
      case 'HIGH': return 'bg-orange-500 text-white';
      case 'MEDIUM': return 'bg-yellow-500 text-white';
      case 'LOW': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#E8E4DD] animate-[slideIn_0.2s_ease-out] flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-5 border-b border-[#E8E4DD] shrink-0 bg-white">
          <div className="flex justify-between items-start gap-4 mb-3">
            <h2 className="font-display italic text-2xl break-words min-w-0 flex-1" style={{ overflowWrap: 'anywhere' }}>{task.title}</h2>
            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={() => setShowDeleteConfirm(true)} 
                className="text-black/30 hover:text-signal-red transition-colors font-mono text-xs border border-[#E8E4DD] hover:border-signal-red px-3 py-1.5 rounded-lg"
              >
                🗑 Delete
              </button>
              <button onClick={onClose} className="text-black/40 hover:text-black text-xl">✕</button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm font-mono text-black/60 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>
            <span>Status: <strong className="text-black">{task.status}</strong></span>
            <span>Assignee: <strong className="text-black">{task.assignee?.name || 'Unassigned'}</strong></span>
            <div className="relative">
              <button 
                onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                className="flex items-center gap-1 border border-[#E8E4DD] px-2 py-0.5 rounded hover:border-black transition-colors"
              >
                + Labels
              </button>
              {showLabelDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-[#E8E4DD] rounded-xl shadow-xl z-50 p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-xs uppercase tracking-widest text-black/50">Task Labels</span>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                    {labels?.map(l => {
                      const isActive = activeTask.labels?.some(al => al.id === l.id);
                      return (
                        <div key={l.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-[#F5F3EE] rounded" onClick={() => toggleLabel(l.id)}>
                          <input type="checkbox" readOnly checked={isActive} className="rounded" />
                          <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: l.color }}></div>
                          <span className="text-xs text-black truncate">{l.name}</span>
                        </div>
                      );
                    })}
                  </div>
                  <form onSubmit={handleCreateLabel} className="border-t border-[#E8E4DD] pt-3 mt-2">
                    <span className="font-bold text-xs uppercase tracking-widest text-black/50 mb-2 block">New Label</span>
                    <input 
                      type="text" 
                      placeholder="Name..." 
                      value={newLabelName}
                      onChange={e => setNewLabelName(e.target.value)}
                      className="w-full text-xs p-2 border border-[#E8E4DD] rounded mb-2 focus:border-black outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={newLabelColor}
                        onChange={e => setNewLabelColor(e.target.value)}
                        className="w-8 h-8 rounded border-none p-0 cursor-pointer"
                      />
                      <button type="submit" className="flex-1 bg-black text-white text-xs py-1.5 rounded disabled:opacity-50" disabled={createLabelMutation.isPending || !newLabelName.trim()}>
                        Create
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
            {activeTask.labels?.map(label => (
              <span key={label.id} className="font-mono text-[10px] px-2 py-1 rounded tracking-widest uppercase border border-black/10" style={{ backgroundColor: label.color, color: '#000' }}>
                {label.name}
              </span>
            ))}
          </div>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="px-8 py-4 bg-red-50 border-b border-red-200 shrink-0 flex items-center justify-between">
            <p className="font-sans text-sm text-red-800">
              <strong>Delete this task permanently?</strong> This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="px-4 py-2 text-sm font-medium rounded-lg border border-[#E8E4DD] hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => deleteMutation.mutate()} 
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-signal-red text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        )}

        {/* Two-Panel Body: Details (Left) + Chat (Right) */}
        <div className="flex-1 flex min-h-0">
          
          {/* LEFT PANEL — Task Details */}
          <div className="w-1/2 overflow-y-auto p-6 bg-[#F5F3EE] border-r border-[#E8E4DD]">
            {/* Description */}
            <div className="mb-6 bg-white p-5 rounded-2xl border border-[#E8E4DD] shadow-sm">
              <h3 className="font-mono text-xs text-black/40 uppercase tracking-widest mb-3">Description</h3>
              {task.description ? (
                <div className="prose prose-sm max-w-none font-sans prose-headings:font-display prose-headings:italic">
                  <ReactMarkdown>{task.description}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-black/40 italic font-mono text-sm">No description provided.</p>
              )}
            </div>

            {/* Time Tracker */}
            <div className="mb-6">
              <TaskTimeTracker taskId={task.id} projectId={projectId} />
            </div>

            {/* Dependencies */}
            <div className="bg-white p-5 rounded-2xl border border-[#E8E4DD] shadow-sm">
              <h3 className="font-mono text-xs text-black/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                Dependencies <span className="bg-[#E8E4DD] text-black px-2 py-0.5 rounded-full">{activeTask.blockedBy?.length || 0}</span>
              </h3>
              
              {activeTask.blockedBy?.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {activeTask.blockedBy.map(blocker => (
                    <div key={blocker.id} className="flex items-center justify-between bg-[#F5F3EE] p-3 rounded-xl border border-[#E8E4DD]">
                      <div className="flex items-center gap-3">
                        <span className="text-[#E63B2E]">🔒</span>
                        <span className={`font-mono text-xs px-2 py-1 rounded ${blocker.status === 'DONE' ? 'bg-green-100 text-green-800' : 'bg-[#E8E4DD] text-black'}`}>{blocker.status}</span>
                        <span className="font-sans font-medium text-sm">{blocker.title}</span>
                      </div>
                      <button 
                        onClick={() => removeBlockerMutation.mutate(blocker.id)}
                        disabled={removeBlockerMutation.isPending}
                        className="text-black/30 hover:text-[#E63B2E] transition-colors"
                      >✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-black/40 italic font-mono text-sm mb-4">No tasks are blocking this task.</p>
              )}

              {availableTasks.length > 0 && (
                <div className="flex gap-2">
                  <select 
                    className="flex-1 bg-[#F5F3EE] border border-[#E8E4DD] rounded-xl px-4 py-2 text-sm font-sans focus:outline-none focus:border-black"
                    onChange={(e) => {
                      if (e.target.value) {
                        addBlockerMutation.mutate(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Add a blocker...</option>
                    {availableTasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title} ({t.status})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Activity Timeline */}
            <div className="bg-white p-5 rounded-2xl border border-[#E8E4DD] shadow-sm mt-6">
              <h3 className="font-mono text-xs text-black/40 uppercase tracking-widest mb-4">📋 Activity Timeline</h3>
              <ActivityTimeline taskId={task.id} projectId={projectId} />
            </div>
          </div>

          {/* RIGHT PANEL — Discussion / Chat */}
          <div className="w-1/2 flex flex-col bg-white">
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-[#E8E4DD] shrink-0 flex items-center justify-between bg-[#FAFAF8]">
              <h3 className="font-mono text-xs text-black/40 uppercase tracking-widest font-bold">💬 Discussion Thread</h3>
              <span className="font-mono text-xs bg-[#E8E4DD] px-2.5 py-1 rounded-full">{comments.length}</span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {commentsLoading && (
                <div className="text-center text-sm font-mono text-black/40 py-8">Loading thread...</div>
              )}
              {!commentsLoading && comments.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3 opacity-30">💬</div>
                  <p className="font-mono text-xs text-black/30">No comments yet. Start the conversation!</p>
                </div>
              )}
              {comments.map(comment => (
                <div key={comment.id} className={`flex gap-3 ${comment.user.id === user.id ? 'flex-row-reverse' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-display text-lg shrink-0">
                    {comment.user.name.charAt(0)}
                  </div>
                  <div className={`flex flex-col ${comment.user.id === user.id ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    <div className="flex items-baseline gap-2 mb-1 px-1">
                      <span className="font-mono text-xs font-bold">{comment.user.name}</span>
                      <span className="font-mono text-[10px] text-black/40">{new Date(comment.createdAt).toLocaleString()}</span>
                    </div>
                    <div className={`p-4 rounded-2xl ${comment.user.id === user.id ? 'bg-black text-white rounded-tr-sm' : 'bg-[#F5F3EE] border border-[#E8E4DD] rounded-tl-sm'}`}>
                      <div className={`prose prose-sm max-w-none ${comment.user.id === user.id ? 'prose-invert' : ''}`}>
                        <ReactMarkdown>{comment.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input — pinned to bottom */}
            <div className="p-4 bg-white border-t border-[#E8E4DD] shrink-0">
              <form onSubmit={handleSubmitComment} className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Write a comment... (Markdown supported)"
                  className="flex-1 bg-[#F5F3EE] border border-[#E8E4DD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black font-sans resize-none h-12 min-h-[48px]"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitComment(e);
                    }
                  }}
                />
                <button 
                  type="submit" 
                  disabled={!newComment.trim() || commentMutation.isPending}
                  className="bg-signal-red text-white px-6 font-medium rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-12"
                >
                  Post
                </button>
              </form>
              <div className="text-right mt-1.5 mr-2">
                <span className="font-mono text-[10px] text-black/30">Markdown supported · Enter to post · Shift+Enter for newline</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

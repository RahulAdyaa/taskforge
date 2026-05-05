import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

export default function TaskDetailsModal({ task, projectId, onClose }) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const user = useAuthStore(state => state.user);

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

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    commentMutation.mutate(newComment);
  };

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div 
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl my-8 overflow-hidden border border-[#E8E4DD] animate-[slideIn_0.2s_ease-out] flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-[#E8E4DD] shrink-0">
          <div className="flex justify-between items-start mb-4">
            <h2 className="font-display italic text-3xl pr-8">{task.title}</h2>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(true)} 
                className="text-black/30 hover:text-signal-red transition-colors font-mono text-xs border border-[#E8E4DD] hover:border-signal-red px-3 py-1.5 rounded-lg"
              >
                🗑 Delete
              </button>
              <button onClick={onClose} className="text-black/40 hover:text-black text-xl">✕</button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm font-mono text-black/60">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>
            <span>Status: <strong className="text-black">{task.status}</strong></span>
            <span>Assignee: <strong className="text-black">{task.assignee?.name || 'Unassigned'}</strong></span>
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#F5F3EE]">
          <div className="mb-10 bg-white p-6 rounded-2xl border border-[#E8E4DD] shadow-sm">
            <h3 className="font-mono text-xs text-black/40 uppercase tracking-widest mb-4">Description</h3>
            {task.description ? (
              <div className="prose prose-sm max-w-none font-sans prose-headings:font-display prose-headings:italic">
                <ReactMarkdown>{task.description}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-black/40 italic font-mono text-sm">No description provided.</p>
            )}
          </div>

          <div className="mb-10 bg-white p-6 rounded-2xl border border-[#E8E4DD] shadow-sm">
            <h3 className="font-mono text-xs text-black/40 uppercase tracking-widest mb-4 flex items-center gap-2">
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

          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-mono text-xs text-black/40 uppercase tracking-widest">Discussion Thread</h3>
            <span className="font-mono text-xs bg-[#E8E4DD] px-2 py-0.5 rounded">{comments.length} Comments</span>
          </div>

          <div className="space-y-4 mb-8">
            {commentsLoading && <div className="text-center text-sm font-mono text-black/40">Loading thread...</div>}
            {comments.map(comment => (
              <div key={comment.id} className={`flex gap-4 ${comment.user.id === user.id ? 'flex-row-reverse' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-display text-lg shrink-0">
                  {comment.user.name.charAt(0)}
                </div>
                <div className={`flex flex-col ${comment.user.id === user.id ? 'items-end' : 'items-start'} max-w-[80%]`}>
                  <div className="flex items-baseline gap-2 mb-1 px-1">
                    <span className="font-mono text-xs font-bold">{comment.user.name}</span>
                    <span className="font-mono text-[10px] text-black/40">{new Date(comment.createdAt).toLocaleString()}</span>
                  </div>
                  <div className={`p-4 rounded-2xl ${comment.user.id === user.id ? 'bg-black text-white rounded-tr-sm' : 'bg-white border border-[#E8E4DD] shadow-sm rounded-tl-sm'}`}>
                    <div className={`prose prose-sm max-w-none ${comment.user.id === user.id ? 'prose-invert' : ''}`}>
                      <ReactMarkdown>{comment.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comment Input */}
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
          <div className="text-right mt-2 mr-2">
            <span className="font-mono text-[10px] text-black/30">Markdown supported. Press Enter to post.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

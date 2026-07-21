import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { TaskTimeTracker } from './TimeTracker';
import ActivityTimeline from './ActivityTimeline';
import { useSocket } from '../context/SocketContext';
import { Pencil, Trash2, Info, Check, X } from 'lucide-react';

const toLocalISOString = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

export default function TaskDetailsModal({ task, projectId, labels, onClose }) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const user = useAuthStore(state => state.user);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#E8E4DD');
  const chatEndRef = useRef(null);
  const labelDropdownRef = useRef(null);

  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [infoCommentId, setInfoCommentId] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    enabled: !!projectId,
  });
  const projectMember = project?.members?.find(m => m.user.id === user?.id);
  const isAdmin = projectMember?.role === 'ADMIN';

  const { socket, isConnected } = useSocket();
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    function handleClickOutside(event) {
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(event.target)) {
        setShowLabelDropdown(false);
      }
    }
    if (showLabelDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLabelDropdown]);

  // Join/leave thread room and listen to comments
  useEffect(() => {
    if (!socket) return;

    socket.emit('join_thread', { taskId: task.id, projectId });

    const handleNewComment = (data) => {
      if (data.taskId === task.id) {
        queryClient.setQueryData(['comments', task.id], (oldComments = []) => {
          if (oldComments.some(c => c.id === data.comment.id)) {
            return oldComments;
          }
          return [...oldComments, data.comment];
        });
      }
    };

    const handleCommentUpdated = (data) => {
      if (data.taskId === task.id) {
        queryClient.setQueryData(['comments', task.id], (oldComments = []) => {
          return oldComments.map(c => c.id === data.comment.id ? data.comment : c);
        });
      }
    };

    const handleCommentDeleted = (data) => {
      if (data.taskId === task.id) {
        queryClient.setQueryData(['comments', task.id], (oldComments = []) => {
          return oldComments.filter(c => c.id !== data.commentId);
        });
      }
    };

    const handleTypingStatus = (data) => {
      if (data.taskId === task.id) {
        setTypingUsers((prev) => {
          if (data.isTyping) {
            if (prev.includes(data.userName)) return prev;
            return [...prev, data.userName];
          } else {
            return prev.filter(name => name !== data.userName);
          }
        });
      }
    };

    socket.on('new_comment', handleNewComment);
    socket.on('comment_updated', handleCommentUpdated);
    socket.on('comment_deleted', handleCommentDeleted);
    socket.on('typing_status', handleTypingStatus);

    return () => {
      socket.emit('leave_thread', { taskId: task.id });
      socket.off('new_comment', handleNewComment);
      socket.off('comment_updated', handleCommentUpdated);
      socket.off('comment_deleted', handleCommentDeleted);
      socket.off('typing_status', handleTypingStatus);
    };
  }, [socket, task.id, projectId, queryClient]);

  // Clean up typing timers on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

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
  const canEdit = true;
  const members = project?.members || [];
  const availableTasks = projectTasks.filter(t => t.id !== activeTask.id && !activeTask.blockedBy?.find(b => b.id === t.id));

  // REST API fallbacks for comments (used when WebSockets are disconnected, e.g. on Vercel)
  const postCommentMutation = useMutation({
    mutationFn: async (content) => {
      const { data } = await api.post(`/projects/${projectId}/tasks/${task.id}/comments`, { content });
      return data;
    },
    onSuccess: (newCommentData) => {
      queryClient.setQueryData(['comments', task.id], (oldComments = []) => {
        return [...oldComments, newCommentData];
      });
      setNewComment('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to post comment');
    }
  });

  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }) => {
      const { data } = await api.patch(`/projects/${projectId}/tasks/${task.id}/comments/${commentId}`, { content });
      return { commentId, data };
    },
    onSuccess: ({ commentId, data }) => {
      queryClient.setQueryData(['comments', task.id], (oldComments = []) => {
        return oldComments.map(c => c.id === commentId ? data : c);
      });
      setEditingCommentId(null);
      setEditCommentContent('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to edit comment');
    }
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId) => {
      await api.delete(`/projects/${projectId}/tasks/${task.id}/comments/${commentId}`);
      return commentId;
    },
    onSuccess: (commentId) => {
      queryClient.setQueryData(['comments', task.id], (oldComments = []) => {
        return oldComments.filter(c => c.id !== commentId);
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to delete comment');
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

  const updateTaskMutation = useMutation({
    mutationFn: async (updatedFields) => {
      const { data } = await api.patch(`/projects/${projectId}/tasks/${task.id}`, updatedFields);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
      toast.success('Protocol updated.');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to update protocol');
    }
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

  const handleTextareaChange = (e) => {
    setNewComment(e.target.value);

    if (!socket || !isConnected) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing_start', { taskId: task.id, projectId });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing_end', { taskId: task.id, projectId });
    }, 2000);
  };

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!socket || !isConnected) {
      postCommentMutation.mutate(newComment);
      return;
    }

    socket.emit('send_message', { taskId: task.id, projectId, content: newComment });
    
    // Clear typing indicator status
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    socket.emit('typing_end', { taskId: task.id, projectId });

    setNewComment('');
  };

  const handleSaveEdit = (commentId) => {
    if (!editCommentContent.trim()) return;
    if (socket && isConnected) {
      socket.emit('edit_message', {
        taskId: task.id,
        projectId,
        commentId,
        content: editCommentContent,
      });
      setEditingCommentId(null);
      setEditCommentContent('');
    } else {
      editCommentMutation.mutate({ commentId, content: editCommentContent });
    }
  };

  const handleDeleteComment = (commentId) => {
    if (socket && isConnected) {
      socket.emit('delete_message', {
        taskId: task.id,
        projectId,
        commentId,
      });
      setDeletingCommentId(null);
    } else {
      deleteCommentMutation.mutate(commentId);
      setDeletingCommentId(null);
    }
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div 
        className="w-full max-w-6xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-[#E8E4DD] animate-[slideIn_0.2s_ease-out] flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-8 py-4 sm:py-5 border-b border-[#E8E4DD] shrink-0 bg-white">
          <div className="flex justify-between items-start gap-4 mb-3">
            <h2 className="font-display italic text-xl sm:text-2xl break-words min-w-0 flex-1" style={{ overflowWrap: 'anywhere' }}>{task.title}</h2>
            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={() => setShowDeleteConfirm(true)} 
                className="text-black/60 hover:text-signal-red transition-colors font-mono text-xs border border-[#E8E4DD] hover:border-signal-red px-3 py-1.5 rounded-lg hover:bg-signal-red/5"
              >
                🗑 Delete
              </button>
              <button onClick={onClose} className="text-black/40 hover:text-black text-xl">✕</button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm font-mono text-black/60 flex-wrap">
            {/* Priority */}
            <div>
              Priority:{' '}
              {canEdit ? (
                <select
                  value={activeTask.priority}
                  onChange={(e) => updateTaskMutation.mutate({ priority: e.target.value })}
                  className="bg-transparent border-b border-[#E8E4DD] text-black font-bold outline-none cursor-pointer focus:border-black text-xs"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              ) : (
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getPriorityColor(activeTask.priority)}`}>
                  {activeTask.priority}
                </span>
              )}
            </div>

            {/* Status */}
            <span>
              Status:{' '}
              {canEdit ? (
                <select
                  value={activeTask.status}
                  onChange={(e) => updateTaskMutation.mutate({ status: e.target.value })}
                  className="bg-transparent border-b border-[#E8E4DD] text-black font-bold outline-none cursor-pointer focus:border-black text-xs"
                >
                  <option value="TODO">Todo</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </select>
              ) : (
                <strong className="text-black">{activeTask.status}</strong>
              )}
            </span>

            {/* Assignee */}
            <span>
              Assignee:{' '}
              {canEdit ? (
                <select
                  value={activeTask.assigneeId || ''}
                  onChange={(e) => updateTaskMutation.mutate({ assigneeId: e.target.value || null })}
                  className="bg-transparent border-b border-[#E8E4DD] text-black font-bold outline-none cursor-pointer focus:border-black text-xs"
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                  ))}
                </select>
              ) : (
                <strong className="text-black">{activeTask.assignee?.name || 'Unassigned'}</strong>
              )}
            </span>

            {/* Due Date (Deadline) */}
            <span>
              Due:{' '}
              {canEdit ? (
                <input
                  type="datetime-local"
                  value={toLocalISOString(activeTask.dueDate)}
                  onChange={(e) => updateTaskMutation.mutate({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="bg-transparent border-b border-[#E8E4DD] text-black font-mono outline-none cursor-pointer focus:border-black text-xs min-w-[220px] w-56"
                />
              ) : (
                <strong className="text-black font-mono">
                  {activeTask.dueDate ? new Date(activeTask.dueDate).toLocaleString() : 'None'}
                </strong>
              )}
            </span>

            <div className="relative" ref={labelDropdownRef}>
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
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-hidden">
          
          {/* LEFT PANEL — Task Details */}
          <div className="w-full md:w-1/2 lg:w-3/5 min-w-0 overflow-y-auto p-4 sm:p-6 bg-[#F5F3EE] border-b md:border-b-0 md:border-r border-[#E8E4DD]">
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
          <div className="w-full md:w-1/2 lg:w-2/5 min-w-0 flex flex-col bg-white min-h-[320px] md:min-h-0">
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
              {comments.map(comment => {
                const isOwn = comment.user.id === user.id;
                const isEditing = editingCommentId === comment.id;
                const isDeleting = deletingCommentId === comment.id;
                const isInfoActive = infoCommentId === comment.id;

                return (
                  <div key={comment.id} className={`flex gap-3 relative group ${isOwn ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-display text-lg shrink-0">
                      {comment.user.name.charAt(0)}
                    </div>
                    
                    {/* Content Area */}
                    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85%] relative`}>
                      {/* Name + Timestamp */}
                      <div className="flex items-baseline gap-2 mb-1 px-1">
                        <span className="font-mono text-xs font-bold">{comment.user.name}</span>
                        <span className="font-mono text-[10px] text-black/40">
                          {new Date(comment.createdAt).toLocaleString()}
                          {comment.isEdited && (
                            <span className="text-black/30 text-[9px] italic ml-1.5 font-sans">(edited)</span>
                          )}
                        </span>
                      </div>
                      
                      {/* Bubble */}
                      <div className={`p-4 rounded-2xl relative ${isOwn ? 'bg-black text-white rounded-tr-sm' : 'bg-[#F5F3EE] border border-[#E8E4DD] rounded-tl-sm'} w-full`}>
                        {isEditing ? (
                          <div className="w-full flex flex-col gap-2 min-w-[200px]">
                            <textarea
                              value={editCommentContent}
                              onChange={(e) => setEditCommentContent(e.target.value)}
                              className="w-full bg-[#F5F3EE] dark:bg-[#1E1E24] text-black dark:text-white border border-[#E8E4DD] dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black font-sans resize-none min-h-[60px]"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSaveEdit(comment.id);
                                } else if (e.key === 'Escape') {
                                  setEditingCommentId(null);
                                }
                              }}
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <button 
                                onClick={() => setEditingCommentId(null)}
                                className="px-2 py-1 border border-[#E8E4DD] dark:border-white/10 text-xs font-medium rounded-lg hover:bg-[#F5F3EE] dark:hover:bg-white/10 transition-colors"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => handleSaveEdit(comment.id)}
                                disabled={!editCommentContent.trim()}
                                className="px-3 py-1 bg-[#E63B2E] text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={`prose prose-sm max-w-none ${isOwn ? 'prose-invert' : ''}`}>
                            <ReactMarkdown>{comment.content}</ReactMarkdown>
                          </div>
                        )}

                        {/* Hover Action Bar or Delete Confirm */}
                        {!isEditing && (
                          <>
                            {isDeleting ? (
                              <div className={`absolute -top-3.5 ${isOwn ? 'right-2' : 'left-2'} bg-white border border-red-200 shadow-md rounded-lg px-2 py-1 z-20 flex items-center gap-1.5 animate-[slideIn_0.1s_ease-out]`}>
                                <span className="text-[10px] font-mono text-red-600 font-bold px-1">Delete?</span>
                                <button 
                                  onClick={() => handleDeleteComment(comment.id)} 
                                  className="text-[10px] bg-[#E63B2E] text-white px-2 py-0.5 rounded font-medium hover:bg-red-700 transition-colors"
                                >
                                  Yes
                                </button>
                                <button 
                                  onClick={() => setDeletingCommentId(null)} 
                                  className="text-[10px] border border-[#E8E4DD] px-1.5 py-0.5 rounded text-black/50 hover:bg-[#F5F3EE] transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <div className={`absolute -top-3.5 ${isOwn ? 'right-2' : 'left-2'} flex items-center gap-1 bg-white border border-[#E8E4DD] shadow-md rounded-lg p-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                                <button 
                                  onClick={() => setInfoCommentId(isInfoActive ? null : comment.id)}
                                  className="p-1 hover:bg-[#F5F3EE] rounded text-black/40 hover:text-black transition-colors"
                                  title="Message Info"
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                                {isOwn && (
                                  <button 
                                    onClick={() => {
                                      setEditingCommentId(comment.id);
                                      setEditCommentContent(comment.content);
                                    }}
                                    className="p-1 hover:bg-[#F5F3EE] rounded text-black/40 hover:text-black transition-colors"
                                    title="Edit Message"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {(isOwn || isAdmin) && (
                                  <button 
                                    onClick={() => setDeletingCommentId(comment.id)}
                                    className="p-1 hover:bg-red-50 rounded text-black/40 hover:text-[#E63B2E] transition-colors"
                                    title="Delete Message"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Info Popover */}
                      {isInfoActive && (
                        <div className={`absolute top-8 ${isOwn ? 'right-0' : 'left-0'} w-64 bg-white border border-[#E8E4DD] rounded-xl shadow-xl z-30 p-4 text-left font-sans text-xs text-black animate-[slideIn_0.15s_ease-out]`}>
                          <div className="flex justify-between items-center mb-2 border-b border-[#E8E4DD] pb-1.5">
                            <span className="font-mono text-[9px] font-bold text-black/40 uppercase tracking-widest">Message Info</span>
                            <button onClick={() => setInfoCommentId(null)} className="text-black/40 hover:text-black">✕</button>
                          </div>
                          <div className="space-y-1.5 font-mono text-[9px] text-black/60">
                            <div><strong className="text-black/80 font-sans text-[10px]">Author:</strong> {comment.user.name}</div>
                            <div><strong className="text-black/80 font-sans text-[10px]">Email:</strong> {comment.user.email}</div>
                            <div className="border-t border-[#E8E4DD]/50 my-1"></div>
                            <div><strong className="text-black/80 font-sans text-[10px]">Created:</strong> {new Date(comment.createdAt).toLocaleString()}</div>
                            {comment.isEdited && (
                              <div><strong className="text-black/80 font-sans text-[10px]">Edited:</strong> {new Date(comment.updatedAt).toLocaleString()}</div>
                            )}
                            <div className="border-t border-[#E8E4DD]/50 my-1"></div>
                            <div><strong className="text-black/80 font-sans text-[10px]">Characters:</strong> {comment.content.length}</div>
                            <div><strong className="text-black/80 font-sans text-[10px]">Words:</strong> {comment.content.trim().split(/\s+/).filter(Boolean).length}</div>
                            <div className="border-t border-[#E8E4DD]/50 my-1"></div>
                            <div className="text-[8px] text-black/30 truncate" title={comment.id}>ID: {comment.id}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 text-xs italic text-black/40 font-mono px-2 py-1">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-black/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-black/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-black/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat Input — pinned to bottom */}
            <div className="p-4 bg-white border-t border-[#E8E4DD] shrink-0">
              <form onSubmit={handleSubmitComment} className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={handleTextareaChange}
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
                  disabled={!newComment.trim() || postCommentMutation.isPending}
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

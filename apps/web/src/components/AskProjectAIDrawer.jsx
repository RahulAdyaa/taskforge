import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { 
  Sparkles, 
  X, 
  Send, 
  Copy, 
  Check, 
  Trash2, 
  Bot, 
  User, 
  Loader2,
  Square,
  Download,
  Plus,
  History,
  MessageSquare
} from 'lucide-react';
import gsap, { useIsomorphicLayoutEffect } from '../lib/gsap';

export default function AskProjectAIDrawer({ projectId, projectName, tasks = [] }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [query, setQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);

  const drawerRef = useRef(null);
  const backdropRef = useRef(null);
  const chatEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  // ─── ChatGPT Multi-Session Chat History State ────────────────────
  const [sessions, setSessions] = useState(() => {
    try {
      if (projectId) {
        const saved = localStorage.getItem(`tf_ai_sessions_${projectId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse AI chat sessions:', e);
    }
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    try {
      if (projectId) {
        const savedId = localStorage.getItem(`tf_ai_active_session_${projectId}`);
        if (savedId) return savedId;
      }
    } catch (e) {}
    return `session_${Date.now()}`;
  });

  const [messages, setMessages] = useState(() => {
    try {
      if (projectId) {
        const savedId = localStorage.getItem(`tf_ai_active_session_${projectId}`);
        const savedSessions = localStorage.getItem(`tf_ai_sessions_${projectId}`);
        if (savedSessions && savedId) {
          const parsed = JSON.parse(savedSessions);
          const current = parsed.find(s => s.id === savedId);
          if (current && Array.isArray(current.messages)) {
            return current.messages;
          }
        }
      }
    } catch (e) {}
    return [];
  });

  // Sync active session changes to localStorage
  useEffect(() => {
    if (!projectId) return;

    try {
      localStorage.setItem(`tf_ai_active_session_${projectId}`, activeSessionId);

      setSessions(prevSessions => {
        const existingIdx = prevSessions.findIndex(s => s.id === activeSessionId);
        let updated;
        
        if (messages.length === 0 && existingIdx === -1) {
          return prevSessions;
        }

        const title = prevSessions[existingIdx]?.title || 
                      (messages.length > 0 ? (messages[0].content.slice(0, 32) + '...') : 'New Chat Session');

        const sessionObj = {
          id: activeSessionId,
          title,
          updatedAt: Date.now(),
          messages,
        };

        if (existingIdx >= 0) {
          updated = [...prevSessions];
          updated[existingIdx] = sessionObj;
        } else {
          updated = [sessionObj, ...prevSessions];
        }

        localStorage.setItem(`tf_ai_sessions_${projectId}`, JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      console.error('Failed to persist AI chat sessions:', e);
    }
  }, [projectId, activeSessionId, messages]);

  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;
    if (backdropRef.current) {
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    }
    if (drawerRef.current) {
      gsap.fromTo(
        drawerRef.current,
        { x: '100%' },
        { x: '0%', duration: 0.4, ease: 'power3.out' }
      );
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleStartNewChat = () => {
    const newId = `session_${Date.now()}`;
    setActiveSessionId(newId);
    setMessages([]);
    setShowHistory(false);
    toast.success('Started new chat session');
  };

  const handleSelectSession = (session) => {
    setActiveSessionId(session.id);
    setMessages(session.messages || []);
    setShowHistory(false);
  };

  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== sessionId);
    setSessions(updated);
    if (projectId) {
      localStorage.setItem(`tf_ai_sessions_${projectId}`, JSON.stringify(updated));
    }

    if (sessionId === activeSessionId) {
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id);
        setMessages(updated[0].messages || []);
      } else {
        const newId = `session_${Date.now()}`;
        setActiveSessionId(newId);
        setMessages([]);
      }
    }
    toast.success('Chat session deleted');
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    toast('Response generation stopped', { icon: '⏹' });
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: '⏹ *[Response generation stopped by user]*' }
    ]);
  };

  const handleSaveChat = () => {
    if (messages.length === 0) {
      toast.error('No chat messages to save.');
      return;
    }

    let content = `# TaskForge AI Chat Export — ${projectName || 'Project'}\n`;
    content += `*Exported on: ${new Date().toLocaleString()}*\n\n---\n\n`;

    messages.forEach((m) => {
      const sender = m.role === 'user' ? '👤 User' : '🤖 TaskForge AI';
      content += `### ${sender}\n${m.content}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TaskForge_Chat_${projectName ? projectName.replace(/\s+/g, '_') : 'Project'}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Chat history saved as Markdown file!');
  };

  const copilotMutation = useMutation({
    mutationFn: async (userQuery) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const historyToPass = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await api.post(`/projects/${projectId}/ai-copilot`, {
        query: userQuery,
        chatHistory: historyToPass,
      }, { signal: controller.signal });
      return res.data;
    },
    onSuccess: (data) => {
      abortControllerRef.current = null;
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.answer }
      ]);
      if (data.createdTask) {
        toast.success(`⚡ Task "${data.createdTask.title}" created live on Kanban board!`);
        queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] });
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      }
    },
    onError: (err) => {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        abortControllerRef.current = null;
        return;
      }
      abortControllerRef.current = null;
      toast.error(err.response?.data?.error || 'AI Co-Pilot is currently busy. Please try again.');
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ *I encountered a temporary connection issue reaching the AI model core. Please try asking your question again!*' }
      ]);
    }
  });

  const handleSend = (textToSend) => {
    const text = textToSend || query;
    if (!text || !text.trim() || copilotMutation.isPending) return;

    const trimmed = text.trim();
    const command = trimmed.toLowerCase();
    if (command === 'clear' || command === 'cls' || command === 'clr') {
      setMessages([]);
      if (!textToSend) setQuery('');
      toast.success('Chat history cleared!');
      return;
    }

    const newMsg = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, newMsg]);
    if (!textToSend) setQuery('');

    copilotMutation.mutate(trimmed);
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success('Response copied to clipboard!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const quickQueries = [
    { label: '🛠️ How do I complete task...', query: 'Give me a step-by-step technical implementation guide and execution plan to complete my highest priority open task.' },
    { label: '⚡ What is blocking the sprint?', query: 'What are the main blockers and incomplete dependencies slowing down this project sprint?' },
    { label: '📊 Summarize attachments', query: 'Summarize all Excel, CSV, PDF, and Word file attachments uploaded to tasks in this project.' },
    { label: '📝 Generate Client Status Update', query: 'Write a professional, concise executive status update for project stakeholders summarizing completed vs active work.' },
    { label: '👤 Who is currently overloaded?', query: 'Analyze the team workload distribution and tell me who has the most active tasks and estimated hours.' },
  ];

  return (
    <>
      {/* Raycast / Linear Style Floating AI Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 group flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-2.5 rounded-full bg-[#09090B] text-white border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(230,59,46,0.25)] hover:shadow-[0_10px_35px_rgba(230,59,46,0.45)] hover:border-[#E63B2E] hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-xl"
      >
        <div className="relative flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#E63B2E] animate-pulse" />
          <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-[#E63B2E] animate-ping opacity-75" />
        </div>
        
        <span className="font-sans font-bold text-xs sm:text-sm tracking-tight text-white flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 fill-[#E63B2E] text-[#E63B2E]" />
          <span>Ask Project AI</span>
        </span>

        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E63B2E]/15 text-[#E63B2E] border border-[#E63B2E]/30 uppercase tracking-wider hidden sm:inline-block">
          RAG
        </span>
      </button>

      {/* Slide-Over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Overlay */}
          <div
            ref={backdropRef}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
          />

          {/* Drawer Container */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
            <div
              ref={drawerRef}
              data-lenis-prevent
              className="w-screen max-w-full sm:max-w-2xl bg-[#09090B] text-white flex flex-col border-l border-white/10 shadow-2xl relative"
            >
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#09090B] sticky top-0 z-20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#E63B2E]/20 to-black border border-[#E63B2E]/30 text-[#E63B2E] flex items-center justify-center shadow-inner">
                    <Sparkles className="w-5 h-5 fill-[#E63B2E]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-sans font-extrabold text-base text-white tracking-tight">Ask Project AI</h2>
                      <span className="flex items-center gap-1 text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        RAG ACTIVE
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-white/50 truncate max-w-[240px]">
                      {projectName ? `Project: ${projectName}` : 'Context-Aware Co-Pilot'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* TaskForge Brutalist New Chat Button */}
                  <button
                    onClick={handleStartNewChat}
                    className="btn-brutal bg-[#E63B2E] hover:bg-[#d03226] text-white text-xs font-mono font-bold px-3 py-2 rounded-xl shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
                    title="Start new chat session"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">New Chat</span>
                  </button>

                  {/* TaskForge History Toggle Button */}
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className={`px-3 py-2 rounded-xl border transition-all flex items-center gap-1.5 font-mono text-xs font-semibold ${
                      showHistory 
                        ? 'bg-[#E63B2E]/20 text-[#E63B2E] border-[#E63B2E]/40 shadow-sm' 
                        : 'bg-white/5 text-white/70 border-white/10 hover:text-white hover:bg-white/10'
                    }`}
                    title="Saved Chat History"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">History</span>
                    {sessions.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-[#E63B2E]/20 text-[#E63B2E] rounded-full text-[10px] font-bold">
                        {sessions.length}
                      </span>
                    )}
                  </button>

                  {messages.length > 0 && (
                    <button
                      onClick={handleSaveChat}
                      className="p-2 rounded-xl text-white/60 hover:text-emerald-400 hover:bg-white/10 border border-white/10 transition-all active:scale-95"
                      title="Export Chat as Markdown"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 border border-white/10 transition-all active:scale-95 ml-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Main Content Body (Dual View: Chat vs History Sidebar) */}
              <div className="flex-1 flex overflow-hidden relative">
                
                {/* 📜 ChatGPT-Style Chat History Sidebar Panel */}
                {showHistory && (
                  <div className="w-72 bg-[#09090B] border-r border-white/10 flex flex-col shrink-0 animate-[slideIn_0.2s_ease-out] z-10">
                    <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-[#121215]">
                      <span className="text-xs font-mono font-bold text-[#E63B2E] flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-[#E63B2E]" /> Saved Sessions
                      </span>
                      <button
                        onClick={handleStartNewChat}
                        className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="New Chat"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                      {sessions.length === 0 ? (
                        <div className="p-6 text-center text-xs font-mono text-white/40">
                          No saved chat sessions yet.
                        </div>
                      ) : (
                        sessions.map(s => {
                          const isActive = s.id === activeSessionId;
                          return (
                            <div
                              key={s.id}
                              onClick={() => handleSelectSession(s)}
                              className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group border ${
                                isActive 
                                  ? 'bg-[#E63B2E]/10 border-[#E63B2E]/40 text-white font-medium shadow-md' 
                                  : 'bg-white/5 hover:bg-white/10 border-white/5 text-white/70 hover:text-white'
                              }`}
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <div className="text-xs truncate font-sans font-medium leading-tight">
                                  {s.title}
                                </div>
                                <div className="text-[10px] font-mono text-white/40 mt-1 flex items-center gap-2">
                                  <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                                  <span>•</span>
                                  <span>{s.messages?.length || 0} msgs</span>
                                </div>
                              </div>
                              <button
                                onClick={(e) => handleDeleteSession(s.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-[#E63B2E] hover:bg-white/10 rounded-lg transition-all shrink-0"
                                title="Delete session"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* 💬 Main Active Chat Window */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[#09090B]">
                  
                  {/* Quick Action Prompt Chips */}
                  <div className="px-6 py-3.5 border-b border-white/10 bg-[#0F0F12] flex flex-wrap gap-2 shrink-0">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#E63B2E] w-full flex items-center gap-1.5 mb-0.5">
                      <Sparkles className="w-3 h-3 fill-[#E63B2E] text-[#E63B2E]" /> Suggested Quick Queries
                    </span>
                    {quickQueries.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(item.query)}
                        disabled={copilotMutation.isPending}
                        className="text-xs font-sans bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 hover:border-[#E63B2E]/40 px-3.5 py-1.5 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
                      >
                        <span>{item.label}</span>
                        <span className="text-white/30 text-[10px]">›</span>
                      </button>
                    ))}
                  </div>

                  {/* Chat Log */}
                  <div data-lenis-prevent className="flex-1 overflow-y-auto p-5 space-y-4">
                    {messages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/40 my-auto">
                        <div className="w-16 h-16 rounded-2xl bg-[#E63B2E]/10 border border-[#E63B2E]/30 flex items-center justify-center mb-4 shadow-lg">
                          <Sparkles className="w-8 h-8 text-[#E63B2E] fill-[#E63B2E]" />
                        </div>
                        <h3 className="text-base font-sans font-extrabold text-white mb-1">How can I help with this project?</h3>
                        <p className="text-xs max-w-sm font-sans text-white/50 leading-relaxed">
                          I have 360° context on all tasks, DAG dependencies, team workloads, comments, and uploaded files in <strong>{projectName || 'this project'}</strong>.
                        </p>
                      </div>
                    )}

                    {messages.map((msg, idx) => {
                      const isUser = msg.role === 'user';
                      return (
                        <div key={idx} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-mono text-xs shadow-md ${isUser ? 'bg-white text-black font-bold' : 'bg-[#E63B2E] text-white'}`}>
                            {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                          </div>

                          <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[92%]`}>
                            <div className={`p-4.5 rounded-2xl font-sans relative ${isUser ? 'bg-white text-black font-medium text-xs sm:text-sm rounded-tr-xs' : 'bg-[#141417] border border-white/10 text-neutral-200 text-xs sm:text-sm leading-relaxed rounded-tl-xs'} shadow-sm`}>
                              {isUser ? (
                                <p className="whitespace-pre-wrap leading-relaxed font-sans">{msg.content}</p>
                              ) : (
                                <div className="text-neutral-200 font-sans text-xs sm:text-sm leading-relaxed">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      table: ({ node, ...props }) => (
                                        <div className="overflow-x-auto my-3 rounded-xl border border-white/15 bg-[#09090B] shadow-lg">
                                          <table className="w-full text-left text-xs border-collapse" {...props} />
                                        </div>
                                      ),
                                      thead: ({ node, ...props }) => (
                                        <thead className="bg-white/10 text-white font-mono uppercase text-[10px] tracking-wider border-b border-white/15" {...props} />
                                      ),
                                      th: ({ node, ...props }) => (
                                        <th className="p-2.5 font-bold px-3 text-[#E63B2E]" {...props} />
                                      ),
                                      td: ({ node, ...props }) => (
                                        <td className="p-2.5 px-3 border-b border-white/5 text-white/90 font-sans" {...props} />
                                      ),
                                      h1: ({ node, ...props }) => (
                                        <h1 className="text-base font-extrabold text-[#E63B2E] mt-4 mb-2 border-b border-white/10 pb-1" {...props} />
                                      ),
                                      h2: ({ node, ...props }) => (
                                        <h2 className="text-sm font-bold text-white mt-3.5 mb-1.5 flex items-center gap-1.5" {...props} />
                                      ),
                                      h3: ({ node, ...props }) => (
                                        <h3 className="text-xs sm:text-sm font-bold text-white mt-3 mb-1" {...props} />
                                      ),
                                      ul: ({ node, ...props }) => (
                                        <ul className="list-disc pl-5 my-2 space-y-1" {...props} />
                                      ),
                                      ol: ({ node, ...props }) => (
                                        <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />
                                      ),
                                      li: ({ node, ...props }) => (
                                        <li className="leading-relaxed" {...props} />
                                      ),
                                      p: ({ node, ...props }) => (
                                        <p className="my-2 leading-relaxed" {...props} />
                                      ),
                                      code: ({ node, inline, ...props }) => (
                                        inline ? (
                                          <code className="bg-white/10 text-[#E63B2E] px-1.5 py-0.5 rounded font-mono text-[12px]" {...props} />
                                        ) : (
                                          <code className="block bg-[#09090B] p-3 rounded-xl border border-white/10 font-mono text-xs text-neutral-200 overflow-x-auto my-2" {...props} />
                                        )
                                      )
                                    }}
                                  >
                                    {msg.content}
                                  </ReactMarkdown>
                                </div>
                              )}

                              {!isUser && (
                                <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-end text-[10px] font-mono text-white/40">
                                  <button
                                    onClick={() => handleCopy(msg.content, idx)}
                                    className="flex items-center gap-1 hover:text-white transition-colors"
                                  >
                                    {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                    <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {copilotMutation.isPending && (
                      <div className="flex items-center justify-between gap-3 text-white/80 font-sans text-xs sm:text-sm py-2.5 px-4 bg-white/5 rounded-xl border border-white/10 shadow-sm animate-pulse">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-[#E63B2E]" />
                          <span>TaskForge AI is analyzing telemetry...</span>
                        </div>
                        <button
                          onClick={handleStopGenerating}
                          type="button"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E63B2E] hover:bg-red-700 text-white rounded-xl font-mono text-xs font-bold transition-all shadow hover:scale-105 active:scale-95"
                        >
                          <Square className="w-3 h-3 fill-current" />
                          <span>Stop</span>
                        </button>
                      </div>
                    )}

                    <div ref={chatEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 border-t border-white/10 bg-[#121215]">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                      }}
                      className="flex gap-2 items-center"
                    >
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ask about tasks, blockers, files, or team workloads..."
                        className="flex-1 bg-[#09090B] text-white placeholder-white/40 border border-white/15 focus:border-[#E63B2E] rounded-2xl px-4 py-3.5 text-xs sm:text-sm font-sans focus:outline-none transition-colors shadow-inner"
                        disabled={copilotMutation.isPending}
                      />
                      {copilotMutation.isPending ? (
                        <button
                          type="button"
                          onClick={handleStopGenerating}
                          className="btn-brutal bg-[#E63B2E] hover:bg-red-700 text-white px-5 py-3.5 rounded-2xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all shrink-0 shadow-lg"
                          title="Stop Generating"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Stop</span>
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={!query.trim()}
                          className="btn-brutal bg-[#E63B2E] hover:bg-[#d03226] text-white px-5 py-3.5 rounded-2xl text-xs font-mono font-bold flex items-center gap-1.5 hover:scale-105 transition-all disabled:opacity-40 shrink-0 shadow-lg"
                        >
                          <span>Ask</span>
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

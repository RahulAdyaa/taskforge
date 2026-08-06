import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
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
  AlertTriangle, 
  FileText, 
  FileSpreadsheet, 
  Users, 
  Loader2,
  ChevronRight
} from 'lucide-react';
import gsap, { useIsomorphicLayoutEffect } from '../lib/gsap';

export default function AskProjectAIDrawer({ projectId, projectName, tasks = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const drawerRef = useRef(null);
  const backdropRef = useRef(null);
  const chatEndRef = useRef(null);

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

  const copilotMutation = useMutation({
    mutationFn: async (userQuery) => {
      const historyToPass = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await api.post(`/projects/${projectId}/ai-copilot`, {
        query: userQuery,
        chatHistory: historyToPass,
      });
      return res.data;
    },
    onSuccess: (data, userQuery) => {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.answer, model: data.model }
      ]);
    },
    onError: (err) => {
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

  const quickPrompts = [
    { label: '🛠️ How do I complete task...', query: 'Give me a step-by-step technical implementation guide and execution plan to complete my highest priority open task.' },
    { label: '⚡ What is blocking the sprint?', query: 'What are the main blockers and incomplete dependencies slowing down this project sprint?' },
    { label: '📊 Summarize attachments', query: 'Summarize all Excel, CSV, PDF, and Word file attachments uploaded to tasks in this project.' },
    { label: '📝 Generate Client Status Update', query: 'Write a professional, concise executive status update for project stakeholders summarizing completed vs active work.' },
    { label: '👤 Who is currently overloaded?', query: 'Analyze the team workload distribution and tell me who has the most active tasks and estimated hours.' },
  ];

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white font-mono text-xs font-bold shadow-2xl hover:shadow-red-500/25 hover:scale-105 transition-all duration-300 border border-white/20 active:scale-95"
      >
        <Sparkles className="w-4 h-4 fill-white text-white animate-pulse" />
        <span>Ask Project AI</span>
        <span className="bg-black/30 text-[10px] px-2 py-0.5 rounded-full font-sans border border-white/10">
          LIVE CO-PILOT
        </span>
      </button>

      {/* Slide-Over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Overlay */}
          <div
            ref={backdropRef}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
          />

          {/* Drawer Container */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div
              ref={drawerRef}
              data-lenis-prevent
              className="w-screen max-w-xl bg-[#121214] text-white flex flex-col border-l border-white/10 shadow-2xl relative"
            >
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#1A1A1E]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center shadow-inner">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-sm text-white">Ask Project AI</h2>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        RAG ACTIVE
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-white/50 truncate max-w-[280px]">
                      {projectName ? `Project: ${projectName}` : 'Context-Aware Co-Pilot'} • {tasks.length} Tasks
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <button
                      onClick={() => setMessages([])}
                      className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors"
                      title="Clear chat history"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Quick Action Prompt Chips */}
              <div className="p-4 bg-[#161619] border-b border-white/5 space-y-2">
                <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Suggested Quick Queries</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quickPrompts.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(item.query)}
                      disabled={copilotMutation.isPending}
                      className="text-[11px] font-sans px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border border-white/10 hover:border-white/30 transition-all text-left flex items-center gap-1 disabled:opacity-50"
                    >
                      <span>{item.label}</span>
                      <ChevronRight className="w-3 h-3 text-white/40" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Log */}
              <div data-lenis-prevent className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/40 my-auto">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-amber-500/20 border border-white/10 flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 text-amber-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">How can I help with this project?</h3>
                    <p className="text-xs max-w-sm text-white/50 leading-relaxed">
                      I have 360° context on all tasks, DAG dependencies, team workloads, comments, and uploaded files in <strong>{projectName || 'this project'}</strong>.
                    </p>
                  </div>
                )}

                {messages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div key={idx} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs ${isUser ? 'bg-white text-black font-bold' : 'bg-red-600 text-white'}`}>
                        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>

                      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[88%]`}>
                        <div className={`p-4 rounded-2xl text-xs sm:text-sm font-sans relative ${isUser ? 'bg-white text-black font-medium rounded-tr-xs' : 'bg-[#1C1C20] border border-white/10 text-white/90 rounded-tl-xs'} shadow-sm`}>
                          {isUser ? (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          ) : (
                            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-amber-400 prose-headings:font-bold prose-a:text-red-400 prose-code:text-amber-300">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          )}

                          {!isUser && (
                            <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-white/40">
                              <span>Model: {msg.model || 'OpenRouter AI'}</span>
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
                  <div className="flex gap-3 items-center text-white/60 font-mono text-xs py-2 bg-white/5 p-3 rounded-xl border border-white/10">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Analyzing project telemetry & generating response...</span>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-white/10 bg-[#161619]">
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
                    className="flex-1 bg-[#202025] text-white placeholder-white/40 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm font-sans focus:outline-none focus:border-amber-400 transition-colors"
                    disabled={copilotMutation.isPending}
                  />
                  <button
                    type="submit"
                    disabled={!query.trim() || copilotMutation.isPending}
                    className="btn-brutal bg-gradient-to-r from-red-600 to-amber-600 text-white px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-all disabled:opacity-40 shrink-0 shadow-lg"
                  >
                    {copilotMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Ask</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

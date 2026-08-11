import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocation } from 'react-router-dom';
import { Square } from 'lucide-react';
import api from '../lib/axios';

export default function ChatWidget() {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Extract projectId dynamically from URL path if inside a project view
  const projectMatch = pathname.match(/\/app\/projects\/([^/]+)/);
  const projectId = projectMatch && projectMatch[1] !== 'settings' ? projectMatch[1] : null;

  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('tf_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse chat history from sessionStorage:', e);
    }
    return [
      {
        role: 'assistant',
        content: 'Hi there! I am TaskForge AI. How can I assist you with your projects, tasks, or settings?'
      }
    ];
  });

  // Save messages to sessionStorage whenever they change
  useEffect(() => {
    if (Array.isArray(messages)) {
      sessionStorage.setItem('tf_chat_history', JSON.stringify(messages));
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages(prev => [...prev, { role: 'assistant', content: '⏹ *[Response generation stopped by user]*' }]);
  };

  const chatMutation = useMutation({
    mutationFn: async (message) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const url = projectId ? `/projects/${projectId}/chat` : `/settings/chat`;
      const { data } = await api.post(url, { message }, { signal: controller.signal });
      return data.reply;
    },
    onSuccess: (reply) => {
      abortControllerRef.current = null;
      const cleaned = reply.replace(/<\/?(?:assistant|system|user|thought|chat|im_end|assistant_response)>/gi, '').trim();
      setMessages(prev => [...prev, { role: 'assistant', content: cleaned }]);
    },
    onError: (err) => {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        abortControllerRef.current = null;
        return;
      }
      abortControllerRef.current = null;
      setMessages(prev => [...prev, { role: 'assistant', content: 'Oops! I encountered an error. Please try again.' }]);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending) return;

    const command = trimmed.toLowerCase();
    if (command === 'clear' || command === 'cls' || command === 'clr') {
      const resetMsg = [
        {
          role: 'assistant',
          content: '✨ Chat cleared! How can I assist you with your projects, tasks, or settings?'
        }
      ];
      setMessages(resetMsg);
      try {
        sessionStorage.removeItem('tf_chat_history');
      } catch (err) {
        console.error('Failed to clear sessionStorage chat history', err);
      }
      setInput('');
      return;
    }

    const userMessage = trimmed;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    chatMutation.mutate(userMessage);
  };

  // Only display the chatbot inside authenticated app views (/app)
  if (!pathname.startsWith('/app')) {
    return null;
  }

  // Inside project views (/app/projects/:id), AskProjectAIDrawer provides full project RAG intelligence.
  // Suppress global ChatWidget trigger in project views to eliminate button overlap.
  if (projectId) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 bg-black text-white rounded-full shadow-2xl flex items-center justify-center text-xl sm:text-2xl hover:scale-110 transition-transform z-50"
        title="Open AI Assistant"
      >
        ✨
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 left-3 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[380px] h-[480px] max-h-[80vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-[#E8E4DD] flex flex-col z-50 overflow-hidden animate-[slideIn_0.2s_ease-out]">
      {/* Header */}
      <div className="bg-black text-white px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl">✨</span>
          <h3 className="font-display font-bold text-lg m-0">TaskForge AI</h3>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition-colors">
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#F5F3EE] flex flex-col gap-4 font-sans text-sm leading-relaxed">
        {Array.isArray(messages) && messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl p-3.5 ${
              msg.role === 'user' 
                ? 'bg-black text-white rounded-tr-xs shadow-md font-medium' 
                : 'bg-white border border-[#E8E4DD] text-neutral-800 shadow-md rounded-tl-xs'
            }`}>
              <div className="font-sans text-xs sm:text-sm leading-relaxed text-neutral-800 dark:text-neutral-100">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-2 rounded-lg border border-[#E8E4DD] bg-gray-50 shadow-sm">
                        <table className="w-full text-left text-xs border-collapse" {...props} />
                      </div>
                    ),
                    thead: ({ node, ...props }) => (
                      <thead className="bg-gray-100 text-gray-800 font-mono text-[10px] uppercase border-b border-[#E8E4DD]" {...props} />
                    ),
                    th: ({ node, ...props }) => (
                      <th className="p-2 font-bold px-2.5 text-gray-900" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                      <td className="p-2 px-2.5 border-b border-gray-200 text-gray-800 font-sans" {...props} />
                    ),
                    h1: ({ node, ...props }) => (
                      <h1 className="text-sm font-extrabold text-black mt-3 mb-1" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2 className="text-xs sm:text-sm font-bold text-gray-900 mt-2.5 mb-1" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul className="list-disc pl-4 my-1.5 space-y-0.5" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol className="list-decimal pl-4 my-1.5 space-y-0.5" {...props} />
                    ),
                    li: ({ node, ...props }) => (
                      <li className="leading-relaxed" {...props} />
                    ),
                    p: ({ node, ...props }) => (
                      <p className="my-1.5 leading-relaxed" {...props} />
                    )
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="flex justify-between items-center bg-white border border-[#E8E4DD] rounded-xl p-3 shadow-sm text-xs font-sans text-neutral-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-black/40 rounded-full animate-ping"></div>
              <span>Generating AI response...</span>
            </div>
            <button
              onClick={handleStopGenerating}
              type="button"
              className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-mono text-[11px] font-bold transition-all shadow"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-[#E8E4DD] flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything..."
          className="flex-1 bg-[#F5F3EE] border border-[#E8E4DD] rounded-xl px-4 py-2 font-sans focus:outline-none focus:border-black text-sm"
          disabled={chatMutation.isPending}
        />
        {chatMutation.isPending ? (
          <button
            type="button"
            onClick={handleStopGenerating}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
            title="Stop Generating"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-black text-white px-4 py-2 rounded-xl disabled:opacity-50 hover:bg-gray-800 transition-colors text-xs font-bold"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}

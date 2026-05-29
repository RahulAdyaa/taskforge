import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';
import api from '../lib/axios';

export default function ChatWidget() {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

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
        content: 'Hi there! I am the TaskForge AI. How can I assist you with your projects, tasks, or settings?'
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

  const chatMutation = useMutation({
    mutationFn: async (message) => {
      const url = projectId ? `/projects/${projectId}/chat` : `/settings/chat`;
      const { data } = await api.post(url, { message });
      return data.reply;
    },
    onSuccess: (reply) => {
      const cleaned = reply.replace(/<\/?(?:assistant|system|user|thought|chat|im_end|assistant_response)>/gi, '').trim();
      setMessages(prev => [...prev, { role: 'assistant', content: cleaned }]);
    },
    onError: () => {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Oops! I encountered an error. Please try again.' }]);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    chatMutation.mutate(userMessage);
  };

  // Only display the chatbot inside authenticated app views (/app)
  if (!pathname.startsWith('/app')) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-black text-white rounded-full shadow-2xl flex items-center justify-center text-2xl hover:scale-110 transition-transform z-50"
        title="Open AI Assistant"
      >
        ✨
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[380px] h-[500px] bg-white rounded-3xl shadow-2xl border border-[#E8E4DD] flex flex-col z-50 overflow-hidden animate-[slideIn_0.2s_ease-out]">
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
      <div className="flex-1 overflow-y-auto p-4 bg-[#F5F3EE] flex flex-col gap-4">
        {Array.isArray(messages) && messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3.5 ${
              msg.role === 'user' 
                ? 'bg-black text-white rounded-tr-sm shadow-md' 
                : 'bg-white border border-[#E8E4DD] shadow-md rounded-tl-sm'
            }`}>
              <div className={`font-sans text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'text-white/95 [&_a]:text-white [&_a]:underline [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-1 [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_strong]:font-bold'
                  : 'text-gray-800 dark:text-neutral-200 [&_a]:text-red-500 dark:[&_a]:text-red-400 [&_a]:underline [&_a]:hover:text-red-600 dark:[&_a]:hover:text-red-300 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-1 [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_strong]:font-bold dark:[&_strong]:text-white [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1'
              }`}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-white border border-[#E8E4DD] rounded-2xl rounded-tl-sm p-4 shadow-sm flex gap-1">
              <div className="w-2 h-2 bg-black/40 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-black/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-black/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
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
        />
        <button
          type="submit"
          disabled={!input.trim() || chatMutation.isPending}
          className="bg-black text-white px-4 py-2 rounded-xl disabled:opacity-50 hover:bg-gray-800 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}

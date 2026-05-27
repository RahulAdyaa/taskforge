import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import api from '../lib/axios';

export default function ChatWidget({ projectId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi there! I am the TaskForge AI. How can I assist you with this project?' }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const chatMutation = useMutation({
    mutationFn: async (message) => {
      const { data } = await api.post(`/projects/${projectId}/chat`, { message });
      return data.reply;
    },
    onSuccess: (reply) => {
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
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
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3 ${msg.role === 'user' ? 'bg-black text-white rounded-tr-sm' : 'bg-white border border-[#E8E4DD] shadow-sm rounded-tl-sm'}`}>
              <div className={`prose prose-sm font-sans ${msg.role === 'user' ? 'prose-invert' : ''}`}>
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

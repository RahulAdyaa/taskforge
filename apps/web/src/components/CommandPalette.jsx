import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { Search, Folder, Zap } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  // Toggle with Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await api.get('/projects');
      return data;
    },
    enabled: isOpen && isAuthenticated
  });

  const actions = [
    { id: 'create-project', title: 'Create New Project', icon: <Zap className="w-4 h-4" />, action: () => navigate('/app') },
    { id: 'go-dashboard', title: 'Go to Dashboard', icon: <Folder className="w-4 h-4" />, action: () => navigate('/app') },
  ];

  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).map(p => ({
    id: p.id,
    title: `Project: ${p.name}`,
    icon: <Folder className="w-4 h-4" />,
    action: () => navigate(`/app/projects/${p.id}`)
  }));

  const filteredActions = actions.filter(a => a.title.toLowerCase().includes(query.toLowerCase()));
  
  const results = [...filteredProjects, ...filteredActions];

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        results[selectedIndex].action();
        setIsOpen(false);
      }
    }
  };

  if (!isOpen || !isAuthenticated) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center pt-32 p-4" onClick={() => setIsOpen(false)}>
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#E8E4DD] animate-[slideIn_0.2s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-4 border-b border-[#E8E4DD]">
          <Search className="w-5 h-5 text-black/40 mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none font-mono text-lg text-black placeholder:text-black/30"
            placeholder="Type a command or search projects..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="font-mono text-xs text-black/30 bg-[#F5F3EE] px-2 py-1 rounded">ESC</div>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="p-8 text-center font-mono text-sm text-black/40">No results found.</div>
          ) : (
            results.map((item, index) => (
              <div
                key={item.id}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  item.action();
                  setIsOpen(false);
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${index === selectedIndex ? 'bg-signal-red text-white' : 'text-black hover:bg-[#F5F3EE]'}`}
              >
                <div className={`${index === selectedIndex ? 'text-white' : 'text-black/50'}`}>{item.icon}</div>
                <div className="font-sans font-medium">{item.title}</div>
                {index === selectedIndex && (
                  <div className="ml-auto font-mono text-xs opacity-80">ENTER</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

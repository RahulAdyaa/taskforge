import React, { useState } from 'react';
import { Sparkles, X, Loader2, Rocket, CheckCircle2, AlertTriangle, Zap, Clock, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';

const PRIORITY_COLORS = {
  URGENT: { bg: 'bg-red-500/15', text: 'text-red-500', dot: 'bg-red-500' },
  HIGH: { bg: 'bg-orange-500/15', text: 'text-orange-500', dot: 'bg-orange-500' },
  MEDIUM: { bg: 'bg-blue-500/15', text: 'text-blue-500', dot: 'bg-blue-500' },
  LOW: { bg: 'bg-green-500/15', text: 'text-green-500', dot: 'bg-green-500' },
};

const EXAMPLE_PROMPTS = [
  "Build a social media platform with user profiles, posts, comments, likes, and real-time messaging",
  "Create an e-commerce marketplace with product listings, shopping cart, payments, and order tracking",
  "Build a project management tool with kanban boards, task assignments, and team collaboration",
  "Develop a learning management system with courses, quizzes, progress tracking, and certificates",
  "Create a food delivery app with restaurant listings, menu management, cart, and live order tracking",
];

export default function AutopilotModal({ projectId, onClose, onSuccess }) {
  const [prompt, setPrompt] = useState('');
  const [step, setStep] = useState('input'); // 'input' | 'generating' | 'error'
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || prompt.trim().length < 5) {
      toast.error('Please describe your project in at least 5 characters');
      return;
    }

    setStep('generating');
    setError(null);

    try {
      const { data } = await api.post(`/projects/${projectId}/autopilot`, { prompt: prompt.trim() });
      setResult(data);
      setStep('input');
      toast.success(`🚀 ${data.tasksCreated} tasks generated across ${data.phases?.length || 0} phases!`);
      if (onSuccess) onSuccess(data);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Generation failed';
      setError(msg);
      setStep('error');
    }
  };

  const fillExample = () => {
    const random = EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)];
    setPrompt(random);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm modal-backdrop-anim"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0F0F12] border border-[#E8E4DD] dark:border-zinc-800 rounded-[2rem] shadow-2xl overflow-hidden modal-spring-card">
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 border-b border-[#E8E4DD] dark:border-zinc-800/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-signal-red via-purple-500 to-blue-500" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-signal-red to-purple-600 flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight dark:text-white">AI Autopilot</h2>
                <p className="font-mono text-[10px] text-black/40 dark:text-zinc-500 uppercase tracking-widest">
                  Describe → Generate → Build
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-black/40 dark:text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {step === 'generating' ? (
            <GeneratingView prompt={prompt} />
          ) : step === 'error' ? (
            <ErrorView error={error} onRetry={() => { setStep('input'); setError(null); }} />
          ) : (
            <InputView 
              prompt={prompt}
              setPrompt={setPrompt}
              onGenerate={handleGenerate}
              onFillExample={fillExample}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function InputView({ prompt, setPrompt, onGenerate, onFillExample }) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block font-mono text-xs text-black/50 dark:text-zinc-400 mb-2 uppercase tracking-wider">
          Describe your project
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Build a social media platform with user profiles, posts, comments, likes, and real-time messaging..."
          className="w-full h-32 bg-[#F9F8F5] dark:bg-[#1A1A1E] border border-[#E8E4DD] dark:border-zinc-700 rounded-xl px-4 py-3 font-sans text-sm focus:outline-none focus:border-signal-red dark:focus:border-signal-red transition-colors resize-none placeholder:text-black/30 dark:placeholder:text-zinc-600 dark:text-white"
          maxLength={1000}
          autoFocus
        />
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={onFillExample}
            className="font-mono text-[10px] text-signal-red hover:underline uppercase tracking-wider flex items-center gap-1"
          >
            <Zap className="w-3 h-3" />
            Try an example
          </button>
          <span className="font-mono text-[10px] text-black/30 dark:text-zinc-600">
            {prompt.length}/1000
          </span>
        </div>
      </div>

      {/* What you'll get */}
      <div className="bg-[#F9F8F5] dark:bg-[#1A1A1E] rounded-xl p-4 border border-[#E8E4DD] dark:border-zinc-800">
        <p className="font-mono text-[10px] text-black/40 dark:text-zinc-500 uppercase tracking-wider mb-3">What AI will generate</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: CheckCircle2, label: '30-50 structured tasks' },
            { icon: Tag, label: 'Auto-labeled categories' },
            { icon: Clock, label: 'Time estimates per task' },
            { icon: Rocket, label: 'Dependency chains' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-xs text-black/60 dark:text-zinc-400">
              <Icon className="w-3.5 h-3.5 text-signal-red flex-shrink-0" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={!prompt.trim() || prompt.trim().length < 5}
        className="w-full btn-brutal bg-gradient-to-r from-signal-red to-purple-600 text-white py-4 rounded-xl font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
      >
        <span className="relative z-10 flex items-center gap-2">
          <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          Generate Project Blueprint
          <Rocket className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </span>
      </button>
    </div>
  );
}

function GeneratingView({ prompt }) {
  const phases = [
    'Analyzing project requirements...',
    'Designing task architecture...',
    'Mapping dependencies...',
    'Assigning priorities & estimates...',
    'Building your project blueprint...',
  ];
  const [currentPhase, setCurrentPhase] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhase(prev => (prev + 1) % phases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
      {/* Animated spinner */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-[#E8E4DD] dark:border-zinc-800 border-t-signal-red animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-signal-red animate-pulse" />
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-bold dark:text-white mb-2">Generating Your Blueprint</h3>
        <p className="font-mono text-xs text-black/40 dark:text-zinc-500 transition-opacity duration-500" key={currentPhase}>
          {phases[currentPhase]}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-1.5">
        {phases.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === currentPhase
                ? 'bg-signal-red scale-125'
                : i < currentPhase
                  ? 'bg-signal-red/40'
                  : 'bg-black/10 dark:bg-zinc-700'
            }`}
          />
        ))}
      </div>

      {/* Show prompt */}
      <div className="mt-4 max-w-md">
        <p className="font-mono text-[10px] text-black/30 dark:text-zinc-600 uppercase tracking-wider mb-1">Your prompt</p>
        <p className="text-xs text-black/50 dark:text-zinc-500 italic line-clamp-2">"{prompt}"</p>
      </div>
    </div>
  );
}

function ErrorView({ error, onRetry }) {
  return (
    <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <div>
        <h3 className="font-display text-lg font-bold dark:text-white mb-1">Generation Failed</h3>
        <p className="text-sm text-black/50 dark:text-zinc-500 max-w-sm">{error}</p>
      </div>
      <button
        onClick={onRetry}
        className="btn-brutal bg-black dark:bg-zinc-100 text-white dark:text-black px-6 py-2.5 rounded-xl text-sm font-medium"
      >
        <span className="relative z-10">Try Again</span>
      </button>
    </div>
  );
}

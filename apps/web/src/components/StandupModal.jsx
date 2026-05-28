import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Zap, Copy, Check, X, Sparkles, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';

export default function StandupModal({ onClose }) {
  const [standupData, setStandupData] = useState(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleTaskLinkClick = (projectId, taskId) => {
    onClose();
    navigate(`/app/projects/${projectId}?task=${taskId}`);
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/standup/generate');
      return data;
    },
    onSuccess: (data) => {
      setStandupData(data);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to generate standup');
    }
  });

  const handleCopy = () => {
    if (!standupData?.standup) return;
    navigator.clipboard.writeText(standupData.standup);
    setCopied(true);
    toast.success('Standup copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple markdown to JSX renderer for the standup report
  const renderMarkdown = (md) => {
    if (!md) return null;
    const lines = md.split('\n');
    const elements = [];
    
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) {
        elements.push(<div key={i} className="h-2" />);
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={i} className="font-display font-extrabold text-2xl text-black mb-1">
            {trimmed.replace('## ', '')}
          </h2>
        );
      } else if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={i} className="font-sans font-bold text-sm uppercase tracking-widest text-black/60 mt-6 mb-3 pb-2 border-b border-[#E8E4DD]">
            {trimmed.replace('### ', '')}
          </h3>
        );
      } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        elements.push(
          <p key={i} className="font-mono text-sm text-black/70 mb-3">
            {trimmed.replace(/\*\*/g, '')}
          </p>
        );
      } else if (trimmed.startsWith('- ')) {
        const content = trimmed.replace('- ', '');
        const hasWarning = content.includes('⚠️') || content.includes('OVERDUE');
        elements.push(
          <div key={i} className={`flex items-start gap-3 py-2 px-3 rounded-lg mb-1 ${hasWarning ? 'bg-red-50 border border-red-100' : 'hover:bg-[#F5F3EE]'}`}>
            <span className="text-black/30 mt-0.5 select-none">›</span>
            <span className="font-mono text-xs text-black/80 leading-relaxed">
              {renderTextWithLinksAndBold(content)}
            </span>
          </div>
        );
      } else {
        elements.push(
          <p key={i} className="font-mono text-xs text-black/70 leading-relaxed">
            {renderTextWithLinksAndBold(trimmed)}
          </p>
        );
      }
    });

    return elements;
  };

  const renderTextWithLinksAndBold = (text) => {
    // Regex splits by markdown links pointing to task://
    const regex = /(\[.*?\]\(task:\/\/.*?\))/g;
    const parts = text.split(regex);
    
    return parts.map((part, i) => {
      if (part.startsWith('[') && part.includes('](task://')) {
        const linkMatch = part.match(/\[(.*?)\]\((task:\/\/.*?)\)/);
        if (linkMatch) {
          const linkText = linkMatch[1];
          const taskUrl = linkMatch[2];
          const path = taskUrl.replace('task://', '');
          const [projId, tId] = path.split('/');
          
          return (
            <button
              key={i}
              onClick={() => handleTaskLinkClick(projId, tId)}
              className="text-[#E63B2E] hover:underline font-bold text-left focus:outline-none inline-block align-baseline"
            >
              {linkText}
            </button>
          );
        }
      }
      
      // Render bold text for non-link parts
      const boldRegex = /(\*\*.*?\*\*)/g;
      const subparts = part.split(boldRegex);
      return subparts.map((sub, j) => {
        if (sub.startsWith('**') && sub.endsWith('**')) {
          return <strong key={`${i}-${j}`} className="text-black font-semibold">{sub.slice(2, -2)}</strong>;
        }
        return sub;
      });
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-[slideIn_0.3s_ease-out]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#111111] to-[#2a2a2a] p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E63B2E]/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#E63B2E]" />
            </div>
            <div>
              <h2 className="font-display font-bold text-xl text-white">Daily Standup</h2>
              <p className="font-mono text-[10px] text-white/40 uppercase tracking-widest">AI-Generated Report</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {!standupData && !generateMutation.isPending && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-2xl bg-[#F5F3EE] flex items-center justify-center mx-auto mb-6">
                <Zap className="w-10 h-10 text-[#E63B2E]" />
              </div>
              <h3 className="font-display font-extrabold text-2xl tracking-tight mb-2">Ready to Generate</h3>
              <p className="font-mono text-xs text-black/50 max-w-md mx-auto leading-relaxed mb-8">
                The AI will analyze your tasks from the last 24 hours — completed work, 
                current queue, blockers, and overdue items — to produce a concise standup report.
              </p>
              <button
                onClick={() => generateMutation.mutate()}
                className="bg-black text-white px-8 py-4 rounded-xl font-medium flex items-center gap-3 mx-auto hover:bg-[#E63B2E] transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Generate Standup Report
              </button>
            </div>
          )}

          {generateMutation.isPending && (
            <div className="text-center py-16">
              <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-[#E8E4DD]"></div>
                <div className="absolute inset-0 rounded-full border-2 border-t-[#E63B2E] animate-spin"></div>
                <div className="absolute inset-3 rounded-full border-2 border-t-black animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.6s' }}></div>
              </div>
              <h3 className="font-display font-extrabold text-xl tracking-tight mb-2">Analyzing Your Activity</h3>
              <p className="font-mono text-[10px] text-black/40 uppercase tracking-widest animate-pulse">
                Scanning tasks · Evaluating blockers · Composing report
              </p>
            </div>
          )}

          {standupData && (
            <div>
              {/* Stats Bar */}
              {standupData.context && (
                <div className="flex gap-3 mb-6">
                  <StatPill icon="✅" label="Completed" value={standupData.context.completedCount} />
                  <StatPill icon="📋" label="In Queue" value={standupData.context.openCount} />
                  <StatPill icon="🚧" label="Blocked" value={standupData.context.blockedCount} alert={standupData.context.blockedCount > 0} />
                  <StatPill icon="⚠️" label="Overdue" value={standupData.context.overdueCount} alert={standupData.context.overdueCount > 0} />
                </div>
              )}

              {/* Rendered Report */}
              <div className="bg-[#FAFAF8] rounded-2xl border border-[#E8E4DD] p-6">
                {renderMarkdown(standupData.standup)}
              </div>

              {/* Model Info */}
              <div className="flex items-center justify-between mt-4">
                <span className="font-mono text-[9px] text-black/30 uppercase tracking-widest">
                  Model: {standupData.model} · {new Date(standupData.generatedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {standupData && (
          <div className="border-t border-[#E8E4DD] p-4 flex items-center justify-between bg-[#F5F3EE]">
            <button
              onClick={() => { setStandupData(null); generateMutation.reset(); }}
              className="font-mono text-xs text-black/50 hover:text-black flex items-center gap-2 transition-colors"
            >
              <Zap className="w-3 h-3" />
              Regenerate
            </button>
            <button
              onClick={handleCopy}
              className="bg-black text-white px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-[#E63B2E] transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({ icon, label, value, alert }) {
  return (
    <div className={`flex-1 flex items-center gap-2 p-3 rounded-xl border ${alert ? 'border-red-200 bg-red-50' : 'border-[#E8E4DD] bg-white'}`}>
      <span className="text-sm">{icon}</span>
      <div>
        <div className={`font-display text-xl ${alert ? 'text-red-600' : 'text-black'}`}>{value}</div>
        <div className="font-mono text-[9px] text-black/40 uppercase tracking-widest">{label}</div>
      </div>
    </div>
  );
}

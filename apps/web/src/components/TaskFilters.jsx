import React, { useState } from 'react';
import { Search, X, Filter, ChevronDown } from 'lucide-react';

export default function TaskFilters({ members, labels, filters, onFilterChange }) {
  const [expanded, setExpanded] = useState(false);
  const hasActiveFilters = filters.search || filters.assignee || filters.priority || filters.label || filters.dueDate;

  const updateFilter = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearAll = () => {
    onFilterChange({ search: '', assignee: '', priority: '', label: '', dueDate: '' });
  };

  return (
    <div className="bg-white border-b border-[#E8E4DD] px-8">
      {/* Search Bar + Toggle */}
      <div className="flex items-center gap-3 py-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#F5F3EE] border border-[#E8E4DD] rounded-xl text-sm font-sans focus:outline-none focus:border-black transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => updateFilter('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${expanded || hasActiveFilters ? 'bg-black text-white border-black' : 'bg-[#F5F3EE] border-[#E8E4DD] text-black/60 hover:text-black hover:border-black'}`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="w-5 h-5 rounded-full bg-[#E63B2E] text-white text-[10px] flex items-center justify-center font-bold">
              {[filters.assignee, filters.priority, filters.label, filters.dueDate].filter(Boolean).length}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="font-mono text-xs text-[#E63B2E] hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Expanded Filter Row */}
      {expanded && (
        <div className="flex items-center gap-4 pb-4 flex-wrap animate-[slideIn_0.2s_ease-out]">
          {/* Assignee */}
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] text-black/40 uppercase tracking-widest">Assignee</span>
            <select
              value={filters.assignee}
              onChange={(e) => updateFilter('assignee', e.target.value)}
              className="bg-[#F5F3EE] border border-[#E8E4DD] text-sm px-3 py-1.5 rounded-lg outline-none focus:border-black"
            >
              <option value="">All</option>
              {members.map(m => (
                <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] text-black/40 uppercase tracking-widest">Priority</span>
            <select
              value={filters.priority}
              onChange={(e) => updateFilter('priority', e.target.value)}
              className="bg-[#F5F3EE] border border-[#E8E4DD] text-sm px-3 py-1.5 rounded-lg outline-none focus:border-black"
            >
              <option value="">All</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Label */}
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] text-black/40 uppercase tracking-widest">Label</span>
            <select
              value={filters.label}
              onChange={(e) => updateFilter('label', e.target.value)}
              className="bg-[#F5F3EE] border border-[#E8E4DD] text-sm px-3 py-1.5 rounded-lg outline-none focus:border-black"
            >
              <option value="">All</option>
              {labels.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] text-black/40 uppercase tracking-widest">Due</span>
            <select
              value={filters.dueDate}
              onChange={(e) => updateFilter('dueDate', e.target.value)}
              className="bg-[#F5F3EE] border border-[#E8E4DD] text-sm px-3 py-1.5 rounded-lg outline-none focus:border-black"
            >
              <option value="">Any</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="week">This Week</option>
              <option value="none">No Due Date</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility: apply filters to a task array
export function applyFilters(tasks, filters) {
  if (!tasks) return [];
  let result = [...tasks];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.assignee?.name?.toLowerCase().includes(q)
    );
  }

  if (filters.assignee) {
    result = result.filter(t => t.assigneeId === filters.assignee);
  }

  if (filters.priority) {
    result = result.filter(t => t.priority === filters.priority);
  }

  if (filters.label) {
    result = result.filter(t => t.labels?.some(l => l.id === filters.label));
  }

  if (filters.dueDate) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);
    const endOfWeek = new Date(startOfDay.getTime() + 7 * 86400000);

    switch (filters.dueDate) {
      case 'overdue':
        result = result.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE');
        break;
      case 'today':
        result = result.filter(t => t.dueDate && new Date(t.dueDate) >= startOfDay && new Date(t.dueDate) < endOfDay);
        break;
      case 'week':
        result = result.filter(t => t.dueDate && new Date(t.dueDate) >= startOfDay && new Date(t.dueDate) < endOfWeek);
        break;
      case 'none':
        result = result.filter(t => !t.dueDate);
        break;
    }
  }

  return result;
}

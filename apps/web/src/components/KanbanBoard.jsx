import React, { useState, useEffect } from 'react';
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useDraggable, useDroppable } from '@dnd-kit/core';

import TaskDetailsModal from './TaskDetailsModal';
import { TaskCardTimer } from './TimeTracker';

export default function KanbanBoard({ projectId, tasks, isAdmin, members, labels }) {
  const queryClient = useQueryClient();
  const [columns, setColumns] = useState({ TODO: [], IN_PROGRESS: [], DONE: [] });
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    const cols = { TODO: [], IN_PROGRESS: [], DONE: [] };
    tasks.forEach(t => {
      if (cols[t.status]) cols[t.status].push(t);
    });
    setColumns(cols);
  }, [tasks]);

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }) => {
      await api.patch(`/projects/${projectId}/tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
      queryClient.invalidateQueries(['dashboard', projectId]);
    },
    onError: () => toast.error('Failed to update status')
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const [activeTask, setActiveTask] = useState(null);

  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    setActiveTask(task);
  };

  const handleDragEnd = (event) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id;
    const newStatus = over.id; // column id
    const task = tasks.find(t => t.id === taskId);

    if (task && task.status !== newStatus) {
      if (newStatus === 'DONE') {
        const incompleteBlockers = task.blockedBy?.filter(t => t.status !== 'DONE') || [];
        if (incompleteBlockers.length > 0) {
          toast.error('Cannot complete task. It is blocked by incomplete dependencies.');
          return;
        }
      }

      setColumns(prev => {
        const sourceCol = prev[task.status].filter(t => t.id !== taskId);
        const destCol = [...prev[newStatus], { ...task, status: newStatus }];
        return { ...prev, [task.status]: sourceCol, [newStatus]: destCol };
      });
      updateTaskMutation.mutate({ taskId, status: newStatus });
    }
  };

  const handleDragCancel = () => setActiveTask(null);

  return (
    <div className="flex h-full p-8 gap-8 overflow-x-auto bg-off-white">
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {['TODO', 'IN_PROGRESS', 'DONE'].map(status => (
          <Column key={status} id={status} title={status.replace('_', ' ')} tasks={columns[status]} projectId={projectId} onTaskClick={setSelectedTask} />
        ))}
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
      {selectedTask && (
        <TaskDetailsModal 
          task={selectedTask} 
          projectId={projectId} 
          labels={labels}
          onClose={() => setSelectedTask(null)} 
        />
      )}
    </div>
  );
}

function Column({ id, title, tasks, projectId, onTaskClick }) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div ref={setNodeRef} className="flex-1 min-w-[320px] max-w-sm flex flex-col bg-[#F5F3EE] rounded-[2rem] p-6 border border-[#E8E4DD] shadow-inner">
      <div className="flex items-center justify-between mb-6 px-2">
        <h3 className="font-display italic text-2xl">{title}</h3>
        <span className="font-mono text-xs bg-white px-2 py-1 rounded-md border border-[#E8E4DD]">{tasks.length}</span>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} projectId={projectId} onClick={() => onTaskClick(task)} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task, projectId, onClick, isOverlay }) {
  if (isOverlay) {
    return <TaskCardUI task={task} isOverlay />;
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  
  return (
    <div 
      ref={setNodeRef} 
      {...listeners} 
      {...attributes}
      onDoubleClick={onClick}
      className={`${isDragging ? 'opacity-30' : ''}`}
    >
      <TaskCardUI task={task} projectId={projectId} />
    </div>
  );
}

function TaskCardUI({ task, projectId, isOverlay }) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';
  const isBlocked = task.blockedBy?.some(t => t.status !== 'DONE');

  const priorityColors = {
    LOW: 'bg-green-100 text-green-800',
    MEDIUM: 'bg-blue-100 text-blue-800',
    HIGH: 'bg-orange-100 text-orange-800',
    URGENT: 'bg-red-100 text-red-800',
  };

  return (
    <div 
      className={`bg-white p-5 rounded-2xl border ${isBlocked ? 'border-dashed border-black/30 opacity-80' : isOverdue ? 'border-l-4 border-[#E63B2E]' : 'border-[#E8E4DD]'} shadow-sm ${isOverlay ? 'cursor-grabbing rotate-2 scale-105 shadow-2xl' : 'cursor-grab hover:border-black'} transition-all`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2 items-center flex-wrap">
          <span className={`font-mono text-[10px] px-2 py-1 rounded tracking-widest uppercase ${priorityColors[task.priority]}`}>
            {task.priority}
          </span>
          {task.labels?.map(label => (
            <span key={label.id} className="font-mono text-[10px] px-2 py-1 rounded tracking-widest uppercase border border-black/10" style={{ backgroundColor: label.color, color: '#000' }}>
              {label.name}
            </span>
          ))}
          {isBlocked && (
            <span className="text-[#E63B2E]" title="Blocked by dependencies">
              🔒
            </span>
          )}
        </div>
        <span className="font-mono text-[10px] text-black/40 uppercase whitespace-nowrap ml-2">ID: {task.id.slice(0,6)}</span>
      </div>
      
      <h4 className="font-sans font-bold text-lg mb-2 leading-tight">{task.title}</h4>
      
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#E8E4DD]/50">
        <div className="flex items-center gap-3">
          <div className="font-mono text-xs text-black/60">
            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Double-click to open'}
          </div>
          {projectId && !isOverlay && <TaskCardTimer taskId={task.id} projectId={projectId} />}
        </div>
        {task.assignee && (
          <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center font-mono text-[10px]" title={task.assignee.name}>
            {task.assignee.name.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

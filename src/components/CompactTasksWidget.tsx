/**
 * Compact Tasks Widget - Professional Dashboard Version
 * 
 * Shows 1-2 tasks max in a preview format
 * Designed for executive dashboards - calm but informative
 */

import React from 'react';
import { CheckSquare, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { Task } from '../types';
import { PageType } from '../App';

interface CompactTasksWidgetProps {
  tasks: Task[];
  onNavigate?: (page: PageType) => void;
}

const CompactTasksWidget: React.FC<CompactTasksWidgetProps> = ({
  tasks,
  onNavigate,
}) => {
  // Get top 2 active tasks (prioritize by urgency)
  const topTasks = React.useMemo(() => {
    const active = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    const sorted = [...active].sort((a, b) => {
      const priorityOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    return sorted.slice(0, 2);
  }, [tasks]);

  const getTaskIcon = (task: Task) => {
    if (task.status === 'blocked') {
      return <AlertCircle className="w-3 h-3 text-red-500" />;
    } else if (task.status === 'in_progress') {
      return <Clock className="w-3 h-3 text-blue-500" />;
    } else {
      return <CheckSquare className="w-3 h-3 text-slate-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      default:
        return 'text-blue-600';
    }
  };

  if (topTasks.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Tasks</h3>
          <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded">All clear</span>
        </div>
        <p className="text-xs text-slate-500">No active tasks</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Tasks</h3>
          <span className="text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded">
            {tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length}
          </span>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate('Tasks' as PageType)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            View all →
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        {topTasks.map((task) => (
          <div
            key={task.id}
            onClick={() => onNavigate?.('Tasks' as PageType)}
            className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer transition-colors group"
          >
            {getTaskIcon(task)}
            <span className={`text-xs flex-1 truncate ${getPriorityColor(task.priority)}`}>
              {task.title}
            </span>
            <span className={`text-xs ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>
            <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompactTasksWidget;



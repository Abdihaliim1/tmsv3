import React, { useState, useMemo, useEffect } from 'react';
import { useTMS } from '../context/TMSContext';
import { useTenant } from '../context/TenantContext';
import { Task, TaskStatus, TaskPriority, WorkflowRule } from '../types';
import { CheckCircle2, Circle, AlertCircle, XCircle, Clock, Filter, Search, Zap, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { useDebounce } from '../utils/debounce';
import { loadWorkflowRules, saveWorkflowRules, DEFAULT_WORKFLOW_RULES } from '../services/workflow/workflowRules';

const Tasks: React.FC = () => {
  const { tasks, updateTaskStatus, completeTask, deleteTaskById, loads, invoices } = useTMS();
  const { activeTenantId } = useTenant();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [showAutomation, setShowAutomation] = useState(false);
  const [workflowRules, setWorkflowRules] = useState<WorkflowRule[]>([]);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  // Load workflow rules
  useEffect(() => {
    const rules = loadWorkflowRules(activeTenantId);
    setWorkflowRules(rules);
  }, [activeTenantId]);

  // Toggle rule enabled/disabled
  const toggleRule = (ruleId: string) => {
    const updatedRules = workflowRules.map(rule =>
      rule.id === ruleId ? { ...rule, isEnabled: !rule.isEnabled } : rule
    );
    setWorkflowRules(updatedRules);
    saveWorkflowRules(activeTenantId, updatedRules);
  };

  // Reset to default rules
  const resetToDefaults = () => {
    if (confirm('Reset all workflow rules to defaults?')) {
      setWorkflowRules(DEFAULT_WORKFLOW_RULES);
      saveWorkflowRules(activeTenantId, DEFAULT_WORKFLOW_RULES);
    }
  };

  // Toggle expanded rule
  const toggleExpanded = (ruleId: string) => {
    setExpandedRules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  };

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    // Filter by priority
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(task => task.priority === priorityFilter);
    }

    // Filter by search term
    if (debouncedSearchTerm) {
      const lowerTerm = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(lowerTerm) ||
        task.description?.toLowerCase().includes(lowerTerm) ||
        task.entityId.toLowerCase().includes(lowerTerm)
      );
    }

    // Sort by priority (urgent > high > medium > low) then by due date
    return filtered.sort((a, b) => {
      const priorityOrder: Record<TaskPriority, number> = {
        urgent: 4,
        high: 3,
        medium: 2,
        low: 1,
      };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      if (a.dueAt && b.dueAt) {
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      }
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return 0;
    });
  }, [tasks, statusFilter, priorityFilter, searchTerm]);

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Circle className="w-5 h-5 text-blue-600" />;
      case 'blocked':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-gray-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    const colors = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[priority]}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  const getEntityLink = (task: Task) => {
    if (task.entityType === 'load') {
      const load = loads.find(l => l.id === task.entityId);
      return load ? `Load ${load.loadNumber}` : task.entityId;
    }
    if (task.entityType === 'invoice') {
      const invoice = invoices.find(i => i.id === task.entityId);
      return invoice ? `Invoice ${invoice.invoiceNumber}` : task.entityId;
    }
    return `${task.entityType} ${task.entityId}`;
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    updateTaskStatus(taskId, newStatus);
  };

  const handleComplete = (taskId: string) => {
    completeTask(taskId);
  };

  const handleDelete = (taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteTaskById(taskId);
    }
  };

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
    };
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-1">Manage workflow tasks and follow-ups</p>
        </div>
        <button
          onClick={() => setShowAutomation(!showAutomation)}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            showAutomation
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Zap size={18} />
          Automation Rules
          {showAutomation ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Automation Rules Panel */}
      {showAutomation && (
        <div className="bg-white rounded-lg shadow-lg border border-blue-200">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Workflow Automation Rules</h2>
            </div>
            <button
              onClick={resetToDefaults}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <Settings size={14} />
              Reset to Defaults
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {workflowRules.map((rule) => (
              <div key={rule.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleRule(rule.id)}
                        className="focus:outline-none"
                      >
                        {rule.isEnabled ? (
                          <ToggleRight className="w-8 h-8 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-gray-400" />
                        )}
                      </button>
                      <div>
                        <h3 className={`font-medium ${rule.isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                          {rule.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Trigger: <span className="font-mono bg-gray-100 px-1 rounded">{rule.eventType}</span>
                          {rule.filter?.loadStatusIn && (
                            <span className="ml-2">
                              Status: {rule.filter.loadStatusIn.join(', ')}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleExpanded(rule.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {expandedRules.has(rule.id) ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </button>
                </div>

                {/* Expanded Actions */}
                {expandedRules.has(rule.id) && (
                  <div className="mt-4 ml-11 space-y-3">
                    <p className="text-sm font-medium text-gray-700">Actions:</p>
                    {rule.actions.map((action, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            action.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                            action.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                            action.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {action.priority}
                          </span>
                          <span className="font-medium text-gray-900">{action.title}</span>
                        </div>
                        {action.description && (
                          <p className="text-sm text-gray-600">{action.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                          {action.dueOffsetMinutes && (
                            <span>Due: {action.dueOffsetMinutes < 60
                              ? `${action.dueOffsetMinutes}m`
                              : action.dueOffsetMinutes < 1440
                                ? `${Math.round(action.dueOffsetMinutes / 60)}h`
                                : `${Math.round(action.dueOffsetMinutes / 1440)}d`
                            }</span>
                          )}
                          {action.assignTo && <span>Assign to: {action.assignTo}</span>}
                          {action.tags && action.tags.length > 0 && (
                            <span>Tags: {action.tags.join(', ')}</span>
                          )}
                          {action.blockers && action.blockers.length > 0 && (
                            <span className="text-red-600">Blocked by: {action.blockers.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
            <p className="text-sm text-gray-600">
              <Zap className="w-4 h-4 inline mr-1 text-blue-600" />
              {workflowRules.filter(r => r.isEnabled).length} of {workflowRules.length} rules enabled.
              Tasks are automatically created when workflow events occur.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">In Progress</div>
          <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Completed</div>
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Blocked</div>
          <div className="text-2xl font-bold text-red-600">{stats.blocked}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center">
            <Circle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
            <p className="text-gray-600">
              {tasks.length === 0
                ? 'Tasks will appear here when workflow rules are triggered.'
                : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 hover:bg-gray-50 transition-colors ${
                  task.status === 'blocked' ? 'bg-red-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">{getStatusIcon(task.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                        {getPriorityBadge(task.priority)}
                      </div>
                      {task.description && (
                        <p className="text-gray-600 mb-2">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span>Entity: {getEntityLink(task)}</span>
                        {task.dueAt && (
                          <span>
                            Due: {new Date(task.dueAt).toLocaleDateString()}
                          </span>
                        )}
                        {task.blockers && task.blockers.length > 0 && (
                          <span className="text-red-600">
                            Blocked: {task.blockers.join(', ')}
                          </span>
                        )}
                      </div>
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {task.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {task.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(task.id, 'in_progress')}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Start
                        </button>
                        <button
                          onClick={() => handleComplete(task.id)}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Complete
                        </button>
                      </>
                    )}
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => handleComplete(task.id)}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Complete
                      </button>
                    )}
                    {task.status !== 'completed' && task.status !== 'cancelled' && (
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;


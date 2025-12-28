/**
 * Alerts Dashboard Widget
 * 
 * Displays alerts with:
 * - Alert count badges
 * - Alert list with filtering
 * - Acknowledge alert functionality
 * - Click to navigate to entity
 * - Visual severity indicators
 */

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  ChevronRight,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { Alert, AlertType, generateAllAlerts, getAlertCounts } from '../services/alertsService';
import { Load, Invoice } from '../types';

interface AlertsWidgetProps {
  loads: Load[];
  invoices: Invoice[];
  onNavigate?: (entityType: string, entityId: string) => void;
  maxDisplay?: number; // Max alerts to display (default: 10)
}

const AlertsWidget: React.FC<AlertsWidgetProps> = ({
  loads,
  invoices,
  onNavigate,
  maxDisplay = 10,
}) => {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  // Generate all alerts
  const allAlerts = useMemo(() => {
    return generateAllAlerts(loads, invoices);
  }, [loads, invoices]);

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    let filtered = allAlerts.filter(alert => !acknowledged.has(alert.id));
    
    if (filter !== 'all') {
      filtered = filtered.filter(alert => alert.severity === filter);
    }
    
    return filtered.slice(0, maxDisplay);
  }, [allAlerts, filter, acknowledged, maxDisplay]);

  // Get alert counts
  const counts = useMemo(() => {
    return getAlertCounts(allAlerts.filter(alert => !acknowledged.has(alert.id)));
  }, [allAlerts, acknowledged]);

  const handleAcknowledge = (alertId: string) => {
    setAcknowledged(prev => new Set([...prev, alertId]));
  };

  const handleNavigate = (alert: Alert) => {
    if (onNavigate) {
      onNavigate(alert.entityType, alert.entityId);
    } else if (alert.actionUrl) {
      window.location.href = alert.actionUrl;
    }
  };

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Info className="w-5 h-5 text-slate-600" />;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const getSeverityBadgeColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700';
      case 'warning':
        return 'bg-amber-100 text-amber-700';
      case 'info':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  if (counts.total === 0 && acknowledged.size === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Alerts</h3>
        </div>
        <div className="text-center py-8">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="text-slate-600">No alerts at this time</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-slate-900">Alerts</h3>
          {counts.total > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
              {counts.total}
            </span>
          )}
        </div>
      </div>

      {/* Alert Counts */}
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-200">
        <button
          onClick={() => setFilter('all')}
          className={`text-sm px-3 py-1 rounded-lg transition-colors ${
            filter === 'all'
              ? 'bg-blue-100 text-blue-700 font-medium'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All ({counts.total})
        </button>
        {counts.critical > 0 && (
          <button
            onClick={() => setFilter('critical')}
            className={`text-sm px-3 py-1 rounded-lg transition-colors flex items-center gap-1 ${
              filter === 'critical'
                ? 'bg-red-100 text-red-700 font-medium'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Critical ({counts.critical})
          </button>
        )}
        {counts.warning > 0 && (
          <button
            onClick={() => setFilter('warning')}
            className={`text-sm px-3 py-1 rounded-lg transition-colors flex items-center gap-1 ${
              filter === 'warning'
                ? 'bg-amber-100 text-amber-700 font-medium'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            Warning ({counts.warning})
          </button>
        )}
        {counts.info > 0 && (
          <button
            onClick={() => setFilter('info')}
            className={`text-sm px-3 py-1 rounded-lg transition-colors flex items-center gap-1 ${
              filter === 'info'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Info className="w-4 h-4" />
            Info ({counts.info})
          </button>
        )}
      </div>

      {/* Alert List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            {filter === 'all' ? 'No unacknowledged alerts' : `No ${filter} alerts`}
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-lg p-3 transition-all hover:shadow-sm ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getSeverityIcon(alert.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-slate-900">
                          {alert.title}
                        </h4>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${getSeverityBadgeColor(alert.severity)}`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{alert.message}</p>
                      {alert.entityName && (
                        <p className="text-xs text-slate-500">
                          {alert.entityType}: {alert.entityName}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Acknowledge alert"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {alert.actionUrl && (
                    <button
                      onClick={() => handleNavigate(alert)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      View <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Show More Link */}
      {allAlerts.filter(a => !acknowledged.has(a.id)).length > maxDisplay && (
        <div className="mt-4 pt-4 border-t border-slate-200 text-center">
          <button
            onClick={() => setFilter('all')}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            View all {allAlerts.filter(a => !acknowledged.has(a.id)).length} alerts
          </button>
        </div>
      )}
    </div>
  );
};

export default AlertsWidget;



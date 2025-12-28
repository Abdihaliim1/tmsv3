/**
 * Compact Alerts Widget - Professional Dashboard Version
 * 
 * Shows max 3 alerts in a small, quiet format
 * Designed for executive dashboards - calm but informative
 */

import React from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronRight } from 'lucide-react';
import { Alert, generateAllAlerts, getAlertCounts } from '../services/alertsService';
import { Load, Invoice } from '../types';

interface CompactAlertsWidgetProps {
  loads: Load[];
  invoices: Invoice[];
  onNavigate?: (entityType: string, entityId: string) => void;
}

const CompactAlertsWidget: React.FC<CompactAlertsWidgetProps> = ({
  loads,
  invoices,
  onNavigate,
}) => {
  const allAlerts = React.useMemo(() => {
    return generateAllAlerts(loads, invoices);
  }, [loads, invoices]);

  const counts = React.useMemo(() => {
    return getAlertCounts(allAlerts);
  }, [allAlerts]);

  // Show only top 3 alerts (prioritize critical, then warning)
  const topAlerts = React.useMemo(() => {
    const sorted = [...allAlerts].sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
    return sorted.slice(0, 3);
  }, [allAlerts]);

  const getSeverityDot = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return <div className="w-2 h-2 rounded-full bg-red-500" />;
      case 'warning':
        return <div className="w-2 h-2 rounded-full bg-amber-500" />;
      case 'info':
        return <div className="w-2 h-2 rounded-full bg-blue-500" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-slate-400" />;
    }
  };

  const handleNavigate = (alert: Alert) => {
    if (onNavigate) {
      onNavigate(alert.entityType, alert.entityId);
    } else if (alert.actionUrl) {
      window.location.href = alert.actionUrl;
    }
  };

  if (counts.total === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Alerts</h3>
          <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded">All clear</span>
        </div>
        <p className="text-xs text-slate-500">No alerts at this time</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Alerts</h3>
          <span className="text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded">
            {counts.total}
          </span>
        </div>
        {counts.total > topAlerts.length && (
          <button
            onClick={() => {
              // Navigate to Loads page where alerts are most relevant
              if (onNavigate) {
                onNavigate('load', '');
              }
            }}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            View all →
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        {topAlerts.map((alert) => (
          <div
            key={alert.id}
            onClick={() => handleNavigate(alert)}
            className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer transition-colors group"
          >
            {getSeverityDot(alert.severity)}
            <span className="text-xs text-slate-700 flex-1 truncate group-hover:text-slate-900">
              {alert.title}
            </span>
            <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompactAlertsWidget;


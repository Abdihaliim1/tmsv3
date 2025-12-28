/**
 * Export Menu Component
 * 
 * Provides export functionality for:
 * - Loads
 * - Invoices
 * - Settlements
 * - Drivers
 * - Complete tenant snapshot
 */

import React, { useState } from 'react';
import {
  Download,
  FileText,
  FileJson,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { useTenant } from '../context/TenantContext';
import {
  exportLoadsToCSV,
  exportInvoicesToCSV,
  exportSettlementsToCSV,
  exportDriversToCSV,
  exportAllData,
  downloadCSV,
  downloadJSON,
  exportTenantSnapshot,
} from '../services/exportService';

const ExportMenu: React.FC = () => {
  const { loads, invoices, settlements, drivers, dispatchers } = useTMS();
  const { tenant } = useTenant();
  const [exporting, setExporting] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);

  const handleExport = async (type: string) => {
    setExporting(type);
    setExported(null);

    try {
      const timestamp = new Date().toISOString().split('T')[0];

      switch (type) {
        case 'loads':
          const loadsCSV = exportLoadsToCSV(loads);
          downloadCSV(loadsCSV, `loads-export-${timestamp}.csv`);
          break;

        case 'invoices':
          const invoicesCSV = exportInvoicesToCSV(invoices);
          downloadCSV(invoicesCSV, `invoices-export-${timestamp}.csv`);
          break;

        case 'settlements':
          const settlementsCSV = exportSettlementsToCSV(settlements);
          downloadCSV(settlementsCSV, `settlements-export-${timestamp}.csv`);
          break;

        case 'drivers':
          const driversCSV = exportDriversToCSV(drivers);
          downloadCSV(driversCSV, `drivers-export-${timestamp}.csv`);
          break;

        case 'all-json':
          const snapshot = exportTenantSnapshot({
            loads,
            invoices,
            settlements,
            drivers,
            dispatchers,
            tenantId: tenant?.id || 'default',
            exportedAt: new Date().toISOString(),
          });
          downloadJSON(snapshot, `tms-backup-${tenant?.id || 'default'}-${timestamp}.json`);
          break;

        case 'all':
          exportAllData({
            loads,
            invoices,
            settlements,
            drivers,
            dispatchers,
            tenantId: tenant?.id || 'default',
          });
          break;

        default:
          throw new Error('Unknown export type');
      }

      setExported(type);
      setTimeout(() => setExported(null), 3000);
    } catch (error: any) {
      console.error('Export error:', error);
      alert(`Failed to export: ${error.message}`);
    } finally {
      setExporting(null);
    }
  };

  const exportButtons = [
    {
      id: 'loads',
      label: 'Export Loads',
      description: 'CSV format with all load details',
      icon: FileText,
      count: loads.length,
    },
    {
      id: 'invoices',
      label: 'Export Invoices',
      description: 'CSV format with payment information',
      icon: FileText,
      count: invoices.length,
    },
    {
      id: 'settlements',
      label: 'Export Settlements',
      description: 'CSV format with pay details',
      icon: FileText,
      count: settlements.length,
    },
    {
      id: 'drivers',
      label: 'Export Drivers',
      description: 'CSV format with driver profiles',
      icon: FileText,
      count: drivers.length,
    },
    {
      id: 'all-json',
      label: 'Full Backup (JSON)',
      description: 'Complete tenant snapshot with metadata',
      icon: FileJson,
      count: loads.length + invoices.length + settlements.length,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exportButtons.map((button) => {
          const Icon = button.icon;
          const isExporting = exporting === button.id;
          const isExported = exported === button.id;

          return (
            <button
              key={button.id}
              onClick={() => handleExport(button.id)}
              disabled={isExporting || button.count === 0}
              className={`
                relative p-4 border-2 rounded-lg text-left transition-all
                ${isExporting
                  ? 'border-blue-300 bg-blue-50 cursor-wait'
                  : isExported
                  ? 'border-green-300 bg-green-50'
                  : button.count === 0
                  ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                  : 'border-slate-300 bg-white hover:border-blue-400 hover:shadow-md cursor-pointer'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-5 h-5 text-slate-600" />
                    <span className="font-semibold text-slate-900">{button.label}</span>
                    {button.count > 0 && (
                      <span className="text-xs text-slate-500">({button.count})</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">{button.description}</p>
                </div>
                <div className="flex-shrink-0 ml-4">
                  {isExporting ? (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  ) : isExported ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Download className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> All exports are generated client-side. Your data never leaves your browser until you download the file.
          CSV files can be opened in Excel, Google Sheets, or any spreadsheet application.
        </p>
      </div>
    </div>
  );
};

export default ExportMenu;



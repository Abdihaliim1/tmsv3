/**
 * Export/Backup Service
 * 
 * Provides CSV and JSON export functionality for:
 * - Loads
 * - Invoices
 * - Settlements
 * - Drivers
 * - Complete tenant snapshot
 */

import { Load, Invoice, Settlement, Driver, Dispatcher } from '../types';

/**
 * Export loads to CSV
 */
export function exportLoadsToCSV(loads: Load[]): string {
  const headers = [
    'Load Number',
    'Status',
    'Broker',
    'Customer',
    'Driver',
    'Origin',
    'Destination',
    'Pickup Date',
    'Delivery Date',
    'Miles',
    'Rate',
    'Rate/Mile',
    'Driver Pay',
    'Margin',
    'Invoice Number',
    'Settlement Number',
    'Created At',
  ];

  const rows = loads.map(load => [
    load.loadNumber || '',
    load.status || '',
    load.brokerName || '',
    load.customerName || '',
    load.driverName || 'Unassigned',
    `${load.originCity}, ${load.originState}`,
    `${load.destCity}, ${load.destState}`,
    load.pickupDate || '',
    load.deliveryDate || '',
    load.miles?.toString() || '0',
    load.rate?.toFixed(2) || '0.00',
    load.ratePerMile?.toFixed(2) || '0.00',
    load.driverBasePay?.toFixed(2) || '0.00',
    ((load.rate || 0) - (load.driverBasePay || 0)).toFixed(2),
    load.invoiceNumber || '',
    load.settlementNumber || '',
    load.createdAt || '',
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

/**
 * Export invoices to CSV
 */
export function exportInvoicesToCSV(invoices: Invoice[]): string {
  const headers = [
    'Invoice Number',
    'Customer',
    'Amount',
    'Status',
    'Date',
    'Due Date',
    'Paid Date',
    'Paid Amount',
    'Payment Method',
    'Load Numbers',
    'Created At',
  ];

  const rows = invoices.map(invoice => [
    invoice.invoiceNumber || '',
    invoice.customerName || '',
    invoice.amount?.toFixed(2) || '0.00',
    invoice.status || '',
    invoice.date || '',
    invoice.dueDate || '',
    invoice.paidAt || '',
    invoice.paidAmount?.toFixed(2) || '0.00',
    invoice.paymentMethod || '',
    (invoice.loadIds || []).join('; '),
    invoice.createdAt || '',
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

/**
 * Export settlements to CSV
 */
export function exportSettlementsToCSV(settlements: Settlement[]): string {
  const headers = [
    'Settlement Number',
    'Type',
    'Driver/Dispatcher',
    'Period Start',
    'Period End',
    'Gross Pay',
    'Total Deductions',
    'Net Pay',
    'Status',
    'Date',
    'Load Numbers',
    'Created At',
  ];

  const rows = settlements.map(settlement => [
    settlement.settlementNumber || '',
    settlement.type || 'driver',
    settlement.driverName || '',
    settlement.periodStart || '',
    settlement.periodEnd || '',
    settlement.grossPay?.toFixed(2) || '0.00',
    settlement.totalDeductions?.toFixed(2) || '0.00',
    settlement.netPay?.toFixed(2) || '0.00',
    settlement.status || '',
    settlement.date || '',
    (settlement.loadIds || []).join('; '),
    settlement.createdAt || '',
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

/**
 * Export drivers to CSV
 */
export function exportDriversToCSV(drivers: Driver[]): string {
  const headers = [
    'Driver Number',
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Type',
    'Status',
    'License Number',
    'License State',
    'Payment Type',
    'Payment Rate',
    'Created At',
  ];

  const rows = drivers.map(driver => [
    driver.driverNumber || '',
    driver.firstName || '',
    driver.lastName || '',
    driver.email || '',
    driver.phone || '',
    driver.type || '',
    driver.status || '',
    driver.licenseNumber || '',
    driver.licenseState || '',
    driver.payment?.type || '',
    driver.payment?.type === 'percentage' 
      ? `${driver.payment?.percentage || 0}%`
      : driver.payment?.perMileRate?.toFixed(2) || '0.00',
    driver.createdAt || '',
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

/**
 * Export complete tenant snapshot to JSON
 */
export function exportTenantSnapshot(params: {
  loads: Load[];
  invoices: Invoice[];
  settlements: Settlement[];
  drivers: Driver[];
  dispatchers: Dispatcher[];
  tenantId: string;
  exportedAt: string;
}): string {
  const snapshot = {
    tenantId: params.tenantId,
    exportedAt: params.exportedAt,
    version: '1.0',
    data: {
      loads: params.loads,
      invoices: params.invoices,
      settlements: params.settlements,
      drivers: params.drivers,
      dispatchers: params.dispatchers,
    },
    summary: {
      totalLoads: params.loads.length,
      totalInvoices: params.invoices.length,
      totalSettlements: params.settlements.length,
      totalDrivers: params.drivers.length,
      totalDispatchers: params.dispatchers.length,
      totalRevenue: params.invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
      totalSettlementsPaid: params.settlements
        .filter(s => s.status === 'paid')
        .reduce((sum, s) => sum + (s.netPay || 0), 0),
    },
  };

  return JSON.stringify(snapshot, null, 2);
}

/**
 * Download CSV file
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Download JSON file
 */
export function downloadJSON(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Export all data (convenience function)
 */
export function exportAllData(params: {
  loads: Load[];
  invoices: Invoice[];
  settlements: Settlement[];
  drivers: Driver[];
  dispatchers: Dispatcher[];
  tenantId: string;
}): void {
  const timestamp = new Date().toISOString().split('T')[0];
  
  // Export as JSON snapshot
  const snapshot = exportTenantSnapshot({
    ...params,
    exportedAt: new Date().toISOString(),
  });
  
  downloadJSON(snapshot, `tms-export-${params.tenantId}-${timestamp}.json`);
}



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

import {
  Load,
  Invoice,
  Settlement,
  Driver,
  Dispatcher,
  Expense,
  Trip,
  PlannedLoad,
  Truck,
  Trailer,
  Broker,
  CustomerEntity,
  FactoringCompany,
  FactoringTransaction,
  Employee,
} from '../types';

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
    'Dispatcher',
    'Origin',
    'Destination',
    'Pickup Date',
    'Delivery Date',
    'Miles',
    'Rate',
    'FSC',
    'Grand Total',
    'Rate/Mile',
    'Driver Pay',
    'Dispatcher Commission',
    'Margin',
    'Invoice Number',
    'Settlement Number',
    'Dispatcher Settlement',
    'Created At',
  ];

  const rows = loads.map(load => [
    load.loadNumber || '',
    load.status || '',
    load.brokerName || '',
    load.customerName || '',
    load.driverName || 'Unassigned',
    load.dispatcherName || '',
    `${load.originCity}, ${load.originState}`,
    `${load.destCity}, ${load.destState}`,
    load.pickupDate || '',
    load.deliveryDate || '',
    load.miles?.toString() || '0',
    load.rate?.toFixed(2) || '0.00',
    (load.fscAmount || 0).toFixed(2),
    (load.grandTotal || load.rate || 0).toFixed(2),
    load.ratePerMile?.toFixed(2) || '0.00',
    load.driverBasePay?.toFixed(2) || '0.00',
    (load.dispatcherCommissionAmount || 0).toFixed(2),
    ((load.grandTotal || load.rate || 0) - (load.driverBasePay || 0) - (load.dispatcherCommissionAmount || 0)).toFixed(2),
    load.invoiceNumber || '',
    load.settlementNumber || '',
    load.dispatcherSettlementNumber || '',
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
    'Factored',
    'Factoring Company',
    'Factoring Fee %',
    'Factoring Fee',
    'Payment Count',
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
    invoice.isFactored ? 'Yes' : 'No',
    invoice.factoringCompanyName || '',
    invoice.factoringFeePercent?.toFixed(2) || '',
    invoice.factoringFee?.toFixed(2) || '',
    String(invoice.payments?.length || 0),
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
    'Pay Type',
    'Pay Rate Snapshot',
    'Period Start',
    'Period End',
    'Total Miles',
    'Gross Pay',
    'Total Deductions',
    'Net Pay',
    'Status',
    'Date',
    'Load Numbers',
    'Load Snapshot Count',
    'Created At',
  ];

  const rows = settlements.map(settlement => [
    settlement.settlementNumber || '',
    settlement.type || 'driver',
    settlement.driverName || '',
    settlement.payType || '',
    settlement.payRateSnapshot != null ? String(settlement.payRateSnapshot) : '',
    settlement.periodStart || '',
    settlement.periodEnd || '',
    String(settlement.totalMiles ?? 0),
    settlement.grossPay?.toFixed(2) || '0.00',
    settlement.totalDeductions?.toFixed(2) || '0.00',
    settlement.netPay?.toFixed(2) || '0.00',
    settlement.status || '',
    settlement.date || '',
    (settlement.loadIds || []).join('; '),
    String(settlement.loads?.length || 0),
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

export type TenantSnapshotParams = {
  loads: Load[];
  invoices: Invoice[];
  settlements: Settlement[];
  drivers: Driver[];
  dispatchers: Dispatcher[];
  employees?: Employee[];
  expenses?: Expense[];
  trips?: Trip[];
  plannedLoads?: PlannedLoad[];
  trucks?: Truck[];
  trailers?: Trailer[];
  brokers?: Broker[];
  customers?: CustomerEntity[];
  factoringCompanies?: FactoringCompany[];
  factoringTransactions?: FactoringTransaction[];
  tenantId: string;
  exportedAt: string;
};

/**
 * Export complete tenant snapshot to JSON (all primary business collections).
 */
export function exportTenantSnapshot(params: TenantSnapshotParams): string {
  const data = {
    loads: params.loads,
    invoices: params.invoices,
    settlements: params.settlements,
    drivers: params.drivers,
    dispatchers: params.dispatchers,
    employees: params.employees || [],
    expenses: params.expenses || [],
    trips: params.trips || [],
    plannedLoads: params.plannedLoads || [],
    trucks: params.trucks || [],
    trailers: params.trailers || [],
    brokers: params.brokers || [],
    customers: params.customers || [],
    factoringCompanies: params.factoringCompanies || [],
    factoringTransactions: params.factoringTransactions || [],
  };

  const snapshot = {
    tenantId: params.tenantId,
    exportedAt: params.exportedAt,
    version: '2.0',
    data,
    summary: {
      totalLoads: data.loads.length,
      totalInvoices: data.invoices.length,
      totalSettlements: data.settlements.length,
      totalDrivers: data.drivers.length,
      totalDispatchers: data.dispatchers.length,
      totalEmployees: data.employees.length,
      totalExpenses: data.expenses.length,
      totalTrips: data.trips.length,
      totalPlannedLoads: data.plannedLoads.length,
      totalTrucks: data.trucks.length,
      totalTrailers: data.trailers.length,
      totalBrokers: data.brokers.length,
      totalCustomers: data.customers.length,
      totalFactoringCompanies: data.factoringCompanies.length,
      totalFactoringTransactions: data.factoringTransactions.length,
      totalRevenue: data.invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
      totalSettlementsPaid: data.settlements
        .filter(s => s.status === 'paid')
        .reduce((sum, s) => sum + (s.netPay || 0), 0),
      totalExpensesAmount: data.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
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
export function exportAllData(params: Omit<TenantSnapshotParams, 'exportedAt'>): void {
  const timestamp = new Date().toISOString().split('T')[0];
  const snapshot = exportTenantSnapshot({
    ...params,
    exportedAt: new Date().toISOString(),
  });
  downloadJSON(snapshot, `tms-export-${params.tenantId}-${timestamp}.json`);
}



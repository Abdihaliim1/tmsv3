import React, { useState, Suspense, lazy, useMemo } from 'react';
import {
  BarChart3, DollarSign, Users, Truck, FileText, Calculator, Fuel, MapPin,
  TrendingUp, PieChart, ChevronRight, Building2, ClipboardList, Wrench, FileSpreadsheet,
  Printer, Download, Calendar, RefreshCw, Phone
} from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { useCompany } from '../context/CompanyContext';
import { calculateCompanyRevenue } from '../services/utils';
import {
  getLoadMiles,
  getLoadRevenue,
  getLoadFsc,
  isRevenueLoadStatus,
  calculateFactoringFees,
  calculateAccruedDriverPay,
  calculateAccruedDispatcherCommission,
  isCompanyRecognizedExpense,
  getLoadAccessorials,
  calculatePeriodFinancials,
  resolveLoadFactoringFee,
} from '../services/businessLogic';
import { parseDateOnlyLocal, tryParseDateOnlyLocal } from '../utils/dateOnly';
import { sumStateMiles } from '../services/stateMiles';
import { formatExpenseCategoryLabel, normalizeExpenseCategory } from '../services/expenseCategory';
import { allocateSettlementToPeriod } from '../services/settlementPeriod';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

// Lazy load existing report pages
const ReportsPage = lazy(() => import('./Reports'));
const SettlementsPage = lazy(() => import('./Settlements'));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
      <p className="text-slate-500 text-sm">Loading...</p>
    </div>
  </div>
);


const fmtMoney = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getFuelGallonsFromExpense = (e: import('../types').Expense): number | null => {
  const ext = e as import('../types').Expense & { quantity?: number };
  const raw = e.gallons ?? ext.quantity;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  return null;
};

const truckUnitGroup = (
  truckId: string | undefined,
  trucks: import('../types').Truck[],
  fallbackNumber?: string
): { id: string; label: string } => {
  const truck = truckId ? trucks.find(t => t.id === truckId) : undefined;
  const id = truckId || 'unassigned';
  const label = truck?.number || truck?.truckNumber || fallbackNumber || (truckId ? truckId : 'Unassigned');
  return { id, label };
};

/** Shared month picker shell for newly implemented reports */
const MonthScopedReportShell: React.FC<{
  title: string;
  subtitle: string;
  onBack: () => void;
  children: (ctx: { periodStart: Date; periodEnd: Date; month: string }) => React.ReactNode;
}> = ({ title, subtitle, onBack, children }) => {
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [y, m] = month.split('-').map(Number);
  const periodStart = new Date(y, m - 1, 1);
  const periodEnd = new Date(y, m, 0, 23, 59, 59, 999);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button type="button" onClick={onBack} className="text-sm text-blue-600 hover:underline mb-1">
            ← Back to reports
          </button>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="text-slate-500 text-sm">{subtitle}</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        />
      </div>
      {children({ periodStart, periodEnd, month })}
    </div>
  );
};

/** Quarter picker shell for true quarterly reports */
const QuarterScopedReportShell: React.FC<{
  title: string;
  subtitle: string;
  onBack: () => void;
  children: (ctx: { periodStart: Date; periodEnd: Date; quarter: number; year: number }) => React.ReactNode;
}> = ({ title, subtitle, onBack, children }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const periodStart = new Date(year, (quarter - 1) * 3, 1);
  const periodEnd = new Date(year, quarter * 3, 0, 23, 59, 59, 999);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button type="button" onClick={onBack} className="text-sm text-blue-600 hover:underline mb-1">
            ← Back to reports
          </button>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="text-slate-500 text-sm">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={quarter}
            onChange={e => setQuarter(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg"
          >
            <option value={1}>Q1 (Jan–Mar)</option>
            <option value={2}>Q2 (Apr–Jun)</option>
            <option value={3}>Q3 (Jul–Sep)</option>
            <option value={4}>Q4 (Oct–Dec)</option>
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg"
          >
            {Array.from({ length: 8 }, (_, i) => now.getFullYear() - 5 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
      {children({ periodStart, periodEnd, quarter, year })}
    </div>
  );
};

const TaxReport: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { loads, expenses, invoices, settlements, factoringCompanies, drivers, employees } = useTMS();
  return (
    <MonthScopedReportShell
      title="Tax Report"
      subtitle="Taxable revenue, deductible expenses, and estimated tax base"
      onBack={onBack}
    >
      {({ periodStart, periodEnd }) => {
        const financials = calculatePeriodFinancials({
          loads,
          expenses,
          settlements,
          invoices,
          factoringCompanies,
          drivers,
          employees,
          periodStart,
          periodEnd,
        });
        const estimatedTaxBase = Math.max(0, financials.netProfit);
        return (
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-500">Gross Revenue</p>
                <p className="text-xl font-bold">{fmtMoney(financials.revenue)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Operating Expenses</p>
                <p className="text-xl font-bold">{fmtMoney(financials.operatingExpenses)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">
                  Dispatcher Commission{financials.dispatcherCostEstimated ? ' (Est.)' : ''}
                </p>
                <p className="text-xl font-bold">{fmtMoney(financials.dispatcherCost)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Driver Pay + Factoring</p>
                <p className="text-xl font-bold">
                  {fmtMoney(financials.driverPay + financials.factoringFees)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Estimated Taxable Base</p>
                <p className="text-xl font-bold text-blue-700">{fmtMoney(estimatedTaxBase)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Net profit for period: {fmtMoney(financials.netProfit)}. This is a management summary — not a filed tax return.
            </p>
          </div>
        );
      }}
    </MonthScopedReportShell>
  );
};

const FuelVendorReport: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { expenses } = useTMS();
  return (
    <MonthScopedReportShell
      title="Fuel Vendor Report"
      subtitle="Fuel spend grouped by vendor"
      onBack={onBack}
    >
      {({ periodStart, periodEnd }) => {
        const rows = expenses.filter(e => {
          if (e.status === 'rejected') return false;
          if ((e.type || '').toLowerCase() !== 'fuel' && (e.category || '').toLowerCase() !== 'fuel') {
            return false;
          }
          const d = tryParseDateOnlyLocal(e.date || e.createdAt || '');
          if (!d) return false;
          return d >= periodStart && d <= periodEnd;
        });
        const byVendor: Record<string, { amount: number; count: number }> = {};
        rows.forEach(e => {
          const vendor = (e.vendor || 'Unknown vendor').trim() || 'Unknown vendor';
          if (!byVendor[vendor]) byVendor[vendor] = { amount: 0, count: 0 };
          byVendor[vendor].amount += Number(e.amount) || 0;
          byVendor[vendor].count += 1;
        });
        const sorted = Object.entries(byVendor).sort((a, b) => b[1].amount - a[1].amount);
        const total = sorted.reduce((s, [, v]) => s + v.amount, 0);
        return (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between">
              <span className="font-medium text-slate-700">{sorted.length} vendors</span>
              <span className="font-bold">{fmtMoney(total)}</span>
            </div>
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vendor</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Transactions</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">No fuel expenses this month</td></tr>
                ) : (
                  sorted.map(([vendor, data]) => (
                    <tr key={vendor}>
                      <td className="px-6 py-3 text-sm text-slate-900">{vendor}</td>
                      <td className="px-6 py-3 text-sm text-right text-slate-600">{data.count}</td>
                      <td className="px-6 py-3 text-sm text-right font-medium">{fmtMoney(data.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );
      }}
    </MonthScopedReportShell>
  );
};

const CustomerAnalyticsReport: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { loads } = useTMS();
  return (
    <MonthScopedReportShell
      title="Customer Report"
      subtitle="Booked revenue by customer/broker"
      onBack={onBack}
    >
      {({ periodStart, periodEnd }) => {
        const periodLoads = loads.filter(l => {
          if (!isRevenueLoadStatus(l.status)) return false;
          const d = tryParseDateOnlyLocal(l.deliveryDate || l.pickupDate || '');
          if (!d) return false;
          return d >= periodStart && d <= periodEnd;
        });
        const byCustomer: Record<string, { revenue: number; loads: number; miles: number }> = {};
        periodLoads.forEach(l => {
          const key = (l.customerName || l.brokerName || 'Unknown').trim() || 'Unknown';
          if (!byCustomer[key]) byCustomer[key] = { revenue: 0, loads: 0, miles: 0 };
          byCustomer[key].revenue += getLoadRevenue(l);
          byCustomer[key].loads += 1;
          byCustomer[key].miles += getLoadMiles(l);
        });
        const sorted = Object.entries(byCustomer).sort((a, b) => b[1].revenue - a[1].revenue);
        const total = sorted.reduce((s, [, v]) => s + v.revenue, 0);
        return (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between">
              <span className="font-medium text-slate-700">{sorted.length} customers · {periodLoads.length} loads</span>
              <span className="font-bold">{fmtMoney(total)}</span>
            </div>
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Loads</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Miles</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No delivered loads this month</td></tr>
                ) : (
                  sorted.map(([name, data]) => (
                    <tr key={name}>
                      <td className="px-6 py-3 text-sm text-slate-900">{name}</td>
                      <td className="px-6 py-3 text-sm text-right text-slate-600">{data.loads}</td>
                      <td className="px-6 py-3 text-sm text-right text-slate-600">{Math.round(data.miles).toLocaleString()}</td>
                      <td className="px-6 py-3 text-sm text-right font-medium">{fmtMoney(data.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );
      }}
    </MonthScopedReportShell>
  );
};

const UnitRevenueReport: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { loads, trucks } = useTMS();
  return (
    <MonthScopedReportShell
      title="Unit Revenue"
      subtitle="Booked revenue by truck/unit"
      onBack={onBack}
    >
      {({ periodStart, periodEnd }) => {
        const periodLoads = loads.filter(l => {
          if (!isRevenueLoadStatus(l.status)) return false;
          const d = tryParseDateOnlyLocal(l.deliveryDate || l.pickupDate || '');
          if (!d) return false;
          return d >= periodStart && d <= periodEnd;
        });
        const byUnit: Record<string, { label: string; revenue: number; loads: number; miles: number }> = {};
        periodLoads.forEach(l => {
          const { id, label } = truckUnitGroup(l.truckId, trucks, l.truckNumber);
          if (!byUnit[id]) byUnit[id] = { label, revenue: 0, loads: 0, miles: 0 };
          byUnit[id].revenue += getLoadRevenue(l);
          byUnit[id].loads += 1;
          byUnit[id].miles += getLoadMiles(l);
        });
        const sorted = Object.entries(byUnit).sort((a, b) => b[1].revenue - a[1].revenue);
        const total = sorted.reduce((s, [, v]) => s + v.revenue, 0);
        return (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between">
              <span className="font-medium text-slate-700">{sorted.length} units</span>
              <span className="font-bold">{fmtMoney(total)}</span>
            </div>
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Unit</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Loads</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Miles</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">$/Mile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No unit revenue this month</td></tr>
                ) : (
                  sorted.map(([unitId, data]) => (
                    <tr key={unitId}>
                      <td className="px-6 py-3 text-sm text-slate-900">{data.label}</td>
                      <td className="px-6 py-3 text-sm text-right text-slate-600">{data.loads}</td>
                      <td className="px-6 py-3 text-sm text-right text-slate-600">{Math.round(data.miles).toLocaleString()}</td>
                      <td className="px-6 py-3 text-sm text-right font-medium">{fmtMoney(data.revenue)}</td>
                      <td className="px-6 py-3 text-sm text-right text-slate-600">
                        {data.miles > 0 ? fmtMoney(data.revenue / data.miles) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );
      }}
    </MonthScopedReportShell>
  );
};

const UnitOperatingIncomeReport: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { loads, trucks, expenses, drivers, employees, settlements, invoices, factoringCompanies } = useTMS();
  return (
    <MonthScopedReportShell
      title="Unit Operating Income"
      subtitle="Revenue minus truck, driver, dispatcher, and factoring costs by unit"
      onBack={onBack}
    >
      {({ periodStart, periodEnd }) => {
        const periodLoads = loads.filter(l => {
          if (!isRevenueLoadStatus(l.status)) return false;
          const d = tryParseDateOnlyLocal(l.deliveryDate || l.pickupDate || '');
          if (!d) return false;
          return d >= periodStart && d <= periodEnd;
        });
        const periodExpenses = expenses.filter(e => {
          if (!isCompanyRecognizedExpense(e, drivers)) return false;
          const d = tryParseDateOnlyLocal(String(e.date || e.createdAt || ''));
          if (!d) return false;
          return d >= periodStart && d <= periodEnd;
        });
        const accruedDriver = calculateAccruedDriverPay(periodLoads, settlements, drivers);
        const accruedDispatcher = calculateAccruedDispatcherCommission(periodLoads, settlements, employees);
        const byUnit: Record<
          string,
          { label: string; revenue: number; expenses: number; driver: number; dispatcher: number; factoring: number; loads: number; miles: number }
        > = {};
        const ensure = (id: string, label: string) => {
          if (!byUnit[id]) {
            byUnit[id] = {
              label,
              revenue: 0,
              expenses: 0,
              driver: 0,
              dispatcher: 0,
              factoring: 0,
              loads: 0,
              miles: 0,
            };
          }
          return byUnit[id];
        };
        periodLoads.forEach(l => {
          const { id, label } = truckUnitGroup(l.truckId, trucks, l.truckNumber);
          const row = ensure(id, label);
          const inv = invoices.find(
            i => i.id === l.invoiceId || (i.loadIds || []).includes(l.id) || i.loadId === l.id
          );
          row.revenue += getLoadRevenue(l);
          row.loads += 1;
          row.miles += getLoadMiles(l);
          row.driver += accruedDriver.byLoadId[l.id] || 0;
          row.dispatcher += accruedDispatcher.byLoadId[l.id] || 0;
          row.factoring += resolveLoadFactoringFee(l, inv, factoringCompanies);
        });
        periodExpenses.forEach(e => {
          const { id, label } = truckUnitGroup(e.truckId, trucks, e.truckNumber);
          const amount = typeof e.amount === 'number' ? e.amount : parseFloat(String(e.amount ?? ''));
          ensure(id, label).expenses += Number.isFinite(amount) ? amount : 0;
        });
        const sorted = Object.entries(byUnit).sort(
          (a, b) =>
            (b[1].revenue - b[1].expenses - b[1].driver - b[1].dispatcher - b[1].factoring) -
            (a[1].revenue - a[1].expenses - a[1].driver - a[1].dispatcher - a[1].factoring)
        );
        return (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Unit</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Loads</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Op. Exp</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Driver</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Dispatcher</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Factoring</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Op. Income</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-500">No unit activity this month</td></tr>
                ) : (
                  sorted.map(([unitId, data]) => {
                    const income =
                      data.revenue - data.expenses - data.driver - data.dispatcher - data.factoring;
                    return (
                      <tr key={unitId}>
                        <td className="px-6 py-3 text-sm text-slate-900">{data.label}</td>
                        <td className="px-6 py-3 text-sm text-right text-slate-600">{data.loads}</td>
                        <td className="px-6 py-3 text-sm text-right">{fmtMoney(data.revenue)}</td>
                        <td className="px-6 py-3 text-sm text-right">{fmtMoney(data.expenses)}</td>
                        <td className="px-6 py-3 text-sm text-right">{fmtMoney(data.driver)}</td>
                        <td className="px-6 py-3 text-sm text-right">{fmtMoney(data.dispatcher)}</td>
                        <td className="px-6 py-3 text-sm text-right">{fmtMoney(data.factoring)}</td>
                        <td className={`px-6 py-3 text-sm text-right font-medium ${income >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {fmtMoney(income)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        );
      }}
    </MonthScopedReportShell>
  );
};

const StateMilesTable: React.FC<{ periodStart: Date; periodEnd: Date }> = ({ periodStart, periodEnd }) => {
  const { loads } = useTMS();
  const periodLoads = loads.filter(l => {
    if (!isRevenueLoadStatus(l.status)) return false;
    const d = tryParseDateOnlyLocal(l.deliveryDate || l.pickupDate || '');
    if (!d) return false;
    return d >= periodStart && d <= periodEnd;
  });
  const withStored = periodLoads.filter(l => (l.stateMiles?.length || 0) > 0).length;
  const byState = sumStateMiles(
    periodLoads.map(l => ({
      stateMiles: l.stateMiles,
      originState: l.originState,
      destState: l.destState,
      miles: getLoadMiles(l),
    }))
  );
  const sorted = Object.entries(byState).sort((a, b) => b[1].miles - a[1].miles);
  const total = sorted.reduce((s, [, v]) => s + v.miles, 0);
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-6 py-3 border-b text-xs text-slate-500">
        {withStored} of {periodLoads.length} loads have stored stateMiles.
        Others use 50/50 origin/destination allocation.
        Total: {Math.round(total).toLocaleString()} mi
      </div>
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">State</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Load touches</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Allocated Miles</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.length === 0 ? (
            <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">No state miles this period</td></tr>
          ) : (
            sorted.map(([state, data]) => (
              <tr key={state}>
                <td className="px-6 py-3 text-sm font-medium text-slate-900">{state}</td>
                <td className="px-6 py-3 text-sm text-right text-slate-600">{data.loads}</td>
                <td className="px-6 py-3 text-sm text-right font-medium">{Math.round(data.miles).toLocaleString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

const StateMilesReport: React.FC<{
  onBack: () => void;
  title?: string;
  subtitle?: string;
  scope?: 'month' | 'quarter';
}> = ({
  onBack,
  title = 'IRP / IFTA State Miles',
  subtitle = 'Uses load.stateMiles when present; otherwise allocates total miles by origin/destination state',
  scope = 'month',
}) => {
  if (scope === 'quarter') {
    return (
      <QuarterScopedReportShell title={title} subtitle={subtitle} onBack={onBack}>
        {({ periodStart, periodEnd }) => (
          <StateMilesTable periodStart={periodStart} periodEnd={periodEnd} />
        )}
      </QuarterScopedReportShell>
    );
  }
  return (
    <MonthScopedReportShell title={title} subtitle={subtitle} onBack={onBack}>
      {({ periodStart, periodEnd }) => (
        <StateMilesTable periodStart={periodStart} periodEnd={periodEnd} />
      )}
    </MonthScopedReportShell>
  );
};

const UnitMilesReport: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { loads, trucks } = useTMS();
  return (
    <MonthScopedReportShell
      title="Unit Miles"
      subtitle="Loaded miles by truck/unit"
      onBack={onBack}
    >
      {({ periodStart, periodEnd }) => {
        const periodLoads = loads.filter(l => {
          if (!isRevenueLoadStatus(l.status)) return false;
          const d = tryParseDateOnlyLocal(l.deliveryDate || l.pickupDate || '');
          if (!d) return false;
          return d >= periodStart && d <= periodEnd;
        });
        const byUnit: Record<string, { label: string; miles: number; loads: number }> = {};
        periodLoads.forEach(l => {
          const { id, label } = truckUnitGroup(l.truckId, trucks, l.truckNumber);
          if (!byUnit[id]) byUnit[id] = { label, miles: 0, loads: 0 };
          byUnit[id].miles += getLoadMiles(l);
          byUnit[id].loads += 1;
        });
        const sorted = Object.entries(byUnit).sort((a, b) => b[1].miles - a[1].miles);
        const totalMiles = sorted.reduce((s, [, v]) => s + v.miles, 0);
        return (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between">
              <span className="font-medium text-slate-700">{sorted.length} units</span>
              <span className="font-bold">{Math.round(totalMiles).toLocaleString()} mi</span>
            </div>
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Unit</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Loads</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Miles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">No unit miles this month</td></tr>
                ) : (
                  sorted.map(([unitId, data]) => (
                    <tr key={unitId}>
                      <td className="px-6 py-3 text-sm text-slate-900">{data.label}</td>
                      <td className="px-6 py-3 text-sm text-right text-slate-600">{data.loads}</td>
                      <td className="px-6 py-3 text-sm text-right font-medium">{Math.round(data.miles).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );
      }}
    </MonthScopedReportShell>
  );
};

const MilesPerGallonReport: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { loads, trucks, expenses } = useTMS();
  return (
    <MonthScopedReportShell
      title="Miles per Gallon"
      subtitle="MPG from loaded miles and recorded fuel gallons (estimated when gallons not recorded)"
      onBack={onBack}
    >
      {({ periodStart, periodEnd }) => {
        const periodLoads = loads.filter(l => {
          if (!isRevenueLoadStatus(l.status)) return false;
          const d = tryParseDateOnlyLocal(l.deliveryDate || l.pickupDate || '');
          if (!d) return false;
          return d >= periodStart && d <= periodEnd;
        });
        const fuelExpenses = expenses.filter(e => {
          if (e.status === 'rejected') return false;
          const type = (e.type || '').toLowerCase();
          const desc = (e.description || '').toLowerCase();
          if (type !== 'fuel' && !desc.includes('fuel')) return false;
          const d = tryParseDateOnlyLocal(String(e.date || e.createdAt || ''));
          if (!d) return false;
          return d >= periodStart && d <= periodEnd;
        });
        // Use recorded gallons when available; fall back to $/gal estimate
        const EST_PRICE_PER_GAL = 3.5;
        const byUnit: Record<string, { label: string; miles: number; fuelSpend: number; gallons: number; estimatedGallons: number }> = {};
        const ensure = (id: string, label: string) => {
          if (!byUnit[id]) byUnit[id] = { label, miles: 0, fuelSpend: 0, gallons: 0, estimatedGallons: 0 };
          return byUnit[id];
        };
        periodLoads.forEach(l => {
          const { id, label } = truckUnitGroup(l.truckId, trucks, l.truckNumber);
          ensure(id, label).miles += getLoadMiles(l);
        });
        fuelExpenses.forEach(e => {
          const { id, label } = truckUnitGroup(e.truckId, trucks, e.truckNumber);
          const row = ensure(id, label);
          const amount = typeof e.amount === 'number' ? e.amount : parseFloat(String(e.amount ?? ''));
          if (Number.isFinite(amount)) row.fuelSpend += amount;
          const recorded = getFuelGallonsFromExpense(e);
          if (recorded != null) {
            row.gallons += recorded;
          } else if (Number.isFinite(amount) && amount > 0) {
            row.estimatedGallons += amount / EST_PRICE_PER_GAL;
          }
        });
        const sorted = Object.entries(byUnit)
          .filter(([, v]) => v.miles > 0 || v.fuelSpend > 0)
          .sort((a, b) => b[1].miles - a[1].miles);
        const hasEstimated = sorted.some(([, v]) => v.estimatedGallons > 0);
        return (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {hasEstimated && (
            <p className="px-6 py-3 text-xs text-slate-500 border-b">
              Gallons estimated at ${EST_PRICE_PER_GAL.toFixed(2)}/gal only when quantity is not recorded on the expense.
            </p>
            )}
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Unit</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Miles</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Fuel $</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Gallons</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">MPG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No miles/fuel this month</td></tr>
                ) : (
                  sorted.map(([unitId, data]) => {
                    const totalGallons = data.gallons + data.estimatedGallons;
                    const mpg = totalGallons > 0 ? data.miles / totalGallons : 0;
                    const gallonsDisplay = data.gallons > 0
                      ? data.estimatedGallons > 0
                        ? `${data.gallons.toFixed(1)} + ~${data.estimatedGallons.toFixed(1)} est.`
                        : data.gallons.toFixed(1)
                      : data.estimatedGallons > 0
                        ? `~${data.estimatedGallons.toFixed(1)} est.`
                        : '—';
                    return (
                      <tr key={unitId}>
                        <td className="px-6 py-3 text-sm text-slate-900">{data.label}</td>
                        <td className="px-6 py-3 text-sm text-right">{Math.round(data.miles).toLocaleString()}</td>
                        <td className="px-6 py-3 text-sm text-right">{fmtMoney(data.fuelSpend)}</td>
                        <td className="px-6 py-3 text-sm text-right text-slate-600">{gallonsDisplay}</td>
                        <td className="px-6 py-3 text-sm text-right font-medium">{mpg > 0 ? mpg.toFixed(1) : '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        );
      }}
    </MonthScopedReportShell>
  );
};

const SettlementPayeeReport: React.FC<{
  onBack: () => void;
  title: string;
  subtitle: string;
  payeeColumn: string;
  emptyLabel: string;
  filterSettlements: (s: import('../types').Settlement, drivers: import('../types').Driver[]) => boolean;
  payeeId: (s: import('../types').Settlement) => string;
  payeeLabel: (s: import('../types').Settlement) => string;
}> = ({ onBack, title, subtitle, payeeColumn, emptyLabel, filterSettlements, payeeId, payeeLabel }) => {
  const { settlements, drivers, loads } = useTMS();
  return (
    <MonthScopedReportShell title={title} subtitle={subtitle} onBack={onBack}>
      {({ periodStart, periodEnd }) => {
        // Allocate by load delivery dates — never count full multi-month net in every month
        const allocated = settlements
          .filter(s => filterSettlements(s, drivers))
          .map(s => ({ s, alloc: allocateSettlementToPeriod(s, loads, periodStart, periodEnd) }))
          .filter(row => row.alloc.inPeriod);
        const byPayee: Record<string, { label: string; count: number; gross: number; net: number; paid: number }> = {};
        allocated.forEach(({ s, alloc }) => {
          const id = payeeId(s);
          if (!byPayee[id]) byPayee[id] = { label: payeeLabel(s), count: 0, gross: 0, net: 0, paid: 0 };
          byPayee[id].count += 1;
          byPayee[id].gross += alloc.grossShare;
          byPayee[id].net += alloc.netShare;
          if (s.status === 'paid') byPayee[id].paid += alloc.netShare;
        });
        const sorted = Object.entries(byPayee).sort((a, b) => b[1].gross - a[1].gross);
        return (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b">
              <span className="font-medium text-slate-700">{allocated.length} settlements (load-date allocated)</span>
            </div>
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{payeeColumn}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Count</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Gross</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Net</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">{emptyLabel}</td></tr>
                ) : (
                  sorted.map(([id, data]) => (
                    <tr key={id}>
                      <td className="px-6 py-3 text-sm text-slate-900">{data.label}</td>
                      <td className="px-6 py-3 text-sm text-right">{data.count}</td>
                      <td className="px-6 py-3 text-sm text-right">{fmtMoney(data.gross)}</td>
                      <td className="px-6 py-3 text-sm text-right">{fmtMoney(data.net)}</td>
                      <td className="px-6 py-3 text-sm text-right">{fmtMoney(data.paid)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );
      }}
    </MonthScopedReportShell>
  );
};

const DispatcherSettlementsReport: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <SettlementPayeeReport
    onBack={onBack}
    title="Dispatcher Settlements"
    subtitle="Dispatcher settlement totals by payee"
    payeeColumn="Dispatcher"
    emptyLabel="No dispatcher settlements this month"
    filterSettlements={s => s.type === 'dispatcher'}
    payeeId={s => s.dispatcherId || s.driverId || s.id}
    payeeLabel={s => s.driverName || s.payeeName || s.dispatcherId || 'Unknown'}
  />
);

const UserSettlementsReport: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <SettlementPayeeReport
    onBack={onBack}
    title="User Settlements"
    subtitle="All settlement totals by payee"
    payeeColumn="Payee"
    emptyLabel="No settlements this month"
    filterSettlements={() => true}
    payeeId={s => s.driverId || s.dispatcherId || s.id}
    payeeLabel={s => s.driverName || s.payeeName || s.dispatcherId || s.driverId || 'Unknown'}
  />
);

const CarrierSettlementsReport: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <SettlementPayeeReport
    onBack={onBack}
    title="Carrier Settlements"
    subtitle="Owner-operator settlement totals"
    payeeColumn="Carrier / O-O"
    emptyLabel="No owner-operator settlements this month"
    filterSettlements={(s, drivers) => {
      if (s.type !== 'driver') return false;
      const driver = drivers.find(d => d.id === s.driverId);
      return driver?.type === 'OwnerOperator';
    }}
    payeeId={s => s.driverId || s.id}
    payeeLabel={s => s.driverName || s.payeeName || s.driverId || 'Unknown'}
  />
);

const CarrierPayReport: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <SettlementPayeeReport
    onBack={onBack}
    title="Carrier Pay"
    subtitle="Owner-operator paid and unpaid settlement summary"
    payeeColumn="Carrier / O-O"
    emptyLabel="No owner-operator pay this month"
    filterSettlements={(s, drivers) => {
      if (s.type !== 'driver') return false;
      const driver = drivers.find(d => d.id === s.driverId);
      return driver?.type === 'OwnerOperator';
    }}
    payeeId={s => s.driverId || s.id}
    payeeLabel={s => s.driverName || s.payeeName || s.driverId || 'Unknown'}
  />
);

const DispatcherManagementReport: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { loads, employees, settlements } = useTMS();
  return (
    <MonthScopedReportShell
      title="Dispatcher Management Report"
      subtitle="Load volume and booked revenue by dispatcher"
      onBack={onBack}
    >
      {({ periodStart, periodEnd }) => {
        const periodLoads = loads.filter(l => {
          if (!isRevenueLoadStatus(l.status)) return false;
          const d = tryParseDateOnlyLocal(l.deliveryDate || l.pickupDate || '');
          if (!d) return false;
          return d >= periodStart && d <= periodEnd;
        });
        const accrued = calculateAccruedDispatcherCommission(periodLoads, settlements, employees);
        const byDisp: Record<string, { label: string; loads: number; revenue: number; commission: number }> = {};
        periodLoads.forEach(l => {
          const id = l.dispatcherId || 'unassigned';
          const emp = employees.find(e => e.id === l.dispatcherId);
          const label =
            (emp ? `${emp.firstName} ${emp.lastName}` : '') ||
            l.dispatcherName ||
            l.dispatcherId ||
            'Unassigned';
          if (!byDisp[id]) byDisp[id] = { label, loads: 0, revenue: 0, commission: 0 };
          byDisp[id].loads += 1;
          byDisp[id].revenue += getLoadRevenue(l);
          byDisp[id].commission += accrued.byLoadId[l.id] || 0;
        });
        const sorted = Object.entries(byDisp).sort((a, b) => b[1].revenue - a[1].revenue);
        return (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Dispatcher</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Loads</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No dispatcher activity this month</td></tr>
                ) : (
                  sorted.map(([dispId, data]) => (
                    <tr key={dispId}>
                      <td className="px-6 py-3 text-sm text-slate-900">{data.label}</td>
                      <td className="px-6 py-3 text-sm text-right">{data.loads}</td>
                      <td className="px-6 py-3 text-sm text-right">{fmtMoney(data.revenue)}</td>
                      <td className="px-6 py-3 text-sm text-right font-medium">{fmtMoney(data.commission)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );
      }}
    </MonthScopedReportShell>
  );
};

/** Month- or quarter-selectable operating expense report with category drill-down */
const PeriodExpensesReport: React.FC<{ filterType: string; title: string; scope?: 'month' | 'quarter' }> = ({
  filterType,
  title,
  scope = 'month',
}) => {
  const { expenses, trucks, drivers } = useTMS();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [truckFilter, setTruckFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const periodStart = scope === 'quarter'
    ? new Date(year, (quarter - 1) * 3, 1)
    : (() => { const [y, m] = month.split('-').map(Number); return new Date(y, m - 1, 1); })();
  const periodEnd = scope === 'quarter'
    ? new Date(year, quarter * 3, 0, 23, 59, 59, 999)
    : (() => { const [y, m] = month.split('-').map(Number); return new Date(y, m, 0, 23, 59, 59, 999); })();

  const periodKey = scope === 'quarter' ? `${year}-Q${quarter}` : month;

  const monthExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const d = tryParseDateOnlyLocal(exp.date || exp.createdAt || '');
      if (!d) return false;
      if (d < periodStart || d > periodEnd) return false;
      if (filterType === 'reefer_fuel') {
        const type = (exp.type || '').toLowerCase();
        const desc = (exp.description || '').toLowerCase();
        const cat = (exp.category || '').toLowerCase();
        const isReefer =
          type === 'reefer_fuel' ||
          type.includes('reefer') ||
          desc.includes('reefer') ||
          cat.includes('reefer');
        if (!isReefer) return false;
      } else if (filterType === 'maintenance') {
        const type = (exp.type || '').toLowerCase();
        const category = (exp.category || '').toLowerCase();
        const isMaint =
          type === 'maintenance' ||
          category === 'maintenance' ||
          type.includes('repair') ||
          category.includes('repair');
        if (!isMaint) return false;
      } else if (filterType !== 'all' && exp.type !== filterType) {
        return false;
      }
      if (truckFilter && exp.truckId !== truckFilter) return false;
      if (driverFilter && exp.driverId !== driverFilter) return false;
      return true;
    });
  }, [expenses, periodKey, filterType, truckFilter, driverFilter, periodStart, periodEnd]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    monthExpenses.forEach(e => {
      const cat = e.category || e.type || 'other';
      map[cat] = (map[cat] || 0) + (e.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthExpenses]);

  const total = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const drillRows = selectedCategory
    ? monthExpenses.filter(e => (e.category || e.type || 'other') === selectedCategory)
    : monthExpenses;

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setSelectedCategory(null);
  };

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="text-slate-500 text-sm">
            {scope === 'quarter' ? 'Quarterly operating expenses' : 'Month-by-month operating expenses'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scope === 'quarter' ? (
            <>
              <select value={quarter} onChange={e => { setQuarter(Number(e.target.value)); setSelectedCategory(null); }} className="px-3 py-2 border rounded-lg">
                <option value={1}>Q1 (Jan–Mar)</option>
                <option value={2}>Q2 (Apr–Jun)</option>
                <option value={3}>Q3 (Jul–Sep)</option>
                <option value={4}>Q4 (Oct–Dec)</option>
              </select>
              <select value={year} onChange={e => { setYear(Number(e.target.value)); setSelectedCategory(null); }} className="px-3 py-2 border rounded-lg">
                {Array.from({ length: 8 }, (_, i) => now.getFullYear() - 5 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <button type="button" onClick={() => shiftMonth(-1)} className="px-3 py-2 border rounded-lg">← Prev</button>
              <input type="month" value={month} onChange={e => { setMonth(e.target.value); setSelectedCategory(null); }} className="px-3 py-2 border rounded-lg" />
              <button type="button" onClick={() => shiftMonth(1)} className="px-3 py-2 border rounded-lg">Next →</button>
            </>
          )}
          <select value={truckFilter} onChange={e => setTruckFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">All trucks</option>
            {trucks.map(t => <option key={t.id} value={t.id}>{t.number || t.truckNumber}</option>)}
          </select>
          <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">All drivers</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <p className="text-sm text-slate-500 uppercase">{scope === 'quarter' ? 'Quarter total' : 'Month total'}</p>
        <p className="text-3xl font-bold text-slate-900">{fmt(total)}</p>
        <p className="text-sm text-slate-500 mt-1">{monthExpenses.length} expense(s)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-slate-800">By category (click to drill down)</div>
          <table className="w-full">
            <tbody>
              {byCategory.map(([cat, amt]) => (
                <tr
                  key={cat}
                  className={`border-b cursor-pointer hover:bg-slate-50 ${selectedCategory === cat ? 'bg-blue-50' : ''}`}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                >
                  <td className="px-4 py-3 capitalize">{cat}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(amt)}</td>
                </tr>
              ))}
              {byCategory.length === 0 && (
                <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={2}>No expenses this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-slate-800">
            {selectedCategory ? `Details: ${selectedCategory}` : 'All records'}
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {drillRows.map(e => (
                  <tr key={e.id} className="border-b">
                    <td className="px-3 py-2">{e.date?.split('T')[0]}</td>
                    <td className="px-3 py-2">{e.description}</td>
                    <td className="px-3 py-2 text-right">{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const MonthlyExpensesReport: React.FC<{ filterType: string; title: string }> = (props) => (
  <PeriodExpensesReport {...props} scope="month" />
);

// Company Overview Report Component
const CompanyOverviewReport: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const { loads, drivers, employees, settlements, expenses, factoringCompanies, invoices } = useTMS();
  const currentYear = new Date().getFullYear();

  const [startMonth, setStartMonth] = useState(1);
  const [startYear, setStartYear] = useState(currentYear - 1);
  const [endMonth, setEndMonth] = useState(1);
  const [endYear, setEndYear] = useState(currentYear);
  const [reportGenerated, setReportGenerated] = useState(false);

  // Generate years for dropdown (last 10 years to current year + 1)
  const years = Array.from({ length: 12 }, (_, i) => currentYear - 10 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // Calculate report data
  const reportData = useMemo(() => {
    if (!reportGenerated) return null;

    const periodStart = new Date(startYear, startMonth - 1, 1);
    const periodEnd = new Date(endYear, endMonth, 0); // Last day of end month
    periodEnd.setHours(23, 59, 59, 999);

    // Filter loads by period
    const filteredLoads = loads.filter(load => {
      const date = tryParseDateOnlyLocal(load.deliveryDate || load.pickupDate || '');
      if (!date) return false;
      return date >= periodStart && date <= periodEnd;
    });

    // Delivered through paid all count as revenue loads
    const revenueLoads = filteredLoads.filter(l => isRevenueLoadStatus(l.status));

    // Calculate revenue by driver type
    let companyDriverRevenue = 0;
    let ownerOperatorRevenue = 0;

    revenueLoads.forEach(load => {
      const grossAmount = getLoadRevenue(load);
      if (load.driverId) {
        const driver = drivers.find(d => d.id === load.driverId);
        if (driver) {
          const companyRevenue = calculateCompanyRevenue(grossAmount, driver);
          if (driver.type === 'OwnerOperator') {
            ownerOperatorRevenue += grossAmount;
          } else {
            companyDriverRevenue += companyRevenue;
          }
        } else {
          companyDriverRevenue += grossAmount;
        }
      } else {
        companyDriverRevenue += grossAmount;
      }
    });

    const totalRevenue = companyDriverRevenue + ownerOperatorRevenue;
    const totalMiles = revenueLoads.reduce((sum, l) => sum + getLoadMiles(l), 0);
    const loadsCompleted = revenueLoads.length;

    // Filter expenses by period
    const filteredExpenses = expenses.filter(expense => {
      const date = tryParseDateOnlyLocal(expense.date || expense.createdAt || '');
      if (!date) return false;
      return date >= periodStart && date <= periodEnd;
    });

    // Per-load accrual: settled line pay + estimates for unsettled loads
    const accrued = calculateAccruedDriverPay(revenueLoads, settlements, drivers);
    const totalDriverPay = accrued.total;
    const isEstimated = accrued.isEstimated;

    // Calculate company expenses (exclude rejected + O/O pass-through)
    const companyExpenses = filteredExpenses.filter(exp =>
      isCompanyRecognizedExpense(exp, drivers)
    );

    const totalExpenses = companyExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    const accruedDispatcher = calculateAccruedDispatcherCommission(
      revenueLoads,
      settlements,
      employees
    );
    const dispatcherCost = accruedDispatcher.total;

    // Factoring fees from loads + factored invoices
    const factoringExpenses = calculateFactoringFees(revenueLoads, invoices, factoringCompanies);

    const totalExpensesWithFees = totalExpenses + factoringExpenses + dispatcherCost;
    const netProfit = totalRevenue - totalExpensesWithFees - totalDriverPay;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;

    // Get unique customers and brokers
    const uniqueCustomers = new Set(revenueLoads.map(l => l.customerName).filter(Boolean));
    const uniqueDrivers = new Set(revenueLoads.map(l => l.driverId).filter(Boolean));

    return {
      periodStart,
      periodEnd,
      totalRevenue,
      totalMiles,
      loadsCompleted,
      totalDriverPay,
      isEstimated,
      dispatcherCost,
      dispatcherCostEstimated: accruedDispatcher.isEstimated,
      totalExpenses: totalExpensesWithFees,
      netProfit,
      profitMargin,
      uniqueCustomers: uniqueCustomers.size,
      activeDrivers: uniqueDrivers.size,
      avgRevenuePerLoad: loadsCompleted > 0 ? totalRevenue / loadsCompleted : 0,
      avgMilesPerLoad: loadsCompleted > 0 ? totalMiles / loadsCompleted : 0,
      revenuePerMile: totalMiles > 0 ? totalRevenue / totalMiles : 0,
    };
  }, [reportGenerated, startMonth, startYear, endMonth, endYear, loads, drivers, employees, settlements, expenses, factoringCompanies, invoices]);

  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleGenerateReport = () => {
    setReportGenerated(true);
  };

  if (!reportGenerated) {
    return (
      <div className="bg-slate-900 rounded-lg shadow-lg border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Report: Company Overview</h2>
        </div>
        <div className="p-6 space-y-6">
          {/* Start Date */}
          <div className="flex items-center gap-4">
            <label className="text-slate-300 w-24 text-right">Start Date <span className="text-red-400">*</span></label>
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 text-white rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={startYear}
              onChange={(e) => setStartYear(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 text-white rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* End Date */}
          <div className="flex items-center gap-4">
            <label className="text-slate-300 w-24 text-right">End Date <span className="text-red-400">*</span></label>
            <select
              value={endMonth}
              onChange={(e) => setEndMonth(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 text-white rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={endYear}
              onChange={(e) => setEndYear(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 text-white rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-4 pt-4 border-t border-slate-700">
            <button
              onClick={handleGenerateReport}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Generate Report
            </button>
            <span className="text-slate-400">or</span>
            <button
              onClick={onCancel}
              className="text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Report Generated - Show Results
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Company Overview Report</h2>
            <p className="text-slate-600 mt-1">
              {formatDate(reportData!.periodStart)} - {formatDate(reportData!.periodEnd)}
            </p>
          </div>
          <button
            onClick={() => setReportGenerated(false)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Change Date Range
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center text-white">
              <DollarSign className="w-6 h-6" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-500">Total Revenue</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(reportData!.totalRevenue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white">
              <MapPin className="w-6 h-6" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-500">Total Miles</p>
              <p className="text-2xl font-bold text-slate-900">{reportData!.totalMiles.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
              <Truck className="w-6 h-6" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-500">Loads Completed</p>
              <p className="text-2xl font-bold text-slate-900">{reportData!.loadsCompleted}</p>
            </div>
          </div>
        </div>

        <div className={`rounded-lg p-6 border shadow-sm ${
          reportData!.netProfit >= 0
            ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200'
            : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white ${
              reportData!.netProfit >= 0
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                : 'bg-gradient-to-br from-red-500 to-red-600'
            }`}>
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-500">Net Profit</p>
              <p className={`text-2xl font-bold ${reportData!.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatCurrency(reportData!.netProfit)}
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mt-2">{reportData!.profitMargin.toFixed(1)}% margin</p>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Summary */}
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Financial Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Total Revenue</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(reportData!.totalRevenue)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Total Expenses</span>
              <span className="font-semibold text-red-600">{formatCurrency(reportData!.totalExpenses)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Driver Pay {reportData!.isEstimated && <span className="text-xs text-yellow-600">(Est.)</span>}</span>
              <span className="font-semibold text-blue-600">{formatCurrency(reportData!.totalDriverPay)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-600">
                Dispatcher Commission
                {reportData!.dispatcherCostEstimated && <span className="text-xs text-yellow-600"> (Est.)</span>}
              </span>
              <span className="font-semibold text-blue-600">{formatCurrency(reportData!.dispatcherCost)}</span>
            </div>
            <div className="flex justify-between py-2 pt-4 border-t-2 border-slate-200">
              <span className="font-bold text-slate-900">Net Profit</span>
              <span className={`font-bold ${reportData!.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(reportData!.netProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* Operations Summary */}
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Operations Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Active Customers</span>
              <span className="font-semibold text-slate-900">{reportData!.uniqueCustomers}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Active Drivers</span>
              <span className="font-semibold text-slate-900">{reportData!.activeDrivers}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Avg Revenue/Load</span>
              <span className="font-semibold text-slate-900">{formatCurrency(reportData!.avgRevenuePerLoad)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Avg Miles/Load</span>
              <span className="font-semibold text-slate-900">{reportData!.avgMilesPerLoad.toFixed(0)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-600">Revenue/Mile</span>
              <span className="font-semibold text-slate-900">{formatCurrency(reportData!.revenuePerMile)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Profit & Loss Report Component - TruckingOffice Style
const ProfitLossReport: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const { loads, drivers, employees, settlements, expenses, factoringCompanies, invoices } = useTMS();
  const { companyProfile } = useCompany();

  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const toLocalDateInput = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const [beginDate, setBeginDate] = useState(toLocalDateInput(firstDayOfMonth));
  const [endDate, setEndDate] = useState(toLocalDateInput(lastDayOfMonth));
  const [reportGenerated, setReportGenerated] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  // Calculate report data
  const reportData = useMemo(() => {
    if (!reportGenerated) return null;

    const periodStart = parseDateOnlyLocal(beginDate);
    const periodEnd = parseDateOnlyLocal(endDate);
    if (periodStart > periodEnd) return null;
    periodEnd.setHours(23, 59, 59, 999);

    // Filter loads by period (delivered through paid)
    const filteredLoads = loads.filter(load => {
      const date = parseDateOnlyLocal(load.deliveryDate || load.pickupDate || '');
      return isRevenueLoadStatus(load.status) && date >= periodStart && date <= periodEnd;
    });

    // Calculate Income
    let primaryFees = 0;
    let fuelSurcharge = 0;
    let accessoryFees = 0;
    const otherRevenue = 0;

    filteredLoads.forEach(load => {
      primaryFees += load.rate || 0;
      fuelSurcharge += getLoadFsc(load);
      accessoryFees += getLoadAccessorials(load);
    });

    const totalRevenue = primaryFees + fuelSurcharge + accessoryFees + otherRevenue;
    const totalIncome = totalRevenue;

    // Company-recognized expenses in period (excludes rejected + O/O pass-through)
    const filteredExpenses = expenses.filter(expense => {
      if (!isCompanyRecognizedExpense(expense, drivers)) return false;
      const date = tryParseDateOnlyLocal(expense.date || expense.createdAt || '');
      if (!date) return false;
      return date >= periodStart && date <= periodEnd;
    });

    // Per-load accrual: settled line pay + estimates for unsettled loads
    const accrued = calculateAccruedDriverPay(filteredLoads, settlements, drivers);
    const driverExpenses = accrued.total;
    const isEstimated = accrued.isEstimated;

    // Calculate other operating expenses by canonical category (no overlap)
    const expensesByCategory: Record<string, number> = {};
    filteredExpenses.forEach(expense => {
      const category = formatExpenseCategoryLabel(
        normalizeExpenseCategory(expense.type, expense.category)
      );
      expensesByCategory[category] = (expensesByCategory[category] || 0) + (expense.amount || 0);
    });

    const accruedDispatcher = calculateAccruedDispatcherCommission(
      filteredLoads,
      settlements,
      employees
    );
    const dispatcherCost = accruedDispatcher.total;

    const factoringExpenses = calculateFactoringFees(filteredLoads, invoices, factoringCompanies);

    const operatingExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0);
    const totalExpenses = driverExpenses + operatingExpenses + dispatcherCost + factoringExpenses;
    const profitLoss = totalIncome - totalExpenses;

    return {
      periodStart,
      periodEnd,
      income: {
        primaryFees,
        fuelSurcharge,
        accessoryFees,
        totalRevenue,
        otherRevenue,
        totalIncome,
      },
      expenses: {
        drivers: driverExpenses,
        isEstimated,
        byCategory: expensesByCategory,
        dispatcher: dispatcherCost,
        dispatcherEstimated: accruedDispatcher.isEstimated,
        factoring: factoringExpenses,
        operating: operatingExpenses,
        total: totalExpenses,
      },
      profitLoss,
    };
  }, [reportGenerated, beginDate, endDate, loads, drivers, employees, settlements, expenses, factoringCompanies, invoices]);

  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateDisplay = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const handleGenerateReport = () => {
    const start = parseDateOnlyLocal(beginDate);
    const end = parseDateOnlyLocal(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setDateError('Enter valid begin and end dates.');
      return;
    }
    if (start > end) {
      setDateError('Begin date must be on or before end date.');
      return;
    }
    setDateError(null);
    setReportGenerated(true);
  };

  const handleRunAgain = () => {
    setReportGenerated(false);
    setDateError(null);
  };

  // Chart data for Revenue vs Expenses
  const chartData = reportData ? [
    { name: 'Revenue', value: reportData.income.totalRevenue, color: '#60A5FA' },
    { name: 'Expenses', value: reportData.expenses.total, color: '#93C5FD' }
  ] : [];

  if (!reportGenerated) {
    // Dark themed date picker form - TruckingOffice style
    return (
      <div className="bg-slate-900 rounded-lg shadow-lg border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Report: Profit & Loss</h2>
        </div>
        <div className="p-8 space-y-6">
          {/* Begin Date */}
          <div className="flex items-center justify-center gap-6">
            <label className="text-slate-300 w-28 text-right font-medium">Begin Date <span className="text-red-400">*</span></label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="date"
                value={beginDate}
                onChange={(e) => {
                  setBeginDate(e.target.value);
                  setDateError(null);
                }}
                className="bg-slate-800 border border-slate-600 text-white rounded-md pl-10 pr-4 py-3 w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="flex items-center justify-center gap-6">
            <label className="text-slate-300 w-28 text-right font-medium">End Date <span className="text-red-400">*</span></label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDateError(null);
                }}
                className="bg-slate-800 border border-slate-600 text-white rounded-md pl-10 pr-4 py-3 w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
              />
            </div>
          </div>

          {dateError && (
            <p className="text-center text-red-400 text-sm">{dateError}</p>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-center gap-4 pt-6">
            <button
              onClick={handleGenerateReport}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md font-medium flex items-center gap-2 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Generate Report
            </button>
            <span className="text-slate-400">or</span>
            <button
              onClick={onCancel}
              className="text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Report Generated - Show Results (TruckingOffice Style)
  return (
    <div className="bg-slate-900 min-h-full -m-6 p-6">
      {/* Action Buttons */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleRunAgain}
          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors border border-slate-600"
        >
          <RefreshCw className="w-4 h-4" />
          Run Report Again
        </button>
        <button
          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors border border-slate-600"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
        <button
          type="button"
          onClick={() => {
            if (!reportData) return;
            const rows: string[][] = [
              ['Section', 'Line', 'Amount'],
              ['Income', 'Primary Fees', String(reportData.income.primaryFees)],
              ['Income', 'Fuel Surcharge', String(reportData.income.fuelSurcharge)],
              ['Income', 'Accessory Fees', String(reportData.income.accessoryFees)],
              ['Income', 'Other Revenue', String(reportData.income.otherRevenue)],
              ['Income', 'Total Income', String(reportData.income.totalIncome)],
              [
                'Expense',
                reportData.expenses.isEstimated ? 'Drivers (Est.)' : 'Drivers',
                String(reportData.expenses.drivers),
              ],
              [
                'Expense',
                reportData.expenses.dispatcherEstimated
                  ? 'Dispatcher Commission (Estimated)'
                  : 'Dispatcher Commission',
                String(reportData.expenses.dispatcher),
              ],
              ['Expense', 'Factoring Fees', String(reportData.expenses.factoring)],
              ...Object.entries(reportData.expenses.byCategory).map(([cat, amt]) => [
                'Expense',
                cat,
                String(amt),
              ]),
              ['Expense', 'Total Expenses', String(reportData.expenses.total)],
              ['Profit', 'Profit / (Loss)', String(reportData.profitLoss)],
            ];
            const csv = rows
              .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
              .join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pnl-${beginDate}-to-${endDate}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors border border-slate-600"
        >
          <Download className="w-4 h-4" />
          Export Spreadsheet
        </button>
      </div>

      <div className="flex gap-8">
        {/* Left Side - Company Info and Tables */}
        <div className="flex-1">
          {/* Company Header */}
          <div className="mb-6">
            <div className="flex items-start gap-3 mb-2">
              <Building2 className="w-6 h-6 text-slate-400 mt-1" />
              <div>
                <h1 className="text-2xl font-bold text-white">{companyProfile?.companyName || 'Your Company'}</h1>
                {companyProfile?.address && (
                  <p className="text-slate-400">{companyProfile.address}</p>
                )}
                {(companyProfile?.city || companyProfile?.state || companyProfile?.zip) && (
                  <p className="text-slate-400">
                    {[companyProfile.city, companyProfile.state, companyProfile.zip].filter(Boolean).join(', ')}
                  </p>
                )}
                {companyProfile?.phone && (
                  <p className="text-slate-400 flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {companyProfile.phone}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Report Title and Period */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Profit & Loss Statement</h2>
            <p className="text-slate-400">
              Period: {formatDateDisplay(reportData!.periodStart)} - {formatDateDisplay(reportData!.periodEnd)}
            </p>
          </div>

          {/* Income Section */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-3">Income</h3>
            <table className="w-full max-w-2xl">
              <tbody className="text-white">
                <tr className="border-b border-slate-700">
                  <td className="py-2 px-4 bg-slate-800">Primary Fees</td>
                  <td className="py-2 px-4 bg-slate-800 text-right">{formatCurrency(reportData!.income.primaryFees)}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 px-4">Fuel Surcharge</td>
                  <td className="py-2 px-4 text-right">{formatCurrency(reportData!.income.fuelSurcharge)}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 px-4 bg-slate-800">Accessory Fees</td>
                  <td className="py-2 px-4 bg-slate-800 text-right">{formatCurrency(reportData!.income.accessoryFees)}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 px-4">Revenue</td>
                  <td className="py-2 px-4 text-right">{formatCurrency(reportData!.income.totalRevenue)}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 px-4 bg-slate-800">Other Revenue</td>
                  <td className="py-2 px-4 bg-slate-800 text-right">{formatCurrency(reportData!.income.otherRevenue)}</td>
                </tr>
                <tr className="border-b border-slate-600 bg-slate-800">
                  <td className="py-2 px-4 font-bold">Total Income</td>
                  <td className="py-2 px-4 text-right font-bold">{formatCurrency(reportData!.income.totalIncome)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Expenses Section */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-3">Expenses</h3>
            <table className="w-full max-w-2xl">
              <tbody className="text-white">
                <tr className="border-b border-slate-700">
                  <td className="py-2 px-4 bg-slate-800">
                    Drivers {reportData!.expenses.isEstimated && <span className="text-yellow-400 text-xs">(Est.)</span>}
                  </td>
                  <td className="py-2 px-4 bg-slate-800 text-right">{formatCurrency(reportData!.expenses.drivers)}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 px-4">
                    Dispatcher Commission
                    {reportData!.expenses.dispatcherEstimated && (
                      <span className="text-yellow-400 text-xs"> (Estimated)</span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-right">{formatCurrency(reportData!.expenses.dispatcher)}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 px-4 bg-slate-800">Factoring Fees</td>
                  <td className="py-2 px-4 bg-slate-800 text-right">{formatCurrency(reportData!.expenses.factoring)}</td>
                </tr>
                {Object.entries(reportData!.expenses.byCategory).map(([category, amount], index) => (
                  <tr key={category} className="border-b border-slate-700">
                    <td className={`py-2 px-4 ${index % 2 === 0 ? 'bg-slate-800' : ''}`}>{category}</td>
                    <td className={`py-2 px-4 text-right ${index % 2 === 0 ? 'bg-slate-800' : ''}`}>{formatCurrency(amount)}</td>
                  </tr>
                ))}
                <tr className="border-b border-slate-600 bg-slate-800">
                  <td className="py-2 px-4 font-bold">Total Expenses</td>
                  <td className="py-2 px-4 text-right font-bold">{formatCurrency(reportData!.expenses.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Profit / Loss */}
          <div className="mb-6">
            <table className="w-full max-w-2xl">
              <tbody className="text-white">
                <tr className={`border-2 ${reportData!.profitLoss >= 0 ? 'border-green-600 bg-green-900/20' : 'border-red-600 bg-red-900/20'}`}>
                  <td className="py-3 px-4 font-bold text-lg">Profit / (Loss)</td>
                  <td className={`py-3 px-4 text-right font-bold text-lg ${reportData!.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(reportData!.profitLoss)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side - Chart */}
        <div className="w-96">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" horizontal={true} vertical={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                  stroke="#94a3b8"
                  fontSize={12}
                  axisLine={{ stroke: '#475569' }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={12}
                  axisLine={{ stroke: '#475569' }}
                  width={80}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="text-center mt-2">
              <span className="text-slate-400 text-sm">Category</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type ReportCategory =
  | 'menu'
  | 'companyOverview'
  | 'tax'
  | 'profitLoss'
  | 'driverSettlements'
  | 'userSettlements'
  | 'carrierSettlements'
  | 'carrierPay'
  | 'dispatcherSettlements'
  | 'dispatcherManagement'
  | 'expenses'
  | 'fuelExpenses'
  | 'reeferFuelExpenses'
  | 'fuelVendor'
  | 'irpStateMiles'
  | 'quarterlyIFTA'
  | 'iftaAudit'
  | 'quarterlyMaintenance'
  | 'customerReport'
  | 'unitRevenue'
  | 'unitOperatingIncome'
  | 'milesPerGallon'
  | 'unitMiles'
  | 'legacyReports'
  | 'legacySettlements';

interface ReportItem {
  id: ReportCategory;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

const ReportsCombined: React.FC = () => {
  const [currentReport, setCurrentReport] = useState<ReportCategory>('menu');

  const reportItems: ReportItem[] = [
    // Financial Reports
    {
      id: 'companyOverview',
      label: 'Company Overview',
      description: 'Overall company performance metrics',
      icon: <Building2 className="w-5 h-5" />,
      category: 'Financial Reports',
    },
    {
      id: 'tax',
      label: 'Tax Report',
      description: 'Tax-related financial summary',
      icon: <FileText className="w-5 h-5" />,
      category: 'Financial Reports',
    },
    {
      id: 'profitLoss',
      label: 'Profit & Loss',
      description: 'Revenue, expenses, and profit analysis',
      icon: <TrendingUp className="w-5 h-5" />,
      category: 'Financial Reports',
    },
    {
      id: 'legacyReports',
      label: 'Analytics Dashboard',
      description: 'Detailed analytics and charts',
      icon: <BarChart3 className="w-5 h-5" />,
      category: 'Financial Reports',
    },

    // Settlement Reports
    {
      id: 'driverSettlements',
      label: 'Driver Settlements',
      description: 'Driver pay and settlement records',
      icon: <Users className="w-5 h-5" />,
      category: 'Settlement Reports',
    },
    {
      id: 'legacySettlements',
      label: 'Settlement Management',
      description: 'Create and manage all settlements',
      icon: <Calculator className="w-5 h-5" />,
      category: 'Settlement Reports',
    },
    {
      id: 'userSettlements',
      label: 'User Settlements',
      description: 'User payment settlements',
      icon: <Users className="w-5 h-5" />,
      category: 'Settlement Reports',
    },
    {
      id: 'carrierSettlements',
      label: 'Carrier Settlements',
      description: 'Carrier payment records',
      icon: <Truck className="w-5 h-5" />,
      category: 'Settlement Reports',
    },
    {
      id: 'carrierPay',
      label: 'Carrier Pay',
      description: 'Carrier payment summary',
      icon: <DollarSign className="w-5 h-5" />,
      category: 'Settlement Reports',
    },
    {
      id: 'dispatcherSettlements',
      label: 'Dispatcher Settlements',
      description: 'Dispatcher commission settlements',
      icon: <Users className="w-5 h-5" />,
      category: 'Settlement Reports',
    },
    {
      id: 'dispatcherManagement',
      label: 'Dispatcher Management Report',
      description: 'Dispatcher performance metrics',
      icon: <ClipboardList className="w-5 h-5" />,
      category: 'Settlement Reports',
    },

    // Expense Reports
    {
      id: 'expenses',
      label: 'Expenses',
      description: 'General expense reports',
      icon: <DollarSign className="w-5 h-5" />,
      category: 'Expense Reports',
    },
    {
      id: 'fuelExpenses',
      label: 'Fuel Expenses',
      description: 'Fuel cost analysis',
      icon: <Fuel className="w-5 h-5" />,
      category: 'Expense Reports',
    },
    {
      id: 'reeferFuelExpenses',
      label: 'Reefer Fuel Expenses',
      description: 'Refrigeration fuel costs',
      icon: <Fuel className="w-5 h-5" />,
      category: 'Expense Reports',
    },
    {
      id: 'fuelVendor',
      label: 'Fuel Vendor',
      description: 'Fuel vendor spending breakdown',
      icon: <Building2 className="w-5 h-5" />,
      category: 'Expense Reports',
    },

    // Compliance/IFTA Reports
    {
      id: 'irpStateMiles',
      label: 'IRP - State Miles',
      description: 'Miles traveled by state',
      icon: <MapPin className="w-5 h-5" />,
      category: 'Compliance/IFTA Reports',
    },
    {
      id: 'quarterlyIFTA',
      label: 'Quarterly IFTA',
      description: 'Quarterly fuel tax report',
      icon: <FileText className="w-5 h-5" />,
      category: 'Compliance/IFTA Reports',
    },
    {
      id: 'iftaAudit',
      label: 'IFTA Audit',
      description: 'IFTA audit documentation',
      icon: <ClipboardList className="w-5 h-5" />,
      category: 'Compliance/IFTA Reports',
    },

    // Maintenance Reports
    {
      id: 'quarterlyMaintenance',
      label: 'Quarterly Maintenance',
      description: 'Fleet maintenance summary',
      icon: <Wrench className="w-5 h-5" />,
      category: 'Maintenance Reports',
    },

    // Performance Reports
    {
      id: 'customerReport',
      label: 'Customer Report',
      description: 'Customer activity and revenue',
      icon: <Building2 className="w-5 h-5" />,
      category: 'Performance Reports',
    },
    {
      id: 'unitRevenue',
      label: 'Unit Revenue',
      description: 'Revenue per unit analysis',
      icon: <DollarSign className="w-5 h-5" />,
      category: 'Performance Reports',
    },
    {
      id: 'unitOperatingIncome',
      label: 'Unit Operating Income',
      description: 'Operating income by unit',
      icon: <TrendingUp className="w-5 h-5" />,
      category: 'Performance Reports',
    },
    {
      id: 'milesPerGallon',
      label: 'Miles per Gallon',
      description: 'Fuel efficiency analysis',
      icon: <PieChart className="w-5 h-5" />,
      category: 'Performance Reports',
    },
    {
      id: 'unitMiles',
      label: 'Unit Miles',
      description: 'Miles traveled by unit',
      icon: <MapPin className="w-5 h-5" />,
      category: 'Performance Reports',
    },
  ];

  const categories = [
    'Financial Reports',
    'Settlement Reports',
    'Expense Reports',
    'Compliance/IFTA Reports',
    'Maintenance Reports',
    'Performance Reports',
  ];

  const renderReport = () => {
    switch (currentReport) {
      case 'legacyReports':
        return (
          <Suspense fallback={<PageLoader />}>
            <ReportsPage />
          </Suspense>
        );
      case 'legacySettlements':
      case 'driverSettlements':
        return (
          <Suspense fallback={<PageLoader />}>
            <SettlementsPage />
          </Suspense>
        );
      case 'companyOverview':
        return <CompanyOverviewReport onCancel={() => setCurrentReport('menu')} />;
      case 'tax':
        return <TaxReport onBack={() => setCurrentReport('menu')} />;
      case 'profitLoss':
        return <ProfitLossReport onCancel={() => setCurrentReport('menu')} />;
      case 'userSettlements':
        return <UserSettlementsReport onBack={() => setCurrentReport('menu')} />;
      case 'carrierSettlements':
        return <CarrierSettlementsReport onBack={() => setCurrentReport('menu')} />;
      case 'carrierPay':
        return <CarrierPayReport onBack={() => setCurrentReport('menu')} />;
      case 'dispatcherSettlements':
        return <DispatcherSettlementsReport onBack={() => setCurrentReport('menu')} />;
      case 'dispatcherManagement':
        return <DispatcherManagementReport onBack={() => setCurrentReport('menu')} />;
      case 'expenses':
        return <MonthlyExpensesReport filterType="all" title="Expenses Report" />;
      case 'fuelExpenses':
        return <MonthlyExpensesReport filterType="fuel" title="Fuel Expenses" />;
      case 'reeferFuelExpenses':
        return <MonthlyExpensesReport filterType="reefer_fuel" title="Reefer Fuel Expenses" />;
      case 'fuelVendor':
        return <FuelVendorReport onBack={() => setCurrentReport('menu')} />;
      case 'irpStateMiles':
        return <StateMilesReport onBack={() => setCurrentReport('menu')} title="IRP - State Miles" />;
      case 'quarterlyIFTA':
        return (
          <StateMilesReport
            onBack={() => setCurrentReport('menu')}
            title="Quarterly IFTA"
            subtitle="State-allocated miles for the selected calendar quarter"
            scope="quarter"
          />
        );
      case 'iftaAudit':
        return (
          <StateMilesReport
            onBack={() => setCurrentReport('menu')}
            title="IFTA Audit"
            subtitle="State mile allocation worksheet for audit support"
          />
        );
      case 'quarterlyMaintenance':
        return <PeriodExpensesReport filterType="maintenance" title="Quarterly Maintenance" scope="quarter" />;
      case 'customerReport':
        return <CustomerAnalyticsReport onBack={() => setCurrentReport('menu')} />;
      case 'unitRevenue':
        return <UnitRevenueReport onBack={() => setCurrentReport('menu')} />;
      case 'unitOperatingIncome':
        return <UnitOperatingIncomeReport onBack={() => setCurrentReport('menu')} />;
      case 'milesPerGallon':
        return <MilesPerGallonReport onBack={() => setCurrentReport('menu')} />;
      case 'unitMiles':
        return <UnitMilesReport onBack={() => setCurrentReport('menu')} />;
      default:
        return null;
    }
  };

  if (currentReport !== 'menu') {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setCurrentReport('menu')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Reports
        </button>
        {renderReport()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600 mt-1">Access all reports and analytics in one place</p>
      </div>

      {/* Report Categories */}
      <div className="space-y-6">
        {categories.map((category) => {
          const categoryItems = reportItems.filter((item) => item.category === category);
          if (categoryItems.length === 0) return null;

          return (
            <div key={category} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{category}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-100">
                {categoryItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentReport(item.id)}
                    className="bg-white px-4 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600 flex-shrink-0">{item.icon}</div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{item.label}</p>
                      <p className="text-sm text-slate-500 truncate">{item.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReportsCombined;

import React, { useMemo, useState, useEffect } from 'react';
import { Plus, Download, Filter, Receipt, Fuel, Wrench, Shield, MapPin, DollarSign, FileText, Bed, MoreHorizontal, Edit, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useTMS } from '../context/TMSContext';
import { useTenant } from '../context/TenantContext';
import { Expense, Truck } from '../types';
import { downloadCSV } from '../services/exportService';
import { storage } from '../lib/firebase';
import {
  formatLocalDate,
  getTodayDateString,
  tryParseDateOnlyLocal,
} from '../utils/dateOnly';

/** Display expense dates as YYYY-MM-DD (never raw ISO timestamps). */
const formatExpenseDate = (raw?: string | null): string => {
  if (!raw) return '—';
  const parsed = tryParseDateOnlyLocal(raw);
  if (parsed) return formatLocalDate(parsed);
  // Fallback: strip time portion if present
  const datePart = String(raw).split('T')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : String(raw);
};
import {
  currentISOWeekKey,
  getDateOfISOWeek,
  getISOWeekParts,
  shiftISOWeekKey,
} from '../utils/isoWeek';

type ExpensePeriod =
  | 'current_week'
  | 'last_week'
  | 'current_month'
  | 'last_month'
  | 'select_month'
  | 'custom'
  | 'all_time';

const PAGE_SIZE = 50;

const Expenses: React.FC = () => {
  const { drivers, trucks, loads, expenses, addExpense, updateExpense, deleteExpense } = useTMS();
  const { activeTenantId } = useTenant();
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedLoadId, setSelectedLoadId] = useState<string>('');
  const [period, setPeriod] = useState<ExpensePeriod>('current_month');
  const MAX_EXPENSE_AMOUNT = 999_999.99;
  const MAX_DESCRIPTION_LENGTH = 500;
  const ALLOWED_RECEIPT_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
  ]);
  const [selectMonth, setSelectMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [page, setPage] = useState(1);
  
  // Form state
  const [formData, setFormData] = useState<Partial<Omit<Expense, 'id'>> & Pick<Expense, 'date'>>({
    date: getTodayDateString(),
    type: 'other',
    status: 'pending',
  });
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (_event: MouseEvent) => {
      if (openMenuId) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openMenuId]);

  const getTypeIcon = (type: Expense['type'] | undefined) => {
    const icons = {
      fuel: Fuel,
      maintenance: Wrench,
      insurance: Shield,
      toll: MapPin,
      lumper: DollarSign,
      permit: FileText,
      lodging: Bed,
      other: Receipt,
    };
    return icons[type || 'other'] || Receipt;
  };

  const getTypeColor = (type: Expense['type'] | undefined) => {
    const colors = {
      fuel: 'bg-blue-100 text-blue-700 border-blue-200',
      maintenance: 'bg-orange-100 text-orange-700 border-orange-200',
      insurance: 'bg-purple-100 text-purple-700 border-purple-200',
      toll: 'bg-green-100 text-green-700 border-green-200',
      lumper: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      permit: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      lodging: 'bg-pink-100 text-pink-700 border-pink-200',
      other: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return colors[type || 'other'] || colors.other;
  };

  const getStatusBadge = (status: Expense['status'] | undefined) => {
    const resolved = status || 'pending';
    const styles = {
      pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[resolved]}`}>
        {resolved.charAt(0).toUpperCase() + resolved.slice(1)}
      </span>
    );
  };

  const resolveTruckAssignment = (
    freeText: string,
    fleetTrucks: Truck[]
  ): { truckId?: string | null; truckNumber?: string | null } => {
    const trimmed = freeText.trim();
    if (!trimmed) return { truckId: null, truckNumber: null };

    const byId = fleetTrucks.find(t => t.id === trimmed);
    if (byId) {
      return {
        truckId: byId.id,
        truckNumber: byId.number || byId.truckNumber || trimmed,
      };
    }

    const byNumber = fleetTrucks.find(
      t => t.number === trimmed || t.truckNumber === trimmed
    );
    if (byNumber) {
      return {
        truckId: byNumber.id,
        truckNumber: byNumber.number || byNumber.truckNumber || trimmed,
      };
    }

    return { truckId: null, truckNumber: trimmed };
  };

  const buildAssignmentFields = () => {
    const driverName = selectedDriverId
      ? `${drivers.find(d => d.id === selectedDriverId)?.firstName || ''} ${drivers.find(d => d.id === selectedDriverId)?.lastName || ''}`.trim()
      : undefined;
    const truckFields = resolveTruckAssignment(selectedTruckId, trucks);
    return {
      driverId: selectedDriverId ? selectedDriverId : null,
      driverName: selectedDriverId ? driverName : null,
      loadId: selectedLoadId ? selectedLoadId : null,
      ...truckFields,
    };
  };

  const deleteFirebaseReceiptBestEffort = async (receipt?: string) => {
    if (!receipt?.startsWith('http')) return;
    try {
      const url = new URL(receipt);
      if (
        !url.hostname.endsWith('firebasestorage.googleapis.com')
        && !url.hostname.endsWith('firebasestorage.app')
      ) {
        return;
      }
      // Download URLs encode the object path after /o/
      const encodedPath = url.pathname.split('/o/')[1];
      if (!encodedPath) return;
      const objectPath = decodeURIComponent(encodedPath);
      await deleteObject(ref(storage, objectPath));
    } catch (error) {
      console.warn('Could not delete previous receipt from Firebase Storage:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      date: getTodayDateString(),
      type: 'other',
      status: 'pending',
      description: '',
      amount: undefined,
      receipt: undefined,
    });
    setSelectedDriverId('');
    setSelectedTruckId('');
    setSelectedLoadId('');
  };

  const periodBounds = useMemo((): { start: Date | null; end: Date | null; label: string } => {
    const now = new Date();
    const endOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(23, 59, 59, 999);
      return x;
    };
    const startOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };

    switch (period) {
      case 'current_week': {
        const { week, year } = getISOWeekParts(now);
        const start = startOfDay(getDateOfISOWeek(week, year));
        const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
        return { start, end, label: `Week ${year}-W${String(week).padStart(2, '0')}` };
      }
      case 'last_week': {
        const lastKey = shiftISOWeekKey(currentISOWeekKey(), -1);
        const [y, w] = lastKey.split('-W');
        const start = startOfDay(getDateOfISOWeek(parseInt(w, 10), parseInt(y, 10)));
        const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
        return { start, end, label: `Week ${lastKey}` };
      }
      case 'current_month': {
        const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
        const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        return { start, end, label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
      }
      case 'last_month': {
        const start = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
        return { start, end, label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
      }
      case 'select_month': {
        const [y, m] = selectMonth.split('-').map(Number);
        const start = startOfDay(new Date(y, m - 1, 1));
        const end = endOfDay(new Date(y, m, 0));
        return { start, end, label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
      }
      case 'custom': {
        const start = customStart ? tryParseDateOnlyLocal(customStart) : null;
        const endRaw = customEnd ? tryParseDateOnlyLocal(customEnd) : null;
        const end = endRaw ? endOfDay(endRaw) : null;
        return {
          start: start ? startOfDay(start) : null,
          end,
          label: start && end
            ? `${formatLocalDate(start)} → ${formatLocalDate(endRaw!)}`
            : 'Custom range',
        };
      }
      case 'all_time':
      default:
        return { start: null, end: null, label: 'All Time' };
    }
  }, [period, selectMonth, customStart, customEnd]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      if (filterType !== 'all' && expense.type !== filterType) return false;
      if (filterStatus !== 'all' && expense.status !== filterStatus) return false;

      if (periodBounds.start || periodBounds.end) {
        const expDate = tryParseDateOnlyLocal(expense.date || expense.createdAt || '');
        if (!expDate) return false;
        if (periodBounds.start && expDate < periodBounds.start) return false;
        if (periodBounds.end && expDate > periodBounds.end) return false;
      }
      return true;
    });
  }, [expenses, filterType, filterStatus, periodBounds]);

  useEffect(() => {
    setPage(1);
  }, [filterType, filterStatus, period, selectMonth, customStart, customEnd]);

  // Rejected expenses never count toward totals unless explicitly filtering rejected
  const totalAmount = filteredExpenses
    .filter(exp => filterStatus === 'rejected' || exp.status !== 'rejected')
    .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const pendingAmount = filteredExpenses
    .filter(e => e.status === 'pending')
    .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));
  const paginatedExpenses = filteredExpenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expense Tracking</h1>
          <p className="text-slate-500 mt-1">Track fuel, maintenance, lumper fees, and all receipts</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              const rows = [
                ['Date', 'Type', 'Description', 'Driver', 'Truck', 'Amount', 'Status', 'Vendor', 'Receipt'],
                ...filteredExpenses.map(e => [
                  formatExpenseDate(e.date || e.createdAt),
                  e.type || '',
                  (e.description || '').replace(/"/g, '""'),
                  e.driverName || '',
                  e.truckNumber || e.truckId || '',
                  String(e.amount ?? 0),
                  e.status || '',
                  e.vendor || '',
                  e.receipt || '',
                ]),
              ];
              const csv = rows
                .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                .join('\n');
              const periodSlug = periodBounds.label.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
              downloadCSV(csv, `expenses-${periodSlug || 'export'}-${getTodayDateString()}.csv`);
            }}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
          >
            <Download size={18} />
            <span>Export CSV</span>
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus size={18} />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Summary Cards — reflect selected period + filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <DollarSign size={24} />
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">Period Total</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          <p className="text-xs text-slate-500 mt-1">{periodBounds.label}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-yellow-100 text-yellow-600 p-3 rounded-lg">
              <Receipt size={24} />
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">Pending in Period</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-emerald-100 text-emerald-600 p-3 rounded-lg">
              <FileText size={24} />
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">Expense Count</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{filteredExpenses.length}</h3>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Period:</span>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as ExpensePeriod)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="current_week">Current Week</option>
            <option value="last_week">Last Week</option>
            <option value="current_month">Current Month</option>
            <option value="last_month">Last Month</option>
            <option value="select_month">Select Month</option>
            <option value="custom">Custom Date Range</option>
            <option value="all_time">All Time</option>
          </select>
          {period === 'select_month' && (
            <input
              type="month"
              value={selectMonth}
              onChange={(e) => setSelectMonth(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          {period === 'custom' && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-400 text-sm">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-slate-700">Type / Status:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="fuel">Fuel</option>
            <option value="maintenance">Maintenance</option>
            <option value="insurance">Insurance</option>
            <option value="toll">Tolls</option>
            <option value="lumper">Lumper Fees</option>
            <option value="permit">Permits</option>
            <option value="lodging">Lodging</option>
            <option value="other">Other</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Driver/Truck</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Receipt</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    No expenses found for {periodBounds.label}. Adjust the period or add a new expense.
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((expense) => {
                  const expenseType = expense.type || 'other';
                  const TypeIcon = getTypeIcon(expenseType);
                  return (
                    <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatExpenseDate(expense.date || expense.createdAt)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <TypeIcon size={18} className="text-slate-500" />
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getTypeColor(expenseType)}`}>
                            {expenseType.charAt(0).toUpperCase() + expenseType.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900 max-w-[240px]">
                        <span className="block truncate" title={expense.description}>
                          {(expense.description || '').length > 120
                            ? `${expense.description.slice(0, 120)}…`
                            : (expense.description || '—')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {expense.driverName || expense.truckNumber || expense.truckId || <span className="text-slate-400 italic">N/A</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-900">
                        ${expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(expense.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {expense.receipt ? (
                          expense.receipt.startsWith('http') ? (
                            <a
                              href={expense.receipt}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                              View Receipt
                            </a>
                          ) : (
                            <span className="text-slate-500 text-sm" title={expense.receipt}>
                              {expense.receipt}
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 text-sm">No receipt</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right relative">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === expense.id ? null : expense.id);
                          }}
                          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg relative"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {openMenuId === expense.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-10">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const expenseToEdit = expenses.find(e => e.id === expense.id);
                                if (expenseToEdit) {
                                  setFormData({
                                    date: expenseToEdit.date,
                                    type: expenseToEdit.type,
                                    description: expenseToEdit.description,
                                    amount: expenseToEdit.amount,
                                    status: expenseToEdit.status,
                                    receipt: expenseToEdit.receipt,
                                    category: expenseToEdit.category,
                                    vendor: expenseToEdit.vendor,
                                    paidBy: expenseToEdit.paidBy,
                                  });
                                  setSelectedDriverId(expenseToEdit.driverId || drivers.find(d => `${d.firstName} ${d.lastName}` === expenseToEdit.driverName)?.id || '');
                                  setSelectedTruckId(expenseToEdit.truckId || expenseToEdit.truckNumber || '');
                                  setSelectedLoadId(expenseToEdit.loadId || '');
                                  setEditingExpenseId(expenseToEdit.id);
                                  setIsEditModalOpen(true);
                                  setOpenMenuId(null);
                                }
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <Edit size={16} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const ok = window.confirm(
                                  `Delete this expense ($${Number(expense.amount || 0).toFixed(2)})?\n\n` +
                                    `This permanently removes a financial record and may change P&L.\n` +
                                    `Click OK to confirm deletion.`
                                );
                                if (!ok) return;
                                try {
                                  await deleteExpense(expense.id);
                                  await deleteFirebaseReceiptBestEffort(expense.receipt);
                                  setOpenMenuId(null);
                                } catch (err) {
                                  alert(
                                    err instanceof Error
                                      ? err.message
                                      : 'Failed to delete expense. Admin permission may be required.'
                                  );
                                }
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 size={16} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredExpenses.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-600">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredExpenses.length)} of {filteredExpenses.length}
              {' · '}
              {periodBounds.label}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-white flex items-center gap-1"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span className="text-sm text-slate-600">Page {page} / {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-white flex items-center gap-1"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Expense Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
          setEditingExpenseId(null);
        }}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
              <h2 className="text-lg font-semibold text-slate-900">{isEditModalOpen ? 'Edit Expense' : 'Add New Expense'}</h2>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                  setEditingExpenseId(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const amount = Number(formData.amount);
              if (!Number.isFinite(amount) || amount <= 0) {
                alert('Expense amount must be greater than zero.');
                return;
              }
              if (amount > MAX_EXPENSE_AMOUNT) {
                alert(`Expense amount cannot exceed $${MAX_EXPENSE_AMOUNT.toLocaleString()}.`);
                return;
              }
              const description = String(formData.description || '').trim();
              if (!description) {
                alert('Description is required.');
                return;
              }
              if (description.length > MAX_DESCRIPTION_LENGTH) {
                alert(`Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`);
                return;
              }
              const normalized = {
                ...formData,
                description,
                amount: Math.round(amount * 100) / 100,
                type: (formData.type || 'other') as Expense['type'],
                status: (formData.status || 'pending') as Expense['status'],
                category: formData.category || formData.type || 'other',
              };
              const assignment = buildAssignmentFields();
              try {
                if (isEditModalOpen && editingExpenseId) {
                  const previousReceipt = expenses.find(expense => expense.id === editingExpenseId)?.receipt;
                  await updateExpense(editingExpenseId, {
                    ...normalized,
                    ...assignment,
                  });
                  if (previousReceipt && previousReceipt !== normalized.receipt) {
                    await deleteFirebaseReceiptBestEffort(previousReceipt);
                  }
                  setIsEditModalOpen(false);
                  setEditingExpenseId(null);
                } else {
                  await addExpense({
                    ...normalized,
                    description,
                    ...assignment,
                  } as Expense);
                  setIsAddModalOpen(false);
                }
                resetForm();
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Failed to save expense.');
              }
            }} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Expense Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.type || 'other'}
                    onChange={(e) => {
                      const nextType = e.target.value as Expense['type'];
                      setFormData({ ...formData, type: nextType, category: nextType });
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="fuel">Fuel</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="insurance">Insurance</option>
                    <option value="toll">Tolls</option>
                    <option value="lumper">Lumper Fees</option>
                    <option value="permit">Permits</option>
                    <option value="lodging">Lodging</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value.slice(0, MAX_DESCRIPTION_LENGTH) })}
                  placeholder="Enter expense description..."
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {(formData.description || '').length}/{MAX_DESCRIPTION_LENGTH} characters
                </p>
              </div>

              {/* Driver/Truck/Load Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Driver
                  </label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => {
                      setSelectedDriverId(e.target.value);
                      setSelectedTruckId(''); // Clear truck when driver changes
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Driver (Optional)</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.firstName} {driver.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Truck ID
                  </label>
                  <input
                    type="text"
                    value={selectedTruckId}
                    onChange={(e) => setSelectedTruckId(e.target.value)}
                    placeholder="e.g., TRK-101"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Linked Load
                  </label>
                  <select
                    value={selectedLoadId}
                    onChange={(e) => setSelectedLoadId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">No load (optional)</option>
                    {loads
                      .slice()
                      .sort((a, b) => String(b.deliveryDate || b.pickupDate || '').localeCompare(String(a.deliveryDate || a.pickupDate || '')))
                      .slice(0, 300)
                      .map(load => (
                        <option key={load.id} value={load.id}>
                          {load.loadNumber} — {load.originCity || '?'}/{load.destCity || '?'}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Amount ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  max={MAX_EXPENSE_AMOUNT}
                  step="0.01"
                  value={formData.amount || ''}
                  onChange={(e) => {
                    const next = parseFloat(e.target.value);
                    if (!Number.isFinite(next)) {
                      setFormData({ ...formData, amount: 0 });
                      return;
                    }
                    setFormData({
                      ...formData,
                      amount: Math.min(MAX_EXPENSE_AMOUNT, Math.max(0, next)),
                    });
                  }}
                  placeholder="0.00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">Maximum ${MAX_EXPENSE_AMOUNT.toLocaleString()}</p>
              </div>

              {/* Receipt Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Receipt (Optional)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.pdf"
                  disabled={uploadingReceipt}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const mimeOk = ALLOWED_RECEIPT_TYPES.has(file.type)
                      || /\.(jpe?g|png|webp|gif|pdf)$/i.test(file.name);
                    if (!mimeOk || file.type === 'text/plain') {
                      alert('Only image (JPEG, PNG, WEBP, GIF) or PDF receipts are allowed.');
                      e.target.value = '';
                      return;
                    }
                    setUploadingReceipt(true);
                    try {
                      const tenant = activeTenantId || 'default';
                      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                      const path = `tenants/${tenant}/expenses/receipts/${Date.now()}_${safeName}`;
                      const storageRef = ref(storage, path);
                      await uploadBytes(storageRef, file, { contentType: file.type || 'application/octet-stream' });
                      const url = await getDownloadURL(storageRef);
                      setFormData({ ...formData, receipt: url });
                    } catch (err) {
                      console.error('Receipt upload failed:', err);
                      alert('Receipt upload failed. Please try again with an image or PDF.');
                      e.target.value = '';
                    } finally {
                      setUploadingReceipt(false);
                    }
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {uploadingReceipt
                    ? 'Uploading receipt…'
                    : formData.receipt?.startsWith('http')
                      ? 'Receipt uploaded to storage'
                      : 'Images or PDF only — other file types are rejected'}
                </p>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Status
                </label>
                <select
                    value={formData.status || 'pending'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Expense['status'] })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                    setEditingExpenseId(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-4 py-2 rounded-lg transition-colors"
                >
                  {isEditModalOpen ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;


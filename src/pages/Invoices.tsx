/**
 * Invoices Page - Enhanced with Tabs
 *
 * Tabs:
 * 1. Invoices - Create and manage invoices (Loads Not Invoiced → New Invoice → Invoice List)
 * 2. Factored Loads - View and manage factored loads with charts
 * 3. Factoring Companies - Manage factoring company relationships
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText, Plus, Search, ChevronLeft, ChevronRight,
  Check, X, Download, Edit, Trash2, MoreHorizontal,
  Building2, Package, Clock, CheckCircle,
  AlertTriangle, TrendingUp
} from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { useCompany } from '../context/CompanyContext';
import { useTenant } from '../context/TenantContext';
import { Invoice, InvoiceStatus, LoadStatus, Load, FactoringCompany, NewFactoringCompanyInput } from '../types';
import { generateUniqueInvoiceNumber } from '../services/invoiceService';
import { generateInvoicePDF } from '../services/invoicePDF';
import { useDebounce } from '../utils/debounce';
import { formatDateOnly, tryParseDateOnlyLocal } from '../utils/dateOnly';
import { FactoringCompanyAutocomplete } from '../components/FactoringCompanyAutocomplete';
import { getFactoredLoads } from '../services/businessLogic';
import { canInvoiceLoad } from '../services/documentService';
import {
  calculateTotalPaid,
  calculateOutstandingBalance,
  validatePayment,
} from '../services/paymentService';
import {
  buildMarkLoadFundedPatch,
  buildMarkLoadHeldPatch,
  deriveInvoiceFundingFromLoads,
  getLoadAllocatedFee,
  getLoadExpectedNet,
  getLoadFactoredAmount,
  getLoadFactoringStatus,
  getLoadFeePercent,
  isLoadFunded,
  isLoadHeld,
  summarizeFactoredLoads,
} from '../services/factoringFunding';
import type { FactoringFundingStatus } from '../types';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

type TabType = 'invoices' | 'factored' | 'companies';
type InvoiceViewType = 'loads-not-invoiced' | 'new-invoice' | 'invoice-list';

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (amount: number) => {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '-';
  // Date-only strings must use local parse to avoid Jul 31 → Jul 30 UTC shift
  return formatDateOnly(dateString, { month: 'short', day: 'numeric', year: 'numeric' });
};

/** Loads delivered in the last 45 days or in the current/previous calendar month. */
const isRecentDeliveredLoad = (load: Load): boolean => {
  const deliveredDate = load.deliveryDate || load.updatedAt;
  if (!deliveredDate) return false;
  const date = tryParseDateOnlyLocal(deliveredDate);
  if (!date) return false;
  const now = new Date();

  const fortyFiveDaysAgo = new Date(now);
  fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
  if (date >= fortyFiveDaysAgo) return true;

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const loadMonth = date.getMonth();
  const loadYear = date.getFullYear();

  return (
    (loadYear === currentYear && loadMonth === currentMonth)
    || (loadYear === prevYear && loadMonth === prevMonth)
  );
};

/** Prevent duplicate backfill factoring TX creation across effect re-runs. */
const backfillFactoringInFlight = new Set<string>();

// ============================================================================
// Loads Not Invoiced View
// ============================================================================

interface LoadsNotInvoicedProps {
  onCreateInvoice: (customerName: string, loadIds: string[]) => void;
  onViewInvoiceList: () => void;
}

const LoadsNotInvoiced: React.FC<LoadsNotInvoicedProps> = ({ onCreateInvoice, onViewInvoiceList }) => {
  const { loads, invoices } = useTMS();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Get delivered loads that are NOT invoiced
  const uninvoicedLoads = useMemo(() => {
    return loads.filter(load => {
      // Must be delivered or completed
      const isDelivered =
        load.status === LoadStatus.Delivered
        || load.status === LoadStatus.Completed
        || load.status === LoadStatus.DeliveredWithBOL;
      if (!isDelivered) return false;

      // Check if already invoiced via load's invoiceId
      if (load.invoiceId) return false;

      // Check if any invoice references this load
      const hasInvoice = invoices.some(inv =>
        inv.loadId === load.id || inv.loadIds?.includes(load.id)
      );
      if (hasInvoice) return false;

      return true;
    });
  }, [loads, invoices]);

  // Group by customer name
  const groupedByCustomer = useMemo(() => {
    const groups: Record<string, Load[]> = {};

    uninvoicedLoads.forEach(load => {
      const customerName = load.customerName || load.brokerName || 'Unknown Customer';
      if (!groups[customerName]) {
        groups[customerName] = [];
      }
      groups[customerName].push(load);
    });

    // Filter by search term
    if (debouncedSearchTerm) {
      const filtered: Record<string, Load[]> = {};
      Object.entries(groups).forEach(([customer, customerLoads]) => {
        if (customer.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) {
          filtered[customer] = customerLoads;
        }
      });
      return filtered;
    }

    return groups;
  }, [uninvoicedLoads, debouncedSearchTerm]);

  const customerCount = Object.keys(groupedByCustomer).length;
  const totalLoads = uninvoicedLoads.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Loads Not Invoiced</h2>
          <p className="text-slate-600 mt-1">
            {totalLoads} delivered, uninvoiced load{totalLoads !== 1 ? 's' : ''} from {customerCount} customer{customerCount !== 1 ? 's' : ''}. Totals include all uninvoiced loads.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onViewInvoiceList}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
          >
            <FileText size={18} />
            Invoice List
          </button>
          <button
            onClick={() => onCreateInvoice('', [])}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={18} />
            No Load Invoice
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Customer Groups Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <p className="px-4 py-3 text-xs text-slate-600 bg-blue-50 border-b border-blue-100">
          Create Invoice preselects delivered loads from the last 45 days or the current/previous calendar month. Older loads remain available unchecked on the invoice form.
        </p>
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Customer</th>
              <th className="text-center py-3 px-4 font-medium text-slate-700"># of Loads</th>
              <th className="text-right py-3 px-4 font-medium text-slate-700">Total Amount</th>
              <th className="text-right py-3 px-4 font-medium text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedByCustomer).length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-500">
                  <Package size={48} className="mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium">No loads ready for invoicing</p>
                  <p className="text-sm">Delivered loads will appear here when ready to invoice</p>
                </td>
              </tr>
            ) : (
              Object.entries(groupedByCustomer)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([customerName, customerLoads]) => {
                  const totalAmount = customerLoads.reduce((sum, load) => sum + (load.grandTotal || load.rate || 0), 0);
                  return (
                    <tr key={customerName} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Building2 size={20} className="text-blue-600" />
                          </div>
                          <span className="font-medium text-slate-900">{customerName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                          {customerLoads.length}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-slate-900">
                        {formatCurrency(totalAmount)}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => {
                            const recentIds = customerLoads
                              .filter(isRecentDeliveredLoad)
                              .map(l => l.id);
                            onCreateInvoice(customerName, recentIds);
                          }}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium flex items-center gap-2 ml-auto"
                        >
                          <Plus size={16} />
                          Create Invoice
                        </button>
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// New Invoice Form
// ============================================================================

interface NewInvoiceFormProps {
  customerName: string;
  preSelectedLoadIds: string[];
  onCancel: () => void;
  onSave: () => void;
}

const NewInvoiceForm: React.FC<NewInvoiceFormProps> = ({
  customerName: initialCustomerName,
  preSelectedLoadIds,
  onCancel,
  onSave,
}) => {
  const { loads, invoices, factoringCompanies, customers, addInvoice, addCustomer } = useTMS();
  const { activeTenantId } = useTenant();
  useCompany();
  const tenantId = activeTenantId || 'default';

  // Form state
  const [invoiceNumber] = useState(() => generateUniqueInvoiceNumber(tenantId, invoices));
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  });
  const [remitTo, setRemitTo] = useState('');
  const [remitSearch, setRemitSearch] = useState('');
  const [showRemitSuggestions, setShowRemitSuggestions] = useState(false);
  const [showCreateRemit, setShowCreateRemit] = useState(false);
  const [newRemitName, setNewRemitName] = useState('');
  const [newRemitAddress, setNewRemitAddress] = useState('');
  const [note, setNote] = useState('');
  const [selectedLoadIds, setSelectedLoadIds] = useState<string[]>(preSelectedLoadIds);
  const [showShippers, setShowShippers] = useState(false);
  const [showMiles, setShowMiles] = useState(false);

  // Factoring options
  const [isFactored, setIsFactored] = useState(false);
  const [selectedFactoringCompany, setSelectedFactoringCompany] = useState<FactoringCompany | null>(null);
  const [factoringFeePercent, setFactoringFeePercent] = useState(2.5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remitOptions = useMemo(() => {
    const fromFactor = factoringCompanies.map(fc => ({
      id: fc.id,
      label: fc.name,
      detail: [fc.address, fc.city, fc.state, fc.zipCode].filter(Boolean).join(', '),
      source: 'factoring' as const,
    }));
    const fromCustomers = customers
      .filter(c => c.isActive !== false && (c.name || '').trim())
      .map(c => ({
        id: c.id,
        label: c.name.trim(),
        detail: [c.address, c.city, c.state, c.zipCode].filter(Boolean).join(', ')
          || (c.type ? `${c.type}` : 'Customer'),
        source: 'customer' as const,
      }));
    const fromLoads = Array.from(
      new Set(
        loads
          .map(l => (l.customerName || l.brokerName || '').trim())
          .filter(Boolean)
      )
    ).map((name, idx) => ({
      id: `load-cust-${idx}-${name}`,
      label: name,
      detail: 'From loads',
      source: 'customer' as const,
    }));
    // Prefer address-book customers; dedupe by lowercase name
    const seen = new Set<string>();
    const merged: Array<{
      id: string;
      label: string;
      detail: string;
      source: 'factoring' | 'customer';
    }> = [];
    for (const opt of [...fromFactor, ...fromCustomers, ...fromLoads]) {
      const key = opt.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(opt);
    }
    return merged;
  }, [factoringCompanies, customers, loads]);

  const filteredRemitOptions = useMemo(() => {
    const q = (remitSearch || remitTo).trim().toLowerCase();
    if (!q) return remitOptions.slice(0, 12);
    return remitOptions
      .filter(o =>
        o.label.toLowerCase().includes(q)
        || o.detail.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [remitOptions, remitSearch, remitTo]);

  const applyRemitSelection = (
    label: string,
    detail?: string,
    source?: 'factoring' | 'customer',
    optionId?: string
  ) => {
    setRemitTo(detail ? `${label} — ${detail}` : label);
    setRemitSearch('');
    setShowRemitSuggestions(false);
    setShowCreateRemit(false);
    // Selecting a factoring company as Remit To should factor the invoice
    if (source === 'factoring' && optionId) {
      const company = factoringCompanies.find(fc => fc.id === optionId);
      if (company) {
        setIsFactored(true);
        setSelectedFactoringCompany(company);
        if (company.feePercentage) setFactoringFeePercent(company.feePercentage);
      }
    }
  };

  const handleCreateRemitTo = () => {
    const name = newRemitName.trim();
    if (!name) {
      alert('Remit-to name is required.');
      return;
    }
    const address = newRemitAddress.trim();
    try {
      addCustomer({
        name,
        type: 'customer',
        address: address || undefined,
        notes: 'Created from Remit To',
        isActive: true,
      } as any);
    } catch (err) {
      // Still apply to the field even if save fails (e.g. duplicate)
      console.warn('Remit customer save:', err);
    }
    applyRemitSelection(name, address || undefined);
    setNewRemitName('');
    setNewRemitAddress('');
  };

  // Get uninvoiced loads for this customer
  const customerLoads = useMemo(() => {
    return loads.filter(load => {
      const isDelivered =
        load.status === LoadStatus.Delivered
        || load.status === LoadStatus.Completed
        || load.status === LoadStatus.DeliveredWithBOL;
      if (!isDelivered) return false;
      if (load.invoiceId) return false;
      const hasInvoice = invoices.some(inv => inv.loadId === load.id || inv.loadIds?.includes(load.id));
      if (hasInvoice) return false;

      // If customer name provided, filter by it
      if (initialCustomerName) {
        const loadCustomer = load.customerName || load.brokerName || '';
        return loadCustomer === initialCustomerName;
      }
      return true;
    });
  }, [loads, invoices, initialCustomerName]);

  const handleLoadToggle = (loadId: string) => {
    setSelectedLoadIds(prev =>
      prev.includes(loadId) ? prev.filter(id => id !== loadId) : [...prev, loadId]
    );
  };

  const handleSelectAll = () => {
    setSelectedLoadIds(customerLoads.map(l => l.id));
  };

  const handleDeselectAll = () => {
    setSelectedLoadIds([]);
  };

  const selectedLoads = customerLoads.filter(l => selectedLoadIds.includes(l.id));
  const totalAmount = selectedLoads.reduce((sum, load) => sum + (load.grandTotal || load.rate || 0), 0);
  const factoringFee = isFactored ? totalAmount * (factoringFeePercent / 100) : 0;
  const netAmount = totalAmount - factoringFee;

  const allowNoLoadInvoice = !initialCustomerName && preSelectedLoadIds.length === 0;

  const handleCreateInvoice = async () => {
    if (isSubmitting) return;
    if (selectedLoadIds.length === 0 && !allowNoLoadInvoice) {
      alert('Please select at least one load to invoice');
      return;
    }
    if (selectedLoadIds.length === 0 && allowNoLoadInvoice) {
      const customer = window.prompt('Customer / broker name for this no-load invoice:');
      if (!customer?.trim()) {
        alert('Customer name is required for a no-load invoice.');
        return;
      }
      const amountRaw = window.prompt('Invoice amount (USD):');
      const amount = Number(amountRaw);
      if (!Number.isFinite(amount) || amount <= 0) {
        alert('Enter a valid invoice amount greater than 0.');
        return;
      }
      setIsSubmitting(true);
      try {
        const finalInvoiceNumber = (customInvoiceNumber || invoiceNumber).trim();
        await addInvoice({
          invoiceNumber: finalInvoiceNumber,
          customerName: customer.trim(),
          amount,
          status: 'pending',
          date: invoiceDate,
          dueDate,
          loadIds: [],
          notes: note || undefined,
          remitTo: remitTo.trim() || undefined,
          isFactored: false,
        } as any);
        onSave();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to create invoice.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const checks = selectedLoads.map(load => ({ load, check: canInvoiceLoad(load) }));
    const blocked = checks.filter(x => !x.check.canInvoice);
    if (blocked.length > 0) {
      alert(
        `Cannot invoice — missing requirements:\n` +
          blocked
            .slice(0, 8)
            .map(x => `• ${x.load.loadNumber}: ${x.check.reason}`)
            .join('\n') +
          (blocked.length > 8 ? `\n…and ${blocked.length - 8} more` : '')
      );
      return;
    }
    const warnings = checks.filter(x => x.check.canInvoice && x.check.reason);
    if (warnings.length > 0) {
      const ok = window.confirm(
        `Warning — paperwork incomplete:\n` +
          warnings
            .slice(0, 8)
            .map(x => `• ${x.load.loadNumber}: ${x.check.reason}`)
            .join('\n') +
          (warnings.length > 8 ? `\n…and ${warnings.length - 8} more` : '') +
          `\n\nCreate invoice anyway?`
      );
      if (!ok) return;
    }

    const finalInvoiceNumber = (customInvoiceNumber || invoiceNumber).trim();
    const duplicate = invoices.some(
      inv => inv.invoiceNumber?.trim().toLowerCase() === finalInvoiceNumber.toLowerCase()
    );
    if (duplicate) {
      alert(`Invoice number "${finalInvoiceNumber}" already exists. Please use a unique invoice number.`);
      return;
    }

    if (isFactored && !selectedFactoringCompany) {
      alert('Select a factoring company (or pick one from Remit To) before creating a factored invoice.');
      return;
    }

    const customerName = selectedLoads[0]?.customerName || selectedLoads[0]?.brokerName || initialCustomerName || 'Unknown';

    // Create the invoice
    const newInvoice: Omit<Invoice, 'id'> = {
      invoiceNumber: finalInvoiceNumber,
      customerName: customerName,
      brokerName: customerName,
      loadIds: selectedLoadIds,
      amount: totalAmount,
      status: 'pending',
      date: invoiceDate,
      dueDate: dueDate,
      notes: note,
      remitTo: remitTo.trim() || undefined,
      createdAt: new Date().toISOString(),
      isFactored: isFactored,
      factoringCompanyId: selectedFactoringCompany?.id,
      factoringCompanyName: selectedFactoringCompany?.name,
      factoredDate: isFactored ? invoiceDate : undefined,
      factoringFeePercent: isFactored ? factoringFeePercent : undefined,
      factoringFee: isFactored ? factoringFee : undefined,
      netFundedAmount: isFactored ? netAmount : undefined,
      fundingStatus: isFactored ? 'submitted' : undefined,
    };

    setIsSubmitting(true);
    try {
      // addInvoice atomically creates the invoice and links real invoiceId on loads.
      // Do NOT overwrite invoiceId with "pending" afterward — that corrupts the link.
      const created = await addInvoice(newInvoice);
      if (!created?.id) {
        throw new Error('Invoice was not created. Check whether the load is already invoiced.');
      }
      onSave();
    } catch (error: any) {
      alert(error?.message || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onCancel}
          className="p-2 hover:bg-slate-100 rounded-lg"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900">New Invoice</h2>
          {initialCustomerName && (
            <p className="text-lg text-blue-600 font-medium mt-1">{initialCustomerName}</p>
          )}
        </div>
      </div>

      {/* Invoice Details Form */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Invoice Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={invoiceNumber}
              disabled
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Custom Invoice Number
            </label>
            <input
              type="text"
              value={customInvoiceNumber}
              onChange={(e) => setCustomInvoiceNumber(e.target.value)}
              placeholder="Override system number"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Invoice Date
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Remit To
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={remitTo}
                onChange={(e) => {
                  setRemitTo(e.target.value);
                  setRemitSearch(e.target.value);
                  setShowRemitSuggestions(true);
                  setShowCreateRemit(false);
                }}
                onFocus={() => setShowRemitSuggestions(true)}
                placeholder="Search factoring company or customer..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  setShowCreateRemit(true);
                  setShowRemitSuggestions(false);
                  setNewRemitName(remitTo.includes('—') ? remitTo.split('—')[0].trim() : remitTo.trim());
                }}
                className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm whitespace-nowrap"
              >
                + Create Remit To
              </button>
            </div>
            {showCreateRemit && (
              <div className="mt-2 p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                <input
                  type="text"
                  value={newRemitName}
                  onChange={(e) => setNewRemitName(e.target.value)}
                  placeholder="Remit-to name *"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  autoFocus
                />
                <input
                  type="text"
                  value={newRemitAddress}
                  onChange={(e) => setNewRemitAddress(e.target.value)}
                  placeholder="Address (optional)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreateRemit(false)}
                    className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateRemitTo}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save Remit To
                  </button>
                </div>
              </div>
            )}
            {showRemitSuggestions && !showCreateRemit && filteredRemitOptions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                {filteredRemitOptions.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                    onClick={() =>
                      applyRemitSelection(
                        opt.label,
                        opt.detail || undefined,
                        opt.source,
                        opt.id
                      )
                    }
                  >
                    <div className="text-sm font-medium text-slate-900">{opt.label}</div>
                    <div className="text-xs text-slate-500">{opt.detail || opt.source}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="md:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Factoring Options */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Factoring Options</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFactored}
                  onChange={(e) => setIsFactored(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Factor this invoice</span>
              </label>
            </div>
            {isFactored && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Factoring Company</label>
                  <select
                    value={selectedFactoringCompany?.id || ''}
                    onChange={(e) => {
                      const company = factoringCompanies.find(fc => fc.id === e.target.value);
                      setSelectedFactoringCompany(company || null);
                      if (company?.feePercentage) {
                        setFactoringFeePercent(company.feePercentage);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select factoring company...</option>
                    {factoringCompanies.map(company => (
                      <option key={company.id} value={company.id}>{company.name} ({company.feePercentage || 2.5}%)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fee Percentage</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={factoringFeePercent}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        if (!Number.isFinite(n)) {
                          setFactoringFeePercent(0);
                          return;
                        }
                        setFactoringFeePercent(Math.min(100, Math.max(0, n)));
                      }}
                      min={0}
                      max={100}
                      step="0.1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500">%</span>
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Remit-To Address Display (TruckingOffice style) */}
          {isFactored && selectedFactoringCompany && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Building2 size={20} className="text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 text-sm uppercase">Remit Payment To:</p>
                  <p className="font-medium text-slate-900 mt-1">{selectedFactoringCompany.name}</p>
                  {selectedFactoringCompany.address && (
                    <p className="text-sm text-slate-600">{selectedFactoringCompany.address}</p>
                  )}
                  {(selectedFactoringCompany.city || selectedFactoringCompany.state || selectedFactoringCompany.zipCode) && (
                    <p className="text-sm text-slate-600">
                      {[selectedFactoringCompany.city, selectedFactoringCompany.state, selectedFactoringCompany.zipCode].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {selectedFactoringCompany.phone && (
                    <p className="text-sm text-slate-500 mt-1">Phone: {selectedFactoringCompany.phone}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          {isFactored && totalAmount > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-600">Gross Amount:</span>
                  <span className="ml-2 font-semibold">{formatCurrency(totalAmount)}</span>
                </div>
                <div>
                  <span className="text-slate-600">Factoring Fee ({factoringFeePercent}%):</span>
                  <span className="ml-2 font-semibold text-amber-600">-{formatCurrency(factoringFee)}</span>
                </div>
                <div>
                  <span className="text-slate-600">Net Amount:</span>
                  <span className="ml-2 font-semibold text-green-600">{formatCurrency(netAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Uninvoiced Loads Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Uninvoiced Loads</h3>
            <p className="text-sm text-slate-600">Check the boxes next to the loads you want included in the invoice.</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-600">{selectedLoadIds.length} selected</div>
            <div className="text-lg font-semibold text-slate-900">{formatCurrency(totalAmount)}</div>
          </div>
        </div>

        {/* Bulk Selection */}
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-200">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
          >
            <Check size={16} />
            Check all on this page
          </button>
          <button
            onClick={handleDeselectAll}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
          >
            <X size={16} />
            Uncheck all on this page
          </button>
        </div>

        {/* Loads Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-2 px-3 text-left w-10"></th>
                <th className="py-2 px-3 text-left font-medium text-slate-700">Load#</th>
                <th className="py-2 px-3 text-left font-medium text-slate-700">Pickup</th>
                <th className="py-2 px-3 text-left font-medium text-slate-700">Delivery</th>
                <th className="py-2 px-3 text-left font-medium text-slate-700">From</th>
                <th className="py-2 px-3 text-left font-medium text-slate-700">To</th>
                <th className="py-2 px-3 text-left font-medium text-slate-700">BOL</th>
                <th className="py-2 px-3 text-right font-medium text-slate-700">Miles</th>
                <th className="py-2 px-3 text-right font-medium text-slate-700">Rate</th>
                <th className="py-2 px-3 text-right font-medium text-slate-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {customerLoads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No uninvoiced loads found for this customer
                  </td>
                </tr>
              ) : (
                customerLoads.map(load => (
                  <tr
                    key={load.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 ${selectedLoadIds.includes(load.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        checked={selectedLoadIds.includes(load.id)}
                        onChange={() => handleLoadToggle(load.id)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">{load.loadNumber}</td>
                    <td className="py-3 px-3">{formatDate(load.pickupDate)}</td>
                    <td className="py-3 px-3">{formatDate(load.deliveryDate)}</td>
                    <td className="py-3 px-3">{load.originCity}, {load.originState}</td>
                    <td className="py-3 px-3">{load.destCity}, {load.destState}</td>
                    <td className="py-3 px-3">{load.bolNumber || '-'}</td>
                    <td className="py-3 px-3 text-right">{load.miles?.toLocaleString() || '-'}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(load.rate || 0)}</td>
                    <td className="py-3 px-3 text-right font-medium">{formatCurrency(load.grandTotal || load.rate || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Options */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-200">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showShippers}
              onChange={(e) => setShowShippers(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            Add Shippers / Consignees to Invoice
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showMiles}
              onChange={(e) => setShowMiles(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            Show Miles on Invoice
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleCreateInvoice}
          disabled={(!allowNoLoadInvoice && selectedLoadIds.length === 0) || isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium"
        >
          {isSubmitting ? 'Creating…' : allowNoLoadInvoice && selectedLoadIds.length === 0 ? 'Create No-Load Invoice' : 'Create Invoice'}
        </button>
        <button
          onClick={onCancel}
          className="text-red-600 hover:text-red-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Payment Modal - TruckingOffice Style
// ============================================================================

interface PaymentModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSave: (paymentData: {
    amount: number;
    method: string;
    reference: string;
    date: string;
  }) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ invoice, onClose, onSave }) => {
  const totalPaid = calculateTotalPaid(invoice);
  const balanceDue = calculateOutstandingBalance(invoice);

  const [amount, setAmount] = useState(balanceDue.toFixed(2));
  const [method, setMethod] = useState<string>('ACH');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = () => {
    const paymentAmount = parseFloat(amount);
    const validation = validatePayment(invoice, paymentAmount);
    if (!validation.valid) {
      alert(validation.error || 'Invalid payment amount');
      return;
    }
    onSave({ amount: paymentAmount, method, reference, date });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Record Payment</h3>
            <p className="text-sm text-slate-600">Invoice #{invoice.invoiceNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-500 uppercase">Invoice Total</p>
              <p className="text-lg font-semibold text-slate-900">{formatCurrency(invoice.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Already Paid</p>
              <p className="text-lg font-semibold text-emerald-600">{formatCurrency(totalPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Balance Due</p>
              <p className="text-lg font-semibold text-red-600">{formatCurrency(balanceDue)}</p>
            </div>
          </div>
        </div>

        {/* Payment History */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="px-6 py-3 border-b border-slate-200 max-h-32 overflow-y-auto">
            <p className="text-xs font-medium text-slate-500 uppercase mb-2">Payment History</p>
            {invoice.payments.map((payment, idx) => (
              <div key={payment.id || idx} className="flex justify-between text-sm py-1">
                <span className="text-slate-600">
                  {formatDate(payment.date)} - {payment.method}
                  {payment.reference && <span className="text-slate-400"> ({payment.reference})</span>}
                </span>
                <span className="font-medium text-emerald-600">{formatCurrency(payment.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method *</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ACH">ACH Transfer</option>
              <option value="Check">Check</option>
              <option value="Wire">Wire Transfer</option>
              <option value="Credit">Credit Card</option>
              <option value="Factoring">Factoring Payment</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reference # (optional)</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Check #, Transaction ID, etc."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
          >
            <Check size={18} />
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Invoice List View
// ============================================================================

interface InvoiceListProps {
  onBack: () => void;
}

const InvoiceList: React.FC<InvoiceListProps> = ({ onBack }) => {
  const { invoices, loads, factoringCompanies, factoringTransactions, deleteInvoice, updateInvoice, updateLoad, updateFactoringTransaction, addFactoringTransaction, recordInvoicePayment } = useTMS();
  const { companyProfile } = useCompany();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [factoredFilter, setFactoredFilter] = useState<'all' | 'factored' | 'not_factored'>('all');
  const [factoringCompanyFilter, setFactoringCompanyFilter] = useState('');
  const [fundingStatusFilter, setFundingStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const itemsPerPage = 10;

  // Backfill factoring transactions for older factored invoices
  useEffect(() => {
    invoices.forEach(inv => {
      if (!inv.isFactored) return;
      if (factoringTransactions.some(t => t.invoiceId === inv.id)) return;
      if (backfillFactoringInFlight.has(inv.id)) return;
      backfillFactoringInFlight.add(inv.id);
      const feePct = inv.factoringFeePercent || 2.5;
      const fee = inv.factoringFee ?? (inv.amount * (feePct / 100));
      void (async () => {
        try {
          // addFactoringTransaction derives the deterministic ftx_<invoiceId> document ID.
          await addFactoringTransaction({
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            factoringCompanyId: inv.factoringCompanyId,
            factoringCompanyName: inv.factoringCompanyName,
            loadIds: inv.loadIds || (inv.loadId ? [inv.loadId] : []),
            grossAmount: inv.amount,
            feePercentage: feePct,
            feeAmount: fee,
            netFundedAmount: inv.netFundedAmount ?? (inv.amount - fee),
            submittedDate: inv.factoredDate || inv.date,
            fundingStatus: (inv.fundingStatus as FactoringFundingStatus) || 'submitted',
            recourseStatus: 'none',
          });
        } catch (error) {
          console.error(`Failed to backfill factoring transaction for invoice ${inv.id}:`, error);
        } finally {
          backfillFactoringInFlight.delete(inv.id);
        }
      })();
    });
  }, [invoices, factoringTransactions, addFactoringTransaction]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && !(event.target as Element).closest('.menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  // Filter invoices (monthly + factoring reporting controls)
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const matchesStatus = !statusFilter || invoice.status === statusFilter;
      const matchesSearch = !debouncedSearchTerm ||
        invoice.invoiceNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        invoice.customerName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        invoice.brokerName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      if (!matchesStatus || !matchesSearch) return false;

      if (factoredFilter === 'factored' && !invoice.isFactored) return false;
      if (factoredFilter === 'not_factored' && invoice.isFactored) return false;
      if (factoringCompanyFilter && invoice.factoringCompanyId !== factoringCompanyFilter) return false;
      if (fundingStatusFilter && (invoice.fundingStatus || 'not_submitted') !== fundingStatusFilter) return false;
      if (customerFilter && (invoice.customerName || '') !== customerFilter) return false;

      const invDate = tryParseDateOnlyLocal(invoice.date || invoice.createdAt || '');
      if (!invDate) return false;
      if (monthFilter) {
        const [y, m] = monthFilter.split('-').map(Number);
        if (invDate.getFullYear() !== y || invDate.getMonth() !== m - 1) return false;
      }
      const from = dateFrom ? tryParseDateOnlyLocal(dateFrom) : null;
      if (dateFrom && (!from || invDate < from)) return false;
      if (dateTo) {
        const to = tryParseDateOnlyLocal(dateTo);
        if (!to) return false;
        to.setHours(23, 59, 59, 999);
        if (invDate > to) return false;
      }
      if (dueFrom || dueTo) {
        if (!invoice.dueDate) return false;
        const due = tryParseDateOnlyLocal(invoice.dueDate);
        if (!due) return false;
        const dueStart = dueFrom ? tryParseDateOnlyLocal(dueFrom) : null;
        if (dueFrom && (!dueStart || due < dueStart)) return false;
        if (dueTo) {
          const to = tryParseDateOnlyLocal(dueTo);
          if (!to) return false;
          to.setHours(23, 59, 59, 999);
          if (due > to) return false;
        }
      }
      return true;
    });
  }, [invoices, statusFilter, debouncedSearchTerm, factoredFilter, factoringCompanyFilter, fundingStatusFilter, customerFilter, monthFilter, dateFrom, dateTo, dueFrom, dueTo]);

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(start, start + itemsPerPage);
  }, [filteredInvoices, currentPage]);

  // Stats — include partial + draft so summary matches the invoice list
  const stats = useMemo(() => {
    const pending = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + (i.amount || 0), 0);
    const partial = invoices.filter(i => i.status === 'partial').reduce((sum, i) => sum + (i.amount || 0), 0);
    const draft = invoices.filter(i => i.status === 'draft').reduce((sum, i) => sum + (i.amount || 0), 0);
    const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount || 0), 0);
    const overdue = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (i.amount || 0), 0);
    return {
      pending: pending + partial,
      partial,
      draft,
      paid,
      overdue,
      total: pending + partial + draft + paid + overdue,
    };
  }, [invoices]);

  const getStatusBadge = (status: InvoiceStatus) => {
    const styles: Record<InvoiceStatus, string> = {
      pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      partial: 'bg-blue-50 text-blue-700 border-blue-200',
      overdue: 'bg-red-50 text-red-700 border-red-200',
      draft: 'bg-slate-50 text-slate-700 border-slate-200',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const handleMarkAsPaid = (invoice: Invoice) => {
    setPaymentModalInvoice(invoice);
    setOpenMenuId(null);
  };

  const handlePaymentSave = async (paymentData: { amount: number; method: string; reference: string; date: string }) => {
    if (!paymentModalInvoice) return;

    const invoice = paymentModalInvoice;
    try {
      await recordInvoicePayment(invoice.id, {
        amount: paymentData.amount,
        date: paymentData.date,
        method: paymentData.method as 'ACH' | 'Check' | 'Wire' | 'Credit' | 'Factoring' | 'Other',
        reference: paymentData.reference || undefined,
      });
    } catch (error: any) {
      alert(error?.message || 'Failed to record payment');
      return;
    }

    setPaymentModalInvoice(null);
  };

  const handlePrintInvoice = async (invoice: Invoice) => {
    const invoiceLoads = loads.filter(l =>
      invoice.loadIds?.includes(l.id) || l.id === invoice.loadId
    );
    // Get factoring company if invoice is factored (TruckingOffice style - Remit-To)
    const factoringCompany = invoice.isFactored && invoice.factoringCompanyId
      ? factoringCompanies.find(fc => fc.id === invoice.factoringCompanyId)
      : undefined;
    await generateInvoicePDF(invoice, invoiceLoads, companyProfile || undefined, factoringCompany);
    setOpenMenuId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Invoice List</h2>
            <p className="text-slate-600 mt-1">{invoices.length} total invoices</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total</p>
              <p className="text-lg font-semibold text-slate-900">{formatCurrency(stats.total)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock size={20} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Pending</p>
              <p className="text-lg font-semibold text-slate-900">{formatCurrency(stats.pending)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Check size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Paid</p>
              <p className="text-lg font-semibold text-slate-900">{formatCurrency(stats.paid)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Overdue</p>
              <p className="text-lg font-semibold text-slate-900">{formatCurrency(stats.overdue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">Invoice status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="overdue">Overdue</option>
          </select>
          <select value={factoredFilter} onChange={(e) => setFactoredFilter(e.target.value as 'all' | 'factored' | 'not_factored')} className="px-3 py-2 border rounded-lg">
            <option value="all">All (factored+)</option>
            <option value="factored">Factored only</option>
            <option value="not_factored">Not factored</option>
          </select>
          <select value={factoringCompanyFilter} onChange={(e) => setFactoringCompanyFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">All factoring cos</option>
            {factoringCompanies.map(fc => (
              <option key={fc.id} value={fc.id}>{fc.name}</option>
            ))}
          </select>
          <select value={fundingStatusFilter} onChange={(e) => setFundingStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">Funding status</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="funded">Funded</option>
            <option value="customer_paid">Customer paid factor</option>
            <option value="rejected">Rejected</option>
            <option value="repurchased">Repurchased</option>
          </select>
          <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="px-3 py-2 border rounded-lg" title="Invoice month" />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-500">Invoice date</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-2 py-1.5 border rounded-lg" />
          <span className="text-slate-400">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-2 py-1.5 border rounded-lg" />
          <span className="text-slate-500 ml-2">Due date</span>
          <input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} className="px-2 py-1.5 border rounded-lg" />
          <span className="text-slate-400">to</span>
          <input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} className="px-2 py-1.5 border rounded-lg" />
          <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="px-3 py-1.5 border rounded-lg">
            <option value="">All customers</option>
            {[...new Set(invoices.map(i => i.customerName).filter(Boolean))].map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Invoice #</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Customer</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Date</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Due Date</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Loads</th>
              <th className="text-right py-3 px-4 font-medium text-slate-700">Amount</th>
              <th className="text-center py-3 px-4 font-medium text-slate-700">Invoice</th>
              <th className="text-center py-3 px-4 font-medium text-slate-700">Funding</th>
              <th className="text-right py-3 px-4 font-medium text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedInvoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500">
                  No invoices found
                </td>
              </tr>
            ) : (
              paginatedInvoices.map(invoice => (
                <React.Fragment key={invoice.id}>
                  <tr className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-blue-600">{invoice.invoiceNumber}</div>
                      {invoice.isFactored && (
                        <span className="text-xs text-blue-500">Factored via {invoice.factoringCompanyName || 'factor'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{invoice.customerName || invoice.brokerName}</td>
                    <td className="py-3 px-4">{formatDate(invoice.date)}</td>
                    <td className="py-3 px-4">{formatDate(invoice.dueDate)}</td>
                    <td className="py-3 px-4">{invoice.loadIds?.length || 1}</td>
                    <td className="py-3 px-4 text-right font-medium">{formatCurrency(invoice.amount)}</td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(invoice.status)}</td>
                    <td className="py-3 px-4 text-center text-xs text-slate-600">
                      {invoice.isFactored ? (invoice.fundingStatus || 'submitted') : '—'}
                    </td>
                    <td className="py-3 px-4 text-right relative menu-container">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === invoice.id ? null : invoice.id)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {openMenuId === invoice.id && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border border-slate-200">
                          <div className="py-1">
                            {invoice.status !== 'paid' && (
                              <button
                                onClick={() => handleMarkAsPaid(invoice)}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                              >
                                <CheckCircle size={16} />
                                Mark Invoice Paid (customer)
                              </button>
                            )}
                            {invoice.isFactored && (
                              <>
                                <div className="px-4 py-1 text-xs font-semibold text-slate-400 uppercase">Factor funding</div>
                                {(['submitted', 'approved', 'funded', 'customer_paid', 'rejected', 'repurchased'] as FactoringFundingStatus[]).map(status => (
                                  <button
                                    key={status}
                                    onClick={async () => {
                                      const today = new Date().toISOString().split('T')[0];
                                      const patch: Partial<Invoice> = { fundingStatus: status };
                                      if (status === 'funded') patch.factorFundedDate = today;
                                      if (status === 'customer_paid') patch.factorCustomerPaidDate = today;
                                      if (status === 'submitted') patch.factorSubmittedDate = today;
                                      updateInvoice(invoice.id, patch);
                                      const tx = factoringTransactions.find(t => t.invoiceId === invoice.id || t.id === invoice.factoringTransactionId);
                                      if (tx) {
                                        updateFactoringTransaction(tx.id, {
                                          fundingStatus: status,
                                          fundedDate: status === 'funded' ? today : tx.fundedDate,
                                          customerPaidDate: status === 'customer_paid' ? today : tx.customerPaidDate,
                                          submittedDate: status === 'submitted' ? today : tx.submittedDate,
                                          recourseStatus: status === 'repurchased' ? 'repurchased' : tx.recourseStatus,
                                        });
                                      }
                                      // Keep per-load factoring status in sync with invoice funding
                                      if (status === 'funded') {
                                        const linkedIds = Array.from(new Set([
                                          ...(invoice.loadId ? [invoice.loadId] : []),
                                          ...(invoice.loadIds || []),
                                        ]));
                                        for (const loadId of linkedIds) {
                                          const load = loads.find(l => l.id === loadId);
                                          if (!load || isLoadFunded(load) || isLoadHeld(load)) continue;
                                          const company = factoringCompanies.find(c => c.id === (load.factoringCompanyId || invoice.factoringCompanyId));
                                          const loadPatch = buildMarkLoadFundedPatch(
                                            load,
                                            invoice,
                                            company?.feePercentage,
                                            `Invoice-Funded-${invoice.invoiceNumber}`,
                                          );
                                          try {
                                            await updateLoad(loadId, loadPatch, 'Factoring: invoice marked funded');
                                          } catch (err) {
                                            console.error('Failed to sync load funding from invoice:', err);
                                          }
                                        }
                                      }
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 capitalize"
                                  >
                                    {status.replace('_', ' ')}
                                  </button>
                                ))}
                              </>
                            )}
                            <button
                              onClick={() => handlePrintInvoice(invoice)}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                            >
                              <Download size={16} />
                              Download PDF
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this invoice?')) {
                                  deleteInvoice(invoice.id);
                                  setOpenMenuId(null);
                                }
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 size={16} />
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                  {invoice.isFactored && invoice.factoringCompanyName && (
                    <tr className="bg-blue-50">
                      <td colSpan={8} className="px-4 py-2 text-xs text-blue-600">
                        Factored via {invoice.factoringCompanyName} {invoice.factoredDate ? `on ${formatDate(invoice.factoredDate)}` : ''}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <div className="text-sm text-slate-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-slate-300 rounded-lg disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 py-1 text-sm">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-300 rounded-lg disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {paymentModalInvoice && (
        <PaymentModal
          invoice={paymentModalInvoice}
          onClose={() => setPaymentModalInvoice(null)}
          onSave={handlePaymentSave}
        />
      )}
    </div>
  );
};

// ============================================================================
// Factored Loads Tab
// ============================================================================

const factoringStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    funded: 'bg-green-100 text-green-800 border-green-200',
    held: 'bg-red-100 text-red-800 border-red-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
    approved: 'bg-blue-100 text-blue-800 border-blue-200',
    submitted: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    awaiting_paperwork: 'bg-orange-100 text-orange-800 border-orange-200',
    not_submitted: 'bg-slate-100 text-slate-700 border-slate-200',
    repurchased: 'bg-purple-100 text-purple-800 border-purple-200',
  };
  const label = status.replace(/_/g, ' ').toUpperCase();
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.submitted}`}>
      {label}
    </span>
  );
};

const FactoredLoadsTab: React.FC = () => {
  const {
    loads,
    invoices,
    factoringCompanies,
    factoringTransactions,
    updateInvoice,
    updateLoad,
    updateFactoringTransaction,
    markLoadsFunded,
  } = useTMS();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const factoredData = useMemo(() => {
    const fromHelper = getFactoredLoads(loads, invoices).map(item => ({
      ...item,
      factoringCompany: factoringCompanies.find(
        fc => fc.id === (item.load.factoringCompanyId || item.invoice?.factoringCompanyId)
      ),
    }));

    const withTx = fromHelper.map(item => {
      const tx = factoringTransactions.find(t => t.invoiceId === item.invoice?.id);
      const companyPct = item.factoringCompany?.feePercentage;
      const pct = getLoadFeePercent(item.load, item.invoice, tx?.feePercentage || companyPct);
      const enriched = {
        ...item.load,
        factoringFeePercent: pct,
        factoredDate: item.load.factoredDate || tx?.submittedDate,
        factoringFee: getLoadAllocatedFee(
          { ...item.load, factoringFeePercent: pct },
          item.invoice,
          companyPct
        ),
      };
      return { ...item, load: enriched };
    });

    const filtered = selectedCompanyId
      ? withTx.filter(item =>
          (item.load.factoringCompanyId || item.invoice?.factoringCompanyId) === selectedCompanyId
        )
      : withTx;

    return filtered.sort((a, b) => {
      const dateA = tryParseDateOnlyLocal(a.load.factoredDate || a.load.deliveryDate || '')?.getTime() ?? Number.NEGATIVE_INFINITY;
      const dateB = tryParseDateOnlyLocal(b.load.factoredDate || b.load.deliveryDate || '')?.getTime() ?? Number.NEGATIVE_INFINITY;
      return dateB - dateA;
    });
  }, [loads, invoices, factoringCompanies, factoringTransactions, selectedCompanyId]);

  const filteredFactoredData = useMemo(() => {
    return factoredData.filter(item => {
      const brokerName = item.load.brokerName || item.load.customerName || '';
      const matchesSearch = !debouncedSearchTerm ||
        item.load.loadNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        brokerName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        item.invoice?.invoiceNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [factoredData, debouncedSearchTerm]);

  const factoringStats = useMemo(() => {
    return summarizeFactoredLoads(
      factoredData.map(item => ({
        load: item.load,
        invoice: item.invoice,
        feePercent: item.factoringCompany?.feePercentage,
      }))
    );
  }, [factoredData]);

  const donutChartData = useMemo(() => {
    return [
      { name: 'Expected Net', value: Math.max(0, factoringStats.expectedNet), color: '#10B981' },
      { name: 'Expected Fees', value: Math.max(0, factoringStats.expectedFees), color: '#F59E0B' },
    ];
  }, [factoringStats]);

  const monthlyTrendData = useMemo(() => {
    const months: { [key: string]: { factored: number; fees: number } } = {};
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      months[monthKey] = { factored: 0, fees: 0 };
    }

    factoredData.forEach(item => {
      const factoredDate = item.load.factoredDate || item.load.deliveryDate;
      if (!factoredDate) return;
      const date = tryParseDateOnlyLocal(factoredDate);
      if (!date) return;
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (months[monthKey]) {
        months[monthKey].factored += getLoadFactoredAmount(item.load);
        months[monthKey].fees += getLoadAllocatedFee(
          item.load,
          item.invoice,
          item.factoringCompany?.feePercentage
        );
      }
    });

    return Object.entries(months).map(([month, data]) => ({
      month,
      factored: data.factored,
      fees: data.fees,
    }));
  }, [factoredData]);

  const syncInvoiceFromLoads = (invoiceId: string, nextLoads: Load[]) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    const derived = deriveInvoiceFundingFromLoads(invoice, nextLoads);
    updateInvoice(invoiceId, {
      status: derived.status,
      fundingStatus: derived.fundingStatus,
      paidAmount: derived.paidAmount,
      factorFundedDate: derived.factorFundedDate,
      paidAt: derived.paidAt,
      paymentMethod: derived.paymentMethod,
      paymentReference: derived.paymentReference,
      netFundedAmount: derived.paidAmount,
    });
    const tx = factoringTransactions.find(t => t.invoiceId === invoiceId);
    if (tx) {
      updateFactoringTransaction(tx.id, {
        fundingStatus: derived.fundingStatus as FactoringFundingStatus,
        fundedDate: derived.factorFundedDate,
        netFundedAmount: derived.paidAmount,
      });
    }
  };

  const handleMarkLoadFunded = async (loadId: string) => {
    const item = factoredData.find(d => d.load.id === loadId);
    if (!item) return;
    try {
      const patch = buildMarkLoadFundedPatch(
        item.load,
        item.invoice,
        item.factoringCompany?.feePercentage,
        `Factored-${item.load.loadNumber}`
      );
      await updateLoad(loadId, patch, 'Factoring: Mark Load Funded');
      const nextLoads = loads.map(l => (l.id === loadId ? { ...l, ...patch } : l));
      if (item.invoice) {
        syncInvoiceFromLoads(item.invoice.id, nextLoads);
      }
    } catch (error) {
      console.error('Mark Load Funded failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to mark load funded.');
    }
  };

  const handleMarkLoadHeld = async (loadId: string) => {
    const item = factoredData.find(d => d.load.id === loadId);
    if (!item) return;
    if (!window.confirm(`Hold load ${item.load.loadNumber} for missing paperwork? Sibling loads will not be affected.`)) {
      return;
    }
    try {
      const patch = buildMarkLoadHeldPatch('Missing paperwork');
      await updateLoad(loadId, patch, 'Factoring: Hold load');
      const nextLoads = loads.map(l => (l.id === loadId ? { ...l, ...patch } : l));
      if (item.invoice) {
        syncInvoiceFromLoads(item.invoice.id, nextLoads);
      }
    } catch (error) {
      console.error('Hold load failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to hold load.');
    }
  };

  const handleMarkAllFunded = async (opts?: { loadIds?: string[] }) => {
    if (isMarkingAll) return;
    // Prefer explicit IDs (row Mark All) else every pending load in the filtered view
    const scope = opts?.loadIds?.length
      ? filteredFactoredData.filter(d => opts.loadIds!.includes(d.load.id))
      : filteredFactoredData;
    const pending = scope.filter(
      d => !isLoadFunded(d.load) && !isLoadHeld(d.load)
    );
    if (pending.length === 0) {
      alert('All selected loads are already funded.');
      return;
    }
    const totalExpected = pending.reduce(
      (s, d) =>
        s + getLoadExpectedNet(d.load, d.invoice, d.factoringCompany?.feePercentage),
      0
    );
    const label =
      pending[0]?.factoringCompany?.name
      || pending[0]?.load.factoringCompanyName
      || 'factored loads';
    if (
      !window.confirm(
        `Mark all ${pending.length} pending load(s) (${label}) as funded?\n\n` +
          `Expected net for these loads: ${formatCurrency(totalExpected)}\n\n` +
          `This only funds unfunded loads. Confirm paperwork is complete and payment matches.`
      )
    ) {
      return;
    }

    setIsMarkingAll(true);
    try {
      const items = pending.map(item => ({
        loadId: item.load.id,
        patch: buildMarkLoadFundedPatch(
          item.load,
          item.invoice,
          item.factoringCompany?.feePercentage,
          `Factored-All-${label}`
        ),
      }));
      const { fundedIds, failed } = await markLoadsFunded(items);

      // Rebuild local snapshot for invoice sync
      const nextLoads = loads.map(l => {
        const item = items.find(i => i.loadId === l.id && fundedIds.includes(l.id));
        return item ? { ...l, ...item.patch } : l;
      });
      const invoiceIds = Array.from(
        new Set(pending.map(p => p.invoice?.id).filter(Boolean) as string[])
      );
      for (const invId of invoiceIds) {
        syncInvoiceFromLoads(invId, nextLoads);
      }

      const failMsg = failed.length
        ? `\n\nFailed (${failed.length}):\n` +
          failed
            .slice(0, 6)
            .map(f => {
              const num = loads.find(l => l.id === f.loadId)?.loadNumber || f.loadId;
              return `• ${num}: ${f.error}`;
            })
            .join('\n')
        : '';
      alert(`Funded ${fundedIds.length} of ${pending.length} load(s).${failMsg}`);
    } catch (error) {
      console.error('Mark All Funded failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to mark all funded.');
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards — expected vs actual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Submitted/Factored</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(factoringStats.totalFactoredAmount)}</p>
          <p className="text-xs text-slate-400 mt-1">{factoringStats.totalLoads} loads</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Expected Fees</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{formatCurrency(factoringStats.expectedFees)}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Expected Net</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(factoringStats.expectedNet)}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Actual Net Received</p>
          <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(factoringStats.actualNetReceived)}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Funded Loads</p>
          <p className="text-xl font-bold text-green-700 mt-1">{factoringStats.fundedLoads}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pending Loads</p>
          <p className="text-xl font-bold text-yellow-700 mt-1">{factoringStats.pendingLoads}</p>
          {factoringStats.pendingLoads >= 2 && (
            <button
              type="button"
              disabled={isMarkingAll}
              onClick={() => void handleMarkAllFunded()}
              className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
            >
              {isMarkingAll ? 'Funding…' : 'Mark All Pending Funded'}
            </button>
          )}
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Held Loads</p>
          <p className="text-xl font-bold text-red-700 mt-1">{factoringStats.heldLoads}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Expected Factoring Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height={256}>
              <PieChart>
                <Pie
                  data={donutChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {donutChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center space-y-1">
            <p className="text-sm text-slate-600">Expected Net: {formatCurrency(factoringStats.expectedNet)}</p>
            <p className="text-sm text-slate-600">Actual Net Received: {formatCurrency(factoringStats.actualNetReceived)}</p>
            <p className="text-sm text-slate-600">Expected Fees: {formatCurrency(factoringStats.expectedFees)}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Monthly Factoring Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={monthlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="factored" fill="#3B82F6" name="Factored Amount" />
                <Bar dataKey="fees" fill="#F59E0B" name="Expected Fees" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Filter by Factoring Company</label>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Factoring Companies</option>
            {factoringCompanies.map(company => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by load #, customer, invoice..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Factored Loads Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Load #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Broker</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Factoring Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Factored Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Factored Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Allocated Fee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Expected Net</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actual Received</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredFactoredData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-slate-500">
                    No factored loads found
                  </td>
                </tr>
              ) : (
                filteredFactoredData.map((item) => {
                  const load = item.load;
                  const invoice = item.invoice;
                  const company = item.factoringCompany;
                  const factoredAmount = getLoadFactoredAmount(load);
                  const feeRate = getLoadFeePercent(load, invoice, company?.feePercentage);
                  const fee = getLoadAllocatedFee(load, invoice, company?.feePercentage);
                  const expectedNet = getLoadExpectedNet(load, invoice, company?.feePercentage);
                  const funded = isLoadFunded(load);
                  const held = isLoadHeld(load);
                  const status = getLoadFactoringStatus(load);
                  const actualReceived = funded
                    ? (Number(load.actualReceived ?? load.paymentAmount) || expectedNet)
                    : 0;
                  // Mark All Funded applies to every pending load currently shown
                  // (after search/company filter) — not a fragile company/invoice subgroup.
                  const markAllPending = filteredFactoredData.filter(
                    d => !isLoadFunded(d.load) && !isLoadHeld(d.load)
                  );
                  const showMarkAll =
                    !funded
                    && !held
                    && markAllPending.length >= 2
                    && load.id === markAllPending[0]?.load.id;

                  return (
                    <tr key={load.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600">{load.loadNumber}</div>
                        <div className="text-xs text-slate-500">
                          {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{load.brokerName || load.customerName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{company?.name || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        <div>{invoice?.invoiceNumber || '—'}</div>
                        {invoice && (
                          <div className="text-xs text-slate-400">
                            Inv: {invoice.status}{invoice.fundingStatus ? ` · ${invoice.fundingStatus}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {load.factoredDate ? formatDate(load.factoredDate) : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{formatCurrency(factoredAmount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {formatCurrency(fee)} ({feeRate}%)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{formatCurrency(expectedNet)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {formatCurrency(actualReceived)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {factoringStatusBadge(status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-col gap-1 items-start">
                          {!funded && !held && (
                            <button
                              onClick={() => handleMarkLoadFunded(load.id)}
                              className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                              title="Fund this load only — does not mark sibling loads"
                            >
                              <CheckCircle size={16} /> Mark Load Funded
                            </button>
                          )}
                          {!funded && !held && (
                            <button
                              onClick={() => handleMarkLoadHeld(load.id)}
                              className="text-red-600 hover:text-red-800 text-xs"
                            >
                              Hold (paperwork)
                            </button>
                          )}
                          {showMarkAll && (
                            <button
                              type="button"
                              disabled={isMarkingAll}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleMarkAllFunded({
                                  loadIds: markAllPending.map(d => d.load.id),
                                });
                              }}
                              className="text-xs text-slate-600 hover:text-slate-900 underline disabled:opacity-50"
                              title="Requires confirmation; funds every pending load in this view"
                            >
                              {isMarkingAll ? 'Funding…' : 'Mark All Funded'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Factoring Companies Tab
// ============================================================================

const FactoringCompaniesTab: React.FC = () => {
  const { loads, invoices, factoringCompanies, addFactoringCompany, updateFactoringCompany, deleteFactoringCompany } = useTMS();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<FactoringCompany | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedCompanyName, setSelectedCompanyName] = useState('');

  // Filter out auto-seeded companies
  const manuallyAddedCompanies = useMemo(() => {
    return factoringCompanies.filter(company => {
      return !company.id.startsWith('factoring_');
    });
  }, [factoringCompanies]);

  const filteredCompanies = useMemo(() => {
    return manuallyAddedCompanies.filter(company => {
      const matchesSearch = !debouncedSearchTerm ||
        company.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        company.address?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        company.phone?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        company.email?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [manuallyAddedCompanies, debouncedSearchTerm]);

  const factoredData = useMemo(() => {
    return getFactoredLoads(loads, invoices).map(item => ({
      ...item,
      factoringCompany: factoringCompanies.find(
        fc => fc.id === (item.load.factoringCompanyId || item.invoice?.factoringCompanyId)
      ),
    }));
  }, [loads, invoices, factoringCompanies]);

  const handleEditCompany = (company: FactoringCompany) => {
    setEditingCompany(company);
    setSelectedCompanyName(company.name);
    setIsModalOpen(true);
  };

  const handleDeleteCompany = (companyId: string) => {
    if (window.confirm('Are you sure you want to delete this factoring company?')) {
      deleteFactoringCompany(companyId);
    }
  };

  const handleSaveCompany = (companyData: NewFactoringCompanyInput) => {
    const finalData = {
      ...companyData,
      name: selectedCompanyName || companyData.name,
    };

    try {
      if (editingCompany) {
        updateFactoringCompany(editingCompany.id, finalData);
      } else {
        addFactoringCompany(finalData);
      }
      setIsModalOpen(false);
      setEditingCompany(null);
      setSelectedCompanyName('');
    } catch (error: any) {
      alert(error?.message || 'Failed to save factoring company');
    }
  };

  const formatAddress = (company: FactoringCompany) => {
    const parts = [];
    if (company.address) parts.push(company.address);
    if (company.city) parts.push(company.city);
    if (company.state) parts.push(company.state);
    if (company.zipCode) parts.push(company.zipCode);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  };

  const getCompanyStats = (companyId: string) => {
    const companyLoads = factoredData.filter(item => item.load.factoringCompanyId === companyId);
    const totalFactored = companyLoads.reduce((sum, item) => sum + (item.load.grandTotal || item.load.rate || 0), 0);
    const totalFees = companyLoads.reduce((sum, item) => {
      const amount = item.load.grandTotal || item.load.rate || 0;
      const fee = item.load.factoringFee || (amount * ((item.load.factoringFeePercent || 2.5) / 100));
      return sum + fee;
    }, 0);
    const activeLoads = companyLoads.filter(item => item.invoice?.status !== 'paid').length;

    return { totalFactored, totalFees, activeLoads, totalLoads: companyLoads.length };
  };

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search factoring companies..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setEditingCompany(null);
            setSelectedCompanyName('');
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={18} />
          Add Factoring Company
        </button>
      </div>

      {/* Factoring Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompanies.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-500">
            No factoring companies found. Click "Add Factoring Company" to get started.
          </div>
        ) : (
          filteredCompanies.map((company) => {
            const stats = getCompanyStats(company.id);
            return (
              <div key={company.id} className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{company.name}</h3>
                    <p className="text-sm text-slate-500">Fee: {company.feePercentage || 2.5}%</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditCompany(company)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteCompany(company.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-4 text-sm">
                  {company.contactName && (
                    <p className="text-slate-600">Contact: <span className="font-medium">{company.contactName}</span></p>
                  )}
                  {company.phone && (
                    <p className="text-slate-600">Phone: <span className="font-medium">{company.phone}</span></p>
                  )}
                  {company.email && (
                    <p className="text-slate-600">Email: <span className="font-medium">{company.email}</span></p>
                  )}
                  <p className="text-slate-600">Address: <span className="font-medium">{formatAddress(company)}</span></p>
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Factored:</span>
                    <span className="font-medium">{formatCurrency(stats.totalFactored)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Fees Paid:</span>
                    <span className="font-medium">{formatCurrency(stats.totalFees)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Active Loads:</span>
                    <span className="font-medium">{stats.activeLoads}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ACTIVE
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Factoring Company Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editingCompany ? 'Edit' : 'Add'} Factoring Company</h3>
              <button onClick={() => {
                setIsModalOpen(false);
                setEditingCompany(null);
                setSelectedCompanyName('');
              }} className="text-slate-500 hover:text-slate-700">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const companyData: NewFactoringCompanyInput = {
                name: selectedCompanyName || (formData.get('name') as string) || editingCompany?.name || '',
                feePercentage: parseFloat(formData.get('feePercentage') as string) || 2.5,
                contactName: formData.get('contactName') as string || undefined,
                phone: formData.get('phone') as string || undefined,
                email: formData.get('email') as string || undefined,
                address: formData.get('address') as string || undefined,
                city: formData.get('city') as string || undefined,
                state: formData.get('state') as string || undefined,
                zipCode: formData.get('zipCode') as string || undefined,
                notes: formData.get('notes') as string || undefined,
              };
              handleSaveCompany(companyData);
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
                <FactoringCompanyAutocomplete
                  value={selectedCompanyName || editingCompany?.name || ''}
                  onChange={(company) => {
                    if (company) {
                      setSelectedCompanyName(company.name);
                    } else {
                      setSelectedCompanyName('');
                    }
                  }}
                  factoringCompanies={factoringCompanies}
                  onAddCompany={(newCompany) => setSelectedCompanyName(newCompany.name || '')}
                  placeholder="Type to search factoring companies..."
                />
                <input
                  type="hidden"
                  name="name"
                  value={selectedCompanyName || editingCompany?.name || ''}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fee Percentage *</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="feePercentage"
                      required
                      step="0.1"
                      defaultValue={editingCompany?.feePercentage || 2.5}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
                  <select
                    name="paymentTerms"
                    defaultValue="next_day"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="next_day">Next Day</option>
                    <option value="same_day">Same Day</option>
                    <option value="2_days">2 Days</option>
                    <option value="3_days">3 Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  name="contactName"
                  defaultValue={editingCompany?.contactName || ''}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={editingCompany?.phone || ''}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingCompany?.email || ''}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  name="address"
                  defaultValue={editingCompany?.address || ''}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    name="city"
                    defaultValue={editingCompany?.city || ''}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    name="state"
                    defaultValue={editingCompany?.state || ''}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Zip Code</label>
                  <input
                    type="text"
                    name="zipCode"
                    defaultValue={editingCompany?.zipCode || ''}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={editingCompany?.notes || ''}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingCompany(null);
                    setSelectedCompanyName('');
                  }}
                  className="px-4 py-2 border rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Invoices Component
// ============================================================================

const Invoices: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('invoices');
  const [invoiceView, setInvoiceView] = useState<InvoiceViewType>('loads-not-invoiced');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedLoadIds, setSelectedLoadIds] = useState<string[]>([]);

  const handleCreateInvoice = (customerName: string, loadIds: string[]) => {
    setSelectedCustomer(customerName);
    setSelectedLoadIds(loadIds);
    setInvoiceView('new-invoice');
  };

  const handleInvoiceSaved = () => {
    setInvoiceView('loads-not-invoiced');
    setSelectedCustomer('');
    setSelectedLoadIds([]);
  };

  const handleCancelInvoice = () => {
    setInvoiceView('loads-not-invoiced');
    setSelectedCustomer('');
    setSelectedLoadIds([]);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white shadow-sm border-b rounded-lg p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Invoices & Factoring</h1>
            <p className="text-slate-600 mt-2">Create invoices, manage factored loads, and track factoring companies</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => {
                setActiveTab('invoices');
                setInvoiceView('loads-not-invoiced');
              }}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'invoices'
                  ? 'border-blue-500 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText size={18} />
                Invoices
              </div>
            </button>
            <button
              onClick={() => setActiveTab('factored')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'factored'
                  ? 'border-blue-500 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={18} />
                Factored Loads
              </div>
            </button>
            <button
              onClick={() => setActiveTab('companies')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'companies'
                  ? 'border-blue-500 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 size={18} />
                Factoring Companies
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* TAB 1: INVOICES */}
          {activeTab === 'invoices' && (
            <>
              {invoiceView === 'loads-not-invoiced' && (
                <LoadsNotInvoiced
                  onCreateInvoice={handleCreateInvoice}
                  onViewInvoiceList={() => setInvoiceView('invoice-list')}
                />
              )}

              {invoiceView === 'new-invoice' && (
                <NewInvoiceForm
                  customerName={selectedCustomer}
                  preSelectedLoadIds={selectedLoadIds}
                  onCancel={handleCancelInvoice}
                  onSave={handleInvoiceSaved}
                />
              )}

              {invoiceView === 'invoice-list' && (
                <InvoiceList onBack={() => setInvoiceView('loads-not-invoiced')} />
              )}
            </>
          )}

          {/* TAB 2: FACTORED LOADS */}
          {activeTab === 'factored' && <FactoredLoadsTab />}

          {/* TAB 3: FACTORING COMPANIES */}
          {activeTab === 'companies' && <FactoringCompaniesTab />}
        </div>
      </div>
    </div>
  );
};

export default Invoices;

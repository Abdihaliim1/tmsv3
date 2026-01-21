/**
 * Invoices Page - Enhanced with Tabs
 *
 * Tabs:
 * 1. Invoices - Create and manage invoices (Loads Not Invoiced → New Invoice → Invoice List)
 * 2. Factored Loads - View and manage factored loads with charts
 * 3. Factoring Companies - Manage factoring company relationships
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FileText, DollarSign, Plus, Search, ChevronLeft, ChevronRight,
  Check, X, Printer, Download, Eye, Edit, Trash2, MoreHorizontal,
  Building2, MapPin, Truck, Calendar, Package, Clock, CheckCircle,
  AlertTriangle, TrendingUp
} from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { useCompany } from '../context/CompanyContext';
import { useTenant } from '../context/TenantContext';
import { Invoice, InvoiceStatus, LoadStatus, Load, FactoringCompany, NewFactoringCompanyInput } from '../types';
import { generateUniqueInvoiceNumber } from '../services/invoiceService';
import { generateInvoicePDF } from '../services/invoicePDF';
import { useDebounce } from '../utils/debounce';
import { FactoringCompanyAutocomplete } from '../components/FactoringCompanyAutocomplete';
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
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

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
      const isDelivered = load.status === LoadStatus.Delivered || load.status === LoadStatus.Completed;
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
            {totalLoads} delivered load{totalLoads !== 1 ? 's' : ''} from {customerCount} customer{customerCount !== 1 ? 's' : ''} ready to invoice
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
                          onClick={() => onCreateInvoice(customerName, customerLoads.map(l => l.id))}
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
  const { loads, invoices, factoringCompanies, addInvoice, updateLoad } = useTMS();
  const { activeTenantId } = useTenant();
  const { companyProfile } = useCompany();
  const tenantId = activeTenantId || 'default';

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState(() => generateUniqueInvoiceNumber(tenantId, invoices));
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  });
  const [remitTo, setRemitTo] = useState('');
  const [note, setNote] = useState('');
  const [selectedLoadIds, setSelectedLoadIds] = useState<string[]>(preSelectedLoadIds);
  const [showShippers, setShowShippers] = useState(false);
  const [showMiles, setShowMiles] = useState(false);

  // Factoring options
  const [isFactored, setIsFactored] = useState(false);
  const [selectedFactoringCompany, setSelectedFactoringCompany] = useState<FactoringCompany | null>(null);
  const [factoringFeePercent, setFactoringFeePercent] = useState(2.5);

  // Get uninvoiced loads for this customer
  const customerLoads = useMemo(() => {
    return loads.filter(load => {
      const isDelivered = load.status === LoadStatus.Delivered || load.status === LoadStatus.Completed;
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

  const handleCreateInvoice = () => {
    if (selectedLoadIds.length === 0) {
      alert('Please select at least one load to invoice');
      return;
    }

    const finalInvoiceNumber = customInvoiceNumber || invoiceNumber;
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
      createdAt: new Date().toISOString(),
      isFactored: isFactored,
      factoringCompanyId: selectedFactoringCompany?.id,
      factoringCompanyName: selectedFactoringCompany?.name,
      factoredDate: isFactored ? new Date().toISOString().split('T')[0] : undefined,
    };

    addInvoice(newInvoice);

    // Mark loads as invoiced and factored if applicable
    selectedLoadIds.forEach(loadId => {
      const updateData: Partial<Load> = { invoiceId: 'pending' };
      if (isFactored && selectedFactoringCompany) {
        updateData.isFactored = true;
        updateData.factoringCompanyId = selectedFactoringCompany.id;
        updateData.factoringFeePercent = factoringFeePercent;
        updateData.factoringFee = (selectedLoads.find(l => l.id === loadId)?.grandTotal || 0) * (factoringFeePercent / 100);
        updateData.factoredDate = new Date().toISOString().split('T')[0];
      }
      updateLoad(loadId, updateData);
    });

    onSave();
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Remit To
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={remitTo}
                onChange={(e) => setRemitTo(e.target.value)}
                placeholder="Search for name, address..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm whitespace-nowrap">
                + Create Remit To
              </button>
            </div>
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
                      onChange={(e) => setFactoringFeePercent(parseFloat(e.target.value) || 0)}
                      step="0.1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500">%</span>
                  </div>
                </div>
              </>
            )}
          </div>
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
          disabled={selectedLoadIds.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium"
        >
          Create Invoice
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
// Invoice List View
// ============================================================================

interface InvoiceListProps {
  onBack: () => void;
}

const InvoiceList: React.FC<InvoiceListProps> = ({ onBack }) => {
  const { invoices, loads, deleteInvoice, updateInvoice, updateLoad } = useTMS();
  const { companyProfile } = useCompany();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && !(event.target as Element).closest('.menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const matchesStatus = !statusFilter || invoice.status === statusFilter;
      const matchesSearch = !debouncedSearchTerm ||
        invoice.invoiceNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        invoice.customerName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        invoice.brokerName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [invoices, statusFilter, debouncedSearchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(start, start + itemsPerPage);
  }, [filteredInvoices, currentPage]);

  // Stats
  const stats = useMemo(() => {
    const pending = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.amount, 0);
    const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
    const overdue = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0);
    return { pending, paid, overdue, total: pending + paid + overdue };
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

  const handleMarkAsPaid = async (invoice: Invoice) => {
    const paidAmount = prompt('Enter paid amount:', invoice.amount.toString());
    if (!paidAmount) return;

    const paymentMethod = prompt('Payment method (ACH, Check, Wire, etc.):', 'ACH');
    if (!paymentMethod) return;

    const paymentReference = prompt('Payment reference (optional):', '');

    const paidAt = new Date().toISOString();
    updateInvoice(invoice.id, {
      status: 'paid',
      paidAt,
      paidAmount: parseFloat(paidAmount),
      paymentMethod,
      paymentReference: paymentReference || undefined
    });

    // Update associated loads
    if (invoice.loadIds) {
      for (const loadId of invoice.loadIds) {
        const load = loads.find(l => l.id === loadId);
        if (load) {
          try {
            await updateLoad(loadId, {
              paymentReceived: true,
              paymentReceivedDate: paidAt,
              paymentAmount: parseFloat(paidAmount)
            });
          } catch (error) {
            console.error('Error updating load payment status:', error);
          }
        }
      }
    }
    setOpenMenuId(null);
  };

  const handlePrintInvoice = async (invoice: Invoice) => {
    const invoiceLoads = loads.filter(l =>
      invoice.loadIds?.includes(l.id) || l.id === invoice.loadId
    );
    await generateInvoicePDF(invoice, invoiceLoads, companyProfile || undefined);
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
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
        </select>
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
              <th className="text-center py-3 px-4 font-medium text-slate-700">Status</th>
              <th className="text-right py-3 px-4 font-medium text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
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
                        <span className="text-xs text-blue-500">Factored</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{invoice.customerName || invoice.brokerName}</td>
                    <td className="py-3 px-4">{formatDate(invoice.date)}</td>
                    <td className="py-3 px-4">{formatDate(invoice.dueDate)}</td>
                    <td className="py-3 px-4">{invoice.loadIds?.length || 1}</td>
                    <td className="py-3 px-4 text-right font-medium">{formatCurrency(invoice.amount)}</td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(invoice.status)}</td>
                    <td className="py-3 px-4 text-right relative menu-container">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === invoice.id ? null : invoice.id)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {openMenuId === invoice.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-slate-200">
                          <div className="py-1">
                            {invoice.status !== 'paid' && (
                              <button
                                onClick={() => handleMarkAsPaid(invoice)}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                              >
                                <CheckCircle size={16} />
                                Mark as Paid
                              </button>
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
    </div>
  );
};

// ============================================================================
// Factored Loads Tab
// ============================================================================

const FactoredLoadsTab: React.FC = () => {
  const { loads, invoices, factoringCompanies, updateInvoice } = useTMS();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const factoredData = useMemo(() => {
    const factoredLoads: Array<{ load: Load; invoice?: Invoice; factoringCompany?: FactoringCompany }> = [];

    loads.forEach(load => {
      if (load.isFactored && load.factoringCompanyId) {
        const invoice = invoices.find(inv => inv.loadIds?.includes(load.id) || inv.loadId === load.id);
        const factoringCompany = factoringCompanies.find(fc => fc.id === load.factoringCompanyId);
        factoredLoads.push({ load, invoice, factoringCompany });
      }
    });

    if (selectedCompanyId) {
      return factoredLoads.filter(item => item.load.factoringCompanyId === selectedCompanyId);
    }

    return factoredLoads.sort((a, b) => {
      const dateA = new Date(a.load.factoredDate || a.load.deliveryDate || '').getTime();
      const dateB = new Date(b.load.factoredDate || b.load.deliveryDate || '').getTime();
      return dateB - dateA;
    });
  }, [loads, invoices, factoringCompanies, selectedCompanyId]);

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
    const totalFactored = factoredData.length;
    const totalFactoredAmount = factoredData.reduce((sum, item) => {
      return sum + (item.load.grandTotal || item.load.rate || 0);
    }, 0);

    const paidByFactoring = factoredData.filter(item => {
      return item.invoice?.status === 'paid' && item.invoice?.isFactored;
    }).length;

    const pendingPayment = totalFactored - paidByFactoring;

    const totalFees = factoredData.reduce((sum, item) => {
      if (item.load.factoringFee && item.load.factoringFee > 0) {
        return sum + item.load.factoringFee;
      } else {
        const company = item.factoringCompany;
        const feeRate = item.load.factoringFeePercent || company?.feePercentage || 2.5;
        const factoredAmount = item.load.grandTotal || item.load.rate || 0;
        return sum + (factoredAmount * (feeRate / 100));
      }
    }, 0);

    const totalNetReceived = totalFactoredAmount - totalFees;

    return { totalFactored, totalFactoredAmount, paidByFactoring, pendingPayment, totalFees, totalNetReceived };
  }, [factoredData]);

  // Chart data
  const donutChartData = useMemo(() => {
    return [
      { name: 'Net Received', value: factoringStats.totalNetReceived, color: '#10B981' },
      { name: 'Factoring Fees', value: factoringStats.totalFees, color: '#F59E0B' }
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

      const date = new Date(factoredDate);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (months[monthKey]) {
        const amount = item.load.grandTotal || item.load.rate || 0;
        const fee = item.load.factoringFee || (amount * ((item.load.factoringFeePercent || item.factoringCompany?.feePercentage || 2.5) / 100));
        months[monthKey].factored += amount;
        months[monthKey].fees += fee;
      }
    });

    return Object.entries(months).map(([month, data]) => ({
      month,
      factored: data.factored,
      fees: data.fees
    }));
  }, [factoredData]);

  const handleMarkFactoredInvoicePaid = (invoiceId: string, netReceived: number) => {
    updateInvoice(invoiceId, {
      status: 'paid',
      paidAt: new Date().toISOString(),
      paidAmount: netReceived,
      paymentMethod: 'Factoring',
      paymentReference: 'Factored'
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="text-blue-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-500">Total Factored</p>
              <p className="text-2xl font-bold text-slate-900">{factoringStats.totalFactored}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-500">Total Factored Amt</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(factoringStats.totalFactoredAmount)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-green-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-500">Paid by Factoring</p>
              <p className="text-2xl font-bold text-slate-900">{factoringStats.paidByFactoring}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="text-yellow-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-500">Pending Payment</p>
              <p className="text-2xl font-bold text-slate-900">{factoringStats.pendingPayment}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Factoring Breakdown</h3>
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
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-600">Total Factored: {formatCurrency(factoringStats.totalFactoredAmount)}</p>
            <p className="text-sm text-slate-600">Net Received: {formatCurrency(factoringStats.totalNetReceived)}</p>
            <p className="text-sm text-slate-600">Total Fees: {formatCurrency(factoringStats.totalFees)}</p>
          </div>
        </div>

        {/* Bar Chart */}
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
                <Bar dataKey="fees" fill="#F59E0B" name="Fees Paid" />
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
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Net Received</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredFactoredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-slate-500">
                    No factored loads found
                  </td>
                </tr>
              ) : (
                filteredFactoredData.map((item) => {
                  const load = item.load;
                  const invoice = item.invoice;
                  const company = item.factoringCompany;
                  const factoredAmount = load.grandTotal || load.rate || 0;
                  const feeRate = company?.feePercentage || load.factoringFeePercent || 2.5;
                  const fee = load.factoringFee || (factoredAmount * (feeRate / 100));
                  const netReceived = factoredAmount - fee;
                  const isPaid = invoice?.status === 'paid';

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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{invoice?.invoiceNumber || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {load.factoredDate ? formatDate(load.factoredDate) : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{formatCurrency(factoredAmount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {formatCurrency(fee)} ({feeRate}%)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{formatCurrency(netReceived)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isPaid ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            PAID
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                            PENDING
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {!isPaid && invoice && (
                          <button
                            onClick={() => handleMarkFactoredInvoicePaid(invoice.id, netReceived)}
                            className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                            title="Mark as Paid"
                          >
                            <CheckCircle size={16} /> Mark Paid
                          </button>
                        )}
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
    const factoredLoads: Array<{ load: Load; invoice?: Invoice; factoringCompany?: FactoringCompany }> = [];

    loads.forEach(load => {
      if (load.isFactored && load.factoringCompanyId) {
        const invoice = invoices.find(inv => inv.loadIds?.includes(load.id) || inv.loadId === load.id);
        const factoringCompany = factoringCompanies.find(fc => fc.id === load.factoringCompanyId);
        factoredLoads.push({ load, invoice, factoringCompany });
      }
    });

    return factoredLoads;
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

    if (editingCompany) {
      updateFactoringCompany(editingCompany.id, finalData);
    } else {
      addFactoringCompany(finalData);
    }
    setIsModalOpen(false);
    setEditingCompany(null);
    setSelectedCompanyName('');
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

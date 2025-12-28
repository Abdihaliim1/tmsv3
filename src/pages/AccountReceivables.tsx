import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, DollarSign, Clock, AlertTriangle, Download, Printer, CheckCircle, Trash2, 
  MoreHorizontal, X, Plus, Building2, Edit, Search, MapPin, Truck, TrendingUp
} from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { useCompany } from '../context/CompanyContext';
import { Invoice, InvoiceStatus, LoadStatus, FactoringCompany, NewFactoringCompanyInput, Load, Payment } from '../types';
import { FactoringCompanyAutocomplete } from '../components/FactoringCompanyAutocomplete';
import { addPaymentToInvoice, validatePayment, calculateAging, calculateARAgingSummary, calculateInvoiceStatus, calculateTotalPaid, calculateOutstandingBalance, getDaysOutstanding } from '../services/paymentService';
import { canInvoiceLoad } from '../services/documentService';
import { useTenant } from '../context/TenantContext';
import { generateUniqueInvoiceNumber } from '../services/invoiceService';
import { generateInvoicePDF } from '../services/invoicePDF';
import { useDebounce } from '../utils/debounce';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

type TabType = 'invoices' | 'factored' | 'companies';

const AccountReceivables: React.FC = () => {
  const { 
    invoices, loads, factoringCompanies, addInvoice, updateInvoice, deleteInvoice, 
    addFactoringCompany, updateFactoringCompany, deleteFactoringCompany, updateLoad, updateInvoice: updateInvoiceFunc
  } = useTMS();
  
  // Get tenant ID at top level (hooks must be called at top level)
  const { activeTenantId } = useTenant();
  const tenantId = activeTenantId || 'default';
  
  // Get company profile for PDF generation
  const { companyProfile } = useCompany();
  
  const [activeTab, setActiveTab] = useState<TabType>('invoices');
  
  // Invoice tab state
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const itemsPerPage = 10;
  
  // Factored loads tab state
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [factoredSearchTerm, setFactoredSearchTerm] = useState<string>('');
  const debouncedFactoredSearchTerm = useDebounce(factoredSearchTerm, 300);
  
  // Factoring companies tab state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<FactoringCompany | null>(null);
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const debouncedCompanySearchTerm = useDebounce(companySearchTerm, 300);
  const [selectedCompanyName, setSelectedCompanyName] = useState('');

  // Check for overdue invoices
  useEffect(() => {
    checkOverdueInvoices();
    createInvoicesForDeliveredLoads();
    
    const interval = setInterval(() => {
      checkOverdueInvoices();
      createInvoicesForDeliveredLoads();
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [loads, invoices]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && !(event.target as Element).closest('.menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const checkOverdueInvoices = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    invoices.forEach(invoice => {
      if (invoice.status === 'paid' || invoice.status === 'overdue' || !invoice.dueDate) {
        return;
      }

      const dueDate = new Date(invoice.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        updateInvoice(invoice.id, { status: 'overdue' });
      }
    });
  };

  const createInvoicesForDeliveredLoads = () => {
    const deliveredLoads = loads.filter(load => {
      const status = load.status;
      const isDelivered = status === LoadStatus.Delivered || status === LoadStatus.Completed;
      
      // DUPLICATE CHECK 1: Load already has invoiceId
      if (load.invoiceId) return false;
      
      // DUPLICATE CHECK 2: Any invoice references this load
      const hasExistingInvoice = invoices.some(inv => 
        inv.loadId === load.id || inv.loadIds?.includes(load.id)
      );
      if (hasExistingInvoice) return false;
      
      // Must have a broker name to invoice
      return isDelivered && (load.brokerName || load.customerName);
    });

    // Create invoices only for loads that passed all duplicate checks
    deliveredLoads.forEach(load => {
      const brokerName = load.brokerName || load.customerName;
      
      // Final safety check - redundant but safe
      const alreadyHasInvoice = invoices.some(inv => 
        inv.loadId === load.id || inv.loadIds?.includes(load.id)
      );
      
      if (!alreadyHasInvoice && load.rate > 0) {
        const today = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        const newInvoice: Omit<Invoice, 'id'> = {
          invoiceNumber: generateUniqueInvoiceNumber(tenantId, invoices),
          brokerId: load.brokerId,
          brokerName: brokerName,
          customerName: brokerName, // Keep for backward compatibility
          loadIds: [load.id],
          amount: load.grandTotal || load.rate,
          status: 'pending',
          date: today.toISOString().split('T')[0],
          dueDate: dueDate.toISOString().split('T')[0],
        };

        addInvoice(newInvoice);
      }
    });
  };

  // ================================
  // TAB 1: INVOICES
  // ================================
  
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const matchesStatus = !statusFilter || invoice.status === statusFilter;
      const brokerName = invoice.brokerName || invoice.customerName || '';
      const matchesSearch = !debouncedSearchTerm ||
        invoice.invoiceNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        brokerName.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [invoices, statusFilter, debouncedSearchTerm]);

  const invoiceStats = useMemo(() => {
    const total = invoices.length;
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const paidThisMonth = invoices
      .filter(inv => {
        if (inv.status !== 'paid' || !inv.paidAt) return false;
        const paidDate = new Date(inv.paidAt);
        return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + (inv.paidAmount || inv.amount || 0), 0);
    
    const pending = invoices.filter(inv => inv.status === 'pending').length;
    const overdue = invoices.filter(inv => inv.status === 'overdue').length;
    
    return { total, paidThisMonth, pending, overdue };
  }, [invoices]);

  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(start, start + itemsPerPage);
  }, [filteredInvoices, currentPage]);

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    const styles = {
      paid: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      overdue: 'bg-red-100 text-red-800 border-red-200',
      factored: 'bg-blue-100 text-blue-800 border-blue-200',
      draft: 'bg-slate-100 text-slate-800 border-slate-200',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
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
      // Use for...of loop to properly handle async/await
      for (const loadId of invoice.loadIds) {
        const load = loads.find(l => l.id === loadId);
        if (load) {
          try {
            await updateLoad(loadId, {
              paymentReceived: true,
              paymentReceivedDate: paidAt,
              paymentAmount: parseFloat(paidAmount)
            });
          } catch (error: any) {
            console.error('Error updating load payment status:', error);
            // Continue even if update fails - payment is still recorded
          }
        }
      }
    }
  };

  // Handle print/download invoice PDF
  const handlePrintInvoice = (invoice: Invoice) => {
    try {
      generateInvoicePDF(invoice, loads, companyProfile);
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      alert('Failed to generate invoice PDF. Please try again.');
    }
  };

  // ================================
  // TAB 2: FACTORED LOADS
  // ================================
  
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
      const matchesSearch = !debouncedFactoredSearchTerm ||
        item.load.loadNumber.toLowerCase().includes(debouncedFactoredSearchTerm.toLowerCase()) ||
        brokerName.toLowerCase().includes(debouncedFactoredSearchTerm.toLowerCase()) ||
        item.invoice?.invoiceNumber.toLowerCase().includes(debouncedFactoredSearchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [factoredData, debouncedFactoredSearchTerm]);

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

  // Chart data for factored loads
  const donutChartData = useMemo(() => {
    return [
      { name: 'Net Received', value: factoringStats.totalNetReceived, color: '#10B981' },
      { name: 'Factoring Fees', value: factoringStats.totalFees, color: '#F59E0B' }
    ];
  }, [factoringStats]);

  const monthlyTrendData = useMemo(() => {
    const months: { [key: string]: { factored: number; fees: number } } = {};
    const now = new Date();
    
    // Get last 6 months
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
    updateInvoiceFunc(invoiceId, {
      status: 'paid',
      paidAt: new Date().toISOString(),
      paidAmount: netReceived,
      paymentMethod: 'Factoring',
      paymentReference: 'Factored'
    });
  };

  // ================================
  // TAB 3: FACTORING COMPANIES
  // ================================
  
  // Filter out auto-seeded companies (only show manually added ones in the list)
  const manuallyAddedCompanies = useMemo(() => {
    return factoringCompanies.filter(company => {
      // Auto-seeded companies have IDs like "factoring_0001", "factoring_0002", etc.
      // Manually added companies have random IDs
      return !company.id.startsWith('factoring_');
    });
  }, [factoringCompanies]);

  const filteredCompanies = useMemo(() => {
    return manuallyAddedCompanies.filter(company => {
      const matchesSearch = !debouncedCompanySearchTerm ||
        company.name.toLowerCase().includes(debouncedCompanySearchTerm.toLowerCase()) ||
        company.address?.toLowerCase().includes(debouncedCompanySearchTerm.toLowerCase()) ||
        company.phone?.toLowerCase().includes(debouncedCompanySearchTerm.toLowerCase()) ||
        company.email?.toLowerCase().includes(debouncedCompanySearchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [manuallyAddedCompanies, debouncedCompanySearchTerm]);

  const handleEditCompany = (company: FactoringCompany) => {
    setEditingCompany(company);
    setSelectedCompanyName(company.name);
    setIsModalOpen(true);
  };

  const handleCompanySelect = (company: FactoringCompany | null) => {
    if (company) {
      setSelectedCompanyName(company.name);
      // If editing, update the editing company
      if (editingCompany) {
        setEditingCompany({ ...editingCompany, name: company.name });
      }
    } else {
      setSelectedCompanyName('');
    }
  };

  const handleAddNewCompany = (newCompany: Omit<FactoringCompany, 'id'>) => {
    // This will be handled by the form submission
    setSelectedCompanyName(newCompany.name || '');
  };

  const handleDeleteCompany = (companyId: string) => {
    if (window.confirm('Are you sure you want to delete this factoring company?')) {
      deleteFactoringCompany(companyId);
    }
  };

  const handleSaveCompany = (companyData: NewFactoringCompanyInput) => {
    // Use selected company name if available (from autocomplete)
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
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white shadow-sm border-b mb-6 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Account Receivables</h1>
            <p className="text-slate-600 mt-2">Track invoices, factored loads, and manage factoring companies</p>
          </div>
          {activeTab === 'companies' && (
            <button
              onClick={() => {
                setEditingCompany(null);
                setIsModalOpen(true);
              }}
              className="btn-primary px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2"
            >
              <Plus size={16} />
              Add Factoring Company
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'invoices'
                  ? 'border-blue-500 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Invoices
            </button>
            <button
              onClick={() => setActiveTab('factored')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'factored'
                  ? 'border-blue-500 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Factored Loads
            </button>
            <button
              onClick={() => setActiveTab('companies')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'companies'
                  ? 'border-blue-500 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Factoring Companies
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* TAB 1: INVOICES */}
          {activeTab === 'invoices' && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="text-blue-600" size={24} />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-slate-500">Total Invoices</p>
                      <p className="text-2xl font-bold text-slate-900">{invoiceStats.total}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="text-green-600" size={24} />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-slate-500">Paid This Month</p>
                      <p className="text-2xl font-bold text-slate-900">{formatCurrency(invoiceStats.paidThisMonth)}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <Clock className="text-yellow-600" size={24} />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-slate-500">Pending</p>
                      <p className="text-2xl font-bold text-slate-900">{invoiceStats.pending}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="text-red-600" size={24} />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-slate-500">Overdue</p>
                      <p className="text-2xl font-bold text-slate-900">{invoiceStats.overdue}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Invoice #, customer..."
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-end">
                  <button className="w-full bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 flex items-center justify-center gap-2">
                    <Download size={18} />
                    Export
                  </button>
                </div>
              </div>

              {/* Invoices Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Invoice #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Broker</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Due Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {paginatedInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                          No invoices found
                        </td>
                      </tr>
                    ) : (
                      paginatedInvoices.map((invoice) => {
                        const invoiceLoads = invoice.loadIds?.map(id => loads.find(l => l.id === id)).filter(Boolean) || [];
                        return (
                          <React.Fragment key={invoice.id}>
                            <tr className="hover:bg-slate-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-blue-600">{invoice.invoiceNumber}</div>
                                <div className="text-xs text-slate-500">{invoiceLoads.length} load{invoiceLoads.length !== 1 ? 's' : ''}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{invoice.brokerName || invoice.customerName}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDate(invoice.date)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-slate-900">{formatCurrency(invoice.amount)}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(invoice.status)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium relative menu-container">
                                <button
                                  onClick={() => setOpenMenuId(openMenuId === invoice.id ? null : invoice.id)}
                                  className="text-slate-600 hover:text-slate-900"
                                >
                                  <MoreHorizontal size={20} />
                                </button>
                                {openMenuId === invoice.id && (
                                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-slate-200">
                                    <div className="py-1">
                                      {invoice.status !== 'paid' && (
                                        <button
                                          onClick={() => {
                                            handleMarkAsPaid(invoice);
                                            setOpenMenuId(null);
                                          }}
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
                            {invoice.status === 'paid' && (invoice.paymentMethod || invoice.paymentReference) && (
                              <tr className="bg-slate-50">
                                <td colSpan={7} className="px-6 py-2 text-xs text-slate-600">
                                  Paid: {invoice.paidAt ? formatDate(invoice.paidAt) : 'N/A'}
                                  {invoice.isFactored && invoice.factoringCompanyName && ` (${invoice.factoringCompanyName})`}
                                  {invoice.paymentMethod && ` • Method: ${invoice.paymentMethod}`}
                                  {invoice.paymentReference && ` • Ref: ${invoice.paymentReference}`}
                                </td>
                              </tr>
                            )}
                            {invoice.isFactored && invoice.factoringCompanyName && invoice.status !== 'paid' && (
                              <tr className="bg-blue-50">
                                <td colSpan={7} className="px-6 py-2 text-xs text-blue-600">
                                  Factored: {invoice.factoringCompanyName} ({invoice.factoredDate ? formatDate(invoice.factoredDate) : 'N/A'})
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {Math.ceil(filteredInvoices.length / itemsPerPage) > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length} invoices
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border rounded-lg disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredInvoices.length / itemsPerPage), prev + 1))}
                      disabled={currentPage >= Math.ceil(filteredInvoices.length / itemsPerPage)}
                      className="px-4 py-2 border rounded-lg disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: FACTORED LOADS */}
          {activeTab === 'factored' && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                      value={factoredSearchTerm}
                      onChange={(e) => setFactoredSearchTerm(e.target.value)}
                      placeholder="Search by load #, customer, invoice..."
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Factored Loads Table */}
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
                          <React.Fragment key={load.id}>
                            <tr className="hover:bg-slate-50">
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
                                    ✓ PAID
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
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAB 3: FACTORING COMPANIES */}
          {activeTab === 'companies' && (
            <>
              {/* Header with Search */}
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={companySearchTerm}
                        onChange={(e) => setCompanySearchTerm(e.target.value)}
                        placeholder="Search factoring companies..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
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
                            ● ACTIVE
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Factoring Company Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
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
                  onChange={handleCompanySelect}
                  factoringCompanies={factoringCompanies}
                  onAddCompany={handleAddNewCompany}
                  placeholder="Type to search factoring companies (e.g., TAFS, TAB, WEX)..."
                />
                {/* Hidden input for form validation */}
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
                  }}
                  className="px-4 py-2 border rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-4 py-2 rounded-md"
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

export default AccountReceivables;


import React, { useState, useMemo } from 'react';
import { Plus, Building2, Edit, Trash2, Search, X, MapPin, DollarSign, FileText, CheckCircle, Clock, AlertCircle, Truck } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { FactoringCompany, NewFactoringCompanyInput, Load, Invoice } from '../types';
import { useDebounce } from '../utils/debounce';

const FactoringCompanies: React.FC = () => {
  const { factoringCompanies, loads, invoices, addFactoringCompany, updateFactoringCompany, deleteFactoringCompany, updateInvoice, updateLoad } = useTMS();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<FactoringCompany | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'companies' | 'factored'>('factored'); // Toggle between companies list and factored loads (default to factored loads)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(''); // Filter by specific factoring company
  const itemsPerPage = 10;

  // Filter companies
  const filteredCompanies = useMemo(() => {
    return factoringCompanies.filter(company => {
      const matchesSearch = !debouncedSearchTerm ||
        company.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        company.address?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        company.city?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        company.phone?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        company.email?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [factoringCompanies, debouncedSearchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage);
  const paginatedCompanies = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCompanies.slice(start, start + itemsPerPage);
  }, [filteredCompanies, currentPage]);

  const handleEdit = (company: FactoringCompany) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const handleDelete = (companyId: string) => {
    if (window.confirm('Are you sure you want to delete this factoring company?')) {
      deleteFactoringCompany(companyId);
    }
  };

  const handleSave = (companyData: NewFactoringCompanyInput) => {
    if (editingCompany) {
      updateFactoringCompany(editingCompany.id, companyData);
    } else {
      addFactoringCompany(companyData);
    }
    setIsModalOpen(false);
    setEditingCompany(null);
  };

  const formatAddress = (company: FactoringCompany) => {
    const parts = [];
    if (company.address) parts.push(company.address);
    if (company.city) parts.push(company.city);
    if (company.state) parts.push(company.state);
    if (company.zipCode) parts.push(company.zipCode);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  };

  // Get all factored loads/invoices
  const factoredData = useMemo(() => {
    const factoredLoads: Array<{ load: Load; invoice?: Invoice; factoringCompany?: FactoringCompany }> = [];
    
    loads.forEach(load => {
      if (load.isFactored && load.factoringCompanyId) {
        const invoice = invoices.find(inv => inv.loadIds?.includes(load.id) || inv.loadId === load.id);
        const factoringCompany = factoringCompanies.find(fc => fc.id === load.factoringCompanyId);
        
        factoredLoads.push({
          load,
          invoice,
          factoringCompany
        });
      }
    });

    // Filter by selected company if any
    if (selectedCompanyId) {
      return factoredLoads.filter(item => item.load.factoringCompanyId === selectedCompanyId);
    }

    return factoredLoads.sort((a, b) => {
      const dateA = new Date(a.load.factoredDate || a.load.deliveryDate || '').getTime();
      const dateB = new Date(b.load.factoredDate || b.load.deliveryDate || '').getTime();
      return dateB - dateA; // Most recent first
    });
  }, [loads, invoices, factoringCompanies, selectedCompanyId]);

  // Calculate factoring stats
  const factoringStats = useMemo(() => {
    const totalFactored = factoredData.length;
    // Total Factored Amount = sum of grandTotal (invoice amounts that were factored)
    const totalFactoredAmount = factoredData.reduce((sum, item) => {
      // Use grandTotal (total invoice amount) as the factored amount
      return sum + (item.load.grandTotal || item.load.rate || 0);
    }, 0);
    
    // Calculate total fees and net received using factoring company fee rates
    let totalFees = 0;
    let totalNetReceived = 0;
    
    factoredData.forEach(item => {
      const factoredAmount = item.load.grandTotal || item.load.rate || 0;
      // Get fee rate from factoring company (default to 2.5% if not set)
      const feeRate = item.factoringCompany?.feePercentage || item.load.factoringFeePercent || 2.5;
      // Net Received = Factored Amount * (1 - Fee Rate / 100)
      const netReceived = factoredAmount * (1 - feeRate / 100);
      // Fee = Factored Amount - Net Received
      const fee = factoredAmount - netReceived;
      totalFees += fee;
      totalNetReceived += netReceived;
    });
    
    const paidCount = factoredData.filter(item => item.invoice?.status === 'paid').length;
    
    return {
      totalFactored,
      totalFactoredAmount, // Total invoice amounts factored
      totalFees, // Total fees charged (calculated from fee rates)
      netReceived: totalNetReceived, // Net amount received after fees
      paidCount,
      pendingCount: totalFactored - paidCount
    };
  }, [factoredData]);

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Account Receivables</h1>
          <p className="text-slate-600 mt-2">Track factored loads and manage factoring company information</p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('companies')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'companies'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Factoring Company Information
            </button>
            <button
              onClick={() => setViewMode('factored')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'factored'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Factored Loads
            </button>
          </div>
          <button
            onClick={() => {
              setEditingCompany(null);
              setIsModalOpen(true);
            }}
            className="btn-primary px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            Add Factoring Company
          </button>
        </div>
      </div>

      {/* View Toggle: Companies or Factored Loads */}
      {viewMode === 'factored' ? (
        <>
          {/* Factored Loads Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Truck size={20} className="text-blue-600" />
                </div>
                <div className="ml-5">
                  <dt className="text-sm font-medium text-slate-500">Total Factored</dt>
                  <dd className="text-2xl font-semibold text-slate-900">{factoringStats.totalFactored}</dd>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign size={20} className="text-green-600" />
                </div>
                <div className="ml-5">
                  <dt className="text-sm font-medium text-slate-500">Total Factored Amount</dt>
                  <dd className="text-2xl font-semibold text-slate-900">{formatCurrency(factoringStats.totalFactoredAmount)}</dd>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <CheckCircle size={20} className="text-purple-600" />
                </div>
                <div className="ml-5">
                  <dt className="text-sm font-medium text-slate-500">Paid by Factoring</dt>
                  <dd className="text-2xl font-semibold text-slate-900">{factoringStats.paidCount}</dd>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock size={20} className="text-yellow-600" />
                </div>
                <div className="ml-5">
                  <dt className="text-sm font-medium text-slate-500">Pending Payment</dt>
                  <dd className="text-2xl font-semibold text-slate-900">{factoringStats.pendingCount}</dd>
                </div>
              </div>
            </div>
          </div>

          {/* Filter by Factoring Company */}
          <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Filter by Factoring Company</label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    setCurrentPage(1);
                  }}
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
                  <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search by load number, customer, invoice..."
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Factored Loads Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">All Factored Loads & Invoices</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Load #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Factoring Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Invoice #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Factored Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Factored Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Net Received</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {factoredData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                        {selectedCompanyId ? 'No factored loads found for this company.' : 'No factored loads yet. Factor a load to see it here.'}
                      </td>
                    </tr>
                  ) : (
                    factoredData
                      .filter(item => {
                        if (!searchTerm) return true;
                        const search = searchTerm.toLowerCase();
                        return (
                          item.load.loadNumber.toLowerCase().includes(search) ||
                          item.load.customerName.toLowerCase().includes(search) ||
                          item.invoice?.invoiceNumber.toLowerCase().includes(search) ||
                          item.factoringCompany?.name.toLowerCase().includes(search)
                        );
                      })
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((item, index) => {
                        const load = item.load;
                        const invoice = item.invoice;
                        const company = item.factoringCompany;
                        // Factored Amount = grandTotal (total invoice amount)
                        const factoredAmount = load.grandTotal || load.rate || 0;
                        // Fee Rate from factoring company (default to 2.5% if not set)
                        const feeRate = company?.feePercentage || load.factoringFeePercent || 2.5;
                        // Net Received = Factored Amount * (1 - Fee Rate / 100)
                        const netReceived = factoredAmount * (1 - feeRate / 100);
                        // Fee = Factored Amount - Net Received
                        const fee = factoredAmount - netReceived;
                        const isPaid = invoice?.status === 'paid' || invoice?.isFactored;

                        return (
                          <tr key={load.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-slate-900">{load.loadNumber}</div>
                              <div className="text-xs text-slate-500">{load.originCity}, {load.originState} → {load.destCity}, {load.destState}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-900">{load.customerName}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-900">{company?.name || load.factoringCompanyName || 'N/A'}</div>
                              {company?.feePercentage && (
                                <div className="text-xs text-slate-500">{company.feePercentage}% fee</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {invoice ? (
                                <div className="text-sm font-medium text-slate-900">{invoice.invoiceNumber}</div>
                              ) : (
                                <div className="text-sm text-slate-400">No Invoice</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-900">{formatDate(load.factoredDate)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-slate-900">{formatCurrency(factoredAmount)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-600">{formatCurrency(fee)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-green-600">{formatCurrency(netReceived)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                {isPaid ? (
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                    <CheckCircle size={12} className="mr-1" />
                                    PAID
                                  </span>
                                ) : (
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                    <Clock size={12} className="mr-1" />
                                    PENDING
                                  </span>
                                )}
                                {invoice?.isFactored && (
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                    FACTORED
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {!isPaid && (
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Mark load ${load.loadNumber} as paid/received from factoring company?`)) {
                                      // Update invoice status to paid
                                      if (invoice) {
                                        updateInvoice(invoice.id, {
                                          status: 'paid',
                                          paidAt: new Date().toISOString(),
                                          paidAmount: netReceived,
                                          paymentMethod: 'Factoring Company',
                                          paymentReference: `Factored-${load.loadNumber}`
                                        });
                                      }
                                    }
                                  }}
                                  className="text-green-600 hover:text-green-900 flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-green-50 transition-colors"
                                  title="Mark as Paid/Received"
                                >
                                  <CheckCircle size={16} />
                                  <span className="text-xs font-medium">Mark Paid</span>
                                </button>
                              )}
                              {isPaid && (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {Math.ceil(factoredData.length / itemsPerPage) > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm text-slate-700">
                  Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * itemsPerPage, factoredData.length)}
                  </span>{' '}
                  of <span className="font-medium">{factoredData.length}</span> factored loads
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.ceil(factoredData.length / itemsPerPage) }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        currentPage === page
                          ? 'text-white bg-blue-600 border border-transparent'
                          : 'text-slate-500 bg-white border border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(factoredData.length / itemsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(factoredData.length / itemsPerPage)}
                    className="px-3 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Companies Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">All Factoring Companies</h3>
            </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Company Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fee Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {paginatedCompanies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    {searchTerm ? 'No factoring companies found matching your search.' : 'No factoring companies yet. Add your first factoring company to get started.'}
                  </td>
                </tr>
              ) : (
                paginatedCompanies.map(company => (
                  <tr key={company.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{company.name}</div>
                      {company.contactName && (
                        <div className="text-sm text-slate-500">Contact: {company.contactName}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900">{formatAddress(company)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {company.phone && (
                        <div className="text-sm text-slate-900">{company.phone}</div>
                      )}
                      {company.email && (
                        <div className="text-sm text-slate-500">{company.email}</div>
                      )}
                      {!company.phone && !company.email && (
                        <div className="text-sm text-slate-400">N/A</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">
                        {company.feePercentage ? `${company.feePercentage}%` : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(company)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(company.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-700">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(currentPage * itemsPerPage, filteredCompanies.length)}
              </span>{' '}
              of <span className="font-medium">{filteredCompanies.length}</span> companies
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    currentPage === page
                      ? 'text-white bg-blue-600 border border-transparent'
                      : 'text-slate-500 bg-white border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {/* Factoring Company Modal */}
      {isModalOpen && (
        <FactoringCompanyModal
          company={editingCompany}
          onClose={() => {
            setIsModalOpen(false);
            setEditingCompany(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

// Factoring Company Modal Component
interface FactoringCompanyModalProps {
  company: FactoringCompany | null;
  onClose: () => void;
  onSave: (company: NewFactoringCompanyInput) => void;
}

const FactoringCompanyModal: React.FC<FactoringCompanyModalProps> = ({ company, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<NewFactoringCompanyInput>>({
    name: company?.name || '',
    contactName: company?.contactName || '',
    phone: company?.phone || '',
    email: company?.email || '',
    feePercentage: company?.feePercentage || 0,
    address: company?.address || '',
    city: company?.city || '',
    state: company?.state || '',
    zipCode: company?.zipCode || '',
    notes: company?.notes || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Company name is required');
      return;
    }
    onSave(formData as NewFactoringCompanyInput);
  };

  const US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">
            {company ? `Edit Factoring Company` : 'Add New Factoring Company'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto p-6 flex-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Information */}
            <div>
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Company Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Company Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Fee Rate (%) *</label>
                  <input
                    type="number"
                    name="feePercentage"
                    value={formData.feePercentage}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 3.5"
                  />
                  <p className="text-xs text-slate-500 mt-1">Typical range: 2-5%</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Contact Name</label>
                  <input
                    type="text"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Address</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Street Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">State</label>
                  <select
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select State</option>
                    {US_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">ZIP Code</label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="border-t pt-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes about this factoring company..."
              />
            </div>

            {/* Form Actions */}
            <div className="border-t pt-6 flex justify-end gap-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary px-6 py-2 rounded-lg"
              >
                {company ? 'Update Company' : 'Add Company'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FactoringCompanies;


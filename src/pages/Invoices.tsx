import React, { useState, useMemo, useEffect } from 'react';
import { FileText, DollarSign, Clock, AlertTriangle, Download, Printer, CheckCircle, Trash2, MoreHorizontal, X } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { useCompany } from '../context/CompanyContext';
import { Invoice, InvoiceStatus, LoadStatus } from '../types';

const Invoices: React.FC = () => {
  const { invoices, loads, addInvoice, updateInvoice, deleteInvoice, updateLoad } = useTMS();
  const { company } = useCompany();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const itemsPerPage = 10;

  // Check for overdue invoices on mount and periodically
  useEffect(() => {
    checkOverdueInvoices();
    createInvoicesForDeliveredLoads();
    
    const interval = setInterval(() => {
      checkOverdueInvoices();
      createInvoicesForDeliveredLoads();
    }, 60 * 60 * 1000); // Every hour

    return () => clearInterval(interval);
  }, [loads, invoices]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && !(event.target as Element).closest('.menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  // Check and update overdue invoices
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

  // Auto-create invoices for delivered loads
  const createInvoicesForDeliveredLoads = () => {
    const deliveredLoads = loads.filter(load => {
      const status = load.status;
      const isDelivered = status === LoadStatus.Delivered || status === LoadStatus.Completed;
      const hasNoInvoice = !(load as any).invoiceId;
      return isDelivered && hasNoInvoice && load.customerName;
    });

    deliveredLoads.forEach(load => {
      // Check if invoice already exists
      const existingInvoice = invoices.find(inv => 
        inv.customerName === load.customerName &&
        inv.loadIds?.includes(load.id)
      );

      if (!existingInvoice && load.rate > 0) {
        const today = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // Net 30

        const newInvoice: Omit<Invoice, 'id'> = {
          invoiceNumber: `INV-${new Date().getFullYear()}-${invoices.length + 1001}`,
          customerName: load.customerName,
          loadIds: [load.id],
          amount: load.rate,
          status: 'pending',
          date: today.toISOString().split('T')[0],
          dueDate: dueDate.toISOString().split('T')[0],
        };

        addInvoice(newInvoice);
        
        // Link load to invoice (would need updateLoad in context)
        // For now, we'll just create the invoice
      }
    });
  };

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const matchesStatus = !statusFilter || invoice.status === statusFilter;
      const matchesSearch = !searchTerm ||
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [invoices, statusFilter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(start, start + itemsPerPage);
  }, [filteredInvoices, currentPage]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = invoices.length;
    
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const paidThisMonth = invoices
      .filter(inv => {
        if (inv.status !== 'paid' || !inv.paidAt) return false;
        const paidDate = new Date(inv.paidAt);
        return paidDate >= firstDayOfMonth;
      })
      .reduce((sum, inv) => sum + inv.amount, 0);

    const pending = invoices.filter(inv => inv.status === 'pending').length;
    const overdue = invoices.filter(inv => inv.status === 'overdue').length;

    return { total, paidThisMonth, pending, overdue };
  }, [invoices]);

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status: InvoiceStatus) => {
    const colors = {
      'paid': 'bg-green-100 text-green-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'overdue': 'bg-red-100 text-red-800',
      'draft': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleMarkAsPaid = (invoiceId: string) => {
    const paymentDate = prompt('Enter payment date (YYYY-MM-DD) or leave blank for today:', new Date().toISOString().split('T')[0]);
    
    if (paymentDate === null) return;

    let paidDate: string;
    if (paymentDate.trim() === '') {
      paidDate = new Date().toISOString();
    } else {
      const date = new Date(paymentDate);
      if (isNaN(date.getTime())) {
        alert('Invalid date format. Please use YYYY-MM-DD');
        return;
      }
      paidDate = date.toISOString();
    }

    updateInvoice(invoiceId, {
      status: 'paid',
      paidAt: paidDate,
    });
  };

  const handleDelete = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    const confirmMessage = invoice?.status === 'paid'
      ? 'Are you sure you want to delete this PAID invoice? This action cannot be undone.'
      : 'Are you sure you want to delete this invoice?';

    if (window.confirm(confirmMessage)) {
      deleteInvoice(invoiceId);
    }
  };

  const handleDownload = (invoice: Invoice) => {
    const loadIds = invoice.loadIds || (invoice.loadId ? [invoice.loadId] : []);
    const invoiceLoads = loads.filter(l => loadIds.includes(l.id));

    if (invoiceLoads.length === 0) {
      alert('No loads found for this invoice');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print invoices');
      return;
    }

    const loadRows = invoiceLoads.map(load => {
      const deliveryDate = load.deliveryDate || load.pickupDate || 'N/A';
      const origin = `${load.originCity}, ${load.originState}`;
      const destination = `${load.destCity}, ${load.destState}`;
      const rateTotal = load.rate || 0;

      return `
        <tr>
          <td>${load.loadNumber}</td>
          <td>${formatDate(deliveryDate)}</td>
          <td>Freight: ${origin} to ${destination}</td>
          <td style="text-align: right">${formatCurrency(rateTotal)}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; margin: 0; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .company-info h1 { margin: 0; color: #1f2937; }
          .invoice-details { text-align: right; }
          .bill-to { margin-bottom: 30px; }
          .bill-to h3 { margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f8f9fa; font-weight: bold; }
          .total { margin-top: 20px; text-align: right; font-size: 1.2em; font-weight: bold; }
          @media print { 
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            <h1>${company.name}</h1>
            <p style="margin:5px 0 0 0; color:#666; font-size:12px; line-height:1.6;">
              ${company.address ? `${company.address}<br>` : ''}${company.city && company.state ? `${company.city}, ${company.state} ${company.zip || ''}<br>` : ''}${company.phone || ''}
            </p>
          </div>
          <div class="invoice-details">
            <h2>INVOICE</h2>
            <p><strong>Invoice #:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Date:</strong> ${formatDate(invoice.date)}</p>
            <p><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>
          </div>
        </div>
        <div class="bill-to">
          <h3>Bill To:</h3>
          <p><strong>${invoice.customerName}</strong></p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Load #</th>
              <th>Date</th>
              <th>Description</th>
              <th style="text-align: right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${loadRows}
          </tbody>
        </table>
        <div class="total">
          Total Due: ${formatCurrency(invoice.amount)}
        </div>
        <div style="margin-top: 50px; text-align: center; color: #666; font-size: 0.9em;">
          <p>Thank you for your business!</p>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  const handlePrint = (invoice: Invoice) => {
    handleDownload(invoice);
    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.print();
      }
    }, 500);
  };

  const handleExport = () => {
    const csv = [
      ['Invoice #', 'Customer', 'Date', 'Due Date', 'Amount', 'Status', 'Paid Date'].join(','),
      ...filteredInvoices.map(invoice => [
        invoice.invoiceNumber,
        invoice.customerName,
        invoice.date,
        invoice.dueDate || '',
        invoice.amount,
        invoice.status,
        invoice.paidAt || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Invoicing System</h1>
          <p className="text-slate-600 mt-2">Invoices are automatically created when loads are delivered</p>
        </div>
      </div>

      {/* Invoice Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText size={20} className="text-blue-600" />
            </div>
            <div className="ml-5">
              <dt className="text-sm font-medium text-slate-500">Total Invoices</dt>
              <dd className="text-2xl font-semibold text-slate-900">{stats.total}</dd>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-green-600" />
            </div>
            <div className="ml-5">
              <dt className="text-sm font-medium text-slate-500">Paid This Month</dt>
              <dd className="text-2xl font-semibold text-slate-900">{formatCurrency(stats.paidThisMonth)}</dd>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-yellow-600" />
            </div>
            <div className="ml-5">
              <dt className="text-sm font-medium text-slate-500">Pending</dt>
              <dd className="text-2xl font-semibold text-slate-900">{stats.pending}</dd>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div className="ml-5">
              <dt className="text-sm font-medium text-slate-500">Overdue</dt>
              <dd className="text-2xl font-semibold text-slate-900">{stats.overdue}</dd>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              {(['pending', 'paid', 'overdue', 'draft'] as InvoiceStatus[]).map(status => (
                <option key={status} value={status}>{status.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Invoice #, customer..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleExport}
              className="w-full bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">All Invoices</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No invoices found. Invoices are automatically created when loads are delivered.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map(invoice => {
                  const loadIds = invoice.loadIds || (invoice.loadId ? [invoice.loadId] : []);
                  const loadCount = loadIds.length;

                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{invoice.invoiceNumber}</div>
                        <div className="text-sm text-slate-500">{loadCount} load{loadCount !== 1 ? 's' : ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{invoice.customerName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{formatDate(invoice.date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{formatDate(invoice.dueDate)}</div>
                        {invoice.status === 'paid' && invoice.paidAt && (
                          <div className="text-xs text-green-600 mt-1">
                            Paid: {formatDate(invoice.paidAt)}
                            {invoice.paymentMethod && (
                              <span className="ml-1">({invoice.paymentMethod})</span>
                            )}
                            {invoice.paymentReference && (
                              <span className="ml-1 text-slate-500">Ref: {invoice.paymentReference}</span>
                            )}
                          </div>
                        )}
                        {invoice.isFactored && invoice.factoringCompanyName && (
                          <div className="text-xs text-blue-600 mt-1">
                            Factored: {invoice.factoringCompanyName} ({formatDate(invoice.factoredDate || '')})
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{formatCurrency(invoice.amount)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                            {invoice.status.toUpperCase()}
                          </span>
                          {invoice.isFactored && (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              FACTORED
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="relative menu-container">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === invoice.id ? null : invoice.id)}
                            className="text-slate-600 hover:text-slate-900"
                          >
                            <MoreHorizontal size={20} />
                          </button>
                          {openMenuId === invoice.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-10">
                              <button
                                onClick={() => {
                                  handleDownload(invoice);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Download size={16} />
                                Download
                              </button>
                              <button
                                onClick={() => {
                                  handlePrint(invoice);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Printer size={16} />
                                Print
                              </button>
                              {invoice.status !== 'paid' && (
                                <button
                                  onClick={() => {
                                    handleMarkAsPaid(invoice.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                                >
                                  <CheckCircle size={16} />
                                  Mark as Paid
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  handleDelete(invoice.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 size={16} />
                                Delete
                              </button>
                            </div>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-700">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(currentPage * itemsPerPage, filteredInvoices.length)}
              </span>{' '}
              of <span className="font-medium">{filteredInvoices.length}</span> invoices
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
    </div>
  );
};

export default Invoices;

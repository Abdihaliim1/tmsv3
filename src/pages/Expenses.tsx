import React, { useState, useEffect } from 'react';
import { Plus, Download, Filter, Receipt, Fuel, Wrench, Shield, MapPin, DollarSign, FileText, Bed, MoreHorizontal, Edit, Trash2, X } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { Expense } from '../types';

const Expenses: React.FC = () => {
  const { drivers, expenses, addExpense, updateExpense, deleteExpense } = useTMS();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Form state
  const [formData, setFormData] = useState<Omit<Expense, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    type: 'fuel',
    description: '',
    amount: 0,
    status: 'pending',
  });
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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

  const getTypeIcon = (type: Expense['type']) => {
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
    return icons[type] || Receipt;
  };

  const getTypeColor = (type: Expense['type']) => {
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
    return colors[type] || colors.other;
  };

  const getStatusBadge = (status: Expense['status']) => {
    const styles = {
      pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredExpenses = expenses.filter(expense => {
    if (filterType !== 'all' && expense.type !== filterType) return false;
    if (filterStatus !== 'all' && expense.status !== filterStatus) return false;
    return true;
  });

  const totalAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const pendingAmount = expenses.filter(e => e.status === 'pending').reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expense Tracking</h1>
          <p className="text-slate-500 mt-1">Track fuel, maintenance, lumper fees, and all receipts</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <DollarSign size={24} />
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">Total Expenses</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-yellow-100 text-yellow-600 p-3 rounded-lg">
              <Receipt size={24} />
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">Pending Approval</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-emerald-100 text-emerald-600 p-3 rounded-lg">
              <FileText size={24} />
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">Total Count</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{expenses.length}</h3>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Filters:</span>
          </div>
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
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    No expenses found. Add a new expense to get started.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => {
                  const TypeIcon = getTypeIcon(expense.type);
                  return (
                    <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{expense.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <TypeIcon size={18} className="text-slate-500" />
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getTypeColor(expense.type)}`}>
                            {expense.type.charAt(0).toUpperCase() + expense.type.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">{expense.description}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {expense.driverName || expense.truckId || <span className="text-slate-400 italic">N/A</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-900">
                        ${expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(expense.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {expense.receipt ? (
                          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                            View Receipt
                          </button>
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
                                  setSelectedTruckId(expenseToEdit.truckId || '');
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
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this expense?')) {
                                  deleteExpense(expense.id);
                                  setOpenMenuId(null);
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
            <form onSubmit={(e) => {
              e.preventDefault();
              if (isEditModalOpen && editingExpenseId) {
                // Update existing expense
                const driverName = selectedDriverId ? drivers.find(d => d.id === selectedDriverId)?.firstName + ' ' + drivers.find(d => d.id === selectedDriverId)?.lastName : undefined;
                updateExpense(editingExpenseId, {
                  ...formData,
                  driverId: selectedDriverId || undefined,
                  driverName,
                  truckId: selectedTruckId || undefined,
                });
                setIsEditModalOpen(false);
                setEditingExpenseId(null);
              } else {
                // Add new expense
                const driverName = selectedDriverId ? drivers.find(d => d.id === selectedDriverId)?.firstName + ' ' + drivers.find(d => d.id === selectedDriverId)?.lastName : undefined;
                addExpense({
                  ...formData,
                  driverId: selectedDriverId || undefined,
                  driverName,
                  truckId: selectedTruckId || undefined,
                });
                setIsAddModalOpen(false);
              }
              // Reset form
              setFormData({
                date: new Date().toISOString().split('T')[0],
                type: 'fuel',
                description: '',
                amount: 0,
                status: 'pending',
              });
              setSelectedDriverId('');
              setSelectedTruckId('');
            }} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Expense Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Expense['type'] })}
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
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter expense description..."
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Driver/Truck Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Amount ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Receipt Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Receipt (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // In a real app, you'd upload this to storage
                      // For now, we'll just store the filename
                      setFormData({ ...formData, receipt: file.name });
                    }
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">Upload receipt image or PDF</p>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
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
                    setFormData({
                      date: new Date().toISOString().split('T')[0],
                      type: 'fuel',
                      description: '',
                      amount: 0,
                      status: 'pending',
                    });
                    setSelectedDriverId('');
                    setSelectedTruckId('');
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


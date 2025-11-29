import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Download, Printer, RefreshCw, Eye, Trash2, DollarSign, Users, Clock, Calculator, Search } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { Settlement, Load, LoadStatus } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { validatePayPercentage } from '../services/utils';

const Settlements: React.FC = () => {
  const { settlements, drivers, loads, addSettlement, updateSettlement, deleteSettlement, updateLoad } = useTMS();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [selectedLoads, setSelectedLoads] = useState<string[]>([]);
  const [fuelDeduction, setFuelDeduction] = useState<number>(0);
  const [otherDeduction, setOtherDeduction] = useState<number>(0);
  const [driverFilter, setDriverFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [weekFilter, setWeekFilter] = useState<string>('');

  // Helper functions (defined before useMemo and useEffect)
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const getDateOfISOWeek = (week: number, year: number): Date => {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = new Date(simple);
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return ISOweekStart;
  };

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff);
  };

  const formatDateRange = (start: Date, end: Date): string => {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  // Set current week
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const weekNum = getWeekNumber(now);
    const weekStr = `${year}-W${weekNum.toString().padStart(2, '0')}`;
    setSelectedWeek(weekStr);
    setWeekFilter(weekStr);
  }, []);


  // Get available loads for selected driver and week
  const availableLoads = useMemo(() => {
    if (!selectedDriverId || !selectedWeek) return [];

    try {
      const [year, week] = selectedWeek.split('-W');
      if (!year || !week) return [];
      
      const weekStart = getDateOfISOWeek(parseInt(week), parseInt(year));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      return loads.filter(load => {
        try {
          const isDriver = load.driverId === selectedDriverId;
          const isDelivered = load.status === LoadStatus.Delivered || load.status === LoadStatus.Completed;
          const notSettled = !load.settlementId; // Only show loads that haven't been settled
          
          // Check delivery date (try multiple fields like HTML does)
          const deliveryDateStr = load.deliveryDate || load.pickupDate || '';
          if (!deliveryDateStr) return false;
          
          const deliveryDate = new Date(deliveryDateStr);
          if (isNaN(deliveryDate.getTime())) return false;
          
          const inPeriod = deliveryDate >= weekStart && deliveryDate <= weekEnd;
          return isDriver && isDelivered && notSettled && inPeriod;
        } catch (error) {
          console.warn('Error processing load:', load.id, error);
          return false;
        }
      });
    } catch (error) {
      console.error('Error calculating available loads:', error);
      return [];
    }
  }, [selectedDriverId, selectedWeek, loads]);

  // Calculate settlement totals
  const settlementTotals = useMemo(() => {
    const selectedLoadsData = availableLoads.filter(load => selectedLoads.includes(load.id));
    const driver = drivers.find(d => d.id === selectedDriverId);
    
    let grossPay = 0;
    let totalMiles = 0;

    selectedLoadsData.forEach(load => {
      // Use validatePayPercentage like HTML does
      let payPercentage = 1; // Default for company drivers
      if (driver) {
        if (driver.type === 'OwnerOperator') {
          // Owner Operator: use payPercentage or rateOrSplit
          const rawPercentage = driver.payPercentage || driver.rateOrSplit || 0;
          payPercentage = validatePayPercentage(rawPercentage, driver.type);
        } else {
          // Company driver: full rate (paid separately)
          payPercentage = 1;
        }
      }
      grossPay += load.rate * payPercentage;
      totalMiles += load.miles || 0;
    });

    const totalDeductions = fuelDeduction + otherDeduction;
    const netPay = Math.max(0, grossPay - totalDeductions);

    return { grossPay, totalDeductions, netPay, totalMiles };
  }, [selectedLoads, availableLoads, fuelDeduction, otherDeduction, selectedDriverId, drivers]);

  // Update period display
  const periodDisplay = useMemo(() => {
    if (!selectedWeek) return 'Select a week to see the period';
    try {
      const [year, week] = selectedWeek.split('-W');
      if (!year || !week) return 'Select a week to see the period';
      const weekStart = getDateOfISOWeek(parseInt(week), parseInt(year));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return formatDateRange(weekStart, weekEnd);
    } catch (error) {
      console.error('Error calculating period display:', error);
      return 'Select a week to see the period';
    }
  }, [selectedWeek]);

  // Filtered settlements
  const filteredSettlements = useMemo(() => {
    let filtered = settlements;
    if (driverFilter) filtered = filtered.filter(s => s.driverId === driverFilter);
    if (statusFilter) filtered = filtered.filter(s => s.status === statusFilter);
    return filtered;
  }, [settlements, driverFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = getWeekStart(now);
    const thisWeekSettlements = settlements.filter(s => {
      const created = new Date(s.createdAt || s.date || '');
      return created >= weekStart;
    });
    const thisWeekTotal = thisWeekSettlements.reduce((sum, s) => sum + (s.netPay || 0), 0);
    const pending = settlements.filter(s => s.status === 'pending').length;
    const avgSettlement = settlements.length > 0
      ? settlements.reduce((sum, s) => sum + (s.netPay || 0), 0) / settlements.length
      : 0;

    return {
      thisWeekTotal,
      totalSettlements: settlements.length,
      pending,
      avgSettlement,
    };
  }, [settlements]);

  // Chart data
  const weeklyTrendsData = useMemo(() => {
    const weeklyData: Record<string, { settlements: number; totalAmount: number }> = {};
    const today = new Date();

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const weekKey = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
      weeklyData[weekKey] = { settlements: 0, totalAmount: 0 };

      settlements.forEach(settlement => {
        const dateValue = settlement.createdAt || settlement.date;
        if (!dateValue) return;
        const settlementDate = new Date(dateValue);
        if (settlementDate >= weekStart && settlementDate <= weekEnd) {
          weeklyData[weekKey].settlements++;
          weeklyData[weekKey].totalAmount += settlement.netPay || 0;
        }
      });
    }

    return Object.keys(weeklyData).map(week => ({
      name: week,
      settlements: weeklyData[week].settlements,
      amount: weeklyData[week].totalAmount,
    }));
  }, [settlements]);

  const statusChartData = useMemo(() => {
    const statusCounts = { Paid: 0, Pending: 0, Processed: 0 };
    settlements.forEach(s => {
      const status = s.status || 'pending';
      if (status === 'paid') statusCounts.Paid++;
      else if (status === 'processed') statusCounts.Processed++;
      else statusCounts.Pending++;
    });
    return Object.keys(statusCounts).map(key => ({
      name: key,
      value: statusCounts[key as keyof typeof statusCounts],
    })).filter(item => item.value > 0);
  }, [settlements]);

  const COLORS = ['#10b981', '#f59e0b', '#3b82f6'];

  // Auto-populate expenses for Owner Operators
  const autoPopulateExpenses = useMemo(() => {
    if (!selectedDriverId) return { fuel: 0, other: 0, expenseIds: [] };
    
    const driver = drivers.find(d => d.id === selectedDriverId);
    if (!driver || driver.type !== 'OwnerOperator') {
      return { fuel: 0, other: 0, expenseIds: [] };
    }

    // Note: Expenses would need to be in context - for now return empty
    // This matches HTML logic but requires expenses in context
    return { fuel: 0, other: 0, expenseIds: [] };
  }, [selectedDriverId, drivers]);

  // Generate settlement
  const handleGenerateSettlement = () => {
    if (!selectedDriverId || selectedLoads.length === 0) {
      alert('Please select a driver and at least one load');
      return;
    }

    const driver = drivers.find(d => d.id === selectedDriverId);
    if (!driver) return;

    const settlementNumber = `ST-${new Date().getFullYear()}-${1000 + settlements.length + 1}`;
    const [year, week] = selectedWeek.split('-W');
    const weekStart = getDateOfISOWeek(parseInt(week), parseInt(year));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const newSettlement: Omit<Settlement, 'id'> = {
      settlementNumber,
      driverId: selectedDriverId,
      driverName: `${driver.firstName} ${driver.lastName}`,
      loadIds: selectedLoads,
      expenseIds: autoPopulateExpenses.expenseIds,
      grossPay: settlementTotals.grossPay,
      totalDeductions: settlementTotals.totalDeductions,
      fuelDeduction,
      otherDeduction,
      netPay: settlementTotals.netPay,
      totalMiles: settlementTotals.totalMiles,
      status: 'pending',
      createdAt: new Date().toISOString(),
      period: {
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
        display: periodDisplay,
      },
    };

    // Add settlement and get the ID
    const settlementId = addSettlement(newSettlement);
    
    // Mark loads as settled (like HTML does)
    selectedLoads.forEach(loadId => {
      updateLoad(loadId, { settlementId });
    });

    setIsModalOpen(false);
    setSelectedDriverId('');
    setSelectedLoads([]);
    setFuelDeduction(0);
    setOtherDeduction(0);
  };

  // Toggle load selection
  const toggleLoad = (loadId: string) => {
    setSelectedLoads(prev =>
      prev.includes(loadId) ? prev.filter(id => id !== loadId) : [...prev, loadId]
    );
  };

  // Toggle all loads
  const toggleAllLoads = (checked: boolean) => {
    setSelectedLoads(checked ? availableLoads.map(l => l.id) : []);
  };

  // Delete settlement
  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this settlement?')) {
      deleteSettlement(id);
    }
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const styles = {
      paid: 'bg-green-100 text-green-800',
      processed: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Driver Settlements</h1>
          <p className="text-slate-600 mt-2">Manage driver payments and settlements</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={18} />
          Generate Settlement
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600" size={20} />
            </div>
            <div className="ml-5 flex-1">
              <p className="text-sm font-medium text-slate-500">This Week</p>
              <p className="text-2xl font-semibold text-slate-900">{formatCurrency(stats.thisWeekTotal)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="text-blue-600" size={20} />
            </div>
            <div className="ml-5 flex-1">
              <p className="text-sm font-medium text-slate-500">Settlements</p>
              <p className="text-2xl font-semibold text-slate-900">{stats.totalSettlements}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="text-yellow-600" size={20} />
            </div>
            <div className="ml-5 flex-1">
              <p className="text-sm font-medium text-slate-500">Pending</p>
              <p className="text-2xl font-semibold text-slate-900">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calculator className="text-purple-600" size={20} />
            </div>
            <div className="ml-5 flex-1">
              <p className="text-sm font-medium text-slate-500">Avg Settlement</p>
              <p className="text-2xl font-semibold text-slate-900">{formatCurrency(stats.avgSettlement)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Weekly Settlement Trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height={256}>
              <AreaChart data={weeklyTrendsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="settlements" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height={256}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Driver</label>
            <select
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Drivers</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processed">Processed</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Week</label>
            <input
              type="week"
              value={weekFilter}
              onChange={(e) => setWeekFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setDriverFilter('');
                setStatusFilter('');
                setWeekFilter('');
              }}
              className="w-full bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 flex items-center justify-center gap-2"
            >
              <Search size={18} />
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">Driver Settlements</h3>
          <div className="flex items-center gap-4">
            <button className="text-slate-600 hover:text-slate-800 flex items-center gap-2">
              <Download size={18} />
              Export
            </button>
            <button className="text-slate-600 hover:text-slate-800 flex items-center gap-2">
              <Printer size={18} />
              Print All
            </button>
            <button className="text-green-600 hover:text-green-800 flex items-center gap-2">
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Settlement #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Driver</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Miles</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Gross Pay</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Deductions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Net Pay</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    <p>No settlements found. Click "Generate Settlement" to create one.</p>
                  </td>
                </tr>
              ) : (
                filteredSettlements.map(settlement => (
                  <tr key={settlement.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {settlement.settlementNumber || settlement.id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{settlement.driverName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {settlement.period?.display || new Date(settlement.createdAt || settlement.date || '').toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{settlement.totalMiles || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{formatCurrency(settlement.grossPay)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">-{formatCurrency(settlement.totalDeductions || settlement.deductions || 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">{formatCurrency(settlement.netPay)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(settlement.status)}`}>
                        {(settlement.status || 'pending').charAt(0).toUpperCase() + (settlement.status || 'pending').slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button className="text-blue-600 hover:text-blue-800" title="View">
                        <Eye size={18} />
                      </button>
                      <button className="text-slate-600 hover:text-slate-800" title="Print PDF">
                        <Printer size={18} />
                      </button>
                      <button onClick={() => handleDelete(settlement.id)} className="text-red-600 hover:text-red-800" title="Delete">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Settlement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
              <h3 className="text-xl font-semibold">Generate Driver Settlement</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white hover:text-gray-200 text-2xl leading-none">
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Settlement Period */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-3">Settlement Period</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-1">Select Week</label>
                    <input
                      type="week"
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value)}
                      className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-1">Period</label>
                    <div className="text-sm text-blue-700 py-2 px-3 bg-white rounded border border-blue-200">
                      {periodDisplay}
                    </div>
                  </div>
                </div>
              </div>

              {/* Driver Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Driver</label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => {
                    setSelectedDriverId(e.target.value);
                    setSelectedLoads([]);
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a driver...</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
                  ))}
                </select>
              </div>

              {/* Available Loads */}
              {selectedDriverId && availableLoads.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 mb-4">Available Loads</h4>
                  <div className="overflow-x-auto border rounded-lg mb-6">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                            <input
                              type="checkbox"
                              checked={selectedLoads.length === availableLoads.length && availableLoads.length > 0}
                              onChange={(e) => toggleAllLoads(e.target.checked)}
                            />
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Load #</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Route</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Pay Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {availableLoads.map(load => {
                          const driver = drivers.find(d => d.id === selectedDriverId);
                          const payPercentage = driver?.type === 'OwnerOperator' ? (driver.rateOrSplit / 100) : 1;
                          const payAmount = load.rate * payPercentage;
                          return (
                            <tr key={load.id}>
                              <td className="px-4 py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedLoads.includes(load.id)}
                                  onChange={() => toggleLoad(load.id)}
                                />
                              </td>
                              <td className="px-4 py-2 text-sm font-medium">{load.loadNumber}</td>
                              <td className="px-4 py-2 text-sm">{new Date(load.deliveryDate).toLocaleDateString()}</td>
                              <td className="px-4 py-2 text-sm">{load.originCity} → {load.destCity}</td>
                              <td className="px-4 py-2 text-sm text-right font-semibold">{formatCurrency(payAmount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Deductions */}
                  <div className="bg-slate-50 p-4 rounded-lg mb-4">
                    <h5 className="font-medium text-slate-700 mb-3">Deductions</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Fuel</label>
                        <input
                          type="number"
                          value={fuelDeduction}
                          onChange={(e) => setFuelDeduction(parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Other</label>
                        <input
                          type="number"
                          value={otherDeduction}
                          onChange={(e) => setOtherDeduction(parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-600">
                        <span>Gross Pay:</span>
                        <span className="font-medium">{formatCurrency(settlementTotals.grossPay)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Total Deductions:</span>
                        <span className="font-medium">{formatCurrency(settlementTotals.totalDeductions)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-300">
                        <span className="text-xl font-bold text-slate-900">Net Pay:</span>
                        <span className="text-2xl font-extrabold text-green-600">{formatCurrency(settlementTotals.netPay)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedDriverId && availableLoads.length === 0 && (
                <div className="text-center py-8">
                  <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg inline-block">
                    No unpaid delivered loads found for this driver in the selected period.
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateSettlement}
                  disabled={!selectedDriverId || selectedLoads.length === 0}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate Settlement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settlements;

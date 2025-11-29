import React, { useState, useMemo } from 'react';
import { BarChart3, DollarSign, MapPin, Package, TrendingUp, Download, Printer, ArrowUp, ArrowDown } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { LoadStatus, DriverType } from '../types';
import { calculateCompanyRevenue } from '../services/utils';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

type TabType = 'overview' | 'revenue' | 'expenses' | 'drivers' | 'customers';
type PeriodType = 'current_month' | 'last_month' | 'current_quarter' | 'current_year' | 'all_time';

const Reports: React.FC = () => {
  const { loads, drivers, invoices, settlements, expenses } = useTMS();
  const [currentTab, setCurrentTab] = useState<TabType>('overview');
  const [reportPeriod, setReportPeriod] = useState<PeriodType>('current_month');

  // Get date range based on period
  const getDateRange = (period: PeriodType): { start: Date | null; end: Date } => {
    const now = new Date();
    let start: Date | null = null;
    let end = now;

    switch (period) {
      case 'current_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'current_quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), currentQuarter * 3, 1);
        break;
      case 'current_year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all_time':
        start = null;
        break;
    }

    return { start, end };
  };

  // Filter data by period
  const { start: periodStart, end: periodEnd } = getDateRange(reportPeriod);
  const filteredLoads = useMemo(() => {
    if (!periodStart) return loads;
    return loads.filter(load => {
      const date = new Date(load.deliveryDate || load.pickupDate || '');
      return date >= periodStart && date <= periodEnd;
    });
  }, [loads, periodStart, periodEnd]);

  const filteredSettlements = useMemo(() => {
    if (!periodStart) return settlements;
    return settlements.filter(settlement => {
      const date = new Date(settlement.createdAt || settlement.date || '');
      return date >= periodStart && date <= periodEnd;
    });
  }, [settlements, periodStart, periodEnd]);

  const filteredExpenses = useMemo(() => {
    if (!periodStart) return expenses;
    return expenses.filter(expense => {
      const date = new Date(expense.date || expense.createdAt || '');
      return date >= periodStart && date <= periodEnd;
    });
  }, [expenses, periodStart, periodEnd]);

  // Calculate report data
  const reportData = useMemo(() => {
    // Only count delivered/completed loads for revenue
    const revenueLoads = filteredLoads.filter(l => 
      l.status === LoadStatus.Delivered || l.status === LoadStatus.Completed
    );

    // Calculate revenue by driver type
    let companyDriverRevenue = 0;
    let ownerOperatorRevenue = 0;

    revenueLoads.forEach(load => {
      const grossAmount = load.rate || 0;
      if (load.driverId) {
        const driver = drivers.find(d => d.id === load.driverId);
        if (driver) {
          const companyRevenue = calculateCompanyRevenue(grossAmount, driver);
          if (driver.type === 'OwnerOperator') {
            ownerOperatorRevenue += grossAmount; // Full revenue for O/O
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

    // Total miles
    const totalMiles = revenueLoads.reduce((sum, l) => sum + (l.miles || 0), 0);

    // Loads completed
    const loadsCompleted = revenueLoads.length;

    // Driver pay breakdown
    let companyDriverPay = 0;
    let ownerOperatorPay = 0;
    let ownerAsDriverPay = 0;
    let isEstimated = false;

    if (filteredSettlements.length > 0) {
      filteredSettlements.forEach(settlement => {
        const driver = drivers.find(d => d.id === settlement.driverId);
        if (!driver) return;

        if (driver.type === 'OwnerOperator') {
          ownerOperatorPay += settlement.grossPay || 0;
        } else {
          // Company driver
          companyDriverPay += settlement.netPay || 0;
        }
      });
    } else {
      // Estimate from loads
      isEstimated = true;
      revenueLoads.forEach(load => {
        if (!load.driverId) return;
        const driver = drivers.find(d => d.id === load.driverId);
        if (!driver) return;

        const payPercentage = driver.type === 'OwnerOperator' ? (driver.rateOrSplit / 100) : 1;
        const driverPay = load.rate * payPercentage;

        if (driver.type === 'OwnerOperator') {
          ownerOperatorPay += driverPay;
        } else {
          companyDriverPay += driverPay;
        }
      });
    }

    const totalDriverPay = companyDriverPay + ownerOperatorPay + ownerAsDriverPay;

    // Calculate real expenses from expense data
    // Only count expenses paid by company (not owner operator expenses)
    const companyExpenses = filteredExpenses.filter(exp => 
      !exp.paidBy || exp.paidBy === 'company' || exp.paidBy === 'tracked_only'
    );

    const totalExpenses = companyExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    
    const expenseBreakdown = {
      fuel: companyExpenses.filter(e => e.type === 'fuel' || e.category === 'fuel').reduce((sum, e) => sum + (e.amount || 0), 0),
      insurance: companyExpenses.filter(e => e.type === 'insurance' || e.category === 'insurance').reduce((sum, e) => sum + (e.amount || 0), 0),
      maintenance: companyExpenses.filter(e => e.type === 'maintenance' || e.category === 'maintenance').reduce((sum, e) => sum + (e.amount || 0), 0),
      fixed: 0, // Fixed costs would come from trucks or other sources
      truckPayments: 0, // Truck payments would come from trucks data
      other: companyExpenses.filter(e => 
        e.type !== 'fuel' && 
        e.type !== 'insurance' && 
        e.type !== 'maintenance' &&
        e.category !== 'fuel' &&
        e.category !== 'insurance' &&
        e.category !== 'maintenance'
      ).reduce((sum, e) => sum + (e.amount || 0), 0),
    };

    // Net profit
    const netProfit = totalRevenue - totalDriverPay - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;

    // Monthly revenue
    const monthlyRevenue = Array(12).fill(0);
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    revenueLoads.forEach(load => {
      const date = new Date(load.deliveryDate || load.pickupDate || '');
      const month = date.getMonth();
      if (!isNaN(month)) {
        monthlyRevenue[month] += load.rate || 0;
      }
    });

    // Load status distribution
    const statusCounts = {
      delivered: filteredLoads.filter(l => l.status === LoadStatus.Delivered || l.status === LoadStatus.Completed).length,
      in_transit: filteredLoads.filter(l => l.status === LoadStatus.InTransit).length,
      available: filteredLoads.filter(l => l.status === LoadStatus.Available).length,
      cancelled: filteredLoads.filter(l => l.status === LoadStatus.Cancelled).length,
    };

    // Customer analysis
    const customerRevenue: Record<string, { revenue: number; loads: number }> = {};
    revenueLoads.forEach(load => {
      const customerName = load.customerName;
      if (customerName) {
        if (!customerRevenue[customerName]) {
          customerRevenue[customerName] = { revenue: 0, loads: 0 };
        }
        customerRevenue[customerName].revenue += load.rate || 0;
        customerRevenue[customerName].loads += 1;
      }
    });

    const topCustomers = Object.entries(customerRevenue)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      revenue: totalRevenue,
      revenueBreakdown: { companyDriver: companyDriverRevenue, ownerOperator: ownerOperatorRevenue },
      miles: totalMiles,
      loads: loadsCompleted,
      driverPay: totalDriverPay,
      driverPayBreakdown: { companyDriver: companyDriverPay, ownerOperator: ownerOperatorPay, ownerAsDriver: ownerAsDriverPay },
      driverPayEstimated: isEstimated,
      expenses: totalExpenses,
      expenseBreakdown,
      netProfit,
      profitMargin,
      monthlyRevenue: { labels: monthLabels, values: monthlyRevenue },
      loadStatus: { labels: Object.keys(statusCounts), values: Object.values(statusCounts) },
      customers: topCustomers,
    };
  }, [filteredLoads, filteredSettlements, filteredExpenses, drivers]);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Export CSV
  const handleExport = () => {
    const data = reportData;
    let csvContent = '';
    let filename = '';
    const date = new Date().toISOString().split('T')[0];

    switch (currentTab) {
      case 'overview':
        filename = `overview-report-${date}.csv`;
        csvContent = 'Metric,Amount\n';
        csvContent += `Total Revenue,${formatCurrency(data.revenue)}\n`;
        csvContent += `Total Miles,${data.miles}\n`;
        csvContent += `Loads Completed,${data.loads}\n`;
        csvContent += `Total Driver Pay,${formatCurrency(data.driverPay)}\n`;
        csvContent += `Total Expenses,${formatCurrency(data.expenses)}\n`;
        csvContent += `Net Profit,${formatCurrency(data.netProfit)}\n`;
        csvContent += `Profit Margin,${data.profitMargin.toFixed(1)}%\n`;
        break;
      case 'revenue':
        filename = `revenue-report-${date}.csv`;
        csvContent = 'Month,Revenue\n';
        data.monthlyRevenue.labels.forEach((label, i) => {
          csvContent += `${label},${formatCurrency(data.monthlyRevenue.values[i])}\n`;
        });
        break;
      default:
        filename = `report-${date}.csv`;
        csvContent = 'No data available\n';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Business Reports</h1>
            <p className="text-slate-600 mt-1">Comprehensive financial and operational analytics</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={reportPeriod}
              onChange={(e) => setReportPeriod(e.target.value as PeriodType)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="current_month">Current Month</option>
              <option value="last_month">Last Month</option>
              <option value="current_quarter">Current Quarter</option>
              <option value="current_year">Current Year</option>
              <option value="all_time">All Time</option>
            </select>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <Printer size={18} />
              Print
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Download size={18} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-8 border-b border-slate-200">
          {(['overview', 'revenue', 'expenses', 'drivers', 'customers'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setCurrentTab(tab)}
              className={`py-4 px-1 font-medium text-sm transition-colors relative ${
                currentTab === tab
                  ? 'text-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {currentTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {currentTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center text-white">
                  <DollarSign size={24} />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(reportData.revenue)}</p>
                </div>
              </div>
              <div className="flex items-center text-sm">
                <span className="text-emerald-600 flex items-center">
                  <ArrowUp size={14} className="mr-1" />
                  +12%
                </span>
                <span className="text-slate-500 ml-2">This period</span>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white">
                  <MapPin size={24} />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-500">Total Miles</p>
                  <p className="text-2xl font-bold text-slate-900">{reportData.miles.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center text-sm">
                <span className="text-blue-600 flex items-center">
                  <Package size={14} className="mr-1" />
                  All loads
                </span>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                  <Package size={24} />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-500">Loads Completed</p>
                  <p className="text-2xl font-bold text-slate-900">{reportData.loads}</p>
                </div>
              </div>
              <div className="flex items-center text-sm">
                <span className="text-purple-600 flex items-center">
                  <TrendingUp size={14} className="mr-1" />
                  Delivered
                </span>
              </div>
            </div>

            <div className={`bg-white rounded-lg p-6 border border-slate-200 shadow-sm ${
              reportData.netProfit >= 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100' : 'bg-gradient-to-br from-red-50 to-red-100'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white ${
                  reportData.netProfit >= 0 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-red-600'
                }`}>
                  <TrendingUp size={24} />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-500">Net Profit</p>
                  <p className={`text-2xl font-bold ${reportData.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatCurrency(reportData.netProfit)}
                  </p>
                </div>
              </div>
              <div className="flex items-center text-sm">
                <span className={`flex items-center ${reportData.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {reportData.netProfit >= 0 ? <ArrowUp size={14} className="mr-1" /> : <ArrowDown size={14} className="mr-1" />}
                  {reportData.profitMargin.toFixed(1)}%
                </span>
                <span className="text-slate-500 ml-2">margin</span>
              </div>
            </div>
          </div>

          {/* Profit Breakdown */}
          <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Profit Breakdown</h3>

            {/* Revenue Section */}
            <div className="mb-4">
              <div className="flex justify-between items-center py-2 border-b-2 border-emerald-200">
                <span className="text-sm font-semibold text-slate-700">Total Revenue</span>
                <span className="text-lg font-bold text-emerald-600">{formatCurrency(reportData.revenue)}</span>
              </div>
              <div className="pl-4 space-y-1 mt-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Company Driver Loads</span>
                  <span className="text-emerald-600 font-medium">{formatCurrency(reportData.revenueBreakdown.companyDriver)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Owner Operator Loads</span>
                  <span className="text-emerald-600 font-medium">{formatCurrency(reportData.revenueBreakdown.ownerOperator)}</span>
                </div>
              </div>
            </div>

            {/* Expenses Section */}
            <div className="mb-4">
              <div className="flex justify-between items-center py-2 border-b-2 border-red-200">
                <span className="text-sm font-semibold text-slate-700">Total Expenses</span>
                <span className="text-lg font-bold text-red-600">{formatCurrency(reportData.expenses)}</span>
              </div>
              <div className="pl-4 space-y-1 mt-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Fuel</span>
                  <span className="text-red-600 font-medium">{formatCurrency(reportData.expenseBreakdown.fuel)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Insurance</span>
                  <span className="text-red-600 font-medium">{formatCurrency(reportData.expenseBreakdown.insurance)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Maintenance</span>
                  <span className="text-red-600 font-medium">{formatCurrency(reportData.expenseBreakdown.maintenance)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Other</span>
                  <span className="text-red-600 font-medium">{formatCurrency(reportData.expenseBreakdown.other)}</span>
                </div>
              </div>
            </div>

            {/* Driver Pay Section */}
            <div className="mb-4">
              <div className="flex justify-between items-center py-2 border-b-2 border-blue-200">
                <span className="text-sm font-semibold text-slate-700">Driver Pay</span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(reportData.driverPay)}
                  {reportData.driverPayEstimated && <span className="text-xs text-yellow-600 font-normal ml-1">(Estimated)</span>}
                </span>
              </div>
              <div className="pl-4 space-y-1 mt-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Company Drivers</span>
                  <span className="text-blue-600 font-medium">{formatCurrency(reportData.driverPayBreakdown.companyDriver)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Owner Operators</span>
                  <span className="text-blue-600 font-medium">{formatCurrency(reportData.driverPayBreakdown.ownerOperator)}</span>
                </div>
              </div>
              {reportData.driverPayEstimated && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                  <span className="flex items-center">
                    <span className="mr-2">ℹ</span>
                    Driver pay is estimated from loads (no settlements found). Create settlements for accurate amounts.
                  </span>
                </div>
              )}
            </div>

            {/* Net Profit */}
            <div className="pt-4 border-t-2 border-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-slate-900">Net Profit</span>
                <span className={`text-xl font-bold ${reportData.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(reportData.netProfit)}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">Owner gets this as distribution (salary already in driver pay)</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold mb-4 text-slate-900">Revenue Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={reportData.monthlyRevenue.labels.map((label, i) => ({
                    name: label,
                    value: reportData.monthlyRevenue.values[i],
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold mb-4 text-slate-900">Load Status Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reportData.loadStatus.labels.map((label, i) => ({
                        name: label,
                        value: reportData.loadStatus.values[i],
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {reportData.loadStatus.labels.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Tab */}
      {currentTab === 'revenue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold mb-4 text-slate-900">Monthly Revenue</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.monthlyRevenue.labels.map((label, i) => ({
                    name: label,
                    value: reportData.monthlyRevenue.values[i],
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold mb-4 text-slate-900">Revenue by Customer</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.customers.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Revenue Details Table */}
          <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Revenue Details</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Period</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Loads</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Miles</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Avg Rate/Mile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {reportData.monthlyRevenue.labels.map((label, i) => {
                    const revenue = reportData.monthlyRevenue.values[i];
                    const monthLoads = filteredLoads.filter(l => {
                      const date = new Date(l.deliveryDate || l.pickupDate || '');
                      return date.getMonth() === i;
                    }).length;
                    const monthMiles = filteredLoads
                      .filter(l => {
                        const date = new Date(l.deliveryDate || l.pickupDate || '');
                        return date.getMonth() === i;
                      })
                      .reduce((sum, l) => sum + (l.miles || 0), 0);
                    const avgRate = monthMiles > 0 ? revenue / monthMiles : 0;

                    return (
                      <tr key={label} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{label}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{formatCurrency(revenue)}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{monthLoads}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{monthMiles.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{formatCurrency(avgRate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {currentTab === 'expenses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold mb-4 text-slate-900">Expense Breakdown</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(reportData.expenseBreakdown)
                        .filter(([_, value]) => value > 0)
                        .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {Object.entries(reportData.expenseBreakdown)
                        .filter(([_, value]) => value > 0)
                        .map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold mb-4 text-slate-900">Expense Trends</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height={256}>
                  <AreaChart data={(() => {
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const now = new Date();
                    const data: { name: string; value: number }[] = [];

                    for (let i = 11; i >= 0; i--) {
                      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
                      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                      monthEnd.setHours(23, 59, 59, 999);

                      const monthExpenses = filteredExpenses.filter(exp => {
                        const expDate = new Date(exp.date || exp.createdAt || '');
                        return expDate >= monthStart && expDate <= monthEnd;
                      });

                      const monthTotal = monthExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
                      data.push({
                        name: months[date.getMonth()],
                        value: monthTotal
                      });
                    }

                    return data;
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Area type="monotone" dataKey="value" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drivers Tab */}
      {currentTab === 'drivers' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Driver Performance Metrics</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={drivers.map(driver => {
                  const driverLoads = filteredLoads.filter(l => l.driverId === driver.id);
                  const driverMiles = driverLoads.reduce((sum, l) => sum + (l.miles || 0), 0);
                  const driverRevenue = driverLoads.reduce((sum, l) => sum + (l.rate || 0), 0);
                  return {
                    name: `${driver.firstName} ${driver.lastName}`,
                    miles: driverMiles,
                    revenue: driverRevenue,
                    loads: driverLoads.length,
                  };
                })}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="miles" fill="#3b82f6" name="Miles" />
                  <Bar yAxisId="left" dataKey="loads" fill="#f59e0b" name="Loads" />
                  <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Driver Rankings Table */}
          <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Driver Rankings</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Driver</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Miles</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Loads</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {drivers.map(driver => {
                    const driverLoads = filteredLoads.filter(l => l.driverId === driver.id);
                    const driverMiles = driverLoads.reduce((sum, l) => sum + (l.miles || 0), 0);
                    const driverRevenue = driverLoads.reduce((sum, l) => sum + (l.rate || 0), 0);
                    const performance = driverMiles > 4000 ? 'Excellent' : driverMiles > 3000 ? 'Good' : 'Average';
                    const performanceClass = performance === 'Excellent' ? 'bg-green-100 text-green-800' :
                      performance === 'Good' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800';

                    return (
                      <tr key={driver.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{driver.firstName} {driver.lastName}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{driverMiles.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{formatCurrency(driverRevenue)}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{driverLoads.length}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${performanceClass}`}>
                            {performance}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {currentTab === 'customers' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Customer Revenue Analysis</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData.customers.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Customers Table */}
          <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Customers</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Loads</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Avg Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Payment Terms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {reportData.customers.map((customer, index) => {
                    const avgRate = customer.loads > 0 ? customer.revenue / customer.loads : 0;
                    return (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{customer.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{formatCurrency(customer.revenue)}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{customer.loads}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{formatCurrency(avgRate)}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">Net 30</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;

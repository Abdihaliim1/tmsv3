import React, { useState, Suspense, lazy, useMemo } from 'react';
import {
  BarChart3, DollarSign, Users, Truck, FileText, Calculator, Fuel, MapPin,
  TrendingUp, PieChart, ChevronRight, Building2, ClipboardList, Wrench, FileSpreadsheet,
  Printer, Download, Calendar, RefreshCw, Phone
} from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { useCompany } from '../context/CompanyContext';
import { LoadStatus } from '../types';
import { calculateCompanyRevenue } from '../services/utils';
import { calculateDriverPay } from '../services/businessLogic';
import { parseDateOnlyLocal } from '../utils/dateOnly';
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

// Placeholder for reports not yet implemented
const PlaceholderReport: React.FC<{ title: string; description: string; icon: React.ReactNode }> = ({
  title,
  description,
  icon,
}) => (
  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12">
    <div className="text-center max-w-md mx-auto">
      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <h2 className="text-xl font-semibold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-600">{description}</p>
    </div>
  </div>
);

// Company Overview Report Component
const CompanyOverviewReport: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const { loads, drivers, settlements, expenses, factoringCompanies } = useTMS();
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
      const date = parseDateOnlyLocal(load.deliveryDate || load.pickupDate || '');
      return date >= periodStart && date <= periodEnd;
    });

    // Only count delivered/completed loads for revenue
    const revenueLoads = filteredLoads.filter(l =>
      l.status === LoadStatus.Delivered || l.status === LoadStatus.Completed
    );

    // Calculate revenue by driver type
    let companyDriverRevenue = 0;
    let ownerOperatorRevenue = 0;

    revenueLoads.forEach(load => {
      const grossAmount = load.grandTotal || load.rate || 0;
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
    const totalMiles = revenueLoads.reduce((sum, l) => sum + (l.miles || 0), 0);
    const loadsCompleted = revenueLoads.length;

    // Filter expenses by period
    const filteredExpenses = expenses.filter(expense => {
      const date = parseDateOnlyLocal(expense.date || expense.createdAt || '');
      return date >= periodStart && date <= periodEnd;
    });

    // Calculate driver pay
    let totalDriverPay = 0;
    let isEstimated = false;

    // Filter settlements by period
    const periodSettlements = settlements.filter(settlement => {
      const settlementLoadIds: string[] = [];
      if (settlement.loadId) settlementLoadIds.push(settlement.loadId);
      if (settlement.loadIds) settlementLoadIds.push(...settlement.loadIds);
      if (settlement.loads) {
        settlement.loads.forEach(l => {
          if (l.loadId && !settlementLoadIds.includes(l.loadId)) {
            settlementLoadIds.push(l.loadId);
          }
        });
      }
      if (settlementLoadIds.length === 0) return false;
      return settlementLoadIds.every(loadId =>
        revenueLoads.some(load => load.id === loadId)
      );
    });

    if (periodSettlements.length > 0) {
      periodSettlements.forEach(settlement => {
        const driver = drivers.find(d => d.id === settlement.driverId);
        if (!driver) return;
        if (driver.type === 'OwnerOperator') {
          totalDriverPay += settlement.grossPay || 0;
        } else {
          totalDriverPay += settlement.netPay || 0;
        }
      });
    } else {
      isEstimated = true;
      revenueLoads.forEach(load => {
        if (!load.driverId) return;
        const driver = drivers.find(d => d.id === load.driverId);
        if (!driver) return;
        totalDriverPay += calculateDriverPay(load, driver);
      });
    }

    // Calculate company expenses (exclude O/O pass-through)
    const companyExpenses = filteredExpenses.filter(exp => {
      if (exp.paidBy !== 'company' && exp.paidBy !== 'tracked_only' && exp.paidBy) {
        return false;
      }
      if (exp.driverId) {
        const driver = drivers.find(d => d.id === exp.driverId);
        if (driver && driver.type === 'OwnerOperator') {
          const expenseType = (exp.type || '').toLowerCase();
          const isPassThrough =
            expenseType === 'fuel' ||
            expenseType === 'insurance' ||
            expenseType === 'toll' ||
            expenseType === 'maintenance' ||
            (exp.description || '').toLowerCase().includes('eld');
          if (isPassThrough) return false;
        }
      }
      return true;
    });

    const totalExpenses = companyExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Calculate dispatcher cost
    const dispatcherCost = revenueLoads.reduce((sum, load) => sum + (load.dispatcherCommissionAmount || 0), 0);

    // Calculate factoring expenses
    const factoringExpenses = revenueLoads
      .filter(load => load.isFactored)
      .reduce((sum, load) => {
        if (load.factoringFee && load.factoringFee > 0) {
          return sum + load.factoringFee;
        }
        const grandTotal = load.grandTotal || load.rate || 0;
        if (grandTotal > 0) {
          let feePercentage = load.factoringFeePercent;
          if ((!feePercentage || feePercentage === 0) && load.factoringCompanyId) {
            const factoringCompany = factoringCompanies.find(fc => fc.id === load.factoringCompanyId);
            if (factoringCompany && factoringCompany.feePercentage) {
              feePercentage = factoringCompany.feePercentage;
            }
          }
          if (!feePercentage || feePercentage === 0) {
            feePercentage = 2.5;
          }
          return sum + grandTotal * (feePercentage / 100);
        }
        return sum;
      }, 0);

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
      totalExpenses: totalExpensesWithFees,
      netProfit,
      profitMargin,
      uniqueCustomers: uniqueCustomers.size,
      activeDrivers: uniqueDrivers.size,
      avgRevenuePerLoad: loadsCompleted > 0 ? totalRevenue / loadsCompleted : 0,
      avgMilesPerLoad: loadsCompleted > 0 ? totalMiles / loadsCompleted : 0,
      revenuePerMile: totalMiles > 0 ? totalRevenue / totalMiles : 0,
    };
  }, [reportGenerated, startMonth, startYear, endMonth, endYear, loads, drivers, settlements, expenses, factoringCompanies]);

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
  const { loads, drivers, settlements, expenses, factoringCompanies } = useTMS();
  const { companyProfile } = useCompany();

  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [beginDate, setBeginDate] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(lastDayOfMonth.toISOString().split('T')[0]);
  const [reportGenerated, setReportGenerated] = useState(false);

  // Calculate report data
  const reportData = useMemo(() => {
    if (!reportGenerated) return null;

    const periodStart = parseDateOnlyLocal(beginDate);
    const periodEnd = parseDateOnlyLocal(endDate);
    periodEnd.setHours(23, 59, 59, 999);

    // Filter loads by period (delivered/completed)
    const filteredLoads = loads.filter(load => {
      const date = parseDateOnlyLocal(load.deliveryDate || load.pickupDate || '');
      const isDelivered = load.status === LoadStatus.Delivered || load.status === LoadStatus.Completed;
      return isDelivered && date >= periodStart && date <= periodEnd;
    });

    // Calculate Income
    let primaryFees = 0;
    let fuelSurcharge = 0;
    let accessoryFees = 0;
    let otherRevenue = 0;

    filteredLoads.forEach(load => {
      // Primary fees = base rate
      primaryFees += load.rate || 0;
      // Fuel surcharge from load
      fuelSurcharge += load.fuelSurcharge || 0;
      // Accessory fees (detention, lumper, etc.)
      accessoryFees += (load.detentionPay || 0) + (load.lumperFee || 0) + (load.accessorialCharges || 0);
    });

    const totalRevenue = primaryFees + fuelSurcharge + accessoryFees + otherRevenue;
    const totalIncome = totalRevenue;

    // Calculate Expenses
    // Filter expenses by period
    const filteredExpenses = expenses.filter(expense => {
      const date = parseDateOnlyLocal(expense.date || expense.createdAt || '');
      return date >= periodStart && date <= periodEnd;
    });

    // Calculate driver pay from settlements or estimates
    let driverExpenses = 0;
    let isEstimated = false;

    // Filter settlements by period
    const periodSettlements = settlements.filter(settlement => {
      const settlementLoadIds: string[] = [];
      if (settlement.loadId) settlementLoadIds.push(settlement.loadId);
      if (settlement.loadIds) settlementLoadIds.push(...settlement.loadIds);
      if (settlement.loads) {
        settlement.loads.forEach(l => {
          if (l.loadId && !settlementLoadIds.includes(l.loadId)) {
            settlementLoadIds.push(l.loadId);
          }
        });
      }
      if (settlementLoadIds.length === 0) return false;
      return settlementLoadIds.some(loadId =>
        filteredLoads.some(load => load.id === loadId)
      );
    });

    if (periodSettlements.length > 0) {
      periodSettlements.forEach(settlement => {
        const driver = drivers.find(d => d.id === settlement.driverId);
        if (!driver) return;
        if (driver.type === 'OwnerOperator') {
          driverExpenses += settlement.grossPay || 0;
        } else {
          driverExpenses += settlement.netPay || 0;
        }
      });
    } else {
      isEstimated = true;
      filteredLoads.forEach(load => {
        if (!load.driverId) return;
        const driver = drivers.find(d => d.id === load.driverId);
        if (!driver) return;
        driverExpenses += calculateDriverPay(load, driver);
      });
    }

    // Calculate other operating expenses by category
    const expensesByCategory: Record<string, number> = {};
    filteredExpenses.forEach(expense => {
      const category = expense.category || expense.type || 'Other';
      expensesByCategory[category] = (expensesByCategory[category] || 0) + (expense.amount || 0);
    });

    // Calculate dispatcher cost
    const dispatcherCost = filteredLoads.reduce((sum, load) => sum + (load.dispatcherCommissionAmount || 0), 0);

    // Calculate factoring expenses
    const factoringExpenses = filteredLoads
      .filter(load => load.isFactored)
      .reduce((sum, load) => {
        if (load.factoringFee && load.factoringFee > 0) {
          return sum + load.factoringFee;
        }
        const grandTotal = load.grandTotal || load.rate || 0;
        if (grandTotal > 0) {
          let feePercentage = load.factoringFeePercent;
          if ((!feePercentage || feePercentage === 0) && load.factoringCompanyId) {
            const factoringCompany = factoringCompanies.find(fc => fc.id === load.factoringCompanyId);
            if (factoringCompany && factoringCompany.feePercentage) {
              feePercentage = factoringCompany.feePercentage;
            }
          }
          if (!feePercentage || feePercentage === 0) {
            feePercentage = 2.5;
          }
          return sum + grandTotal * (feePercentage / 100);
        }
        return sum;
      }, 0);

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
        factoring: factoringExpenses,
        operating: operatingExpenses,
        total: totalExpenses,
      },
      profitLoss,
    };
  }, [reportGenerated, beginDate, endDate, loads, drivers, settlements, expenses, factoringCompanies]);

  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateDisplay = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const handleGenerateReport = () => {
    setReportGenerated(true);
  };

  const handleRunAgain = () => {
    setReportGenerated(false);
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
                onChange={(e) => setBeginDate(e.target.value)}
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
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-800 border border-slate-600 text-white rounded-md pl-10 pr-4 py-3 w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
              />
            </div>
          </div>

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
    <div className="bg-slate-900 min-h-screen -m-6 p-6">
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
                {reportData!.expenses.dispatcher > 0 && (
                  <tr className="border-b border-slate-700">
                    <td className="py-2 px-4">Dispatcher Commission</td>
                    <td className="py-2 px-4 text-right">{formatCurrency(reportData!.expenses.dispatcher)}</td>
                  </tr>
                )}
                {reportData!.expenses.factoring > 0 && (
                  <tr className="border-b border-slate-700">
                    <td className="py-2 px-4 bg-slate-800">Factoring Fees</td>
                    <td className="py-2 px-4 bg-slate-800 text-right">{formatCurrency(reportData!.expenses.factoring)}</td>
                  </tr>
                )}
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
        return (
          <PlaceholderReport
            title="Tax Report"
            description="Tax summary and documentation coming soon."
            icon={<FileText className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'profitLoss':
        return <ProfitLossReport onCancel={() => setCurrentReport('menu')} />;
      case 'userSettlements':
        return (
          <PlaceholderReport
            title="User Settlements"
            description="User settlement reports coming soon."
            icon={<Users className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'carrierSettlements':
        return (
          <PlaceholderReport
            title="Carrier Settlements"
            description="Carrier settlement reports coming soon."
            icon={<Truck className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'carrierPay':
        return (
          <PlaceholderReport
            title="Carrier Pay"
            description="Carrier payment summary coming soon."
            icon={<DollarSign className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'dispatcherSettlements':
        return (
          <PlaceholderReport
            title="Dispatcher Settlements"
            description="Dispatcher settlement reports coming soon."
            icon={<Users className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'dispatcherManagement':
        return (
          <PlaceholderReport
            title="Dispatcher Management Report"
            description="Dispatcher performance metrics coming soon."
            icon={<ClipboardList className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'expenses':
        return (
          <PlaceholderReport
            title="Expenses Report"
            description="Detailed expense analysis coming soon."
            icon={<DollarSign className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'fuelExpenses':
        return (
          <PlaceholderReport
            title="Fuel Expenses"
            description="Fuel expense breakdown coming soon."
            icon={<Fuel className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'reeferFuelExpenses':
        return (
          <PlaceholderReport
            title="Reefer Fuel Expenses"
            description="Refrigeration fuel costs coming soon."
            icon={<Fuel className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'fuelVendor':
        return (
          <PlaceholderReport
            title="Fuel Vendor"
            description="Fuel vendor analysis coming soon."
            icon={<Building2 className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'irpStateMiles':
        return (
          <PlaceholderReport
            title="IRP - State Miles"
            description="State mileage tracking coming soon."
            icon={<MapPin className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'quarterlyIFTA':
        return (
          <PlaceholderReport
            title="Quarterly IFTA"
            description="IFTA quarterly reports coming soon."
            icon={<FileText className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'iftaAudit':
        return (
          <PlaceholderReport
            title="IFTA Audit"
            description="IFTA audit preparation coming soon."
            icon={<ClipboardList className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'quarterlyMaintenance':
        return (
          <PlaceholderReport
            title="Quarterly Maintenance"
            description="Maintenance tracking coming soon."
            icon={<Wrench className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'customerReport':
        return (
          <PlaceholderReport
            title="Customer Report"
            description="Customer analytics coming soon."
            icon={<Building2 className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'unitRevenue':
        return (
          <PlaceholderReport
            title="Unit Revenue"
            description="Revenue by unit analysis coming soon."
            icon={<DollarSign className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'unitOperatingIncome':
        return (
          <PlaceholderReport
            title="Unit Operating Income"
            description="Operating income analysis coming soon."
            icon={<TrendingUp className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'milesPerGallon':
        return (
          <PlaceholderReport
            title="Miles per Gallon"
            description="Fuel efficiency metrics coming soon."
            icon={<PieChart className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'unitMiles':
        return (
          <PlaceholderReport
            title="Unit Miles"
            description="Unit mileage tracking coming soon."
            icon={<MapPin className="w-8 h-8 text-blue-600" />}
          />
        );
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

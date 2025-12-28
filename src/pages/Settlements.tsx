import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Download, Printer, RefreshCw, Eye, Trash2, DollarSign, Users, Clock, Calculator, Search, X, Truck, MapPin, Calendar } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { useCompany } from '../context/CompanyContext';
import { Settlement, Load, LoadStatus, Employee } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { validatePayPercentage } from '../services/utils';
import { generateSettlementPDF } from '../services/settlementPDF';
import { calculateDriverPay } from '../services/businessLogic';
import { formatDateOnly } from '../utils/dateOnly';

type SettlementType = 'driver' | 'dispatcher';

const Settlements: React.FC = () => {
  const { settlements, drivers, loads, addSettlement, updateSettlement, deleteSettlement, updateLoad, employees } = useTMS();
  const { companyProfile } = useCompany();
  const [settlementType, setSettlementType] = useState<SettlementType>('driver');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedDispatcherId, setSelectedDispatcherId] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [selectedLoads, setSelectedLoads] = useState<string[]>([]);
  const [fuelDeduction, setFuelDeduction] = useState<number>(0);
  const [insuranceDeduction, setInsuranceDeduction] = useState<number>(0);
  const [dispatchDeduction, setDispatchDeduction] = useState<number>(0);
  const [advancesDeduction, setAdvancesDeduction] = useState<number>(0);
  const [otherDeduction, setOtherDeduction] = useState<number>(0);
  const [tonuDeduction, setTonuDeduction] = useState<number>(0);
  const [layoverDeduction, setLayoverDeduction] = useState<number>(0);
  const [detentionDeduction, setDetentionDeduction] = useState<number>(0);
  const [driverFilter, setDriverFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [weekFilter, setWeekFilter] = useState<string>('');
  const [showAllDeliveredLoads, setShowAllDeliveredLoads] = useState<boolean>(false);
  const [previewSettlement, setPreviewSettlement] = useState<Settlement | null>(null);

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


  // Get available loads for selected driver/dispatcher and week
  const availableLoads = useMemo(() => {
    const currentPayeeId = settlementType === 'driver' ? selectedDriverId : selectedDispatcherId;
    if (!currentPayeeId || !selectedWeek) return [];

    try {
      const [year, week] = selectedWeek.split('-W');
      if (!year || !week) return [];
      
      const weekStart = getDateOfISOWeek(parseInt(week), parseInt(year));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Debug: Log filter criteria
      console.log('Settlement Filter Debug:', {
        currentPayeeId,
        selectedWeek,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        totalLoads: loads.length,
        settlementType
      });

      // Show all loads that match the driver/dispatcher and are delivered/completed
      // Mark which ones are already settled so user can see them
      return loads.filter(load => {
        try {
          // Check if load belongs to the selected payee (driver or dispatcher)
          const isPayee = settlementType === 'driver' 
            ? load.driverId === currentPayeeId 
            : load.dispatcherId === currentPayeeId;
          
          if (!isPayee) {
            console.log(`Load ${load.loadNumber} filtered out: Not assigned to selected ${settlementType}`);
            return false;
          }
          
          const isDelivered = load.status === LoadStatus.Delivered || load.status === LoadStatus.Completed;
          if (!isDelivered) {
            console.log(`Load ${load.loadNumber} filtered out: Status is ${load.status}, needs Delivered or Completed`);
            return false;
          }
          
          // Check delivery date (try multiple fields like HTML does)
          // More flexible: check deliveryDate, pickupDate, or created date
          const deliveryDateStr = load.deliveryDate || load.pickupDate || load.createdAt || '';
          
          // If showAllDeliveredLoads is true, skip date filtering
          if (showAllDeliveredLoads) {
            console.log(`Load ${load.loadNumber} PASSED filters (showing all delivered loads)`);
            return true;
          }
          
          // If no date at all, exclude the load (unless showAllDeliveredLoads is true)
          if (!deliveryDateStr) {
            console.log(`Load ${load.loadNumber} filtered out: No delivery date, pickup date, or created date`);
            return false;
          }
          
          // Parse date - handle both date strings and ISO strings
          let deliveryDate = new Date(deliveryDateStr);
          if (isNaN(deliveryDate.getTime())) {
            // Try parsing as date-only string (YYYY-MM-DD)
            const dateOnly = deliveryDateStr.split('T')[0];
            deliveryDate = new Date(dateOnly);
            if (isNaN(deliveryDate.getTime())) {
              console.log(`Load ${load.loadNumber} filtered out: Invalid date format: ${deliveryDateStr}`);
              return false;
            }
          }
          
          // Normalize dates to start of day for comparison (avoid timezone issues)
          const deliveryDateOnly = new Date(deliveryDate.getFullYear(), deliveryDate.getMonth(), deliveryDate.getDate());
          const weekStartOnly = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
          const weekEndOnly = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());
          
          const inPeriod = deliveryDateOnly >= weekStartOnly && deliveryDateOnly <= weekEndOnly;
          if (!inPeriod) {
            console.log(`Load ${load.loadNumber} filtered out: Date ${deliveryDateOnly.toISOString().split('T')[0]} not in period ${weekStartOnly.toISOString().split('T')[0]} - ${weekEndOnly.toISOString().split('T')[0]}`);
            return false;
          }
          
          // Include the load even if it's already settled - we'll mark it in the UI
          console.log(`Load ${load.loadNumber} PASSED filters${load.settlementId ? ' (already settled)' : ''}`);
          return true;
        } catch (error) {
          console.warn('Error processing load:', load.id, error);
          // On error, still include the load - let user decide
          return true;
        }
      });
    } catch (error) {
      console.error('Error calculating available loads:', error);
      return [];
    }
  }, [selectedDriverId, selectedDispatcherId, selectedWeek, loads, settlementType, showAllDeliveredLoads]);

  // Calculate settlement totals with earnings breakdown
  const settlementTotals = useMemo(() => {
    const selectedLoadsData = availableLoads.filter(load => selectedLoads.includes(load.id));
    
    if (settlementType === 'dispatcher') {
      // Dispatcher settlement: sum up commissions
      let grossPay = 0;
      selectedLoadsData.forEach(load => {
        let commissionAmount = load.dispatcherCommissionAmount || 0;
        
        // If commission amount is not set, calculate it from commission type and rate
        if (!commissionAmount && load.dispatcherCommissionType && load.dispatcherCommissionRate) {
          const baseRate = load.rate || 0;
          const commissionType = load.dispatcherCommissionType;
          const commissionRate = load.dispatcherCommissionRate;
          
          if (commissionType === 'percentage') {
            // Percentage: commissionAmount = baseRate * (commissionRate / 100)
            commissionAmount = baseRate * (commissionRate / 100);
          } else if (commissionType === 'flat_fee') {
            // Flat fee: commissionAmount = commissionRate
            commissionAmount = commissionRate;
          } else if (commissionType === 'per_mile') {
            // Per mile: commissionAmount = totalMiles * commissionRate
            commissionAmount = (load.miles || 0) * commissionRate;
          }
        }
        
        grossPay += commissionAmount;
      });
      
      const totalDeductions = dispatchDeduction + advancesDeduction + otherDeduction + tonuDeduction + layoverDeduction + detentionDeduction; // Dispatchers don't have fuel/insurance deductions
      const netPay = Math.max(0, grossPay - totalDeductions);
      
      return { 
        grossPay, 
        totalDeductions, 
        netPay, 
        totalMiles: 0,
        earningsBreakdown: {
          basePay: 0,
          detention: 0,
          layover: 0,
          tonu: 0
        }
      };
    } else {
      // Driver settlement
      const driver = drivers.find(d => d.id === selectedDriverId);
      
      let grossPay = 0;
      let totalMiles = 0;
      let totalBasePay = 0;
      let totalDetentionPay = 0;
      let totalLayoverPay = 0;
      let totalTonuPay = 0;

      selectedLoadsData.forEach(load => {
        // Use stored driver pay if available (from load creation), otherwise calculate
        let basePay = 0;
        let detentionPay = 0;
        let layoverPay = 0;
        let tonuPay = 0;
        
        if (load.driverBasePay !== undefined || load.driverDetentionPay !== undefined || load.driverLayoverPay !== undefined) {
          // Use stored values from load (already calculated during load creation)
          basePay = load.driverBasePay || 0;
          detentionPay = load.driverDetentionPay || 0;
          layoverPay = load.driverLayoverPay || 0;
          tonuPay = (load as any).tonuFee || 0;
        } else {
          // Calculate using centralized businessLogic function (NO FALLBACKS)
          if (driver) {
            // Use centralized calculateDriverPay - NO hardcoded fallbacks
            basePay = calculateDriverPay(load, driver);
            // Accessorials: 100% pass-through to driver
            detentionPay = load.detentionAmount || 0;
            layoverPay = load.layoverAmount || 0;
            tonuPay = (load as any).tonuFee || 0;
            
            // If driver pay is 0 and should be calculated, warn
            if (basePay === 0 && load.rate && load.rate > 0) {
              console.warn(`[Settlements] Driver ${driver.firstName} ${driver.lastName} has no payment profile configured. Pay = 0 for load ${load.loadNumber}.`);
            }
          } else {
            // No driver - pay is 0 (NO default to 100%)
            basePay = 0;
            detentionPay = 0;
            layoverPay = 0;
            tonuPay = 0;
            console.warn(`[Settlements] No driver assigned to load ${load.loadNumber}. Pay = 0.`);
          }
        }
        
        // Total gross pay for this load (base + all accessorials)
        const loadGrossPay = basePay + detentionPay + layoverPay + tonuPay;
        
        grossPay += loadGrossPay;
        totalBasePay += basePay;
        totalDetentionPay += detentionPay;
        totalLayoverPay += layoverPay;
        totalTonuPay += tonuPay;
        totalMiles += load.miles || 0;
      });

      const totalDeductions = insuranceDeduction + fuelDeduction + dispatchDeduction + advancesDeduction + otherDeduction + tonuDeduction + layoverDeduction + detentionDeduction;
      const netPay = Math.max(0, grossPay - totalDeductions);

      return { 
        grossPay, 
        totalDeductions, 
        netPay, 
        totalMiles,
        earningsBreakdown: {
          basePay: totalBasePay,
          detention: totalDetentionPay,
          layover: totalLayoverPay,
          tonu: totalTonuPay
        }
      };
    }
  }, [settlementType, selectedLoads, availableLoads, fuelDeduction, otherDeduction, selectedDriverId, selectedDispatcherId, drivers]);

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
    
    // Filter by settlement type (driver or dispatcher)
    if (settlementType === 'driver') {
      filtered = filtered.filter(s => s.type !== 'dispatcher' && s.driverId);
    } else if (settlementType === 'dispatcher') {
      filtered = filtered.filter(s => s.type === 'dispatcher' && s.dispatcherId);
    }
    
    // Apply other filters
    if (settlementType === 'driver' && driverFilter) {
      filtered = filtered.filter(s => s.driverId === driverFilter);
    } else if (settlementType === 'dispatcher' && driverFilter) {
      filtered = filtered.filter(s => s.dispatcherId === driverFilter);
    }
    
    if (statusFilter) filtered = filtered.filter(s => s.status === statusFilter);
    return filtered;
  }, [settlements, settlementType, driverFilter, statusFilter]);

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
  const handleGenerateSettlement = async () => {
    const currentPayeeId = settlementType === 'driver' ? selectedDriverId : selectedDispatcherId;
    if (!currentPayeeId || selectedLoads.length === 0) {
      alert(`Please select a ${settlementType} and at least one load`);
      return;
    }

    const payee = employees.find(e => e.id === currentPayeeId);
    if (!payee) return;

    const settlementNumberPrefix = settlementType === 'driver' ? 'ST' : 'DSP';
    const settlementNumber = `${settlementNumberPrefix}-${new Date().getFullYear()}-${1000 + settlements.length + 1}`;
    const [year, week] = selectedWeek.split('-W');
    const weekStart = getDateOfISOWeek(parseInt(week), parseInt(year));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // Build loads array for settlement
    const settlementLoads = selectedLoads.map(loadId => {
      const load = loads.find(l => l.id === loadId);
      if (settlementType === 'dispatcher') {
        return {
          loadId,
          basePay: 0,
          detention: 0,
          tonu: 0,
          layover: 0,
          dispatchFee: load?.dispatcherCommissionAmount || 0
        };
      } else {
        return {
          loadId,
          basePay: load?.driverBasePay || 0,
          detention: load?.driverDetentionPay || 0,
          tonu: (load as any)?.tonuFee || 0,
          layover: load?.driverLayoverPay || 0,
          dispatchFee: load?.dispatcherCommissionAmount || 0
        };
      }
    });

    // Build deductions object
    const deductions: Settlement['deductions'] = settlementType === 'driver' ? {
      insurance: insuranceDeduction || 0,
      fuel: fuelDeduction || 0,
      cashAdvance: advancesDeduction || 0,
      escrow: 0,
      tonu: tonuDeduction || 0,
      layover: layoverDeduction || 0,
      detention: detentionDeduction || 0,
      other: (otherDeduction || 0) + (dispatchDeduction || 0)
    } : {
      cashAdvance: advancesDeduction || 0,
      escrow: 0,
      tonu: tonuDeduction || 0,
      layover: layoverDeduction || 0,
      detention: detentionDeduction || 0,
      other: (otherDeduction || 0) + (dispatchDeduction || 0)
    };

    const newSettlement: Omit<Settlement, 'id'> = {
      settlementNumber,
      type: settlementType,
      driverId: settlementType === 'driver' ? selectedDriverId : undefined,
      dispatcherId: settlementType === 'dispatcher' ? selectedDispatcherId : undefined,
      driverName: `${payee.firstName} ${payee.lastName}`,
      loadIds: selectedLoads,
      loads: settlementLoads,
      expenseIds: [],
      grossPay: settlementTotals.grossPay,
      deductions,
      totalDeductions: settlementTotals.totalDeductions,
      netPay: settlementTotals.netPay,
      totalMiles: settlementTotals.totalMiles,
      status: 'pending',
      periodStart: weekStart.toISOString().split('T')[0],
      periodEnd: weekEnd.toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      period: {
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
        display: periodDisplay,
      }
    };

    // Add settlement and get the ID
    const settlementId = addSettlement(newSettlement);
    
    // Mark loads as settled - but note: users can delete and recreate settlements
    // When a settlement is deleted, the settlementId is cleared from loads automatically
    // Use for...of loop to properly handle async/await
    for (const loadId of selectedLoads) {
      try {
        await updateLoad(loadId, { settlementId });
      } catch (error: any) {
        console.error('Error linking settlement to load:', error);
        // Continue even if linking fails - settlement is still created
      }
    }

    setIsModalOpen(false);
    setSelectedDriverId('');
    setSelectedDispatcherId('');
    setSelectedLoads([]);
    setFuelDeduction(0);
    setInsuranceDeduction(0);
    setDispatchDeduction(0);
    setAdvancesDeduction(0);
    setOtherDeduction(0);
    setTonuDeduction(0);
    setLayoverDeduction(0);
    setDetentionDeduction(0);
  };

  // Toggle load selection
  const toggleLoad = (loadId: string) => {
    setSelectedLoads(prev =>
      prev.includes(loadId) ? prev.filter(id => id !== loadId) : [...prev, loadId]
    );
  };

  // Toggle all loads - allow selecting all loads (users can delete and recreate settlements)
  const toggleAllLoads = (checked: boolean) => {
    if (checked) {
      // Select all available loads
      const allLoadIds = availableLoads.map(l => l.id);
      setSelectedLoads(allLoadIds);
    } else {
      setSelectedLoads([]);
    }
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
          <h1 className="text-3xl font-bold text-slate-900">Settlements</h1>
          <p className="text-slate-600 mt-2">Manage {settlementType === 'driver' ? 'driver' : 'dispatcher'} payments and settlements</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary px-6 py-3 rounded-lg flex items-center gap-2"
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

      {/* Settlement Type Toggle */}
      <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSettlementType('driver');
              setDriverFilter('');
              setSelectedDriverId('');
              setSelectedDispatcherId('');
              setSelectedLoads([]);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              settlementType === 'driver'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Driver Settlements
          </button>
          <button
            onClick={() => {
              setSettlementType('dispatcher');
              setDriverFilter('');
              setSelectedDriverId('');
              setSelectedDispatcherId('');
              setSelectedLoads([]);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              settlementType === 'dispatcher'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Dispatcher Settlements
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {settlementType === 'driver' ? 'Driver' : 'Dispatcher'}
            </label>
            <select
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All {settlementType === 'driver' ? 'Drivers' : 'Dispatchers'}</option>
              {(settlementType === 'driver' ? drivers : employees.filter(e => e.employeeType === 'dispatcher')).map(d => (
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
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{settlementType === 'driver' ? 'Driver' : 'Dispatcher'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Loads</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Period</th>
                {settlementType === 'driver' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Miles</th>
                )}
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
                  <td colSpan={settlementType === 'driver' ? 10 : 9} className="px-6 py-8 text-center text-slate-500">
                    <p>No {settlementType} settlements found. Click "Generate Settlement" to create one.</p>
                  </td>
                </tr>
              ) : (
                filteredSettlements.map(settlement => {
                  const payeeId = settlement.driverId || settlement.dispatcherId || '';
                  const payee = employees.find(e => e.id === payeeId);
                  
                  // Get loads for this settlement
                  const settlementLoads = settlement.loadIds 
                    ? loads.filter(l => settlement.loadIds!.includes(l.id))
                    : settlement.loads
                      ? loads.filter(l => settlement.loads!.some(sl => sl.loadId === l.id))
                      : [];
                  
                  return (
                    <tr key={settlement.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {settlement.settlementNumber || settlement.id.substring(0, 8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{settlement.driverName}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {settlementLoads.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {settlementLoads.map((load, idx) => (
                              <span key={load.id} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                                {load.loadNumber}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No loads</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {settlement.period?.display || new Date(settlement.createdAt || settlement.date || '').toLocaleDateString()}
                      </td>
                      {settlementType === 'driver' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{settlement.totalMiles || 0}</td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{formatCurrency(settlement.grossPay)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">-{formatCurrency(settlement.totalDeductions || (typeof settlement.deductions === 'number' ? settlement.deductions : 0))}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">{formatCurrency(settlement.netPay)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(settlement.status)}`}>
                          {(settlement.status || 'pending').charAt(0).toUpperCase() + (settlement.status || 'pending').slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button 
                          onClick={() => setPreviewSettlement(settlement)}
                          className="text-blue-600 hover:text-blue-800" 
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            if (payee) {
                              try {
                                generateSettlementPDF(settlement, payee, loads, settlements, companyProfile);
                              } catch (error) {
                                console.error('Error generating PDF:', error);
                                alert('Error generating PDF. Please try again.');
                              }
                            } else {
                              alert(`${settlementType === 'driver' ? 'Driver' : 'Dispatcher'} information not found for this settlement.`);
                            }
                          }}
                          className="text-slate-600 hover:text-slate-800" 
                          title="Print PDF"
                        >
                          <Printer size={18} />
                        </button>
                        <button onClick={() => handleDelete(settlement.id)} className="text-red-600 hover:text-red-800" title="Delete">
                          <Trash2 size={18} />
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

      {/* Generate Settlement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
              <h2 className="text-lg font-semibold text-slate-900">Generate {settlementType === 'driver' ? 'Driver' : 'Dispatcher'} Settlement</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Settlement Period */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-3">Settlement Period</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-1">Select Week</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedWeek) {
                            const [year, week] = selectedWeek.split('-W');
                            const weekNum = parseInt(week);
                            const yearNum = parseInt(year);
                            let newWeek = weekNum - 1;
                            let newYear = yearNum;
                            if (newWeek < 1) {
                              newWeek = 52;
                              newYear = yearNum - 1;
                            }
                            setSelectedWeek(`${newYear}-W${newWeek.toString().padStart(2, '0')}`);
                          }
                        }}
                        className="px-2 py-1 bg-white border border-blue-300 rounded hover:bg-blue-50 text-blue-700"
                        title="Previous Week"
                      >
                        ←
                      </button>
                      <input
                        type="week"
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(e.target.value)}
                        className="flex-1 border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedWeek) {
                            const [year, week] = selectedWeek.split('-W');
                            const weekNum = parseInt(week);
                            const yearNum = parseInt(year);
                            let newWeek = weekNum + 1;
                            let newYear = yearNum;
                            if (newWeek > 52) {
                              newWeek = 1;
                              newYear = yearNum + 1;
                            }
                            setSelectedWeek(`${newYear}-W${newWeek.toString().padStart(2, '0')}`);
                          }
                        }}
                        className="px-2 py-1 bg-white border border-blue-300 rounded hover:bg-blue-50 text-blue-700"
                        title="Next Week"
                      >
                        →
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-1">Period</label>
                    <div className="text-sm text-blue-700 py-2 px-3 bg-white rounded border border-blue-200">
                      {periodDisplay}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payee Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select {settlementType === 'driver' ? 'Driver' : 'Dispatcher'}
                </label>
                <select
                  value={settlementType === 'driver' ? selectedDriverId : selectedDispatcherId}
                  onChange={(e) => {
                    if (settlementType === 'driver') {
                      setSelectedDriverId(e.target.value);
                    } else {
                      setSelectedDispatcherId(e.target.value);
                    }
                    setSelectedLoads([]);
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a {settlementType === 'driver' ? 'driver' : 'dispatcher'}...</option>
                  {(settlementType === 'driver' ? drivers : employees.filter(e => e.employeeType === 'dispatcher')).map(p => {
                    const driver = settlementType === 'driver' ? p : null;
                    const payRate = driver ? (driver.payPercentage || driver.rateOrSplit || 0) : 0;
                    const driverType = driver?.type;
                    const isCompanyDriver = driverType === 'Company';
                    const displayName = `${p.firstName} ${p.lastName}${settlementType === 'driver' && isCompanyDriver && payRate > 0 ? ` (${payRate}%)` : ''}`;
                    return (
                      <option key={p.id} value={p.id}>{displayName}</option>
                    );
                  })}
                </select>
                {settlementType === 'driver' && selectedDriverId && (() => {
                  const selectedDriver = drivers.find(d => d.id === selectedDriverId);
                  if (selectedDriver) {
                    const driverType = selectedDriver.type;
                    const isCompanyDriver = driverType === 'Company';
                    const payRate = selectedDriver.payPercentage || selectedDriver.rateOrSplit || 0;
                    if (isCompanyDriver && payRate > 0) {
                      return (
                        <p className="text-xs text-blue-600 mt-1">
                          <strong>Note:</strong> Company drivers are paid {payRate}% of the base rate, not 100%. Accessorials (detention, layover, TONU) are 100% pass-through.
                        </p>
                      );
                    }
                  }
                  return null;
                })()}
              </div>

              {/* Available Loads */}
              {((settlementType === 'driver' && selectedDriverId) || (settlementType === 'dispatcher' && selectedDispatcherId)) && availableLoads.length > 0 && (
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
                          let payAmount = 0;
                          // Allow all loads to be selectable - users can delete and recreate settlements
                          // Just show a note if load was previously settled (but don't prevent selection)
                          const wasPreviouslySettled = load.settlementId ? settlements.some(s => s.id === load.settlementId) : false;
                          
                          if (settlementType === 'dispatcher') {
                            // Use stored commission amount, or calculate if missing
                            payAmount = load.dispatcherCommissionAmount || 0;
                            
                            // If commission amount is not set, calculate it from commission type and rate
                            if (!payAmount && load.dispatcherCommissionType && load.dispatcherCommissionRate) {
                              const baseRate = load.rate || 0;
                              const commissionType = load.dispatcherCommissionType;
                              const commissionRate = load.dispatcherCommissionRate;
                              
                              if (commissionType === 'percentage') {
                                // Percentage: commissionAmount = baseRate * (commissionRate / 100)
                                payAmount = baseRate * (commissionRate / 100);
                              } else if (commissionType === 'flat_fee') {
                                // Flat fee: commissionAmount = commissionRate
                                payAmount = commissionRate;
                              } else if (commissionType === 'per_mile') {
                                // Per mile: commissionAmount = totalMiles * commissionRate
                                payAmount = (load.miles || 0) * commissionRate;
                              }
                            }
                          } else {
                            // Driver settlement: show total pay including accessorials
                            const driver = drivers.find(d => d.id === selectedDriverId);
                            
                            // Use stored driver pay if available
                            if (load.driverBasePay !== undefined || load.driverDetentionPay !== undefined || load.driverLayoverPay !== undefined) {
                              const basePay = load.driverBasePay || 0;
                              const detentionPay = load.driverDetentionPay || 0;
                              const layoverPay = load.driverLayoverPay || 0;
                              const tonuPay = (load as any).tonuFee || 0;
                              payAmount = basePay + detentionPay + layoverPay + tonuPay;
                            } else {
                              // Calculate on the fly
                              let payPercentage = 1;
                              if (driver) {
                                if (driver.type === 'OwnerOperator' || driver.employeeType === 'owner_operator') {
                                  payPercentage = (driver.rateOrSplit || 0) / 100;
                                } else {
                                  // Company driver: use their percentage (e.g., 35%), NOT 100%
                                  const rawPercentage = driver.payPercentage || driver.rateOrSplit || 0;
                                  payPercentage = rawPercentage > 0 ? (rawPercentage / 100) : 1;
                                }
                              }
                              const basePay = load.rate * payPercentage;
                              const detentionPay = load.detentionAmount || 0;
                              const layoverPay = load.layoverAmount || 0;
                              const tonuPay = (load as any).tonuFee || 0;
                              payAmount = basePay + detentionPay + layoverPay + tonuPay;
                            }
                          }
                          
                          return (
                            <tr key={load.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedLoads.includes(load.id)}
                                  onChange={() => toggleLoad(load.id)}
                                  title="Select this load for settlement"
                                />
                              </td>
                              <td className="px-4 py-2 text-sm font-medium">
                                {load.loadNumber}
                                {wasPreviouslySettled && (
                                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full" title="This load was previously settled but can be included in a new settlement">
                                    Previously Settled
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm">{new Date(load.deliveryDate || load.pickupDate || '').toLocaleDateString()}</td>
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
                    {settlementType === 'driver' && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                          <div>
                            <label className="block text-sm text-slate-600 mb-1">Insurance</label>
                            <input
                              type="number"
                              value={insuranceDeduction}
                              onChange={(e) => setInsuranceDeduction(parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
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
                            <label className="block text-sm text-slate-600 mb-1">Dispatch</label>
                            <input
                              type="number"
                              value={dispatchDeduction}
                              onChange={(e) => setDispatchDeduction(parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600 mb-1">Advances</label>
                            <input
                              type="number"
                              value={advancesDeduction}
                              onChange={(e) => setAdvancesDeduction(parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600 mb-1">Others</label>
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
                        <div className="border-t border-slate-300 pt-4">
                          <h6 className="text-sm font-medium text-slate-700 mb-3">Accessorials</h6>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">TONU</label>
                              <input
                                type="number"
                                value={tonuDeduction}
                                onChange={(e) => setTonuDeduction(parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01"
                                className="w-full border rounded px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">Layover</label>
                              <input
                                type="number"
                                value={layoverDeduction}
                                onChange={(e) => setLayoverDeduction(parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01"
                                className="w-full border rounded px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">Detention</label>
                              <input
                                type="number"
                                value={detentionDeduction}
                                onChange={(e) => setDetentionDeduction(parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01"
                                className="w-full border rounded px-3 py-2"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    {settlementType === 'dispatcher' && (
                      <>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <label className="block text-sm text-slate-600 mb-1">Dispatch</label>
                            <input
                              type="number"
                              value={dispatchDeduction}
                              onChange={(e) => setDispatchDeduction(parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600 mb-1">Advances</label>
                            <input
                              type="number"
                              value={advancesDeduction}
                              onChange={(e) => setAdvancesDeduction(parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600 mb-1">Others</label>
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
                        <div className="border-t border-slate-300 pt-4">
                          <h6 className="text-sm font-medium text-slate-700 mb-3">Accessorials</h6>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">TONU</label>
                              <input
                                type="number"
                                value={tonuDeduction}
                                onChange={(e) => setTonuDeduction(parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01"
                                className="w-full border rounded px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">Layover</label>
                              <input
                                type="number"
                                value={layoverDeduction}
                                onChange={(e) => setLayoverDeduction(parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01"
                                className="w-full border rounded px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">Detention</label>
                              <input
                                type="number"
                                value={detentionDeduction}
                                onChange={(e) => setDetentionDeduction(parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01"
                                className="w-full border rounded px-3 py-2"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Totals */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Pay Summary</h4>
                    <div className="space-y-2">
                      {/* Earnings Breakdown */}
                      {settlementType === 'driver' && settlementTotals.earningsBreakdown && (
                        <div className="mb-3 pb-3 border-b border-slate-300">
                          <p className="text-xs font-medium text-slate-500 mb-2 uppercase">Earnings Breakdown:</p>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between text-slate-600">
                              <span>Base Pay:</span>
                              <span className="font-medium">{formatCurrency(settlementTotals.earningsBreakdown.basePay)}</span>
                            </div>
                            {settlementTotals.earningsBreakdown.detention > 0 && (
                              <div className="flex justify-between text-slate-600">
                                <span>Detention:</span>
                                <span className="font-medium text-blue-600">{formatCurrency(settlementTotals.earningsBreakdown.detention)}</span>
                              </div>
                            )}
                            {settlementTotals.earningsBreakdown.layover > 0 && (
                              <div className="flex justify-between text-slate-600">
                                <span>Layover:</span>
                                <span className="font-medium text-blue-600">{formatCurrency(settlementTotals.earningsBreakdown.layover)}</span>
                              </div>
                            )}
                            {settlementTotals.earningsBreakdown.tonu > 0 && (
                              <div className="flex justify-between text-slate-600">
                                <span>TONU:</span>
                                <span className="font-medium text-blue-600">{formatCurrency(settlementTotals.earningsBreakdown.tonu)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
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

              {((settlementType === 'driver' && selectedDriverId) || (settlementType === 'dispatcher' && selectedDispatcherId)) && availableLoads.length === 0 && (
                <div className="text-center py-8">
                  <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg inline-block max-w-2xl">
                    <p className="font-semibold mb-2">No delivered loads found for this {settlementType === 'driver' ? 'driver' : 'dispatcher'} in the selected period.</p>
                    <p className="text-sm mb-2">To see loads here, they must:</p>
                    <ul className="text-sm text-left list-disc list-inside space-y-1">
                      <li>Be assigned to this {settlementType === 'driver' ? 'driver' : 'dispatcher'}</li>
                      <li>Have status "Delivered" or "Completed"</li>
                      <li>Have a delivery date or pickup date within the selected week</li>
                    </ul>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => setShowAllDeliveredLoads(!showAllDeliveredLoads)}
                        className="btn-primary px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        {showAllDeliveredLoads ? 'Filter by Week' : 'Show All Delivered Loads'}
                      </button>
                    </div>
                    <p className="text-xs mt-3 text-yellow-700">Check the browser console (F12) for detailed filtering information.</p>
                  </div>
                </div>
              )}
              
              {/* Toggle to show all delivered loads */}
              {((settlementType === 'driver' && selectedDriverId) || (settlementType === 'dispatcher' && selectedDispatcherId)) && availableLoads.length > 0 && (
                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={showAllDeliveredLoads}
                      onChange={(e) => setShowAllDeliveredLoads(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    Show all delivered loads (ignore week filter)
                  </label>
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
                  disabled={((settlementType === 'driver' && !selectedDriverId) || (settlementType === 'dispatcher' && !selectedDispatcherId)) || selectedLoads.length === 0}
                  className="btn-primary px-6 py-2.5 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate Settlement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Preview Modal */}
      {previewSettlement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewSettlement(null)}>
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Settlement Details</h2>
                <p className="text-sm text-slate-500">{previewSettlement.settlementNumber}</p>
              </div>
              <button
                onClick={() => setPreviewSettlement(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Status & Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 uppercase font-medium">Status</p>
                  <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${getStatusBadge(previewSettlement.status)}`}>
                    {(previewSettlement.status || 'pending').charAt(0).toUpperCase() + (previewSettlement.status || 'pending').slice(1)}
                  </span>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs text-blue-600 uppercase font-medium">Gross Pay</p>
                  <p className="text-lg font-bold text-blue-700">${(previewSettlement.grossPay || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-xs text-red-600 uppercase font-medium">Deductions</p>
                  <p className="text-lg font-bold text-red-700">-${(previewSettlement.totalDeductions || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-xs text-green-600 uppercase font-medium">Net Pay</p>
                  <p className="text-lg font-bold text-green-700">${(previewSettlement.netPay || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Payee & Period Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase flex items-center gap-2">
                    <Users size={16} />
                    Payee Information
                  </h3>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                    {(() => {
                      const payee = previewSettlement.driverId 
                        ? drivers.find(d => d.id === previewSettlement.driverId)
                        : employees.find(e => e.id === previewSettlement.dispatcherId);
                      return payee ? (
                        <>
                          <p className="font-medium text-slate-900">{payee.firstName} {payee.lastName}</p>
                          <p className="text-sm text-slate-500">
                            {previewSettlement.driverId ? 'Driver' : 'Dispatcher'} • 
                            Pay Rate: {payee.payType === 'percentage' ? `${((payee.payRate || 0) * 100).toFixed(0)}%` : `$${payee.payRate?.toFixed(2) || '0.00'}/mi`}
                          </p>
                        </>
                      ) : (
                        <p className="text-slate-500">Payee information not found</p>
                      );
                    })()}
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase flex items-center gap-2">
                    <Calendar size={16} />
                    Period
                  </h3>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                    <p className="font-medium text-slate-900">
                      {previewSettlement.periodStart && previewSettlement.periodEnd
                        ? `${formatDateOnly(previewSettlement.periodStart)} - ${formatDateOnly(previewSettlement.periodEnd)}`
                        : previewSettlement.weekNumber
                          ? `Week ${previewSettlement.weekNumber}`
                          : previewSettlement.date
                            ? formatDateOnly(previewSettlement.date)
                            : 'N/A'}
                    </p>
                    <p className="text-sm text-slate-500">
                      Created: {previewSettlement.createdAt ? formatDateOnly(previewSettlement.createdAt) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Deductions Breakdown */}
              {previewSettlement.deductions && Object.keys(previewSettlement.deductions).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase">Deductions Breakdown</h3>
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(previewSettlement.deductions).map(([key, value]) => (
                        value && Number(value) > 0 ? (
                          <div key={key} className="flex justify-between">
                            <span className="text-sm text-slate-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                            <span className="text-sm font-medium text-red-600">-${Number(value).toFixed(2)}</span>
                          </div>
                        ) : null
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Loads in Settlement */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 uppercase flex items-center gap-2">
                  <Truck size={16} />
                  Loads ({(previewSettlement.loadIds?.length || (previewSettlement.loadId ? 1 : 0))})
                </h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Load #</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Route</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Miles</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Rate</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Pay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(() => {
                        const loadIds = previewSettlement.loadIds || (previewSettlement.loadId ? [previewSettlement.loadId] : []);
                        const settlementLoads = loads.filter(l => loadIds.includes(l.id));
                        
                        if (settlementLoads.length === 0) {
                          return (
                            <tr>
                              <td colSpan={5} className="px-4 py-4 text-center text-sm text-slate-500">
                                No loads found for this settlement
                              </td>
                            </tr>
                          );
                        }

                        return settlementLoads.map(load => {
                          const payee = previewSettlement.driverId 
                            ? drivers.find(d => d.id === previewSettlement.driverId)
                            : employees.find(e => e.id === previewSettlement.dispatcherId);
                          const driverPay = payee 
                            ? calculateDriverPay(load.grandTotal || load.rate || 0, load.miles || 0, payee.payType, payee.payRate || 0)
                            : 0;
                          
                          return (
                            <tr key={load.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-sm font-medium text-blue-600">{load.loadNumber}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                <div className="flex items-center gap-1">
                                  <MapPin size={12} className="text-green-500" />
                                  {load.originCity}, {load.originState}
                                  <span className="text-slate-400 mx-1">→</span>
                                  <MapPin size={12} className="text-red-500" />
                                  {load.destCity}, {load.destState}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">{(load.miles || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">${(load.grandTotal || load.rate || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                              <td className="px-4 py-3 text-sm font-medium text-green-600 text-right">${driverPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                    <tfoot className="bg-slate-100">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-sm font-medium text-slate-700">Total</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-700 text-right">
                          {(previewSettlement.totalMiles || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-700 text-right">
                          ${(() => {
                            const loadIds = previewSettlement.loadIds || (previewSettlement.loadId ? [previewSettlement.loadId] : []);
                            return loads
                              .filter(l => loadIds.includes(l.id))
                              .reduce((sum, l) => sum + (l.grandTotal || l.rate || 0), 0)
                              .toLocaleString('en-US', { minimumFractionDigits: 2 });
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-green-700 text-right">
                          ${(previewSettlement.grossPay || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              {previewSettlement.notes && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase">Notes</h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">{previewSettlement.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setPreviewSettlement(null)}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const payee = previewSettlement.driverId 
                    ? drivers.find(d => d.id === previewSettlement.driverId)
                    : employees.find(e => e.id === previewSettlement.dispatcherId);
                  if (payee) {
                    generateSettlementPDF(previewSettlement, payee, loads, settlements, companyProfile);
                  }
                }}
                className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Printer size={16} />
                Print PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settlements;

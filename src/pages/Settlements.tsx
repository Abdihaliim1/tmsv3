import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Download, Printer, RefreshCw, Eye, Trash2, DollarSign, Users, Clock, Calculator, Search, X, Truck, MapPin, Calendar } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { useCompany } from '../context/CompanyContext';
import { Settlement, Load, LoadStatus } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { generateSettlementPDF } from '../services/settlementPDF';
import {
  calculateDriverPay,
  formatDriverPayRate,
  resolveDriverPayment,
  getLoadMiles,
  resolveDispatcherCommission,
} from '../services/businessLogic';
import {
  computeSettlementPay,
  sanitizeMoneyInput,
  sumStoredDeductions,
  validateSettlementPay,
  type SettlementLoadPay,
  type SettlementMoneyInputs,
} from '../services/settlementMath';
import { formatDateOnly } from '../utils/dateOnly';

type SettlementType = 'driver' | 'dispatcher';

/** Resolve live loads for a settlement; fall back to embedded settlement.loads stubs. */
function resolveSettlementLoads(
  settlement: Settlement,
  allLoads: Load[]
): Array<Load | { id: string; loadNumber: string; originCity: string; originState: string; destCity: string; destState: string; miles: number; rate: number; grandTotal: number; isStub: true; stubPay: number }> {
  const idSet = new Set<string>();
  if (settlement.loadId) idSet.add(settlement.loadId);
  (settlement.loadIds || []).forEach(id => idSet.add(id));
  (settlement.loads || []).forEach(sl => { if (sl.loadId) idSet.add(sl.loadId); });

  // Reverse lookup: loads that point at this settlement
  allLoads.forEach(l => {
    if (l.settlementId === settlement.id || l.dispatcherSettlementId === settlement.id) {
      idSet.add(l.id);
    }
  });

  const byId = new Map(allLoads.map(l => [l.id, l]));
  const resolved: Array<Load | { id: string; loadNumber: string; originCity: string; originState: string; destCity: string; destState: string; miles: number; rate: number; grandTotal: number; isStub: true; stubPay: number }> = [];

  idSet.forEach(id => {
    const live = byId.get(id);
    if (live) {
      resolved.push(live);
      return;
    }
    const embedded = (settlement.loads || []).find(sl => sl.loadId === id);
    const stubPay = (embedded?.basePay || 0) + (embedded?.detention || 0) + (embedded?.layover || 0) + (embedded?.tonu || 0);
    resolved.push({
      id,
      loadNumber: id.slice(0, 8),
      originCity: '—',
      originState: '',
      destCity: '—',
      destState: '',
      miles: 0,
      rate: 0,
      grandTotal: 0,
      isStub: true,
      stubPay,
    });
  });

  return resolved;
}

/** True when this load is already paid on a settlement of the same type (driver vs dispatcher stay independent). */
function isLoadSettledForType(
  load: Load,
  type: SettlementType,
  allSettlements: Settlement[]
): boolean {
  if (type === 'driver') {
    if (allSettlements.some(s =>
      (s.type === 'driver' || !s.type) &&
      Array.isArray(s.loadIds) &&
      s.loadIds.includes(load.id) &&
      Array.isArray(s.loadIds) &&
      s.loadIds.length > 0 &&
      Number.isFinite(parseFloat(String(s.netPay ?? s.grossPay)))
    )) {
      return true;
    }
    const sid = load.settlementId;
    if (!sid) return false;
    const linked = allSettlements.find(s => s.id === sid);
    return !!(linked && linked.type !== 'dispatcher' &&
      Array.isArray(linked.loadIds) && linked.loadIds.length > 0 &&
      Number.isFinite(parseFloat(String(linked.netPay ?? linked.grossPay))));
  }

  if (allSettlements.some(s =>
    s.type === 'dispatcher' &&
    Array.isArray(s.loadIds) &&
    s.loadIds.includes(load.id) &&
    s.loadIds.length > 0 &&
    Number.isFinite(parseFloat(String(s.netPay ?? s.grossPay)))
  )) {
    return true;
  }
  const dsid = load.dispatcherSettlementId;
  if (!dsid) return false;
  const linked = allSettlements.find(s => s.id === dsid);
  return !!(linked && linked.type === 'dispatcher' &&
    Array.isArray(linked.loadIds) && linked.loadIds.length > 0 &&
    Number.isFinite(parseFloat(String(linked.netPay ?? linked.grossPay))));
}

const Settlements: React.FC = () => {
  const { settlements, drivers, loads, addSettlement, deleteSettlement, updateLoad, employees } = useTMS();
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

  const changeSelectedWeek = (week: string) => {
    setSelectedWeek(week);
    setSelectedLoads([]);
  };

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

      // Unpaid delivered loads for this payee. "Show all" only ignores the week filter —
      // already-settled loads for this settlement type are never selectable (blocks double-pay).
      const dispatcher = settlementType === 'dispatcher'
        ? employees.find(e => e.id === currentPayeeId)
        : null;
      const dispatcherFullName = dispatcher ? `${dispatcher.firstName} ${dispatcher.lastName}`.trim() : '';

      return loads.filter(load => {
        try {
          const isPayee = settlementType === 'driver'
            ? load.driverId === currentPayeeId
            : (
              load.dispatcherId === currentPayeeId ||
              (!!dispatcherFullName && load.dispatcherName === dispatcherFullName)
            );

          if (!isPayee) return false;

          const isDelivered =
            load.status === LoadStatus.Delivered ||
            load.status === LoadStatus.DeliveredWithBOL ||
            load.status === LoadStatus.Invoiced ||
            load.status === LoadStatus.Paid ||
            load.status === LoadStatus.Completed;
          if (!isDelivered) return false;

          if (isLoadSettledForType(load, settlementType, settlements)) return false;

          if (showAllDeliveredLoads) return true;

          const deliveryDateStr = load.deliveryDate || load.pickupDate || load.createdAt || '';
          if (!deliveryDateStr) return false;

          let deliveryDate = new Date(deliveryDateStr);
          if (isNaN(deliveryDate.getTime())) {
            const dateOnly = deliveryDateStr.split('T')[0];
            deliveryDate = new Date(dateOnly);
            if (isNaN(deliveryDate.getTime())) return false;
          }

          const deliveryDateOnly = new Date(deliveryDate.getFullYear(), deliveryDate.getMonth(), deliveryDate.getDate());
          const weekStartOnly = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
          const weekEndOnly = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());

          return deliveryDateOnly >= weekStartOnly && deliveryDateOnly <= weekEndOnly;
        } catch (error) {
          console.warn('Error processing load:', load.id, error);
          return false;
        }
      });
    } catch (error) {
      console.error('Error calculating available loads:', error);
      return [];
    }
  }, [selectedDriverId, selectedDispatcherId, selectedWeek, loads, settlementType, showAllDeliveredLoads, settlements, employees]);

  // Drop selections that are no longer in the visible (filtered) load list
  useEffect(() => {
    const allowed = new Set(availableLoads.map(l => l.id));
    setSelectedLoads(prev => {
      const next = prev.filter(id => allowed.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [availableLoads]);

  const moneyInputs: SettlementMoneyInputs = useMemo(
    () => ({
      insurance: insuranceDeduction,
      fuel: fuelDeduction,
      dispatch: dispatchDeduction,
      advances: advancesDeduction,
      other: otherDeduction,
      tonu: tonuDeduction,
      layover: layoverDeduction,
      detention: detentionDeduction,
    }),
    [
      insuranceDeduction,
      fuelDeduction,
      dispatchDeduction,
      advancesDeduction,
      otherDeduction,
      tonuDeduction,
      layoverDeduction,
      detentionDeduction,
    ]
  );

  /** Resolve per-load earnings used by settlement math (order-independent). */
  const resolveLoadPays = (): { loadPays: SettlementLoadPay[]; totalMiles: number; settlementLoads: Settlement['loads'] } => {
    const selectedLoadsData = availableLoads.filter(load => selectedLoads.includes(load.id));
    const loadPays: SettlementLoadPay[] = [];
    const settlementLoads: NonNullable<Settlement['loads']> = [];
    let totalMiles = 0;

    if (settlementType === 'dispatcher') {
      const dispatcher = employees.find(e => e.id === selectedDispatcherId);
      selectedLoadsData.forEach(load => {
        const commission = resolveDispatcherCommission(load, dispatcher).amount;
        loadPays.push({ basePay: commission });
        settlementLoads.push({
          loadId: load.id,
          basePay: 0,
          detention: 0,
          tonu: 0,
          layover: 0,
          dispatchFee: commission,
        } as any);
      });
      return { loadPays, totalMiles: 0, settlementLoads };
    }

    const driver = drivers.find(d => d.id === selectedDriverId);
    selectedLoadsData.forEach(load => {
      let basePay = 0;
      let detentionPay = 0;
      let layoverPay = 0;
      let tonuPay = 0;

      const hasStoredPay =
        (load.driverTotalGross !== undefined && load.driverTotalGross > 0) ||
        (load.driverBasePay !== undefined && load.driverBasePay > 0);

      if (hasStoredPay && load.driverTotalGross !== undefined && load.driverTotalGross > 0) {
        basePay = load.driverTotalGross;
      } else if (hasStoredPay) {
        basePay = load.driverBasePay || 0;
        detentionPay = load.driverDetentionPay || 0;
        layoverPay = load.driverLayoverPay || 0;
        tonuPay = load.tonuFee || 0;
      } else if (driver) {
        basePay = calculateDriverPay(load, driver);
        detentionPay = load.detentionAmount || 0;
        layoverPay = load.layoverAmount || 0;
        tonuPay = load.tonuFee || 0;
      }

      loadPays.push({ basePay, detention: detentionPay, layover: layoverPay, tonu: tonuPay });
      settlementLoads.push({
        loadId: load.id,
        basePay,
        detention: detentionPay,
        layover: layoverPay,
        tonu: tonuPay,
        dispatchFee: load.dispatcherCommissionAmount || 0,
      } as any);
      totalMiles += getLoadMiles(load);
    });

    return { loadPays, totalMiles, settlementLoads };
  };

  // Calculate settlement totals — every money field is a dependency; math is pure.
  const settlementTotals = useMemo(() => {
    const { loadPays, totalMiles } = resolveLoadPays();
    const pay = computeSettlementPay(loadPays, moneyInputs, {
      includeDriverDeductions: settlementType === 'driver',
    });
    return {
      ...pay,
      totalMiles,
    };
    // resolveLoadPays closes over selected loads / payees — list them explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settlementType,
    selectedLoads,
    availableLoads,
    moneyInputs,
    selectedDriverId,
    selectedDispatcherId,
    drivers,
    employees,
  ]);

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

  // Stats — scoped to current settlement type; ignore empty / $NaN shells
  const stats = useMemo(() => {
    const typed = settlements.filter(s =>
      settlementType === 'dispatcher'
        ? s.type === 'dispatcher' && !!s.dispatcherId
        : s.type !== 'dispatcher' && !!s.driverId
    );
    const valid = typed.filter(s => {
      const hasLoads =
        (Array.isArray(s.loadIds) && s.loadIds.length > 0) ||
        (Array.isArray(s.loads) && s.loads.length > 0);
      const net = parseFloat(String(s.netPay));
      const gross = parseFloat(String(s.grossPay));
      return hasLoads && (Number.isFinite(net) || Number.isFinite(gross));
    });
    const now = new Date();
    const weekStart = getWeekStart(now);
    const safeNet = (s: Settlement) => {
      const n = parseFloat(String(s.netPay));
      return Number.isFinite(n) ? n : 0;
    };
    const thisWeekSettlements = valid.filter(s => {
      const created = new Date(s.createdAt || s.date || '');
      return created >= weekStart;
    });
    const thisWeekTotal = thisWeekSettlements.reduce((sum, s) => sum + safeNet(s), 0);
    const pending = valid.filter(s => s.status === 'pending').length;
    const avgSettlement = valid.length > 0
      ? valid.reduce((sum, s) => sum + safeNet(s), 0) / valid.length
      : 0;

    return {
      thisWeekTotal,
      totalSettlements: valid.length,
      pending,
      avgSettlement,
    };
  }, [settlements, settlementType]);

  // Chart data (scoped to active settlement type)
  const weeklyTrendsData = useMemo(() => {
    const weeklyData: Record<string, { settlements: number; totalAmount: number }> = {};
    const today = new Date();
    const typed = settlements.filter(s =>
      settlementType === 'dispatcher'
        ? s.type === 'dispatcher'
        : s.type !== 'dispatcher'
    );

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const weekKey = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
      weeklyData[weekKey] = { settlements: 0, totalAmount: 0 };

      typed.forEach(settlement => {
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
  }, [settlements, settlementType]);

  const statusChartData = useMemo(() => {
    const statusCounts = { Paid: 0, Pending: 0, Processed: 0 };
    settlements
      .filter(s => settlementType === 'dispatcher' ? s.type === 'dispatcher' : s.type !== 'dispatcher')
      .forEach(s => {
        const status = s.status || 'pending';
        if (status === 'paid') statusCounts.Paid++;
        else if (status === 'processed') statusCounts.Processed++;
        else statusCounts.Pending++;
      });
    return Object.keys(statusCounts).map(key => ({
      name: key,
      value: statusCounts[key as keyof typeof statusCounts],
    })).filter(item => item.value > 0);
  }, [settlements, settlementType]);

  const COLORS = ['#10b981', '#f59e0b', '#3b82f6'];

  const nextSettlementNumber = (prefix: 'ST' | 'DSP'): string => {
    const year = new Date().getFullYear();
    const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    let max = 1000;
    settlements.forEach(s => {
      const m = (s.settlementNumber || '').match(re);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `${prefix}-${year}-${max + 1}`;
  };

  // Generate settlement
  const handleGenerateSettlement = async () => {
    const currentPayeeId = settlementType === 'driver' ? selectedDriverId : selectedDispatcherId;
    // Only settle loads currently visible in the eligibility list (prevents cross-week ghosts)
    const visibleIds = new Set(availableLoads.map(l => l.id));
    const loadsToSettle = selectedLoads.filter(id => visibleIds.has(id));
    if (loadsToSettle.length !== selectedLoads.length) {
      setSelectedLoads(loadsToSettle);
    }
    if (!currentPayeeId || loadsToSettle.length === 0) {
      alert(`Please select a ${settlementType} and at least one load in the current filter`);
      return;
    }

    const selectedLoadObjs = loadsToSettle
      .map(id => loads.find(l => l.id === id))
      .filter((l): l is Load => !!l);
    const alreadySettled = selectedLoadObjs.filter(l =>
      isLoadSettledForType(l, settlementType, settlements)
    );
    if (alreadySettled.length > 0) {
      alert(
        `${alreadySettled.length} selected load(s) are already on a ${settlementType} settlement. ` +
        `Refresh and select unpaid loads only.`
      );
      setSelectedLoads(prev => prev.filter(id => !alreadySettled.some(l => l.id === id) && visibleIds.has(id)));
      return;
    }

    if (settlementType === 'driver') {
      const driver = drivers.find(d => d.id === selectedDriverId);
      if (driver) {
        const pay = resolveDriverPayment(driver);
        if (pay.type === 'per_mile') {
          if (pay.perMileRate <= 0) {
            alert('This driver has no per-mile rate set. Open Employees and set e.g. $0.65/mi before generating a settlement.');
            return;
          }
          const zeroMileLoads = selectedLoadObjs.filter(l => getLoadMiles(l) <= 0);
          if (zeroMileLoads.length > 0) {
            alert(
              `${zeroMileLoads.length} selected load(s) have 0 miles. Per-mile pay cannot be calculated.\n\n` +
              `Add miles on: ${zeroMileLoads.map(l => l.loadNumber).join(', ')}`
            );
            return;
          }
        }
      }
    }

    // Recalculate using only visible selected loads (sync selection first)
    setSelectedLoads(loadsToSettle);
    const { loadPays, totalMiles, settlementLoads } = (() => {
      // Temporarily resolve against loadsToSettle by filtering availableLoads
      const selectedLoadsData = availableLoads.filter(load => loadsToSettle.includes(load.id));
      const loadPaysLocal: SettlementLoadPay[] = [];
      const settlementLoadsLocal: NonNullable<Settlement['loads']> = [];
      let miles = 0;
      if (settlementType === 'dispatcher') {
        const dispatcher = employees.find(e => e.id === selectedDispatcherId);
        selectedLoadsData.forEach(load => {
          const commission = resolveDispatcherCommission(load, dispatcher).amount;
          loadPaysLocal.push({ basePay: commission });
          settlementLoadsLocal.push({
            loadId: load.id,
            basePay: 0,
            detention: 0,
            tonu: 0,
            layover: 0,
          });
        });
      } else {
        const driver = drivers.find(d => d.id === selectedDriverId);
        selectedLoadsData.forEach(load => {
          let basePay = 0;
          let detentionPay = 0;
          let layoverPay = 0;
          let tonuPay = 0;
          const hasStoredPay =
            (load.driverTotalGross !== undefined && load.driverTotalGross > 0) ||
            (load.driverBasePay !== undefined && load.driverBasePay > 0);
          if (hasStoredPay && load.driverTotalGross !== undefined && load.driverTotalGross > 0) {
            basePay = load.driverTotalGross;
          } else if (hasStoredPay) {
            basePay = load.driverBasePay || 0;
            detentionPay = load.driverDetentionPay || 0;
            layoverPay = load.driverLayoverPay || 0;
            tonuPay = load.tonuFee || 0;
          } else if (driver) {
            basePay = calculateDriverPay(load, driver);
            detentionPay = load.detentionAmount || 0;
            layoverPay = load.layoverAmount || 0;
            tonuPay = load.tonuFee || 0;
          }
          loadPaysLocal.push({ basePay, detention: detentionPay, layover: layoverPay, tonu: tonuPay });
          settlementLoadsLocal.push({
            loadId: load.id,
            basePay,
            detention: detentionPay,
            layover: layoverPay,
            tonu: tonuPay,
          });
          miles += getLoadMiles(load);
        });
      }
      return { loadPays: loadPaysLocal, totalMiles: miles, settlementLoads: settlementLoadsLocal };
    })();

    const submitInputs: SettlementMoneyInputs = {
      insurance: insuranceDeduction,
      fuel: fuelDeduction,
      dispatch: dispatchDeduction,
      advances: advancesDeduction,
      other: otherDeduction,
      tonu: tonuDeduction,
      layover: layoverDeduction,
      detention: detentionDeduction,
    };
    const payResult = computeSettlementPay(loadPays, submitInputs, {
      includeDriverDeductions: settlementType === 'driver',
    });
    const validation = validateSettlementPay(payResult, submitInputs, {
      includeDriverDeductions: settlementType === 'driver',
    });
    if (!validation.valid) {
      alert(`Cannot save settlement:\n\n${validation.errors.join('\n')}`);
      return;
    }

    if (payResult.grossPay <= 0) {
      alert(
        settlementType === 'dispatcher'
          ? 'Cannot create a dispatcher settlement with $0 commission. Set the dispatcher commission rate on their employee profile (and/or on each load), then try again.'
          : 'Cannot create a settlement with $0 gross pay. Check driver pay rate and load miles/revenue.'
      );
      return;
    }

    const payee = employees.find(e => e.id === currentPayeeId);
    if (!payee) return;

    const settlementNumber = nextSettlementNumber(settlementType === 'driver' ? 'ST' : 'DSP');
    const [year, week] = selectedWeek.split('-W');
    const weekStart = getDateOfISOWeek(parseInt(week), parseInt(year));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const deductions: Settlement['deductions'] = {
      insurance: settlementType === 'driver' ? payResult.deductions.insurance : 0,
      fuel: settlementType === 'driver' ? payResult.deductions.fuel : 0,
      dispatch: payResult.deductions.dispatch,
      cashAdvance: payResult.deductions.cashAdvance,
      escrow: 0,
      other: payResult.deductions.other,
    };

    const otherEarnings: Settlement['otherEarnings'] = [];
    if (payResult.manualTonu > 0) {
      otherEarnings.push({ type: 'tonu', description: 'TONU (manual)', amount: payResult.manualTonu });
    }
    if (payResult.manualLayover > 0) {
      otherEarnings.push({ type: 'layover', description: 'Layover (manual)', amount: payResult.manualLayover });
    }
    if (payResult.manualDetention > 0) {
      otherEarnings.push({ type: 'detention', description: 'Detention (manual)', amount: payResult.manualDetention });
    }

    const newSettlement: Omit<Settlement, 'id'> = {
      settlementNumber,
      type: settlementType,
      driverId: settlementType === 'driver' ? selectedDriverId : undefined,
      dispatcherId: settlementType === 'dispatcher' ? selectedDispatcherId : undefined,
      driverName: `${payee.firstName} ${payee.lastName}`,
      loadIds: loadsToSettle,
      loads: settlementLoads,
      expenseIds: [],
      grossPay: payResult.grossPay,
      deductions,
      otherEarnings: otherEarnings.length > 0 ? otherEarnings : undefined,
      totalDeductions: payResult.totalDeductions,
      netPay: payResult.netPay,
      totalMiles,
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

    const settlementId = addSettlement(newSettlement);

    // Link loads with type-specific fields so driver vs dispatcher never overwrite each other
    for (const loadId of loadsToSettle) {
      try {
        if (settlementType === 'driver') {
          await updateLoad(loadId, { settlementId, settlementNumber });
        } else {
          await updateLoad(loadId, {
            dispatcherSettlementId: settlementId,
            dispatcherSettlementNumber: settlementNumber,
          });
        }
      } catch (error: any) {
        console.error('Error linking settlement to load:', error);
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

  // Format currency (never show $NaN)
  const formatCurrency = (amount: number): string => {
    const n = typeof amount === 'number' ? amount : parseFloat(String(amount));
    const safe = Number.isFinite(n) ? n : 0;
    return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
          <h3 className="text-lg font-semibold text-slate-900">
            {settlementType === 'driver' ? 'Driver' : 'Dispatcher'} Settlements
          </h3>
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
                  
                  const settlementLoads = resolveSettlementLoads(settlement, loads);
                  const liveLoads = settlementLoads.filter(l => !('isStub' in l && l.isStub));
                  
                  return (
                    <tr key={settlement.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {settlement.settlementNumber || settlement.id.substring(0, 8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{settlement.driverName}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {settlementLoads.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {settlementLoads.map((load) => (
                              <span
                                key={load.id}
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  'isStub' in load && load.isStub
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-blue-50 text-blue-700'
                                }`}
                              >
                                {load.loadNumber}
                              </span>
                            ))}
                            {liveLoads.length === 0 && (
                              <span className="text-amber-600 text-xs italic ml-1">(unlinked)</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No loads</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {(typeof settlement.period === 'object' && settlement.period?.display) || new Date(settlement.createdAt || settlement.date || '').toLocaleDateString()}
                      </td>
                      {settlementType === 'driver' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{settlement.totalMiles || 0}</td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{formatCurrency(settlement.grossPay)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        -{formatCurrency((() => {
                          const fromBreakdown = sumStoredDeductions(settlement.deductions as any);
                          if (fromBreakdown > 0) return fromBreakdown;
                          return settlement.totalDeductions || (typeof settlement.deductions === 'number' ? settlement.deductions : 0);
                        })())}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                        {formatCurrency((() => {
                          const fromBreakdown = sumStoredDeductions(settlement.deductions as any);
                          if (fromBreakdown > 0 && settlement.grossPay != null) {
                            return Math.round((settlement.grossPay - fromBreakdown + Number.EPSILON) * 100) / 100;
                          }
                          return settlement.netPay;
                        })())}
                      </td>
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
                            changeSelectedWeek(`${newYear}-W${newWeek.toString().padStart(2, '0')}`);
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
                        onChange={(e) => changeSelectedWeek(e.target.value)}
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
                            changeSelectedWeek(`${newYear}-W${newWeek.toString().padStart(2, '0')}`);
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
                    const driver = settlementType === 'driver' ? (p as typeof drivers[number]) : null;
                    const rateLabel = driver ? formatDriverPayRate(driver) : '';
                    const displayName = `${p.firstName} ${p.lastName}${rateLabel && rateLabel !== '—' ? ` (${rateLabel})` : ''}`;
                    return (
                      <option key={p.id} value={p.id}>{displayName}</option>
                    );
                  })}
                </select>
                {settlementType === 'driver' && selectedDriverId && (() => {
                  const selectedDriver = drivers.find(d => d.id === selectedDriverId);
                  if (!selectedDriver) return null;
                  const pay = resolveDriverPayment(selectedDriver);
                  if (pay.type === 'per_mile' && pay.perMileRate > 0) {
                    return (
                      <p className="text-xs text-blue-600 mt-1">
                        <strong>Note:</strong> Paid ${pay.perMileRate.toFixed(2)}/mi × load miles. Accessorials (detention, layover, TONU) are 100% pass-through.
                      </p>
                    );
                  }
                  if (pay.type === 'percentage' && pay.percentageDisplay > 0) {
                    return (
                      <p className="text-xs text-blue-600 mt-1">
                        <strong>Note:</strong> Paid {pay.percentageDisplay.toFixed(pay.percentageDisplay % 1 === 0 ? 0 : 2)}% of load revenue. Accessorials are 100% pass-through.
                      </p>
                    );
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
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Formula</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Pay Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {availableLoads.map(load => {
                          let payAmount = 0;
                          let payFormula = '—';

                          if (settlementType === 'dispatcher') {
                            const dispatcher = employees.find(e => e.id === selectedDispatcherId);
                            const resolved = resolveDispatcherCommission(load, dispatcher);
                            payAmount = resolved.amount;
                            payFormula = resolved.formula;
                          } else {
                            const driver = drivers.find(d => d.id === selectedDriverId);
                            const hasStoredPay =
                              (load.driverTotalGross !== undefined && load.driverTotalGross > 0) ||
                              (load.driverBasePay !== undefined && load.driverBasePay > 0);
                            if (hasStoredPay && load.driverTotalGross !== undefined && load.driverTotalGross > 0) {
                              payAmount = load.driverTotalGross;
                              payFormula = 'Stored total gross';
                            } else if (hasStoredPay) {
                              payAmount = (load.driverBasePay || 0) + (load.driverDetentionPay || 0) + (load.driverLayoverPay || 0) + (load.tonuFee || 0);
                              payFormula = 'Stored load pay';
                            } else if (driver) {
                              const pay = resolveDriverPayment(driver);
                              const miles = getLoadMiles(load);
                              const base = calculateDriverPay(load, driver);
                              const detentionPay = load.detentionAmount || 0;
                              const layoverPay = load.layoverAmount || 0;
                              const tonuPay = load.tonuFee || 0;
                              payAmount = base + detentionPay + layoverPay + tonuPay;
                              if (pay.type === 'per_mile') {
                                payFormula = miles > 0
                                  ? `${miles} mi × $${pay.perMileRate.toFixed(2)}/mi`
                                  : `0 mi × $${pay.perMileRate.toFixed(2)}/mi (set miles on load)`;
                              } else if (pay.type === 'percentage') {
                                payFormula = `Rev × ${pay.percentageDisplay.toFixed(2)}%`;
                              } else {
                                payFormula = `Flat $${pay.flatRate.toFixed(2)}`;
                              }
                              if (detentionPay || layoverPay || tonuPay) {
                                payFormula += ' + accessorials';
                              }
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
                              </td>
                              <td className="px-4 py-2 text-sm">{formatDateOnly(load.deliveryDate || load.pickupDate || '')}</td>
                              <td className="px-4 py-2 text-sm">{load.originCity} → {load.destCity}</td>
                              <td className="px-4 py-2 text-xs text-slate-500">{payFormula}</td>
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
                              value={insuranceDeduction || ''}
                              onChange={(e) => setInsuranceDeduction(sanitizeMoneyInput(e.target.value, insuranceDeduction))}
                              min="0"
                              step="0.01"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600 mb-1">Fuel</label>
                            <input
                              type="number"
                              value={fuelDeduction || ''}
                              onChange={(e) => setFuelDeduction(sanitizeMoneyInput(e.target.value, fuelDeduction))}
                              min="0"
                              step="0.01"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600 mb-1">Dispatch</label>
                            <input
                              type="number"
                              value={dispatchDeduction || ''}
                              onChange={(e) => setDispatchDeduction(sanitizeMoneyInput(e.target.value, dispatchDeduction))}
                              min="0"
                              step="0.01"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600 mb-1">Advances</label>
                            <input
                              type="number"
                              value={advancesDeduction || ''}
                              onChange={(e) => setAdvancesDeduction(sanitizeMoneyInput(e.target.value, advancesDeduction))}
                              min="0"
                              step="0.01"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600 mb-1">Others</label>
                            <input
                              type="number"
                              value={otherDeduction || ''}
                              onChange={(e) => setOtherDeduction(sanitizeMoneyInput(e.target.value, otherDeduction))}
                              min="0"
                              step="0.01"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
                        </div>
                        <div className="border-t border-slate-300 pt-4">
                          <h6 className="text-sm font-medium text-slate-700 mb-1">Accessorial earnings</h6>
                          <p className="text-xs text-slate-500 mb-3">100% pass-through — added to gross pay, not deductions.</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">TONU</label>
                              <input
                                type="number"
                                value={tonuDeduction || ''}
                                onChange={(e) => setTonuDeduction(sanitizeMoneyInput(e.target.value, tonuDeduction))}
                                min="0"
                                step="0.01"
                                className="w-full border rounded px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">Layover</label>
                              <input
                                type="number"
                                value={layoverDeduction || ''}
                                onChange={(e) => setLayoverDeduction(sanitizeMoneyInput(e.target.value, layoverDeduction))}
                                min="0"
                                step="0.01"
                                className="w-full border rounded px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">Detention</label>
                              <input
                                type="number"
                                value={detentionDeduction || ''}
                                onChange={(e) => setDetentionDeduction(sanitizeMoneyInput(e.target.value, detentionDeduction))}
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
                              value={dispatchDeduction || ''}
                              onChange={(e) => setDispatchDeduction(sanitizeMoneyInput(e.target.value, dispatchDeduction))}
                              min="0"
                              step="0.01"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600 mb-1">Advances</label>
                            <input
                              type="number"
                              value={advancesDeduction || ''}
                              onChange={(e) => setAdvancesDeduction(sanitizeMoneyInput(e.target.value, advancesDeduction))}
                              min="0"
                              step="0.01"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600 mb-1">Others</label>
                            <input
                              type="number"
                              value={otherDeduction || ''}
                              onChange={(e) => setOtherDeduction(sanitizeMoneyInput(e.target.value, otherDeduction))}
                              min="0"
                              step="0.01"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
                        </div>
                        <div className="border-t border-slate-300 pt-4">
                          <h6 className="text-sm font-medium text-slate-700 mb-1">Accessorial earnings</h6>
                          <p className="text-xs text-slate-500 mb-3">100% pass-through — added to gross pay, not deductions.</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">TONU</label>
                              <input
                                type="number"
                                value={tonuDeduction || ''}
                                onChange={(e) => setTonuDeduction(sanitizeMoneyInput(e.target.value, tonuDeduction))}
                                min="0"
                                step="0.01"
                                className="w-full border rounded px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">Layover</label>
                              <input
                                type="number"
                                value={layoverDeduction || ''}
                                onChange={(e) => setLayoverDeduction(sanitizeMoneyInput(e.target.value, layoverDeduction))}
                                min="0"
                                step="0.01"
                                className="w-full border rounded px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">Detention</label>
                              <input
                                type="number"
                                value={detentionDeduction || ''}
                                onChange={(e) => setDetentionDeduction(sanitizeMoneyInput(e.target.value, detentionDeduction))}
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
                      {settlementTotals.earningsBreakdown && (
                        <div className="mb-3 pb-3 border-b border-slate-300">
                          <p className="text-xs font-medium text-slate-500 mb-2 uppercase">Earnings Breakdown:</p>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between text-slate-600">
                              <span>{settlementType === 'dispatcher' ? 'Commission:' : 'Base Pay:'}</span>
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
                        <span className={`text-2xl font-extrabold ${settlementTotals.netPay < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(settlementTotals.netPay)}
                        </span>
                      </div>
                      {settlementTotals.netPay < 0 && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
                          Deductions exceed gross by {formatCurrency(settlementTotals.totalDeductions - settlementTotals.grossPay)}.
                          Reduce deductions before generating — save is blocked.
                        </div>
                      )}
                      {settlementTotals.grossPay === 0 && selectedLoads.length > 0 && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                          {settlementType === 'dispatcher' ? (
                            <>Gross is $0 because this dispatcher has no commission type/rate on their employee profile, and loads have no stored commission. Edit the dispatcher under Employees, set Commission Type + Rate, then reload Settlements.</>
                          ) : (
                            <>Gross is $0 because stored driver pay is 0 and recalculation also returned 0 — usually missing miles on a per-mile driver, or no pay rate on the driver profile. Check driver pay settings and load miles.</>
                          )}
                        </div>
                      )}
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
                        onClick={() => {
                          setShowAllDeliveredLoads(!showAllDeliveredLoads);
                          setSelectedLoads([]);
                        }}
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
                      onChange={(e) => {
                        setShowAllDeliveredLoads(e.target.checked);
                        setSelectedLoads([]);
                      }}
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
                  disabled={
                    ((settlementType === 'driver' && !selectedDriverId) || (settlementType === 'dispatcher' && !selectedDispatcherId)) ||
                    selectedLoads.length === 0 ||
                    settlementTotals.grossPay <= 0
                  }
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
              {/* Status & Summary Cards — recompute deductions from breakdown so detail never lies */}
              {(() => {
                const breakdownTotal = sumStoredDeductions(previewSettlement.deductions as any);
                const storedTotal = previewSettlement.totalDeductions ?? 0;
                const displayDeductions = breakdownTotal > 0 ? breakdownTotal : storedTotal;
                const otherEarn = (previewSettlement.otherEarnings || []).reduce((s, e) => s + (e.amount || 0), 0);
                const displayNet = Math.round(((previewSettlement.grossPay || 0) - displayDeductions + Number.EPSILON) * 100) / 100;
                const mismatch =
                  breakdownTotal > 0 &&
                  Math.abs(breakdownTotal - storedTotal) > 0.009;
                return (
                  <>
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
                        <p className="text-lg font-bold text-red-700">-${displayDeductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-xs text-green-600 uppercase font-medium">Net Pay</p>
                        <p className="text-lg font-bold text-green-700">${displayNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    {mismatch && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                        Stored totalDeductions was ${storedTotal.toFixed(2)} but breakdown sums to ${breakdownTotal.toFixed(2)}.
                        Showing the breakdown total. Delete and regenerate this settlement to persist corrected totals.
                      </div>
                    )}
                    {otherEarn > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                        Includes ${otherEarn.toFixed(2)} accessorial earnings (TONU / layover / detention) in gross.
                      </div>
                    )}
                  </>
                );
              })()}

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
                            Pay Rate: {previewSettlement.driverId
                              ? formatDriverPayRate(payee as any)
                              : (payee.defaultCommissionRate != null
                                  ? `${payee.defaultCommissionType === 'per_mile' ? `$${payee.defaultCommissionRate}/mi` : payee.defaultCommissionType === 'flat_fee' ? `$${payee.defaultCommissionRate}` : `${payee.defaultCommissionRate}%`}`
                                  : '—')}
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
                      {Object.entries(previewSettlement.deductions)
                        .filter(([key]) => !['tonu', 'layover', 'detention'].includes(key))
                        .map(([key, value]) => (
                        value && Number(value) > 0 ? (
                          <div key={key} className="flex justify-between">
                            <span className="text-sm text-slate-600 capitalize">
                              {key === 'cashAdvance' ? 'Advances' : key.replace(/([A-Z])/g, ' $1').trim()}:
                            </span>
                            <span className="text-sm font-medium text-red-600">-${Number(value).toFixed(2)}</span>
                          </div>
                        ) : null
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-red-200 flex justify-between text-sm font-semibold text-red-800">
                      <span>Breakdown total</span>
                      <span>-${sumStoredDeductions(previewSettlement.deductions as any).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {previewSettlement.otherEarnings && previewSettlement.otherEarnings.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase">Accessorial Earnings</h3>
                  <div className="bg-blue-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                    {previewSettlement.otherEarnings.map((earn, idx) => (
                      <div key={`${earn.type}-${idx}`} className="flex justify-between">
                        <span className="text-sm text-slate-600 capitalize">{earn.description || earn.type}:</span>
                        <span className="text-sm font-medium text-blue-700">+${Number(earn.amount || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loads in Settlement */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 uppercase flex items-center gap-2">
                  <Truck size={16} />
                  Loads ({resolveSettlementLoads(previewSettlement, loads).length})
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
                        const settlementLoads = resolveSettlementLoads(previewSettlement, loads);
                        
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
                          const isStub = 'isStub' in load && load.isStub;
                          const payee = previewSettlement.driverId 
                            ? drivers.find(d => d.id === previewSettlement.driverId)
                            : employees.find(e => e.id === previewSettlement.dispatcherId);
                          const driverPay = isStub
                            ? (load as any).stubPay || 0
                            : payee
                              ? calculateDriverPay(load as Load, payee as any)
                              : 0;
                          const route = isStub
                            ? 'Load record unavailable'
                            : `${load.originCity}, ${load.originState} → ${load.destCity}, ${load.destState}`;
                          
                          return (
                            <tr key={load.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-sm font-medium text-blue-600">{load.loadNumber}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {isStub ? (
                                  <span className="text-amber-600 italic">{route}</span>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <MapPin size={12} className="text-green-500" />
                                    {load.originCity}, {load.originState}
                                    <span className="text-slate-400 mx-1">→</span>
                                    <MapPin size={12} className="text-red-500" />
                                    {load.destCity}, {load.destState}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">{getLoadMiles(load as Load).toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-slate-600 text-right">${((load as Load).grandTotal || (load as Load).rate || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
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
                          ${resolveSettlementLoads(previewSettlement, loads)
                              .reduce((sum, l) => sum + ((l as Load).grandTotal || (l as Load).rate || 0), 0)
                              .toLocaleString('en-US', { minimumFractionDigits: 2 })}
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

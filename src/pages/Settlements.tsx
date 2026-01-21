import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Eye, Trash2, Search, Calendar, List, FileSpreadsheet, Edit2, Info, FileText, Copy, Mail, Save, X, DollarSign, AlertCircle, Check } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { useCompany } from '../context/CompanyContext';
import { Settlement, Load, LoadStatus, Driver } from '../types';
import { generateSettlementPDF } from '../services/settlementPDF';
import { calculateDriverPay } from '../services/businessLogic';

type ViewMode = 'list' | 'new' | 'selectLoads' | 'view' | 'edit';

interface DeductionItem {
  id: string;
  category: string;
  memo: string;
  amount: number;
}

interface AdditionalPayItem {
  id: string;
  category: string;
  memo: string;
  amount: number;
}

// Deduction Categories
const DEDUCTION_CATEGORIES = [
  'Fuel Advance',
  'Cash Advance',
  'Insurance',
  'Escrow',
  'ELD Fee',
  'Equipment Lease',
  'Repairs',
  'Tolls',
  'Parking',
  'Lumper',
  'Detention',
  'Other',
];

// Additional Pay Categories
const ADDITIONAL_PAY_CATEGORIES = [
  'Bonus',
  'Detention Pay',
  'Layover Pay',
  'TONU',
  'Accessorial',
  'Reimbursement',
  'Safety Bonus',
  'Fuel Bonus',
  'Other',
];

const Settlements: React.FC = () => {
  const { settlements, drivers, loads, addSettlement, updateSettlement, deleteSettlement, updateLoad } = useTMS();
  const { companyProfile } = useCompany();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'paidOn' | 'netPay'>('paidOn');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // New settlement form state
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [beginDate, setBeginDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showGrossRevenue, setShowGrossRevenue] = useState<boolean>(false);
  const [selectedLoads, setSelectedLoads] = useState<string[]>([]);
  const [deductions, setDeductions] = useState<DeductionItem[]>([]);
  const [additionalPay, setAdditionalPay] = useState<AdditionalPayItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [paidOnDate, setPaidOnDate] = useState<string>('');
  const [loadSortOrder, setLoadSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAllStops, setShowAllStops] = useState<boolean>(false);

  // Modal states
  const [showSettlementDetails, setShowSettlementDetails] = useState(false);
  const [showAddDeductionModal, setShowAddDeductionModal] = useState(false);
  const [showAddPayModal, setShowAddPayModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // New deduction/pay form state
  const [newDeduction, setNewDeduction] = useState<DeductionItem>({ id: '', category: '', memo: '', amount: 0 });
  const [newPay, setNewPay] = useState<AdditionalPayItem>({ id: '', category: '', memo: '', amount: 0 });

  // Initialize dates on mount
  useEffect(() => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setBeginDate(firstOfMonth.toISOString().split('T')[0]);
    setEndDate(lastOfMonth.toISOString().split('T')[0]);
    setPaidOnDate(now.toISOString().split('T')[0]);
  }, []);

  // Get available loads for selected driver and date range
  const availableLoads = useMemo(() => {
    if (!selectedDriverId || !beginDate || !endDate) return [];

    const startDate = new Date(beginDate);
    startDate.setHours(0, 0, 0, 0);
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);

    let filtered = loads.filter(load => {
      if (load.driverId !== selectedDriverId) return false;
      if (load.status !== LoadStatus.Delivered && load.status !== LoadStatus.Completed) return false;

      // In edit mode, include loads from this settlement
      if (viewMode === 'edit' && selectedSettlement?.loadIds?.includes(load.id)) {
        return true;
      }

      // Exclude already settled loads
      if (load.settlementId && load.settlementId !== selectedSettlement?.id) return false;

      const deliveryDateStr = load.deliveryDate || load.pickupDate || '';
      if (!deliveryDateStr) return false;

      const deliveryDate = new Date(deliveryDateStr);
      if (isNaN(deliveryDate.getTime())) return false;

      return deliveryDate >= startDate && deliveryDate <= endDateObj;
    });

    // Sort by delivery date
    filtered.sort((a, b) => {
      const dateA = new Date(a.deliveryDate || a.pickupDate || '').getTime();
      const dateB = new Date(b.deliveryDate || b.pickupDate || '').getTime();
      return loadSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return filtered;
  }, [selectedDriverId, beginDate, endDate, loads, loadSortOrder, viewMode, selectedSettlement]);

  // Calculate settlement totals
  const settlementTotals = useMemo(() => {
    const selectedLoadsData = availableLoads.filter(load => selectedLoads.includes(load.id));
    const driver = drivers.find(d => d.id === selectedDriverId);

    let grossPay = 0;
    let totalMiles = 0;

    selectedLoadsData.forEach(load => {
      if (load.driverBasePay !== undefined) {
        const basePay = load.driverBasePay || 0;
        const detentionPay = load.driverDetentionPay || 0;
        const layoverPay = load.driverLayoverPay || 0;
        const tonuPay = (load as any).tonuFee || 0;
        grossPay += basePay + detentionPay + layoverPay + tonuPay;
      } else if (driver) {
        grossPay += calculateDriverPay(load, driver);
        grossPay += (load.detentionAmount || 0) + (load.layoverAmount || 0) + ((load as any).tonuFee || 0);
      }
      totalMiles += load.miles || 0;
    });

    // Add additional pay
    const totalAdditionalPay = additionalPay.reduce((sum, p) => sum + p.amount, 0);
    grossPay += totalAdditionalPay;

    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const netPay = Math.max(0, grossPay - totalDeductions);

    return { grossPay, totalDeductions, netPay, totalMiles, totalAdditionalPay };
  }, [selectedLoads, availableLoads, deductions, additionalPay, selectedDriverId, drivers]);

  // Filter and sort settlements for list view
  const filteredSettlements = useMemo(() => {
    let filtered = settlements.filter(s => s.type !== 'dispatcher' && s.driverId);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.driverName?.toLowerCase().includes(term) ||
        s.settlementNumber?.toLowerCase().includes(term)
      );
    }

    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortField === 'paidOn') {
        aVal = new Date(a.createdAt || a.date || '').getTime();
        bVal = new Date(b.createdAt || b.date || '').getTime();
      } else {
        aVal = a.netPay || 0;
        bVal = b.netPay || 0;
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [settlements, searchTerm, sortField, sortDirection]);

  // Calculate YTD earnings for a driver
  const calculateYTDEarnings = (driverId: string) => {
    const currentYear = new Date().getFullYear();
    const driverSettlements = settlements.filter(s =>
      s.driverId === driverId &&
      new Date(s.createdAt || s.date || '').getFullYear() === currentYear
    );

    let grossYTD = 0;
    let deductionsYTD: Record<string, number> = {};

    driverSettlements.forEach(s => {
      grossYTD += s.grossPay || 0;
      if (s.deductions) {
        Object.entries(s.deductions).forEach(([key, value]) => {
          deductionsYTD[key] = (deductionsYTD[key] || 0) + Number(value || 0);
        });
      }
    });

    const totalDeductionsYTD = Object.values(deductionsYTD).reduce((sum, v) => sum + v, 0);
    const netYTD = grossYTD - totalDeductionsYTD;

    return { grossYTD, deductionsYTD, totalDeductionsYTD, netYTD };
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const handleSort = (field: 'paidOn' | 'netPay') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleViewSettlement = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setViewMode('view');
  };

  const handleEditSettlement = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setSelectedDriverId(settlement.driverId || '');
    setBeginDate(settlement.periodStart || '');
    setEndDate(settlement.periodEnd || '');
    setSelectedLoads(settlement.loadIds || []);
    setPaidOnDate(settlement.date || settlement.createdAt?.split('T')[0] || '');
    setNotes(settlement.notes || '');

    // Convert deductions object to array
    const deductionItems: DeductionItem[] = [];
    if (settlement.deductions) {
      Object.entries(settlement.deductions).forEach(([key, value]) => {
        if (value && Number(value) > 0) {
          deductionItems.push({
            id: crypto.randomUUID(),
            category: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
            memo: '',
            amount: Number(value)
          });
        }
      });
    }
    setDeductions(deductionItems);

    // Convert additional pay if exists
    const payItems: AdditionalPayItem[] = [];
    if ((settlement as any).additionalPay) {
      Object.entries((settlement as any).additionalPay).forEach(([key, value]) => {
        if (value && Number(value) > 0) {
          payItems.push({
            id: crypto.randomUUID(),
            category: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
            memo: '',
            amount: Number(value)
          });
        }
      });
    }
    setAdditionalPay(payItems);

    setViewMode('edit');
  };

  const handleDeleteSettlement = (id: string) => {
    if (confirm('Are you sure you want to delete this settlement?')) {
      // Clear settlementId from associated loads
      const settlement = settlements.find(s => s.id === id);
      if (settlement?.loadIds) {
        settlement.loadIds.forEach(loadId => {
          updateLoad(loadId, { settlementId: undefined });
        });
      }

      deleteSettlement(id);
      if (viewMode === 'view') {
        setViewMode('list');
      }
    }
  };

  const handleNewSettlement = () => {
    setSelectedSettlement(null);
    setSelectedDriverId('');
    setSelectedLoads([]);
    setDeductions([]);
    setAdditionalPay([]);
    setNotes('');
    setShowGrossRevenue(false);
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setBeginDate(firstOfMonth.toISOString().split('T')[0]);
    setEndDate(lastOfMonth.toISOString().split('T')[0]);
    setPaidOnDate(now.toISOString().split('T')[0]);
    setViewMode('new');
  };

  const handleNextStep = () => {
    if (!selectedDriverId) {
      alert('Please select a driver');
      return;
    }
    setViewMode('selectLoads');
  };

  const toggleLoadSelection = (loadId: string) => {
    setSelectedLoads(prev =>
      prev.includes(loadId)
        ? prev.filter(id => id !== loadId)
        : [...prev, loadId]
    );
  };

  const selectAllLoads = () => {
    setSelectedLoads(availableLoads.map(l => l.id));
  };

  const unselectAllLoads = () => {
    setSelectedLoads([]);
  };

  const addDeduction = () => {
    setDeductions(prev => [...prev, {
      id: crypto.randomUUID(),
      category: '',
      memo: '',
      amount: 0
    }]);
  };

  const updateDeduction = (id: string, field: keyof DeductionItem, value: string | number) => {
    setDeductions(prev => prev.map(d =>
      d.id === id ? { ...d, [field]: value } : d
    ));
  };

  const removeDeduction = (id: string) => {
    setDeductions(prev => prev.filter(d => d.id !== id));
  };

  // Handle adding deduction from modal (in view mode)
  const handleAddDeductionFromModal = () => {
    if (!newDeduction.category || newDeduction.amount <= 0) {
      alert('Please enter a category and amount');
      return;
    }

    if (selectedSettlement) {
      const updatedDeductions = { ...selectedSettlement.deductions };
      const key = newDeduction.category.toLowerCase().replace(/\s+/g, '');
      updatedDeductions[key] = (updatedDeductions[key] || 0) + newDeduction.amount;

      const newTotalDeductions = Object.values(updatedDeductions).reduce((sum, v) => sum + Number(v), 0);
      const newNetPay = Math.max(0, (selectedSettlement.grossPay || 0) - newTotalDeductions);

      updateSettlement(selectedSettlement.id, {
        deductions: updatedDeductions,
        totalDeductions: newTotalDeductions,
        netPay: newNetPay
      });

      // Update local state
      setSelectedSettlement({
        ...selectedSettlement,
        deductions: updatedDeductions,
        totalDeductions: newTotalDeductions,
        netPay: newNetPay
      });
    }

    setNewDeduction({ id: '', category: '', memo: '', amount: 0 });
    setShowAddDeductionModal(false);
  };

  // Handle adding additional pay from modal (in view mode)
  const handleAddPayFromModal = () => {
    if (!newPay.category || newPay.amount <= 0) {
      alert('Please enter a category and amount');
      return;
    }

    if (selectedSettlement) {
      const existingAdditionalPay = (selectedSettlement as any).additionalPay || {};
      const updatedAdditionalPay = { ...existingAdditionalPay };
      const key = newPay.category.toLowerCase().replace(/\s+/g, '');
      updatedAdditionalPay[key] = (updatedAdditionalPay[key] || 0) + newPay.amount;

      const totalAdditionalPay = Object.values(updatedAdditionalPay).reduce((sum, v) => sum + Number(v), 0);
      const newGrossPay = (selectedSettlement.grossPay || 0) + newPay.amount;
      const newNetPay = Math.max(0, newGrossPay - (selectedSettlement.totalDeductions || 0));

      updateSettlement(selectedSettlement.id, {
        additionalPay: updatedAdditionalPay,
        grossPay: newGrossPay,
        netPay: newNetPay
      } as any);

      // Update local state
      setSelectedSettlement({
        ...selectedSettlement,
        additionalPay: updatedAdditionalPay,
        grossPay: newGrossPay,
        netPay: newNetPay
      } as Settlement);
    }

    setNewPay({ id: '', category: '', memo: '', amount: 0 });
    setShowAddPayModal(false);
  };

  // Clone deductions from last settlement
  const handleCloneDeductions = () => {
    if (!selectedSettlement?.driverId) return;

    // Find the previous settlement for this driver
    const driverSettlements = settlements
      .filter(s => s.driverId === selectedSettlement.driverId && s.id !== selectedSettlement.id)
      .sort((a, b) => new Date(b.createdAt || b.date || '').getTime() - new Date(a.createdAt || a.date || '').getTime());

    if (driverSettlements.length === 0) {
      alert('No previous settlements found for this driver');
      return;
    }

    const lastSettlement = driverSettlements[0];
    if (!lastSettlement.deductions || Object.keys(lastSettlement.deductions).length === 0) {
      alert('No deductions found in the last settlement');
      return;
    }

    // Clone the deductions
    const clonedDeductions = { ...selectedSettlement.deductions };
    Object.entries(lastSettlement.deductions).forEach(([key, value]) => {
      clonedDeductions[key] = (clonedDeductions[key] || 0) + Number(value);
    });

    const newTotalDeductions = Object.values(clonedDeductions).reduce((sum, v) => sum + Number(v), 0);
    const newNetPay = Math.max(0, (selectedSettlement.grossPay || 0) - newTotalDeductions);

    updateSettlement(selectedSettlement.id, {
      deductions: clonedDeductions,
      totalDeductions: newTotalDeductions,
      netPay: newNetPay
    });

    // Update local state
    setSelectedSettlement({
      ...selectedSettlement,
      deductions: clonedDeductions,
      totalDeductions: newTotalDeductions,
      netPay: newNetPay
    });

    alert(`Cloned ${Object.keys(lastSettlement.deductions).length} deduction(s) from last settlement`);
  };

  // Handle send email
  const handleSendEmail = async () => {
    if (!emailAddress || !selectedSettlement) {
      alert('Please enter an email address');
      return;
    }

    setEmailSending(true);

    // Simulate sending email (in real app, this would call an API)
    setTimeout(() => {
      setEmailSending(false);
      setEmailSent(true);

      // Generate PDF and trigger download (simulating email attachment)
      const driver = drivers.find(d => d.id === selectedSettlement.driverId);
      if (driver) {
        generateSettlementPDF(selectedSettlement, driver, loads, settlements, companyProfile);
      }

      setTimeout(() => {
        setShowEmailModal(false);
        setEmailSent(false);
        setEmailAddress('');
        setEmailSubject('');
        setEmailBody('');
      }, 2000);
    }, 1500);
  };

  // Open email modal with pre-filled data
  const openEmailModal = () => {
    if (selectedSettlement) {
      const driver = drivers.find(d => d.id === selectedSettlement.driverId);
      setEmailAddress(driver?.email || '');
      setEmailSubject(`Driver Settlement - ${formatDate(selectedSettlement.date || selectedSettlement.createdAt || '')}`);
      setEmailBody(`Dear ${driver?.firstName || 'Driver'},\n\nPlease find attached your settlement statement.\n\nNet Pay: ${formatCurrency(selectedSettlement.netPay || 0)}\n\nThank you,\n${companyProfile?.companyName || 'Your Company'}`);
      setShowEmailModal(true);
    }
  };

  const handleSaveSettlement = async () => {
    if (!selectedDriverId || selectedLoads.length === 0) {
      alert('Please select at least one load');
      return;
    }

    const driver = drivers.find(d => d.id === selectedDriverId);
    if (!driver) return;

    const deductionsObj: Record<string, number> = {};
    deductions.forEach(d => {
      if (d.category && d.amount > 0) {
        const key = d.category.toLowerCase().replace(/\s+/g, '');
        deductionsObj[key] = (deductionsObj[key] || 0) + d.amount;
      }
    });

    const additionalPayObj: Record<string, number> = {};
    additionalPay.forEach(p => {
      if (p.category && p.amount > 0) {
        const key = p.category.toLowerCase().replace(/\s+/g, '');
        additionalPayObj[key] = (additionalPayObj[key] || 0) + p.amount;
      }
    });

    const settlementLoads = selectedLoads.map(loadId => {
      const load = loads.find(l => l.id === loadId);
      return {
        loadId,
        basePay: load?.driverBasePay || 0,
        detention: load?.driverDetentionPay || 0,
        tonu: (load as any)?.tonuFee || 0,
        layover: load?.driverLayoverPay || 0,
        dispatchFee: load?.dispatcherCommissionAmount || 0
      };
    });

    if (viewMode === 'edit' && selectedSettlement) {
      // Update existing settlement
      const updates: Partial<Settlement> = {
        driverId: selectedDriverId,
        driverName: `${driver.firstName} ${driver.lastName}`,
        loadIds: selectedLoads,
        loads: settlementLoads,
        grossPay: settlementTotals.grossPay,
        deductions: deductionsObj,
        additionalPay: additionalPayObj,
        totalDeductions: settlementTotals.totalDeductions,
        netPay: settlementTotals.netPay,
        totalMiles: settlementTotals.totalMiles,
        periodStart: beginDate,
        periodEnd: endDate,
        date: paidOnDate,
        notes,
        period: {
          start: beginDate,
          end: endDate,
          display: `${formatDate(beginDate)} - ${formatDate(endDate)}`,
        }
      };

      updateSettlement(selectedSettlement.id, updates);

      // Update load links
      // First, clear old settlement links
      if (selectedSettlement.loadIds) {
        for (const loadId of selectedSettlement.loadIds) {
          if (!selectedLoads.includes(loadId)) {
            await updateLoad(loadId, { settlementId: undefined });
          }
        }
      }
      // Then set new ones
      for (const loadId of selectedLoads) {
        await updateLoad(loadId, { settlementId: selectedSettlement.id });
      }

      const updatedSettlement = { ...selectedSettlement, ...updates } as Settlement;
      setSelectedSettlement(updatedSettlement);
      setViewMode('view');
    } else {
      // Create new settlement
      const settlementNumber = `ST-${new Date().getFullYear()}-${1000 + settlements.length + 1}`;

      const newSettlement: Omit<Settlement, 'id'> = {
        settlementNumber,
        type: 'driver',
        driverId: selectedDriverId,
        driverName: `${driver.firstName} ${driver.lastName}`,
        loadIds: selectedLoads,
        loads: settlementLoads,
        expenseIds: [],
        grossPay: settlementTotals.grossPay,
        deductions: deductionsObj,
        additionalPay: additionalPayObj,
        totalDeductions: settlementTotals.totalDeductions,
        netPay: settlementTotals.netPay,
        totalMiles: settlementTotals.totalMiles,
        status: 'pending',
        periodStart: beginDate,
        periodEnd: endDate,
        createdAt: paidOnDate || new Date().toISOString(),
        date: paidOnDate,
        notes,
        period: {
          start: beginDate,
          end: endDate,
          display: `${formatDate(beginDate)} - ${formatDate(endDate)}`,
        }
      };

      const settlementId = addSettlement(newSettlement);

      for (const loadId of selectedLoads) {
        try {
          await updateLoad(loadId, { settlementId });
        } catch (error) {
          console.error('Error linking settlement to load:', error);
        }
      }

      const createdSettlement = { ...newSettlement, id: settlementId } as Settlement;
      setSelectedSettlement(createdSettlement);
      setViewMode('view');
    }
  };

  const getDriverName = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver ? `${driver.lastName}, ${driver.firstName}` : 'Unknown';
  };

  const getDriverLastName = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver ? driver.lastName : 'Unknown';
  };

  // List View
  if (viewMode === 'list') {
    return (
      <div className="min-h-screen bg-slate-900 text-white">
        {/* Toolbar */}
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3 flex-wrap">
          <button className="bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-600">
            <List size={16} />
            Drivers
          </button>
          <button
            onClick={handleNewSettlement}
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus size={16} />
            New Settlement
          </button>
          <button className="bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-600">
            <List size={16} />
            Deduction Categories
          </button>
          <button className="bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-600">
            <List size={16} />
            Additional Pay Categories
          </button>
          <button className="bg-amber-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-amber-700">
            <FileSpreadsheet size={16} />
            Quickbooks Exporter
          </button>
          <div className="flex-1" />
          <div className="relative">
            <input
              type="text"
              placeholder=""
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white w-48"
            />
            <button className="absolute right-0 top-0 bg-slate-600 px-4 py-2 rounded-r flex items-center gap-2 hover:bg-slate-500">
              <Search size={16} />
              Search
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold">Driver Settlements</h1>
        </div>

        {/* Table */}
        <div className="px-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 font-medium text-slate-300">Driver</th>
                <th
                  className="text-left py-3 px-4 font-medium text-slate-300 cursor-pointer hover:text-white"
                  onClick={() => handleSort('paidOn')}
                >
                  Paid On {sortField === 'paidOn' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-left py-3 px-4 font-medium text-slate-300 cursor-pointer hover:text-white"
                  onClick={() => handleSort('netPay')}
                >
                  Net Pay {sortField === 'netPay' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left py-3 px-4 font-medium text-slate-300"></th>
              </tr>
            </thead>
            <tbody>
              {filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No settlements found. Click "New Settlement" to create one.
                  </td>
                </tr>
              ) : (
                filteredSettlements.map(settlement => (
                  <tr key={settlement.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleViewSettlement(settlement)}
                        className="text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {settlement.driverName}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {formatDate(settlement.createdAt || settlement.date || '')}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {formatCurrency(settlement.netPay || 0)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewSettlement(settlement)}
                          className="bg-slate-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-slate-500"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        <button
                          onClick={() => handleEditSettlement(settlement)}
                          className="bg-slate-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-slate-500"
                        >
                          <Edit2 size={14} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSettlement(settlement.id)}
                          className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // New Settlement Form - Step 1
  if (viewMode === 'new') {
    return (
      <div className="min-h-screen bg-slate-900 text-white">
        {/* Toolbar */}
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
          <button
            onClick={() => setViewMode('list')}
            className="bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-600"
          >
            <List size={16} />
            List
          </button>
        </div>

        {/* Form */}
        <div className="p-6 max-w-2xl">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            New Driver Settlement
            <Info size={20} className="text-blue-400" />
          </h1>

          <div className="space-y-6">
            {/* Driver */}
            <div className="flex items-center gap-4">
              <label className="w-40 text-right text-slate-300">
                Driver <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-600 rounded px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a driver...</option>
                {drivers.map(driver => (
                  <option key={driver.id} value={driver.id}>
                    {driver.lastName}, {driver.firstName}
                  </option>
                ))}
              </select>
            </div>

            {/* Begin Date */}
            <div className="flex items-center gap-4">
              <label className="w-40 text-right text-slate-300">
                Begin Date <span className="text-red-400">*</span>
              </label>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Calendar size={16} />
                </span>
                <input
                  type="date"
                  value={beginDate}
                  onChange={(e) => setBeginDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="flex items-center gap-4">
              <label className="w-40 text-right text-slate-300">
                End Date <span className="text-red-400">*</span>
              </label>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Calendar size={16} />
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Show gross revenue */}
            <div className="flex items-center gap-4">
              <label className="w-40 text-right text-slate-300">
                Show gross revenue <span className="text-red-400">*</span>
              </label>
              <div className="flex-1">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showGrossRevenue}
                    onChange={(e) => setShowGrossRevenue(e.target.checked)}
                    className="w-4 h-4 bg-slate-800 border border-slate-600 rounded"
                  />
                  <span className="text-slate-300">Yes</span>
                </label>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-4 pt-6 border-t border-slate-700 ml-44">
              <button
                onClick={handleNextStep}
                className="bg-blue-600 text-white px-6 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
              >
                <FileSpreadsheet size={16} />
                Next
              </button>
              <span className="text-slate-400">or</span>
              <button
                onClick={() => setViewMode('list')}
                className="text-red-400 hover:text-red-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Select Loads - Step 2 (also used for Edit mode)
  if (viewMode === 'selectLoads' || viewMode === 'edit') {
    const driver = drivers.find(d => d.id === selectedDriverId);
    const isEditMode = viewMode === 'edit';

    return (
      <div className="min-h-screen bg-slate-900 text-white">
        {/* Toolbar */}
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
          <button
            onClick={() => setViewMode('list')}
            className="bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-600"
          >
            <List size={16} />
            List
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-2">
            {isEditMode ? 'Edit Settlement' : 'Unpaid Trips'} for {driver?.firstName} {driver?.lastName} (Driver)
          </h1>
          <h2 className="text-xl text-slate-400 mb-6">
            Period: {formatDate(beginDate)} - {formatDate(endDate)}
          </h2>

          {/* Sort and Date Options */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-4">
              <label className="w-32 text-slate-300 font-medium">Order of Loads</label>
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="sortOrder"
                    checked={loadSortOrder === 'asc'}
                    onChange={() => setLoadSortOrder('asc')}
                    className="text-blue-600"
                  />
                  <span className="text-slate-300">Ascending by date</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="sortOrder"
                    checked={loadSortOrder === 'desc'}
                    onChange={() => setLoadSortOrder('desc')}
                    className="text-blue-600"
                  />
                  <span className="text-slate-300">Descending by date</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="w-32 text-slate-300 font-medium">
                Paid On <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Calendar size={16} />
                </span>
                <input
                  type="date"
                  value={paidOnDate}
                  onChange={(e) => setPaidOnDate(e.target.value)}
                  className="bg-slate-800 border border-slate-600 rounded pl-10 pr-4 py-2 text-white [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="w-32 text-slate-300 font-medium">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Note for the driver"
                className="flex-1 bg-slate-800 border border-slate-600 rounded px-4 py-2 text-white max-w-xl"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="w-32 text-slate-300 font-medium">Show all stops</label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showAllStops}
                  onChange={(e) => setShowAllStops(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-slate-300">Show all stops</span>
              </label>
            </div>
          </div>

          {/* Loads Table */}
          <div className="bg-slate-800 rounded-lg overflow-hidden mb-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left p-3 w-10"></th>
                  <th className="text-left p-3 text-slate-300">Trip #</th>
                  <th className="text-left p-3 text-slate-300">Delivery</th>
                  <th className="text-left p-3 text-slate-300">Driver</th>
                  <th className="text-left p-3 text-slate-300">From</th>
                  <th className="text-left p-3 text-slate-300">To</th>
                  <th className="text-right p-3 text-slate-300">Driver Pay</th>
                </tr>
              </thead>
              <tbody>
                {availableLoads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No unpaid trips found for this period.
                    </td>
                  </tr>
                ) : (
                  availableLoads.map(load => {
                    const driverPay = load.driverBasePay || (driver ? calculateDriverPay(load, driver) : 0);
                    return (
                      <tr
                        key={load.id}
                        className={`border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer ${
                          selectedLoads.includes(load.id) ? 'bg-slate-700/30' : ''
                        }`}
                        onClick={() => toggleLoadSelection(load.id)}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedLoads.includes(load.id)}
                            onChange={() => toggleLoadSelection(load.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="p-3 text-slate-300">{load.loadNumber}</td>
                        <td className="p-3 text-slate-300">{formatDate(load.deliveryDate || load.pickupDate || '')}</td>
                        <td className="p-3 text-slate-300">{getDriverLastName(load.driverId || '')}</td>
                        <td className="p-3 text-slate-300">{load.originCity}, {load.originState}</td>
                        <td className="p-3 text-slate-300">{load.destCity}, {load.destState}</td>
                        <td className="p-3 text-slate-300 text-right">{formatCurrency(driverPay)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Select All / Unselect All */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={selectAllLoads}
              className="bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-600 flex items-center gap-2"
            >
              <input type="checkbox" checked={selectedLoads.length === availableLoads.length && availableLoads.length > 0} readOnly className="pointer-events-none" />
              Check all on this page
            </button>
            <button
              onClick={unselectAllLoads}
              className="bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-600 flex items-center gap-2"
            >
              <input type="checkbox" checked={false} readOnly className="pointer-events-none" />
              Uncheck all on this page
            </button>
          </div>

          {/* Deductions Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Deductions</h3>
              <button
                onClick={addDeduction}
                className="bg-slate-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-slate-600"
              >
                <Plus size={14} />
                Add Deduction
              </button>
            </div>
            {deductions.length > 0 && (
              <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                {deductions.map((deduction, index) => (
                  <div key={deduction.id} className="flex items-center gap-3">
                    <select
                      value={deduction.category}
                      onChange={(e) => updateDeduction(deduction.id, 'category', e.target.value)}
                      className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white w-48"
                    >
                      <option value="">Select category...</option>
                      {DEDUCTION_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Memo"
                      value={deduction.memo}
                      onChange={(e) => updateDeduction(deduction.id, 'memo', e.target.value)}
                      className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white flex-1"
                    />
                    <div className="relative w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={deduction.amount || ''}
                        onChange={(e) => updateDeduction(deduction.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="bg-slate-700 border border-slate-600 rounded pl-7 pr-3 py-2 text-white w-full"
                      />
                    </div>
                    <button
                      onClick={() => removeDeduction(deduction.id)}
                      className="text-red-400 hover:text-red-300 p-2"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-slate-800 rounded-lg p-4 mb-6 max-w-md">
            <h3 className="text-lg font-semibold mb-3">Settlement Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Selected Loads:</span>
                <span>{selectedLoads.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gross Pay:</span>
                <span>{formatCurrency(settlementTotals.grossPay)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Deductions:</span>
                <span className="text-red-400">-{formatCurrency(settlementTotals.totalDeductions)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-700 font-bold">
                <span>Net Pay:</span>
                <span className="text-green-400">{formatCurrency(settlementTotals.netPay)}</span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSaveSettlement}
              disabled={selectedLoads.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {isEditMode ? 'Update Settlement' : 'Save'}
            </button>
            <span className="text-slate-400">or</span>
            <button
              onClick={() => isEditMode ? setViewMode('view') : setViewMode('new')}
              className="text-red-400 hover:text-red-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View Settlement
  if (viewMode === 'view' && selectedSettlement) {
    const driver = drivers.find(d => d.id === selectedSettlement.driverId);
    const settlementLoads = selectedSettlement.loadIds
      ? loads.filter(l => selectedSettlement.loadIds!.includes(l.id))
      : [];
    const ytdData = calculateYTDEarnings(selectedSettlement.driverId || '');

    return (
      <div className="min-h-screen bg-slate-900 text-white">
        {/* Toolbar */}
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setViewMode('list')}
            className="bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-600"
          >
            <List size={16} />
            Settlement List
          </button>
          <button
            onClick={() => {
              if (driver) {
                generateSettlementPDF(selectedSettlement, driver, loads, settlements, companyProfile);
              } else {
                alert('Driver not found. Cannot generate PDF.');
              }
            }}
            className="bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-600"
          >
            <FileText size={16} />
            PDF
          </button>
          <button
            onClick={() => setShowSettlementDetails(true)}
            className="bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-600"
          >
            <Info size={16} />
            Settlement Details
          </button>
          <button
            onClick={() => handleEditSettlement(selectedSettlement)}
            className="bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-600"
          >
            <Edit2 size={16} />
            Edit
          </button>
          <button
            onClick={() => {
              setNewDeduction({ id: '', category: '', memo: '', amount: 0 });
              setShowAddDeductionModal(true);
            }}
            className="bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-600"
          >
            <Plus size={16} />
            Add Deduction
          </button>
          <button
            onClick={handleCloneDeductions}
            className="bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-600"
          >
            <Copy size={16} />
            Clone Deductions from Last Settlement
          </button>
          <button
            onClick={() => {
              setNewPay({ id: '', category: '', memo: '', amount: 0 });
              setShowAddPayModal(true);
            }}
            className="bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-600"
          >
            <Plus size={16} />
            Add Additional Pay
          </button>
          <button
            onClick={openEmailModal}
            className="bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-600"
          >
            <Mail size={16} />
            Send via email
          </button>
          <button
            onClick={() => handleDeleteSettlement(selectedSettlement.id)}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-500"
          >
            Delete
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Title */}
          <h1 className="text-2xl font-semibold mb-4">
            Driver Settlement For {selectedSettlement.driverName}
          </h1>

          {/* Success Notice */}
          <div className="border border-slate-600 rounded p-3 mb-4 flex items-center gap-2">
            <span className="text-lg">↩</span>
            <span className="font-bold">Notice</span>
            <span className="text-slate-300">Driver settlement created successfully</span>
          </div>

          {/* Company and Driver Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Company Card */}
            <div className="border border-slate-600 rounded-lg overflow-hidden">
              <div className="bg-slate-700 px-4 py-2 text-sm">Company</div>
              <div className="p-4 space-y-3 text-sm">
                <div>
                  <p className="font-bold text-slate-400">Company</p>
                  <p>🏢 {companyProfile?.companyName || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400">Address</p>
                  <p>{companyProfile?.address1 || 'N/A'}</p>
                  {companyProfile?.address2 && <p>{companyProfile.address2}</p>}
                  <p>{companyProfile?.city}, {companyProfile?.state} {companyProfile?.zip}</p>
                </div>
              </div>
            </div>

            {/* Driver Card */}
            <div className="border border-slate-600 rounded-lg overflow-hidden">
              <div className="bg-slate-700 px-4 py-2 text-sm">Driver</div>
              <div className="p-4 space-y-3 text-sm">
                <div>
                  <p className="font-bold text-slate-400">Driver</p>
                  <p>👤 {driver?.firstName} {driver?.lastName}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400">Address</p>
                  <p>{driver?.address || 'N/A'}</p>
                  <p>{driver?.city}, {driver?.state} {driver?.zipCode}</p>
                </div>
                {driver?.phone && (
                  <div>
                    <p className="font-bold text-slate-400">Primary</p>
                    <p>📞 {driver.phone}</p>
                  </div>
                )}
                {driver?.email && (
                  <div>
                    <p className="font-bold text-slate-400">Email</p>
                    <p>✉ {driver.email}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <h2 className="text-xl mb-4">
            Paid {formatCurrency(selectedSettlement.netPay || 0)} On {formatDate(selectedSettlement.createdAt || selectedSettlement.date || '')}
          </h2>

          <div className="bg-slate-800 rounded-lg overflow-hidden max-w-md mb-6">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-slate-700">
                  <td className="px-4 py-2 font-bold">Gross Earnings</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(selectedSettlement.grossPay || 0)}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="px-4 py-2 font-bold">Deductions</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(selectedSettlement.totalDeductions || 0)}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="px-4 py-2 font-bold">Net Earnings</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(selectedSettlement.netPay || 0)}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="px-4 py-2 font-bold">Pay Advances</td>
                  <td className="px-4 py-2 text-right">$0.00</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-bold">Net Pay</td>
                  <td className="px-4 py-2 text-right font-bold">{formatCurrency(selectedSettlement.netPay || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Settlement Section */}
          <h2 className="text-xl font-semibold mb-4">Settlement</h2>

          {/* Earnings Table */}
          <div className="border border-slate-600 rounded-lg overflow-hidden mb-6 max-w-4xl">
            <div className="bg-blue-600 px-4 py-2 text-center font-medium text-sm">Earnings</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800">
                  <th className="text-left px-4 py-2 font-bold">Earned On</th>
                  <th className="text-left px-4 py-2 font-bold">Memo</th>
                  <th className="text-left px-4 py-2 font-bold">Driver Pay</th>
                  <th className="text-left px-4 py-2 font-bold">Deductions</th>
                </tr>
              </thead>
              <tbody>
                {settlementLoads.map(load => {
                  const basePay = load.driverBasePay || (driver ? calculateDriverPay(load, driver) : 0);
                  return (
                    <tr key={load.id} className="border-b border-slate-700">
                      <td className="px-4 py-2">{formatDate(load.deliveryDate || load.pickupDate || '')}</td>
                      <td className="px-4 py-2">
                        Trip #<span className="text-blue-400">{load.loadNumber}</span> - {load.originCity}, {load.originState} to {load.destCity}, {load.destState}
                      </td>
                      <td className="px-4 py-2">{formatCurrency(basePay)}</td>
                      <td className="px-4 py-2"></td>
                    </tr>
                  );
                })}
                {/* Additional Pay Items */}
                {(selectedSettlement as any).additionalPay && Object.entries((selectedSettlement as any).additionalPay).map(([category, amount]) => (
                  <tr key={category} className="border-b border-slate-700 bg-green-900/20">
                    <td className="px-4 py-2">-</td>
                    <td className="px-4 py-2 text-green-400">Additional Pay: {category}</td>
                    <td className="px-4 py-2 text-green-400">{formatCurrency(Number(amount))}</td>
                    <td className="px-4 py-2"></td>
                  </tr>
                ))}
                {/* Deduction Items */}
                {selectedSettlement.deductions && Object.entries(selectedSettlement.deductions).map(([category, amount]) => (
                  <tr key={category} className="border-b border-slate-700 bg-red-900/20">
                    <td className="px-4 py-2">-</td>
                    <td className="px-4 py-2 text-red-400">Deduction: {category}</td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-red-400">{formatCurrency(Number(amount))}</td>
                  </tr>
                ))}
                <tr className="border-b border-slate-700 bg-slate-800">
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2">Gross Pay</td>
                  <td className="px-4 py-2 font-bold">{formatCurrency(selectedSettlement.grossPay || 0)}</td>
                  <td className="px-4 py-2"></td>
                </tr>
                <tr className="border-b border-slate-700 bg-slate-800">
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2">Totals</td>
                  <td className="px-4 py-2 font-bold">{formatCurrency(selectedSettlement.grossPay || 0)}</td>
                  <td className="px-4 py-2 font-bold">{formatCurrency(selectedSettlement.totalDeductions || 0)}</td>
                </tr>
                <tr className="bg-slate-800">
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2 font-bold">Net Pay</td>
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2 font-bold text-green-400">{formatCurrency(selectedSettlement.netPay || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notes */}
          <h2 className="text-xl font-semibold mb-2">Notes</h2>
          {selectedSettlement.notes ? (
            <p className="text-slate-300 mb-4">{selectedSettlement.notes}</p>
          ) : (
            <p className="text-slate-500 mb-4 italic">No notes</p>
          )}
        </div>

        {/* Settlement Details Modal */}
        {showSettlementDetails && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <h3 className="text-xl font-bold">Settlement Details</h3>
                <button onClick={() => setShowSettlementDetails(false)} className="text-slate-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 text-sm">Settlement Number</p>
                    <p className="font-medium">{selectedSettlement.settlementNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Driver</p>
                    <p className="font-medium">{selectedSettlement.driverName}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Period</p>
                    <p className="font-medium">{formatDate(selectedSettlement.periodStart || '')} - {formatDate(selectedSettlement.periodEnd || '')}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Paid On</p>
                    <p className="font-medium">{formatDate(selectedSettlement.date || selectedSettlement.createdAt || '')}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Status</p>
                    <p className="font-medium capitalize">{selectedSettlement.status || 'Pending'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Total Loads</p>
                    <p className="font-medium">{selectedSettlement.loadIds?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Total Miles</p>
                    <p className="font-medium">{(selectedSettlement.totalMiles || 0).toLocaleString()}</p>
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <h4 className="font-semibold mb-2">Financial Summary</h4>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Gross Pay</td>
                        <td className="py-2 text-right">{formatCurrency(selectedSettlement.grossPay || 0)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Total Deductions</td>
                        <td className="py-2 text-right text-red-400">-{formatCurrency(selectedSettlement.totalDeductions || 0)}</td>
                      </tr>
                      <tr className="font-bold">
                        <td className="py-2">Net Pay</td>
                        <td className="py-2 text-right text-green-400">{formatCurrency(selectedSettlement.netPay || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {selectedSettlement.deductions && Object.keys(selectedSettlement.deductions).length > 0 && (
                  <div className="border-t border-slate-700 pt-4">
                    <h4 className="font-semibold mb-2">Deductions Breakdown</h4>
                    <table className="w-full text-sm">
                      <tbody>
                        {Object.entries(selectedSettlement.deductions).map(([category, amount]) => (
                          <tr key={category} className="border-b border-slate-700">
                            <td className="py-2 capitalize">{category}</td>
                            <td className="py-2 text-right">{formatCurrency(Number(amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="border-t border-slate-700 pt-4">
                  <h4 className="font-semibold mb-2">YTD Summary</h4>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">YTD Gross</td>
                        <td className="py-2 text-right">{formatCurrency(ytdData.grossYTD)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">YTD Deductions</td>
                        <td className="py-2 text-right text-red-400">-{formatCurrency(ytdData.totalDeductionsYTD)}</td>
                      </tr>
                      <tr className="font-bold">
                        <td className="py-2">YTD Net</td>
                        <td className="py-2 text-right text-green-400">{formatCurrency(ytdData.netYTD)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="p-4 border-t border-slate-700">
                <button
                  onClick={() => setShowSettlementDetails(false)}
                  className="w-full bg-slate-700 text-white py-2 rounded hover:bg-slate-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Deduction Modal */}
        {showAddDeductionModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <h3 className="text-xl font-bold">Add Deduction</h3>
                <button onClick={() => setShowAddDeductionModal(false)} className="text-slate-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                  <select
                    value={newDeduction.category}
                    onChange={(e) => setNewDeduction({ ...newDeduction, category: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  >
                    <option value="">Select category...</option>
                    {DEDUCTION_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Memo (optional)</label>
                  <input
                    type="text"
                    value={newDeduction.memo}
                    onChange={(e) => setNewDeduction({ ...newDeduction, memo: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                    placeholder="Description..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      value={newDeduction.amount || ''}
                      onChange={(e) => setNewDeduction({ ...newDeduction, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-700 border border-slate-600 rounded pl-7 pr-3 py-2 text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-700 flex gap-3">
                <button
                  onClick={() => setShowAddDeductionModal(false)}
                  className="flex-1 bg-slate-700 text-white py-2 rounded hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddDeductionFromModal}
                  className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                >
                  Add Deduction
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Additional Pay Modal */}
        {showAddPayModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <h3 className="text-xl font-bold">Add Additional Pay</h3>
                <button onClick={() => setShowAddPayModal(false)} className="text-slate-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                  <select
                    value={newPay.category}
                    onChange={(e) => setNewPay({ ...newPay, category: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  >
                    <option value="">Select category...</option>
                    {ADDITIONAL_PAY_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Memo (optional)</label>
                  <input
                    type="text"
                    value={newPay.memo}
                    onChange={(e) => setNewPay({ ...newPay, memo: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                    placeholder="Description..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      value={newPay.amount || ''}
                      onChange={(e) => setNewPay({ ...newPay, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-700 border border-slate-600 rounded pl-7 pr-3 py-2 text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-700 flex gap-3">
                <button
                  onClick={() => setShowAddPayModal(false)}
                  className="flex-1 bg-slate-700 text-white py-2 rounded hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPayFromModal}
                  className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
                >
                  Add Pay
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg max-w-lg w-full">
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <h3 className="text-xl font-bold">Send Settlement via Email</h3>
                <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              {emailSent ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={32} />
                  </div>
                  <h4 className="text-xl font-semibold mb-2">Email Sent!</h4>
                  <p className="text-slate-400">Settlement has been sent to {emailAddress}</p>
                </div>
              ) : (
                <>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">To</label>
                      <input
                        type="email"
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                        placeholder="driver@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Subject</label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Message</label>
                      <textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        rows={5}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <FileText size={16} />
                      <span>Settlement PDF will be attached automatically</span>
                    </div>
                  </div>
                  <div className="p-4 border-t border-slate-700 flex gap-3">
                    <button
                      onClick={() => setShowEmailModal(false)}
                      className="flex-1 bg-slate-700 text-white py-2 rounded hover:bg-slate-600"
                      disabled={emailSending}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendEmail}
                      disabled={emailSending || !emailAddress}
                      className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {emailSending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail size={16} />
                          Send Email
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default Settlements;

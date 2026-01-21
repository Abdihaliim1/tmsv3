import React, { useState, useEffect, useMemo } from 'react';
import { X, MapPin, Calculator, Clock, FileText, AlertTriangle } from 'lucide-react';
import { LoadStatus, NewLoadInput, Load, Broker, NewBrokerInput, FactoringCompany, DocumentType } from '../types';
import { useTMS } from '../context/TMSContext';
import { calculateDistance, validatePayPercentage } from '../services/utils';
import { normalize } from '../services/brokerUtils';
import { BrokerAutocomplete } from './BrokerAutocomplete';
import { FactoringCompanyAutocomplete } from './FactoringCompanyAutocomplete';
import DocumentUpload from './DocumentUpload';
import { isLoadLocked, validatePostDeliveryUpdates } from '../services/loadLocking';

interface AddLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (load: NewLoadInput) => void;
  editingLoad?: Load | null; // Optional: for editing existing loads
}

const AddLoadModal: React.FC<AddLoadModalProps> = ({ isOpen, onClose, onSubmit, editingLoad }) => {
  const { employees, drivers, factoringCompanies, brokers, loads, trucks, trailers, addBroker, addFactoringCompany } = useTMS();

  // Get dispatchers from employees
  const dispatchers = employees.filter(e => e.employeeType === 'dispatcher' && e.status === 'active');

  const initialState: NewLoadInput = {
    status: LoadStatus.Available,
    customerName: '',
    originCity: '',
    originState: '',
    destCity: '',
    destState: '',
    // BOL/PO Numbers
    bolNumber: '',
    poNumber: '',
    podNumber: '',
    // Trailer Tracking
    trailerId: '',
    trailerNumber: '',
    rate: 0, // Base rate
    miles: 0,
    pickupDate: '',
    deliveryDate: '',
    driverId: '',
    driverName: '',
    // Team Driver Support
    isTeamLoad: false,
    driver2Id: '',
    driver2Name: '',
    driver2PayType: undefined,
    driver2PayRate: 0,
    driver2Earnings: 0,
    totalDriverPay: 0,
    // Broker/Factoring fields
    brokerId: '',
    brokerName: '',
    brokerReference: '',
    factoringCompanyId: '',
    factoringCompanyName: '',
    isFactored: false,
    factoredDate: '',
    factoredAmount: 0,
    factoringFee: 0,
    factoringFeePercent: 0,
    // Dispatcher fields
    dispatcherId: '',
    dispatcherName: '',
    dispatcherCommissionType: undefined,
    dispatcherCommissionRate: 0,
    dispatcherCommissionAmount: 0,
    isExternalDispatch: false,
    dispatcherPaid: false,
    dispatcherPaidDate: '',
    // Payment tracking
    paymentReceived: false,
    paymentReceivedDate: '',
    paymentAmount: 0,
    // Accessorials and Detention
    hasDetention: false,
    detentionLocation: undefined,
    detentionHours: 0,
    detentionRate: 0,
    detentionAmount: 0,
    // Layover
    hasLayover: false,
    layoverDays: 0,
    layoverRate: 0,
    layoverAmount: 0,
    // Lumper
    hasLumper: false,
    lumperFee: 0,
    lumperAmount: 0,
    // Fuel Surcharge
    hasFSC: false,
    fscType: undefined,
    fscRate: 0,
    fscAmount: 0,
    // TONU
    hasTONU: false,
    tonuFee: 0,
    // Other
    otherAccessorials: 0,
    totalAccessorials: 0,
    grandTotal: 0,
    // Notes
    notes: ''
  };

  const [formData, setFormData] = useState<NewLoadInput>(initialState);
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [rpm, setRpm] = useState<string>('0.00');
  const [isCalculatingMiles, setIsCalculatingMiles] = useState(false);

  // Adjustment workflow state (for delivered loads)
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [pendingChanges, setPendingChanges] = useState<Partial<Load> | null>(null);

  // Check if load is locked (delivered/completed)
  const isDeliveredLoad = editingLoad ? isLoadLocked(editingLoad) : false;

  // Get unique broker names from existing loads (for now - later use Customers collection)
  // Handle broker selection from autocomplete
  const handleBrokerSelect = (broker: Broker | null) => {
    if (broker) {
      setFormData(prev => ({
        ...prev,
        brokerId: broker.id,
        brokerName: broker.name,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        brokerId: '',
        brokerName: '',
      }));
    }
  };

  // Handle adding new broker
  const handleAddNewBroker = (newBroker: NewBrokerInput) => {
    addBroker(newBroker);
    // After adding, the broker will be in the list, so we can find and select it
    // We'll set the broker name in the form
    setTimeout(() => {
      const addedBroker = brokers.find(b => b.name === newBroker.name) ||
        brokers.find(b => normalize(b.name) === normalize(newBroker.name || ''));
      if (addedBroker) {
        handleBrokerSelect(addedBroker);
      } else {
        // If not found immediately, set the name directly
        setFormData(prev => ({
          ...prev,
          brokerName: newBroker.name || '',
        }));
      }
    }, 100);
  };

  // Handle factoring company selection from autocomplete
  const handleFactoringCompanySelect = (company: FactoringCompany | null) => {
    if (company) {
      setFormData(prev => ({
        ...prev,
        factoringCompanyId: company.id,
        factoringCompanyName: company.name,
        // Set fee percentage from company if available
        factoringFeePercent: company.feePercentage || prev.factoringFeePercent || 0,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        factoringCompanyId: '',
        factoringCompanyName: '',
        factoringFeePercent: 0,
      }));
    }
  };

  // Handle adding new factoring company
  const handleAddNewFactoringCompany = (newCompany: Omit<FactoringCompany, 'id'>) => {
    addFactoringCompany(newCompany);
    // After adding, the company will be in the list, so we can find and select it
    setTimeout(() => {
      const addedCompany = factoringCompanies.find(c => c.name === newCompany.name) ||
        factoringCompanies.find(c => normalize(c.name) === normalize(newCompany.name || ''));
      if (addedCompany) {
        handleFactoringCompanySelect(addedCompany);
      } else {
        // If not found immediately, set the name directly
        setFormData(prev => ({
          ...prev,
          factoringCompanyName: newCompany.name || '',
        }));
      }
    }, 100);
  };

  // Reset form on open or populate for editing
  useEffect(() => {
    if (isOpen) {
      if (editingLoad) {
        // Populate form with existing load data for editing
        const driver = drivers.find(d => d.id === editingLoad.driverId);
        setFormData({
          status: editingLoad.status,
          customerName: editingLoad.customerName,
          originCity: editingLoad.originCity,
          originState: editingLoad.originState,
          destCity: editingLoad.destCity,
          destState: editingLoad.destState,
          // BOL/PO Numbers
          bolNumber: editingLoad.bolNumber || '',
          poNumber: editingLoad.poNumber || '',
          podNumber: editingLoad.podNumber || '',
          // Trailer Tracking
          trailerId: editingLoad.trailerId || '',
          trailerNumber: editingLoad.trailerNumber || '',
          rate: editingLoad.rate || 0,
          miles: editingLoad.miles || 0,
          pickupDate: editingLoad.pickupDate || '',
          deliveryDate: editingLoad.deliveryDate || '',
          driverId: editingLoad.driverId || '',
          driverName: editingLoad.driverName || '',
          // Broker/Factoring
          brokerId: editingLoad.brokerId || '',
          brokerName: editingLoad.brokerName || '',
          brokerReference: editingLoad.brokerReference || '',
          factoringCompanyId: editingLoad.factoringCompanyId || '',
          factoringCompanyName: editingLoad.factoringCompanyName || '',
          isFactored: editingLoad.isFactored || false,
          factoredDate: editingLoad.factoredDate || '',
          factoredAmount: editingLoad.factoredAmount || 0,
          factoringFee: editingLoad.factoringFee || 0,
          factoringFeePercent: editingLoad.factoringFeePercent || 0,
          // Dispatcher
          dispatcherId: editingLoad.dispatcherId || '',
          dispatcherName: editingLoad.dispatcherName || '',
          dispatcherCommissionType: editingLoad.dispatcherCommissionType,
          dispatcherCommissionRate: editingLoad.dispatcherCommissionRate || 0,
          dispatcherCommissionAmount: editingLoad.dispatcherCommissionAmount || 0,
          isExternalDispatch: editingLoad.isExternalDispatch || false,
          dispatcherPaid: editingLoad.dispatcherPaid || false,
          dispatcherPaidDate: editingLoad.dispatcherPaidDate || '',
          // Payment tracking
          paymentReceived: editingLoad.paymentReceived || false,
          paymentReceivedDate: editingLoad.paymentReceivedDate || '',
          paymentAmount: editingLoad.paymentAmount || 0,
          // Accessorials
          hasDetention: editingLoad.hasDetention || false,
          detentionLocation: editingLoad.detentionLocation,
          detentionHours: editingLoad.detentionHours || 0,
          detentionRate: editingLoad.detentionRate || 0,
          detentionAmount: editingLoad.detentionAmount || 0,
          // Layover
          hasLayover: editingLoad.hasLayover || false,
          layoverDays: editingLoad.layoverDays || 0,
          layoverRate: editingLoad.layoverRate || 0,
          layoverAmount: editingLoad.layoverAmount || 0,
          // Lumper
          hasLumper: editingLoad.hasLumper || false,
          lumperFee: editingLoad.lumperFee || editingLoad.lumperAmount || 0,
          lumperAmount: editingLoad.lumperAmount || editingLoad.lumperFee || 0,
          // Fuel Surcharge
          hasFSC: editingLoad.hasFSC || false,
          fscType: editingLoad.fscType,
          fscRate: editingLoad.fscRate || 0,
          fscAmount: editingLoad.fscAmount || 0,
          // Other
          otherAccessorials: editingLoad.otherAccessorials || 0,
          totalAccessorials: editingLoad.totalAccessorials || 0,
          grandTotal: editingLoad.grandTotal || editingLoad.rate || 0,
          // Driver pay breakdown
          driverBasePay: editingLoad.driverBasePay,
          driverDetentionPay: editingLoad.driverDetentionPay,
          driverLayoverPay: editingLoad.driverLayoverPay,
          driverTotalGross: editingLoad.driverTotalGross,
          // Team Driver Support
          isTeamLoad: editingLoad.isTeamLoad || false,
          driver2Id: editingLoad.driver2Id || '',
          driver2Name: editingLoad.driver2Name || '',
          driver2PayType: editingLoad.driver2PayType,
          driver2PayRate: editingLoad.driver2PayRate || 0,
          driver2Earnings: editingLoad.driver2Earnings || 0,
          totalDriverPay: editingLoad.totalDriverPay || 0,
          // Truck information
          truckId: editingLoad.truckId || driver?.truckId || driver?.currentTruckId || undefined,
          truckNumber: editingLoad.truckNumber || (editingLoad.truckId ? trucks.find(t => t.id === editingLoad.truckId)?.number : (driver?.truckId ? trucks.find(t => t.id === driver.truckId)?.number : undefined))
        });
        // Set selected truck ID for dropdown
        const truckId = editingLoad.truckId || driver?.truckId || driver?.currentTruckId || '';
        setSelectedTruckId(truckId);
      } else {
        // Reset to initial state for new load
        setFormData(initialState);
        setSelectedTruckId('');
      }
      setRpm('0.00');
    }
  }, [isOpen, editingLoad, drivers, trucks]);

  // Auto-calculate Rate Per Mile when Rate or Miles change
  useEffect(() => {
    if (formData.miles > 0 && formData.rate > 0) {
      setRpm((formData.rate / formData.miles).toFixed(2));
    } else {
      setRpm('0.00');
    }
  }, [formData.rate, formData.miles]);

  // Auto-setup factoring when "Is Factored?" is checked
  // Uses the default (first) factoring company and auto-calculates fees
  useEffect(() => {
    if (formData.isFactored) {
      // Auto-select default factoring company if not already selected
      const defaultCompany = factoringCompanies[0]; // Use first/primary factoring company
      const selectedCompany = formData.factoringCompanyId
        ? factoringCompanies.find(fc => fc.id === formData.factoringCompanyId)
        : defaultCompany;

      if (selectedCompany) {
        const feePercentage = selectedCompany.feePercentage || 0;
        const fee = formData.grandTotal > 0 ? formData.grandTotal * (feePercentage / 100) : 0;
        const factoredAmount = formData.grandTotal - fee;

        // Auto-set factored date to day after delivery if not set
        let factoredDate = formData.factoredDate;
        if (!factoredDate && formData.deliveryDate) {
          const deliveryPlusOne = new Date(formData.deliveryDate);
          deliveryPlusOne.setDate(deliveryPlusOne.getDate() + 1);
          factoredDate = deliveryPlusOne.toISOString().split('T')[0];
        }

        setFormData(prev => ({
          ...prev,
          factoringCompanyId: selectedCompany.id,
          factoringCompanyName: selectedCompany.name,
          factoringFeePercent: feePercentage,
          factoringFee: fee,
          factoredAmount: factoredAmount,
          factoredDate: factoredDate || prev.factoredDate,
        }));
      } else if (formData.grandTotal > 0) {
        // No factoring company but has grandTotal - just clear
        setFormData(prev => ({
          ...prev,
          factoringFee: 0,
          factoredAmount: 0
        }));
      }
    } else {
      // Not factored - clear all factoring fields
      setFormData(prev => ({
        ...prev,
        factoringCompanyId: '',
        factoringCompanyName: '',
        factoringFee: 0,
        factoringFeePercent: 0,
        factoredAmount: 0,
        factoredDate: '',
      }));
    }
  }, [formData.isFactored, formData.grandTotal, formData.deliveryDate, factoringCompanies]);

  // Auto-calculate detention amount
  useEffect(() => {
    if (formData.hasDetention && formData.detentionHours > 0 && formData.detentionRate > 0) {
      const detentionAmount = formData.detentionHours * formData.detentionRate;
      setFormData(prev => ({ ...prev, detentionAmount }));
    } else {
      setFormData(prev => ({ ...prev, detentionAmount: 0 }));
    }
  }, [formData.hasDetention, formData.detentionHours, formData.detentionRate]);

  // Auto-calculate TONU amount
  useEffect(() => {
    if (!formData.hasTONU) {
      setFormData(prev => ({ ...prev, tonuFee: 0 }));
    }
  }, [formData.hasTONU]);

  // Auto-calculate total accessorials and grand total
  useEffect(() => {
    const detentionAmount = formData.detentionAmount || 0;
    const layoverAmount = formData.layoverAmount || 0;
    const lumperAmount = formData.lumperAmount || 0;
    const fscAmount = formData.fscAmount || 0;
    const tonuAmount = formData.tonuFee || 0;
    const otherAmount = formData.otherAccessorials || 0;
    const totalAccessorials = detentionAmount + layoverAmount + lumperAmount + fscAmount + tonuAmount + otherAmount;
    const grandTotal = formData.rate + totalAccessorials;
    setFormData(prev => ({ ...prev, totalAccessorials, grandTotal }));
  }, [formData.rate, formData.detentionAmount, formData.layoverAmount, formData.lumperAmount, formData.fscAmount, formData.tonuFee, formData.otherAccessorials]);

  // Auto-calculate driver pay (base + detention + layover)
  useEffect(() => {
    if (formData.driverId && formData.rate > 0) {
      const driver = drivers.find(d => d.id === formData.driverId);
      if (driver) {
        let driverBasePay = 0;
        if (driver.payment?.type === 'percentage') {
          const payPercentage = validatePayPercentage(driver.payPercentage || driver.rateOrSplit || 0, driver.type);
          driverBasePay = formData.rate * payPercentage; // Base pay from base rate (not grand total)
        } else if (driver.payment?.type === 'per_mile') {
          driverBasePay = (formData.miles || 0) * (driver.payment.perMileRate || 0);
        }

        // Detention is 100% pass-through to driver
        const driverDetentionPay = formData.detentionAmount || 0;

        // Layover is also pass-through to driver
        const driverLayoverPay = formData.layoverAmount || 0;

        // Total gross = base + detention + layover
        const driverTotalGross = driverBasePay + driverDetentionPay + driverLayoverPay;

        setFormData(prev => ({
          ...prev,
          driverBasePay,
          driverDetentionPay,
          driverLayoverPay,
          driverTotalGross
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        driverBasePay: 0,
        driverDetentionPay: 0,
        driverLayoverPay: 0,
        driverTotalGross: 0
      }));
    }
  }, [formData.driverId, formData.rate, formData.miles, formData.detentionAmount, formData.layoverAmount, drivers]);

  // Auto-calculate dispatcher commission
  // Commission Calculation Logic:
  // - percentage: commissionAmount = totalRate * (commissionRate / 100)
  // - flat_fee: commissionAmount = commissionRate
  // - per_mile: commissionAmount = totalMiles * commissionRate
  useEffect(() => {
    if (formData.dispatcherCommissionType && formData.dispatcherCommissionRate > 0) {
      let commissionAmount = 0;

      if (formData.dispatcherCommissionType === 'percentage') {
        // Percentage: commissionAmount = totalRate * (commissionRate / 100)
        commissionAmount = formData.rate * (formData.dispatcherCommissionRate / 100);
      } else if (formData.dispatcherCommissionType === 'flat_fee') {
        // Flat fee: commissionAmount = commissionRate
        commissionAmount = formData.dispatcherCommissionRate;
      } else if (formData.dispatcherCommissionType === 'per_mile') {
        // Per mile: commissionAmount = totalMiles * commissionRate
        commissionAmount = formData.miles * formData.dispatcherCommissionRate;
      }

      setFormData(prev => ({ ...prev, dispatcherCommissionAmount: commissionAmount }));
    } else {
      setFormData(prev => ({ ...prev, dispatcherCommissionAmount: 0 }));
    }
  }, [formData.dispatcherCommissionType, formData.dispatcherCommissionRate, formData.rate, formData.miles]);

  // Auto-calculate Driver 2 earnings (if team load)
  useEffect(() => {
    if (formData.isTeamLoad && formData.driver2Id && formData.rate > 0) {
      const driver2 = drivers.find(d => d.id === formData.driver2Id);
      if (driver2) {
        let driver2Earnings = 0;

        if (formData.driver2PayType === 'percentage') {
          // Use the pay rate from form or driver's default
          const payRate = formData.driver2PayRate || driver2.payPercentage || driver2.rateOrSplit || 0;
          driver2Earnings = formData.rate * (payRate / 100);
        } else if (formData.driver2PayType === 'per_mile') {
          const perMileRate = formData.driver2PayRate || driver2.payment?.perMileRate || 0;
          driver2Earnings = (formData.miles || 0) * perMileRate;
        } else if (formData.driver2PayType === 'flat_rate') {
          driver2Earnings = formData.driver2PayRate || 0;
        }

        setFormData(prev => ({ ...prev, driver2Earnings }));
      }
    } else {
      setFormData(prev => ({ ...prev, driver2Earnings: 0 }));
    }
  }, [formData.isTeamLoad, formData.driver2Id, formData.driver2PayType, formData.driver2PayRate, formData.rate, formData.miles, drivers]);

  // Auto-calculate Total Driver Pay (Driver 1 + Driver 2)
  useEffect(() => {
    const driver1Pay = formData.driverTotalGross || 0;
    const driver2Pay = formData.isTeamLoad ? (formData.driver2Earnings || 0) : 0;
    const totalDriverPay = driver1Pay + driver2Pay;

    setFormData(prev => ({ ...prev, totalDriverPay }));
  }, [formData.driverTotalGross, formData.isTeamLoad, formData.driver2Earnings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // For delivered loads, check if material fields are being changed (require reason)
    if (editingLoad && isDeliveredLoad) {
      // Build updates object comparing all fields
      const updates: Partial<Load> = {};

      // Compare each field with the original load
      if (formData.rate !== editingLoad.rate) updates.rate = formData.rate;
      if (formData.miles !== editingLoad.miles) updates.miles = formData.miles;
      if (formData.originCity !== editingLoad.originCity) updates.originCity = formData.originCity;
      if (formData.originState !== editingLoad.originState) updates.originState = formData.originState;
      if (formData.destCity !== editingLoad.destCity) updates.destCity = formData.destCity;
      if (formData.destState !== editingLoad.destState) updates.destState = formData.destState;
      if (formData.pickupDate !== editingLoad.pickupDate) updates.pickupDate = formData.pickupDate;
      if (formData.deliveryDate !== editingLoad.deliveryDate) updates.deliveryDate = formData.deliveryDate;
      if (formData.driverId !== editingLoad.driverId) updates.driverId = formData.driverId;
      if (formData.driverName !== editingLoad.driverName) updates.driverName = formData.driverName;
      if (formData.brokerName !== editingLoad.brokerName) updates.brokerName = formData.brokerName;
      if (formData.brokerId !== editingLoad.brokerId) updates.brokerId = formData.brokerId;
      if (formData.grandTotal !== editingLoad.grandTotal) updates.grandTotal = formData.grandTotal;
      if (formData.customerName !== editingLoad.customerName) updates.customerName = formData.customerName;
      if (formData.dispatcherId !== editingLoad.dispatcherId) updates.dispatcherId = formData.dispatcherId;
      if (formData.truckId !== editingLoad.truckId) updates.truckId = formData.truckId;
      if (formData.trailerId !== editingLoad.trailerId) updates.trailerId = formData.trailerId;

      // Validate - checks if any changes require a reason
      const validation = validatePostDeliveryUpdates(editingLoad, updates);

      // If changes require a reason, show the adjustment modal
      if (validation.requiresReason && validation.changedFields.length > 0) {
        setPendingChanges(updates);
        setShowAdjustmentModal(true);
        return;
      }
    }

    // Normal submit (new load or non-material changes to delivered load)
    onSubmit(formData);
    onClose();
  };

  // Handle adjustment confirmation
  const handleAdjustmentConfirm = () => {
    if (!adjustmentReason.trim()) {
      alert('Please provide a reason for this adjustment.');
      return;
    }

    // Submit with adjustment reason
    // The reason will be passed to the updateLoad function which logs it
    onSubmit({ ...formData, adjustmentReason: adjustmentReason.trim() } as any);
    setShowAdjustmentModal(false);
    setAdjustmentReason('');
    setPendingChanges(null);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'rate' || name === 'miles' ? parseFloat(value) : value
    }));
  };

  const handleDriverChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const driverId = e.target.value;
    const driver = drivers.find(d => d.id === driverId);

    if (driver) {
      // Auto-fill Truck from driver's assigned truck
      const driverTruckId = driver.truckId || driver.currentTruckId || '';
      const driverTruck = driverTruckId ? trucks.find(t => t.id === driverTruckId) : null;

      setFormData(prev => ({
        ...prev,
        driverId: driver.id,
        driverName: `${driver.firstName} ${driver.lastName}`,
        truckId: driverTruckId || undefined,
        truckNumber: driverTruck?.number || undefined
      }));
      setSelectedTruckId(driverTruckId);
    } else {
      setFormData(prev => ({
        ...prev,
        driverId: '',
        driverName: '',
        truckId: undefined,
        truckNumber: undefined
      }));
      setSelectedTruckId('');
    }
  };

  const handleCalculateMiles = async () => {
    // Validate inputs
    if (!formData.originCity || !formData.originState || !formData.destCity || !formData.destState) {
      alert("Please fill in both origin and destination city and state before calculating miles.");
      return;
    }

    setIsCalculatingMiles(true);

    try {
      const dist = await calculateDistance(
        formData.originCity,
        formData.originState,
        formData.destCity,
        formData.destState
      );

      if (dist > 0) {
        setFormData(prev => ({ ...prev, miles: dist }));
        // Show success feedback
        const milesInput = document.querySelector('input[name="miles"]') as HTMLInputElement;
        if (milesInput) {
          milesInput.style.borderColor = '#10b981';
          setTimeout(() => {
            milesInput.style.borderColor = '';
          }, 2000);
        }
      } else {
        alert("Could not calculate distance automatically. Please enter miles manually.");
      }
    } catch (error) {
      console.error('Error calculating miles:', error);
      alert("An error occurred while calculating distance. Please enter miles manually.");
    } finally {
      setIsCalculatingMiles(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity p-4 md:p-0"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-xl md:rounded-xl shadow-xl w-full max-w-2xl mx-4 md:mx-4 overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] md:max-h-[90vh] h-full md:h-auto"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">{editingLoad ? 'Edit Load' : 'Create New Load'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Delivered Load Info Banner */}
        {isDeliveredLoad && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-blue-800">This load is delivered.</span>
              <span className="text-blue-700"> All changes are allowed — you'll just need to provide a reason.</span>
            </div>
          </div>
        )}

        {/* Form Scrollable Area */}
        <div className="overflow-y-auto p-6">
          <form id="add-load-form" onSubmit={handleSubmit} className="space-y-6">

            {/* Section: Route */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                  <MapPin size={16} /> Route Details
                </h3>
                <button
                  type="button"
                  onClick={handleCalculateMiles}
                  disabled={isCalculatingMiles || !formData.originCity || !formData.originState || !formData.destCity || !formData.destState}
                  className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200 transition-colors flex items-center gap-1 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCalculatingMiles ? (
                    <>
                      <Clock size={12} className="animate-spin" /> Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator size={12} /> Calculate Miles
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Origin City</label>
                  <input required name="originCity" value={formData.originCity} onChange={handleChange} type="text" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="e.g. Columbus" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Origin State</label>
                  <input required name="originState" value={formData.originState} onChange={handleChange} type="text" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all uppercase" placeholder="OH" maxLength={2} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Destination City</label>
                  <input required name="destCity" value={formData.destCity} onChange={handleChange} type="text" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="e.g. Chicago" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Destination State</label>
                  <input required name="destState" value={formData.destState} onChange={handleChange} type="text" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all uppercase" placeholder="IL" maxLength={2} />
                </div>
              </div>

              {/* BOL/PO Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">BOL Number</label>
                  <input name="bolNumber" value={formData.bolNumber || ''} onChange={handleChange} type="text" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="BOL-12345" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">PO Number</label>
                  <input name="poNumber" value={formData.poNumber || ''} onChange={handleChange} type="text" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="PO-67890" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">POD Number</label>
                  <input name="podNumber" value={formData.podNumber || ''} onChange={handleChange} type="text" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="POD-11111" />
                </div>
              </div>

              {/* Trailer Tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Trailer</label>
                  <select
                    name="trailerId"
                    value={formData.trailerId || ''}
                    onChange={(e) => {
                      const trailerId = e.target.value;
                      const selectedTrailer = trailers.find(t => t.id === trailerId);
                      setFormData(prev => ({
                        ...prev,
                        trailerId: trailerId || undefined,
                        trailerNumber: selectedTrailer?.number || undefined
                      }));
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="">No Trailer (Bobtail)</option>
                    {trailers.filter(t => t.status === 'available' || t.status === 'in_use').map(trailer => (
                      <option key={trailer.id} value={trailer.id}>
                        {trailer.number} - {trailer.type.replace('_', ' ')} {trailer.assignedTruckId ? '(Assigned)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">Select from trailer pool or leave empty for bobtail</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Trailer Number (Auto-filled)</label>
                  <input
                    disabled
                    value={formData.trailerNumber || 'N/A'}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
                    placeholder="Auto-filled from selection"
                  />
                </div>
              </div>
            </div>

            {/* Section: Financials */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2">Financials</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Base Rate ($) *</label>
                  <input required name="rate" value={formData.rate || ''} onChange={handleChange} type="number" step="0.01" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="0.00" />
                  <p className="text-xs text-slate-500">What broker pays for the haul</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Total Miles *</label>
                  <input required name="miles" value={formData.miles || ''} onChange={handleChange} type="number" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Rate Per Mile</label>
                  <input disabled value={`$${rpm}`} className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed" />
                </div>
              </div>

              {/* Accessorials Section */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-semibold text-slate-700 mb-3">Accessorials</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hasDetention"
                        checked={formData.hasDetention || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, hasDetention: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="hasDetention" className="text-xs font-medium text-slate-600">Has Detention</label>
                    </div>
                    {formData.hasDetention && (
                      <div className="grid grid-cols-3 gap-2 ml-6">
                        <div>
                          <label className="text-xs text-slate-500">Location</label>
                          <select
                            name="detentionLocation"
                            value={formData.detentionLocation || ''}
                            onChange={handleChange}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Select...</option>
                            <option value="pickup">Pickup</option>
                            <option value="delivery">Delivery</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Hours</label>
                          <input
                            name="detentionHours"
                            type="number"
                            step="0.5"
                            value={formData.detentionHours || ''}
                            onChange={handleChange}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Rate/hr</label>
                          <input
                            name="detentionRate"
                            type="number"
                            step="0.01"
                            value={formData.detentionRate || ''}
                            onChange={handleChange}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="text-xs text-slate-500">Detention Amount</label>
                          <input
                            disabled
                            value={`$${(formData.detentionAmount || 0).toFixed(2)}`}
                            className="w-full px-2 py-1 text-xs bg-slate-100 border border-slate-200 rounded text-slate-500 cursor-not-allowed"
                          />
                          <p className="text-xs text-slate-400 mt-0.5">Auto: Hours × Rate</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Layover */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hasLayover"
                        checked={formData.hasLayover || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, hasLayover: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="hasLayover" className="text-xs font-medium text-slate-600">Has Layover</label>
                    </div>
                    {formData.hasLayover && (
                      <div className="grid grid-cols-2 gap-2 ml-6">
                        <div>
                          <label className="text-xs text-slate-500">Days</label>
                          <input
                            name="layoverDays"
                            type="number"
                            step="0.5"
                            value={formData.layoverDays || ''}
                            onChange={handleChange}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Rate/day</label>
                          <input
                            name="layoverRate"
                            type="number"
                            step="0.01"
                            value={formData.layoverRate || ''}
                            onChange={handleChange}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-slate-500">Layover Amount</label>
                          <input
                            disabled
                            value={`$${(formData.layoverAmount || 0).toFixed(2)}`}
                            className="w-full px-2 py-1 text-xs bg-slate-100 border border-slate-200 rounded text-slate-500 cursor-not-allowed"
                          />
                          <p className="text-xs text-slate-400 mt-0.5">Auto: Days × Rate</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Lumper */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hasLumper"
                        checked={formData.hasLumper || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, hasLumper: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="hasLumper" className="text-xs font-medium text-slate-600">Has Lumper</label>
                    </div>
                    {formData.hasLumper && (
                      <div className="ml-6">
                        <label className="text-xs text-slate-500">Lumper Fee ($)</label>
                        <input
                          name="lumperFee"
                          type="number"
                          step="0.01"
                          value={formData.lumperFee || ''}
                          onChange={handleChange}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                        <p className="text-xs text-slate-400 mt-0.5">Lumper fee amount</p>
                      </div>
                    )}
                  </div>
                  {/* Fuel Surcharge (FSC) */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hasFSC"
                        checked={formData.hasFSC || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, hasFSC: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="hasFSC" className="text-xs font-medium text-slate-600">Fuel Surcharge (FSC)</label>
                    </div>
                    {formData.hasFSC && (
                      <div className="space-y-2 ml-6">
                        <div>
                          <label className="text-xs text-slate-500">FSC Type</label>
                          <select
                            name="fscType"
                            value={formData.fscType || ''}
                            onChange={handleChange}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Select...</option>
                            <option value="percentage">Percentage</option>
                            <option value="per_mile">Per Mile</option>
                            <option value="flat">Flat Rate</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">FSC Rate</label>
                          <input
                            name="fscRate"
                            type="number"
                            step="0.01"
                            value={formData.fscRate || ''}
                            onChange={handleChange}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formData.fscType === 'percentage' ? '% of base rate' :
                              formData.fscType === 'per_mile' ? '$ per mile' :
                                formData.fscType === 'flat' ? 'Flat amount' : 'Select type'}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">FSC Amount</label>
                          <input
                            disabled
                            value={`$${(formData.fscAmount || 0).toFixed(2)}`}
                            className="w-full px-2 py-1 text-xs bg-slate-100 border border-slate-200 rounded text-slate-500 cursor-not-allowed"
                          />
                          <p className="text-xs text-slate-400 mt-0.5">Auto-calculated</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* TONU Fee */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hasTONU"
                        checked={formData.hasTONU || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, hasTONU: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="hasTONU" className="text-xs font-medium text-slate-600">TONU Fee (Turned Down, Not Used)</label>
                    </div>
                    {formData.hasTONU && (
                      <div className="ml-6">
                        <label className="text-xs text-slate-500">TONU Fee ($)</label>
                        <input
                          name="tonuFee"
                          type="number"
                          step="0.01"
                          value={formData.tonuFee || ''}
                          onChange={handleChange}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                        <p className="text-xs text-slate-400 mt-0.5">Fee charged when load is turned down</p>
                      </div>
                    )}
                  </div>
                  {/* Other Accessorials */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600">Other Accessorials ($)</label>
                    <input
                      name="otherAccessorials"
                      type="number"
                      step="0.01"
                      value={formData.otherAccessorials || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600">Other Accessorials ($)</label>
                    <input
                      name="otherAccessorials"
                      type="number"
                      step="0.01"
                      value={formData.otherAccessorials || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-xs font-medium text-slate-600">Grand Total ($)</label>
                    <input
                      disabled
                      value={`$${(formData.grandTotal || formData.rate || 0).toFixed(2)}`}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500">Base Rate + Accessorials (Total Invoice Amount)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Assignment & Status */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2">Assignment & Status</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Booked By (Dispatcher)</label>
                  <select
                    name="dispatcherId"
                    value={formData.dispatcherId || ''}
                    onChange={(e) => {
                      const dispatcher = dispatchers.find(d => d.id === e.target.value);
                      if (dispatcher) {
                        // Pre-fill commission type and rate from dispatcher's default settings
                        setFormData(prev => ({
                          ...prev,
                          dispatcherId: dispatcher.id,
                          dispatcherName: `${dispatcher.firstName} ${dispatcher.lastName}`,
                          dispatcherCommissionType: dispatcher.dispatcherCommissionType || undefined,
                          dispatcherCommissionRate: dispatcher.dispatcherCommissionRate || 0,
                          isExternalDispatch: false
                        }));
                      } else {
                        // Clear dispatcher fields when no dispatcher selected
                        setFormData(prev => ({
                          ...prev,
                          dispatcherId: '',
                          dispatcherName: '',
                          dispatcherCommissionType: undefined,
                          dispatcherCommissionRate: 0,
                          dispatcherCommissionAmount: 0
                        }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="">None (Self-Dispatched)</option>
                    {dispatchers.length === 0 ? (
                      <option value="" disabled>No dispatchers available. Add dispatchers in Settings.</option>
                    ) : (
                      dispatchers.map(dispatcher => (
                        <option key={dispatcher.id} value={dispatcher.id}>
                          {dispatcher.firstName} {dispatcher.lastName}
                          {dispatcher.email && ` (${dispatcher.email})`}
                        </option>
                      ))
                    )}
                  </select>
                  <p className="text-xs text-slate-500">Optional - Leave empty if self-dispatched</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Assign Driver</label>
                  <select name="driverId" value={formData.driverId} onChange={handleDriverChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                    <option value="">Select Driver...</option>
                    {drivers.length === 0 ? (
                      <option value="" disabled>No drivers available. Add drivers in Drivers page.</option>
                    ) : drivers.filter(d => d.status === 'active').length === 0 ? (
                      <option value="" disabled>No active drivers. All drivers are inactive or on leave.</option>
                    ) : (
                      drivers.filter(d => d.status === 'active').map(driver => (
                        <option key={driver.id} value={driver.id}>{driver.firstName} {driver.lastName}</option>
                      ))
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Assigned Truck</label>
                  <select
                    value={formData.truckId || ''}
                    onChange={(e) => {
                      const truckId = e.target.value;
                      const selectedTruck = trucks.find(t => t.id === truckId);
                      setFormData(prev => ({
                        ...prev,
                        truckId: truckId || undefined,
                        truckNumber: selectedTruck?.number || undefined
                      }));
                      setSelectedTruckId(truckId);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="">Select a truck...</option>
                    {trucks.length === 0 ? (
                      <option value="" disabled>No trucks available. Add trucks in Fleet page.</option>
                    ) : (() => {
                      const availableTrucks = trucks.filter(t => t.status === 'available' || t.status === 'in_transit');
                      if (availableTrucks.length === 0) {
                        // Show all trucks if none are available, with status indicator
                        return trucks.map(truck => (
                          <option key={truck.id} value={truck.id}>
                            {truck.number} - {truck.make} {truck.model} {truck.year} ({truck.status || 'unknown'})
                          </option>
                        ));
                      }
                      return availableTrucks.map(truck => (
                        <option key={truck.id} value={truck.id}>
                          {truck.number} - {truck.make} {truck.model} {truck.year} {truck.status === 'in_transit' ? '(In Transit)' : ''}
                        </option>
                      ));
                    })()}
                  </select>
                  <p className="text-xs text-slate-500">Select from available fleet trucks</p>
                </div>

                {/* Team Load Toggle */}
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isTeamLoad"
                      checked={formData.isTeamLoad || false}
                      onChange={(e) => {
                        const isTeam = e.target.checked;
                        setFormData(prev => ({
                          ...prev,
                          isTeamLoad: isTeam,
                          // Clear Driver 2 fields if unchecking team load
                          ...(isTeam ? {} : {
                            driver2Id: '',
                            driver2Name: '',
                            driver2PayType: undefined,
                            driver2PayRate: 0,
                            driver2Earnings: 0
                          })
                        }));
                      }}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="isTeamLoad" className="text-sm font-medium text-slate-700">
                      Is Team Load? (Two Drivers)
                    </label>
                  </div>
                  <p className="text-xs text-slate-500 pl-7">Enable for long-haul loads requiring two drivers</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">
                    Customer Name <span className="text-slate-400 font-normal">(Shipper/Consignee - Optional)</span>
                  </label>
                  <input name="customerName" value={formData.customerName || ''} onChange={handleChange} type="text" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="e.g. Midwest Distribution (Optional)" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Status</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                    {Object.values(LoadStatus).map(status => (
                      <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                {/* Driver 2 Section (Team Load) */}
                {formData.isTeamLoad && (
                  <>
                    <div className="space-y-2 sm:col-span-2">
                      <h4 className="text-xs font-semibold text-slate-700 border-t border-slate-200 pt-3 mt-2">Driver 2 (Team Driver)</h4>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-600">Driver 2</label>
                      <select
                        name="driver2Id"
                        value={formData.driver2Id || ''}
                        onChange={(e) => {
                          const driver2 = drivers.find(d => d.id === e.target.value);
                          if (driver2) {
                            setFormData(prev => ({
                              ...prev,
                              driver2Id: driver2.id,
                              driver2Name: `${driver2.firstName} ${driver2.lastName}`,
                              // Pre-fill pay type from driver's default
                              driver2PayType: driver2.payment?.type || undefined,
                              driver2PayRate: driver2.payment?.type === 'percentage'
                                ? (driver2.payPercentage || driver2.rateOrSplit || 0)
                                : driver2.payment?.perMileRate || 0
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              driver2Id: '',
                              driver2Name: '',
                              driver2PayType: undefined,
                              driver2PayRate: 0
                            }));
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      >
                        <option value="">Select Driver 2...</option>
                        {drivers.filter(d => d.status === 'active' && d.id !== formData.driverId).map(driver => (
                          <option key={driver.id} value={driver.id}>{driver.firstName} {driver.lastName}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-600">Driver 2 Pay Type</label>
                      <select
                        name="driver2PayType"
                        value={formData.driver2PayType || ''}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      >
                        <option value="">Select Type...</option>
                        <option value="percentage">Percentage (%)</option>
                        <option value="per_mile">Per Mile ($)</option>
                        <option value="flat_rate">Flat Rate ($)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-600">
                        Driver 2 Rate
                        {formData.driver2PayType === 'percentage' && ' (%)'}
                        {formData.driver2PayType === 'per_mile' && ' ($/mile)'}
                        {formData.driver2PayType === 'flat_rate' && ' ($)'}
                      </label>
                      <input
                        name="driver2PayRate"
                        value={formData.driver2PayRate || ''}
                        onChange={handleChange}
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-600">Driver 2 Earnings</label>
                      <input
                        disabled
                        value={`$${(formData.driver2Earnings || 0).toFixed(2)}`}
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed"
                      />
                      <p className="text-xs text-slate-400">Auto-calculated based on pay type and rate</p>
                    </div>
                  </>
                )}

                {/* Total Driver Pay Display */}
                {(formData.driverTotalGross > 0 || formData.driver2Earnings > 0) && (
                  <div className="space-y-2 sm:col-span-2 bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <label className="text-xs font-semibold text-slate-700">Total Driver Pay</label>
                    <div className="text-lg font-bold text-blue-700">
                      ${(formData.totalDriverPay || 0).toFixed(2)}
                    </div>
                    <p className="text-xs text-slate-600">
                      Driver 1: ${(formData.driverTotalGross || 0).toFixed(2)}
                      {formData.isTeamLoad && formData.driver2Earnings > 0 && (
                        <> + Driver 2: ${(formData.driver2Earnings || 0).toFixed(2)}</>
                      )}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Pickup Date</label>
                  <input required name="pickupDate" value={formData.pickupDate} onChange={handleChange} type="date" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Delivery Date</label>
                  <input required name="deliveryDate" value={formData.deliveryDate} onChange={handleChange} type="date" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                </div>
              </div>
            </div>

            {/* Section: Broker / Factoring */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2">Broker / Factoring</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Broker</label>
                  <BrokerAutocomplete
                    value={formData.brokerName || ''}
                    onChange={handleBrokerSelect}
                    brokers={brokers}
                    onAddBroker={handleAddNewBroker}
                    placeholder="Type to search brokers (e.g., TQL, JB Hunt, CHRW)..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Broker Reference #</label>
                  <input
                    name="brokerReference"
                    value={formData.brokerReference || ''}
                    onChange={handleChange}
                    type="text"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Broker's load number"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isFactored"
                    checked={formData.isFactored || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, isFactored: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isFactored" className="text-sm font-medium text-slate-700">
                    Is Factored?
                  </label>
                </div>

                {formData.isFactored && (
                  <div className="pl-7">
                    {factoringCompanies.length > 0 ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-900">
                              {formData.factoringCompanyName || factoringCompanies[0]?.name || 'Factoring Company'}
                            </p>
                            <p className="text-xs text-blue-700">
                              Fee: {formData.factoringFeePercent || factoringCompanies[0]?.feePercentage || 0}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-blue-600">Factoring Fee</p>
                            <p className="text-lg font-bold text-blue-900">
                              ${(formData.factoringFee || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-blue-600">
                          {formData.grandTotal > 0
                            ? `${formData.grandTotal.toFixed(2)} × ${(formData.factoringFeePercent || factoringCompanies[0]?.feePercentage || 0)}% = $${(formData.factoringFee || 0).toFixed(2)}`
                            : 'Fee will calculate when rate is entered'}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800">
                          No factoring company set up. Add one in Account Receivables → Factoring Companies.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Section: Dispatcher Commission */}
            {formData.dispatcherId && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2">Dispatcher Commission</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600">External Dispatch Service?</label>
                    <div className="flex items-center gap-3 pt-2">
                      <input
                        type="checkbox"
                        id="isExternalDispatch"
                        checked={formData.isExternalDispatch || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, isExternalDispatch: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="isExternalDispatch" className="text-sm text-slate-700">
                        Using outside dispatch company
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600">Commission Type</label>
                    <select
                      name="dispatcherCommissionType"
                      value={formData.dispatcherCommissionType || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="">Select Type...</option>
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat_fee">Flat Fee ($)</option>
                      <option value="per_mile">Per Mile ($)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600">
                      Commission Rate
                      {formData.dispatcherCommissionType === 'percentage' && ' (%)'}
                      {formData.dispatcherCommissionType === 'flat_fee' && ' ($)'}
                      {formData.dispatcherCommissionType === 'per_mile' && ' ($/mile)'}
                    </label>
                    <input
                      name="dispatcherCommissionRate"
                      value={formData.dispatcherCommissionRate || ''}
                      onChange={handleChange}
                      type="number"
                      step="0.01"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-xs font-medium text-slate-600">Commission Amount ($)</label>
                    <input
                      disabled
                      value={`$${(formData.dispatcherCommissionAmount || 0).toFixed(2)}`}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500">
                      {formData.dispatcherCommissionType === 'percentage' && 'Auto-calculated: Rate × Percentage'}
                      {formData.dispatcherCommissionType === 'flat_fee' && 'Auto-calculated: Flat Fee Amount'}
                      {formData.dispatcherCommissionType === 'per_mile' && 'Auto-calculated: Miles × Per Mile Rate'}
                      {!formData.dispatcherCommissionType && 'Select commission type to calculate'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Section: Documents (only show when editing existing load) */}
            {editingLoad && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                    <FileText size={16} /> Documents
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* POD Upload */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">
                      Proof of Delivery (POD) {editingLoad.status === LoadStatus.Delivered || editingLoad.status === LoadStatus.Completed ? <span className="text-red-600">* Required</span> : ''}
                    </label>
                    <DocumentUpload
                      entityType="load"
                      entityId={editingLoad.id}
                      documentType="POD"
                      existingDocuments={editingLoad.documents || []}
                      onUploadComplete={() => {
                        // Refresh load data
                        window.location.reload();
                      }}
                      maxFileSize={10}
                      acceptedFileTypes={['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']}
                    />
                  </div>

                  {/* BOL Upload */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">
                      Bill of Lading (BOL)
                    </label>
                    <DocumentUpload
                      entityType="load"
                      entityId={editingLoad.id}
                      documentType="BOL"
                      existingDocuments={editingLoad.documents || []}
                      onUploadComplete={() => {
                        window.location.reload();
                      }}
                      maxFileSize={10}
                      acceptedFileTypes={['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']}
                    />
                  </div>

                  {/* Rate Confirmation Upload */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">
                      Rate Confirmation
                    </label>
                    <DocumentUpload
                      entityType="load"
                      entityId={editingLoad.id}
                      documentType="RATE_CON"
                      existingDocuments={editingLoad.documents || []}
                      onUploadComplete={() => {
                        window.location.reload();
                      }}
                      maxFileSize={10}
                      acceptedFileTypes={['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']}
                    />
                  </div>
                </div>
              </div>
            )}

          </form>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button form="add-load-form" type="submit" className="btn-primary px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-colors">
            {editingLoad ? 'Save Load' : 'Create Load'}
          </button>
        </div>
      </div>

      {/* Adjustment Reason Modal */}
      {showAdjustmentModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-blue-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Reason Required</h3>
                  <p className="text-sm text-slate-600">This load is delivered — please provide a reason for the change</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-700 mb-2 font-medium">You're changing:</p>
                <ul className="text-sm text-slate-600 space-y-1">
                  {pendingChanges && Object.keys(pendingChanges).map(field => (
                    <li key={field} className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                      <span className="capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Why are you making this change? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="e.g., Rate correction per broker agreement, Correcting typo in address, Driver change requested by dispatch..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  rows={3}
                  autoFocus
                />
                <p className="mt-1 text-xs text-slate-500">
                  ✓ All changes are allowed — this is just for record-keeping.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAdjustmentModal(false);
                  setAdjustmentReason('');
                  setPendingChanges(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdjustmentConfirm}
                disabled={!adjustmentReason.trim()}
                className="btn-primary px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddLoadModal;

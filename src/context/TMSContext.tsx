import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import { Load, LoadStatus, NewLoadInput, KPIMetrics, Employee, NewEmployeeInput, Driver, NewDriverInput, Invoice, Settlement, Truck, NewTruckInput, Expense, NewExpenseInput, FactoringCompany, NewFactoringCompanyInput, Dispatcher, NewDispatcherInput, EmployeeType, Trailer, NewTrailerInput, Broker, NewBrokerInput, CustomerEntity, NewCustomerInput, StatusChangeInfo, PlannedLoad, NewPlannedLoadInput, Trip, NewTripInput, PlannedLoadStatus, TripStatus } from '../types';
import { recentLoads, generateMockKPIs, initialDrivers, initialInvoices, initialTrucks, initialTrailers, initialDispatchers } from '../services/mockData';
import { calculateCompanyRevenue } from '../services/utils';
// Tenant ID comes from TenantContext
import { autoSeedBrokers } from '../services/brokerSeed';
import { autoSeedCustomers } from '../services/customerSeed';
import { autoSeedFactoringCompanies } from '../services/factoringCompanySeed';
import { generateSearchKey, generatePrefixes } from '../services/brokerUtils';
import { generateUniqueInvoiceNumber } from '../services/invoiceService';
import { generateShortId, generateStopId } from '../utils/idGenerator';
import { triggerLoadCreated, triggerLoadStatusChanged, triggerLoadDelivered, triggerInvoiceCreated } from '../services/workflow/workflowEngine';
import { getTasks, createTaskIfNotExists, updateTask, deleteTask } from '../services/workflow/taskService';
import { Task } from '../types';
import { useAuth } from './AuthContext';
import { auditCreate, auditUpdate, auditDelete, auditStatusChange, auditAdjustment } from '../data/audit';
import { validatePostDeliveryUpdates, isLoadLocked } from '../services/loadLocking';
import { createAdjustment } from '../services/adjustmentService';
// Logging and error handling
import { logger } from '../services/logger';
import { errorHandler, ErrorSeverity } from '../services/errorHandler';
// Security - sanitization
import { sanitizeText } from '../security/sanitize';
// Firestore persistence
import {
  loadLoads, loadInvoices, loadSettlements, loadEmployees, loadTrucks, loadTrailers,
  loadExpenses, loadFactoringCompanies, loadBrokers, loadCustomers, loadPlannedLoads, loadTrips,
  saveLoad, saveInvoice, saveSettlement, saveEmployee, saveTruck, saveTrailer,
  saveExpense, saveFactoringCompany, saveBroker, saveCustomer, savePlannedLoad, saveTrip,
  deleteLoad as firestoreDeleteLoad, deleteInvoice as firestoreDeleteInvoice,
  deleteSettlement as firestoreDeleteSettlement, deleteEmployee as firestoreDeleteEmployee,
  deleteTruck as firestoreDeleteTruck, deleteTrailer as firestoreDeleteTrailer,
  deleteExpense as firestoreDeleteExpense, deleteFactoringCompany as firestoreDeleteFactoringCompany,
  deleteBroker as firestoreDeleteBroker, deleteCustomer as firestoreDeleteCustomer,
  deletePlannedLoad as firestoreDeletePlannedLoad, deleteTrip as firestoreDeleteTrip,
  batchSave, subscribeToCollection
} from '../services/firestoreService';

// LocalStorage keys (tenant-aware)
const getStorageKey = (tenantId: string | null, key: string): string => {
  const prefix = tenantId ? `tms_${tenantId}_` : 'tms_';
  return `${prefix}${key}`;
};

interface TMSContextType {
  loads: Load[];
  employees: Employee[]; // New: unified employees
  drivers: Driver[]; // Legacy: filtered employees where type is driver/owner_operator
  invoices: Invoice[];
  settlements: Settlement[];
  trucks: Truck[];
  trailers: Trailer[];
  expenses: Expense[];
  factoringCompanies: FactoringCompany[];
  brokers: Broker[];
  customers: CustomerEntity[]; // Unified customer database (brokers, shippers, consignees)
  dispatchers: Employee[]; // Computed: filtered employees where employeeType is dispatcher
  plannedLoads: PlannedLoad[]; // Planned loads before dispatch
  trips: Trip[]; // Dispatched trips
  tasks: Task[]; // Workflow tasks
  kpis: KPIMetrics;
  addLoad: (load: NewLoadInput) => void;
  updateLoad: (id: string, load: Partial<Load>, reason?: string) => void;
  updateLoadStatus: (id: string, newStatus: LoadStatus, statusChangeInfo: StatusChangeInfo) => Promise<void>;
  deleteLoad: (id: string, force?: boolean) => void;
  addEmployee: (employee: NewEmployeeInput) => void;
  updateEmployee: (id: string, employee: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  addDriver: (driver: NewDriverInput) => void; // Legacy: creates employee with type=driver
  updateDriver: (id: string, driver: Partial<Driver>) => void; // Legacy
  deleteDriver: (id: string) => void; // Legacy
  addTruck: (truck: NewTruckInput) => string; // Returns truck ID
  updateTruck: (id: string, truck: Partial<Truck>) => void;
  deleteTruck: (id: string) => void;
  addTrailer: (trailer: NewTrailerInput) => string; // Returns trailer ID
  updateTrailer: (id: string, trailer: Partial<Trailer>) => void;
  deleteTrailer: (id: string) => void;
  addInvoice: (invoice: Omit<Invoice, 'id'>) => void;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
  deleteInvoice: (id: string, force?: boolean) => void;
  addSettlement: (settlement: Omit<Settlement, 'id'>) => string;
  updateSettlement: (id: string, settlement: Partial<Settlement>) => void;
  deleteSettlement: (id: string, force?: boolean) => void;
  addExpense: (expense: NewExpenseInput) => void;
  updateExpense: (id: string, expense: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  addFactoringCompany: (company: NewFactoringCompanyInput) => void;
  updateFactoringCompany: (id: string, company: Partial<FactoringCompany>) => void;
  deleteFactoringCompany: (id: string) => void;
  addBroker: (broker: NewBrokerInput) => void;
  updateBroker: (id: string, broker: Partial<Broker>) => void;
  deleteBroker: (id: string) => void;
  addCustomer: (customer: NewCustomerInput) => void;
  updateCustomer: (id: string, customer: Partial<CustomerEntity>) => void;
  deleteCustomer: (id: string) => void;
  addDispatcher: (dispatcher: NewDispatcherInput) => void;
  updateDispatcher: (id: string, dispatcher: Partial<Dispatcher>) => void;
  deleteDispatcher: (id: string) => void;
  // Planned Load management
  addPlannedLoad: (plannedLoad: NewPlannedLoadInput) => string;
  updatePlannedLoad: (id: string, plannedLoad: Partial<PlannedLoad>) => void;
  deletePlannedLoad: (id: string) => void;
  // Trip management
  addTrip: (trip: NewTripInput) => string;
  updateTrip: (id: string, trip: Partial<Trip>) => void;
  deleteTrip: (id: string) => void;
  dispatchPlannedLoadsToTrip: (plannedLoadIds: string[], tripData: NewTripInput) => Promise<string>;
  linkLoadToTrip: (loadId: string, tripId: string | null) => void; // Link/unlink load to trip
  // Task management
  updateTaskStatus: (taskId: string, status: Task['status']) => void;
  completeTask: (taskId: string) => void;
  deleteTaskById: (taskId: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  // Cross-page navigation state for dispatching loads
  pendingDispatchLoadIds: string[];
  setPendingDispatchLoadIds: (loadIds: string[]) => void;
  clearPendingDispatchLoadIds: () => void;
}

const TMSContext = createContext<TMSContextType | undefined>(undefined);

interface TMSProviderProps {
  children: ReactNode;
  tenantId: string | null;
}

export const TMSProvider: React.FC<TMSProviderProps> = ({ children, tenantId }) => {
  // tenantId is passed from parent (avoids circular dependency with TenantContext)

  // Get current user from Firebase Auth for tracking changes
  // Hooks must be called unconditionally at the top level
  const { user: authUser } = useAuth();

  // Block data operations if no tenant selected
  if (!tenantId) {
    return (
      <TMSContext.Provider value={{
        loads: [],
        employees: [],
        drivers: [],
        invoices: [],
        settlements: [],
        trucks: [],
        trailers: [],
        expenses: [],
        factoringCompanies: [],
        brokers: [],
        customers: [],
        dispatchers: [],
        plannedLoads: [],
        trips: [],
        tasks: [],
        kpis: {
          revenue: 0,
          profit: 0,
          activeLoads: 0,
          activeDrivers: 0,
        },
        addLoad: () => { },
        updateLoad: () => { },
        updateLoadStatus: async () => { },
        deleteLoad: () => { },
        addEmployee: () => { },
        updateEmployee: () => { },
        deleteEmployee: () => { },
        addDriver: () => { },
        updateDriver: () => { },
        deleteDriver: () => { },
        addTruck: () => '',
        updateTruck: () => { },
        deleteTruck: () => { },
        addTrailer: () => '',
        updateTrailer: () => { },
        deleteTrailer: () => { },
        addInvoice: () => { },
        updateInvoice: () => { },
        deleteInvoice: () => { },
        addSettlement: () => '',
        updateSettlement: () => { },
        deleteSettlement: () => { },
        addExpense: () => { },
        updateExpense: () => { },
        deleteExpense: () => { },
        addFactoringCompany: () => { },
        updateFactoringCompany: () => { },
        deleteFactoringCompany: () => { },
        addBroker: () => { },
        updateBroker: () => { },
        deleteBroker: () => { },
        addCustomer: () => { },
        updateCustomer: () => { },
        deleteCustomer: () => { },
        addDispatcher: () => { },
        updateDispatcher: () => { },
        deleteDispatcher: () => { },
        addPlannedLoad: () => '',
        updatePlannedLoad: () => { },
        deletePlannedLoad: () => { },
        addTrip: () => '',
        updateTrip: () => { },
        deleteTrip: () => { },
        dispatchPlannedLoadsToTrip: async () => '',
        linkLoadToTrip: () => { },
        updateTaskStatus: () => { },
        completeTask: () => { },
        deleteTaskById: () => { },
        searchTerm: '',
        setSearchTerm: () => { },
        pendingDispatchLoadIds: [],
        setPendingDispatchLoadIds: () => { },
        clearPendingDispatchLoadIds: () => { },
      }}>
        {children}
      </TMSContext.Provider>
    );
  }

  // Initialize state with empty arrays (will be loaded from Firestore)
  const [loads, setLoads] = useState<Load[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [factoringCompanies, setFactoringCompanies] = useState<FactoringCompany[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [customers, setCustomers] = useState<CustomerEntity[]>([]);
  const [plannedLoads, setPlannedLoads] = useState<PlannedLoad[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [pendingDispatchLoadIds, setPendingDispatchLoadIds] = useState<string[]>([]);

  // Helper to clear pending dispatch load IDs
  const clearPendingDispatchLoadIds = useCallback(() => {
    setPendingDispatchLoadIds([]);
  }, []);

  // Load all data from Firestore when tenant changes
  useEffect(() => {
    if (!tenantId) return;

    let isMounted = true;

    const loadAllData = async () => {
      if (import.meta.env.DEV) {
        console.log(`[TMSContext] Loading data from Firestore for tenant: ${tenantId}`);
      }
      setIsDataLoaded(false);

      try {
        // Load all collections in parallel
        const [
          loadsData,
          employeesData,
          invoicesData,
          settlementsData,
          trucksData,
          trailersData,
          expensesData,
          fcData,
          brokersData,
          customersData,
          plannedLoadsData,
          tripsData
        ] = await Promise.all([
          loadLoads(tenantId),
          loadEmployees(tenantId),
          loadInvoices(tenantId),
          loadSettlements(tenantId),
          loadTrucks(tenantId),
          loadTrailers(tenantId),
          loadExpenses(tenantId),
          loadFactoringCompanies(tenantId),
          loadBrokers(tenantId),
          loadCustomers(tenantId),
          loadPlannedLoads(tenantId),
          loadTrips(tenantId)
        ]);

        if (!isMounted) return;

        // Set all state
        setLoads(loadsData);
        setEmployees(employeesData);
        setInvoices(invoicesData);
        setSettlements(settlementsData);
        setTrucks(trucksData);
        setTrailers(trailersData);
        setExpenses(expensesData);
        setFactoringCompanies(fcData);
        setBrokers(brokersData);
        setCustomers(customersData);
        setPlannedLoads(plannedLoadsData);
        setTrips(tripsData);

        // Auto-seed brokers if empty
        if (brokersData.length === 0) {
          try {
            const seededBrokers = autoSeedBrokers(tenantId);
            setBrokers(seededBrokers);
            // Save seeded brokers to Firestore
            await batchSave(tenantId, 'brokers', seededBrokers);
          } catch (error) {
            console.warn('Could not auto-seed brokers:', error);
          }
        }

        // Auto-seed factoring companies if empty
        if (fcData.length === 0) {
          try {
            const seededFC = autoSeedFactoringCompanies(tenantId);
            setFactoringCompanies(seededFC);
            // Save seeded factoring companies to Firestore
            await batchSave(tenantId, 'factoringCompanies', seededFC);
          } catch (error) {
            console.warn('Could not auto-seed factoring companies:', error);
          }
        }

        // Auto-seed customers (with broker data) if empty
        if (customersData.length === 0) {
          try {
            const seededCustomers = autoSeedCustomers(tenantId);
            setCustomers(seededCustomers);
            // Save seeded customers to Firestore
            await batchSave(tenantId, 'customers', seededCustomers);
            console.log(`✅ Auto-seeded ${seededCustomers.length} customers for tenant: ${tenantId}`);
          } catch (error) {
            console.warn('Could not auto-seed customers:', error);
          }
        }

        // Load tasks
        try {
          const tasksData = getTasks(tenantId);
          setTasks(tasksData);
        } catch (error) {
          console.warn('Error loading tasks:', error);
        }

        setIsDataLoaded(true);
        if (import.meta.env.DEV) {
          console.log(`[TMSContext] Data loaded successfully for tenant: ${tenantId}`);
        }

      } catch (error) {
        console.error('[TMSContext] Error loading data from Firestore:', error);
        setIsDataLoaded(true); // Set to true even on error to prevent infinite loading
      }
    };

    loadAllData();

    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  // Computed: Drivers (filtered employees)
  const drivers = useMemo(() => {
    return employees.filter(e => e.employeeType === 'driver' || e.employeeType === 'owner_operator') as Driver[];
  }, [employees]);

  // Computed: Dispatchers (filtered employees)
  const dispatchers = useMemo(() => {
    return employees.filter(e => e.employeeType === 'dispatcher');
  }, [employees]);

  // Note: Data is saved to Firestore immediately when changes are made (in each add/update function)
  // No need for auto-save hooks as we persist on each operation

  // Save tasks to localStorage (tasks service handles storage, but we keep state in sync)
  useEffect(() => {
    // Tasks are persisted by taskService, but we can refresh from storage if needed
    try {
      const storedTasks = getTasks(tenantId);
      if (JSON.stringify(storedTasks) !== JSON.stringify(tasks)) {
        // Only update if different to avoid loops
        setTasks(storedTasks);
      }
    } catch (error) {
      // Ignore errors
    }
  }, [tenantId]);


  // KPIs
  const kpis = useMemo(() => {
    const baseKPIs = generateMockKPIs();

    // Calculate real-time revenue based on driver type (Commission vs Full)
    let currentRevenue = 0;
    loads.forEach(load => {
      const driver = drivers.find(d => d.id === load.driverId);

      // Safely extract and convert rate to number
      let loadRate: number = 0;
      if (load.rate !== undefined && load.rate !== null) {
        loadRate = typeof load.rate === 'number' ? load.rate : parseFloat(String(load.rate)) || 0;
      } else if (load.grandTotal !== undefined && load.grandTotal !== null) {
        loadRate = typeof load.grandTotal === 'number' ? load.grandTotal : parseFloat(String(load.grandTotal)) || 0;
      }

      // Ensure loadRate is a valid number
      if (isNaN(loadRate) || loadRate < 0) {
        loadRate = 0;
      }

      const revenue = calculateCompanyRevenue(loadRate, driver);

      // Only add if revenue is a valid number
      if (typeof revenue === 'number' && !isNaN(revenue) && isFinite(revenue) && revenue >= 0) {
        currentRevenue += revenue;
      }
    });

    // Final safety check - ensure currentRevenue is always a valid number
    if (isNaN(currentRevenue) || !isFinite(currentRevenue) || currentRevenue < 0) {
      if (import.meta.env.DEV) {
        console.warn('[TMSContext] Invalid revenue calculated, resetting to 0. Loads:', loads.length, 'CurrentRevenue:', currentRevenue);
      }
      currentRevenue = 0;
    }

    const activeLoadCount = loads.filter(l =>
      [LoadStatus.Dispatched, LoadStatus.InTransit, LoadStatus.Available].includes(l.status)
    ).length;
    const activeDriverCount = drivers.filter(d => d.status === 'active').length;

    const completedLoadsCount = loads.filter(l =>
      [LoadStatus.Delivered, LoadStatus.Completed].includes(l.status)
    ).length;

    // Ensure all KPI values are valid numbers
    const finalRevenue = isNaN(currentRevenue) || !isFinite(currentRevenue) ? 0 : currentRevenue;
    const finalProfit = isNaN(finalRevenue * 0.15) || !isFinite(finalRevenue * 0.15) ? 0 : finalRevenue * 0.15;

    return {
      ...baseKPIs,
      revenue: finalRevenue,
      revenueChange: baseKPIs.revenueChange || 0, // Ensure revenueChange is always a number
      activeLoads: activeLoadCount,
      activeDrivers: activeDriverCount,
      completedLoads: completedLoadsCount,
      profit: finalProfit, // Mock 15% net margin for now
      profitChange: baseKPIs.profitChange || 0, // Ensure profitChange is always a number
      onTimeDelivery: 95 // Mock 95% on-time delivery
    };
  }, [loads, drivers]);

  // Helper function to sanitize user input for loads
  const sanitizeLoadInput = (input: Partial<Load>): Partial<Load> => {
    const sanitized = { ...input };
    // Sanitize text fields that might contain user input
    if (sanitized.customerName) sanitized.customerName = sanitizeText(sanitized.customerName);
    if (sanitized.brokerName) sanitized.brokerName = sanitizeText(sanitized.brokerName);
    if (sanitized.brokerReference) sanitized.brokerReference = sanitizeText(sanitized.brokerReference);
    if (sanitized.driverName) sanitized.driverName = sanitizeText(sanitized.driverName);
    if (sanitized.dispatcherName) sanitized.dispatcherName = sanitizeText(sanitized.dispatcherName);
    if (sanitized.originCity) sanitized.originCity = sanitizeText(sanitized.originCity);
    if (sanitized.destCity) sanitized.destCity = sanitizeText(sanitized.destCity);
    if (sanitized.notes) sanitized.notes = sanitizeText(sanitized.notes);
    return sanitized;
  };

  const addLoad = async (input: NewLoadInput) => {
    // Sanitize user input before saving
    const sanitizedInput = sanitizeLoadInput(input) as NewLoadInput;

    const newLoadId = generateShortId();
    const newLoad: Load = {
      ...sanitizedInput,
      id: newLoadId,
      // Preserve loadNumber if provided, otherwise generate one
      loadNumber: sanitizedInput.loadNumber || `LD-2025-${(loads.length + 301).toString()}`,
      createdAt: new Date().toISOString(),
      createdBy: authUser?.uid || 'system',
    };

    // Optimistic Update - add to state immediately
    setLoads(prev => [newLoad, ...prev]);

    try {
      // Save to Firestore
      await saveLoad(tenantId || 'default', newLoad);

      // Audit logging
      const actorUid = authUser?.uid || 'system';
      const actorRole = authUser?.role || 'viewer';
      await auditCreate(
        tenantId || 'default',
        actorUid,
        actorRole,
        'load',
        newLoadId,
        newLoad,
        `Created load ${newLoad.loadNumber}`
      );

      // Trigger workflow for load created
      const createdTasks = await triggerLoadCreated(tenantId || 'default', newLoad.id, {
        loadNumber: newLoad.loadNumber,
        driverId: newLoad.driverId,
        dispatcherId: newLoad.dispatcherId,
        status: newLoad.status,
        customerName: newLoad.customerName,
        brokerName: newLoad.brokerName,
        isFactored: newLoad.isFactored,
        createdBy: newLoad.createdBy,
      });
      if (createdTasks.length > 0) {
        setTasks(getTasks(tenantId)); // Refresh tasks
      }

      logger.info('[TMSContext] Load created successfully', {
        tenantId,
        loadId: newLoadId,
        loadNumber: newLoad.loadNumber,
      });

    } catch (error) {
      // Rollback optimistic update on error
      setLoads(prev => prev.filter(l => l.id !== newLoadId));

      errorHandler.handle(
        error,
        {
          operation: 'create load',
          tenantId: tenantId || 'default',
          userId: authUser?.uid,
          metadata: { loadNumber: newLoad.loadNumber },
        },
        { severity: ErrorSeverity.HIGH }
      );

      throw error; // Re-throw so caller knows it failed
    }

    // --- AUTOMATION LOGIC ---
    // If load is created as "Delivered" or "Completed", automatically generate Invoice and Settlement
    if (newLoad.status === LoadStatus.Delivered || newLoad.status === LoadStatus.Completed) {

      // 1. Auto-Generate Invoice
      const today = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // Net 30

      // Check if load is factored
      const isFactored = newLoad.isFactored || false;
      const factoringCompany = factoringCompanies.find(fc => fc.id === newLoad.factoringCompanyId);

      const newInvoice: Invoice = {
        id: `inv-${newLoadId}`,
        invoiceNumber: generateUniqueInvoiceNumber(tenantId, invoices),
        loadIds: [newLoad.id],
        customerName: newLoad.customerName,
        amount: newLoad.grandTotal || newLoad.rate, // Use grandTotal (includes accessorials) if available
        status: isFactored ? 'paid' : 'pending', // Mark as paid if factored
        date: today.toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        // Factoring fields
        isFactored: isFactored,
        factoringCompanyId: newLoad.factoringCompanyId,
        factoringCompanyName: factoringCompany?.name || newLoad.factoringCompanyName,
        factoredDate: newLoad.factoredDate,
        factoredAmount: newLoad.factoredAmount,
        factoringFee: newLoad.factoringFee,
        paidAt: isFactored ? (newLoad.factoredDate || today.toISOString().split('T')[0]) : undefined,
      };
      setInvoices(prev => [newInvoice, ...prev]);

      // 2. Auto-Generate Settlement (if Driver is assigned)
      if (newLoad.driverId) {
        const driver = drivers.find(d => d.id === newLoad.driverId);
        if (driver) {
          let grossPay = 0;

          if (driver.type === 'OwnerOperator') {
            // Split Logic: (Load Rate - Expenses) * Split%
            // Assuming 0 expenses for this auto-generated example
            grossPay = newLoad.rate * (driver.rateOrSplit / 100);
          } else {
            // Company Driver: Miles * Rate
            grossPay = newLoad.miles * driver.rateOrSplit;
          }

          const newSettlement: Settlement = {
            id: `st-${newLoadId}`,
            type: 'driver',
            driverId: driver.id,
            payeeName: `${driver.firstName} ${driver.lastName}`,
            loadId: newLoad.loadNumber,
            grossPay: grossPay,
            deductions: {}, // Can be edited later
            totalDeductions: 0,
            netPay: grossPay,
            status: 'draft',
            date: new Date().toISOString().split('T')[0]
          };
          setSettlements(prev => [newSettlement, ...prev]);
        }
      }
    }
  };

  const updateLoad = async (id: string, updates: Partial<Load>, reason?: string): Promise<void> => {
    const oldLoad = loads.find(l => l.id === id);
    if (!oldLoad) {
      return Promise.reject(new Error('Load not found'));
    }

    // Sanitize user input in updates before processing
    const sanitizedUpdates = sanitizeLoadInput(updates);

    // Get current user for audit logging
    const actorUid = authUser?.uid || 'system';
    const actorRole = authUser?.role || 'viewer';

    // For delivered loads, check if a reason is needed
    const hasAdjustmentReason = reason && reason.trim().length > 0;

    if (isLoadLocked(oldLoad)) {
      const validation = validatePostDeliveryUpdates(oldLoad, sanitizedUpdates);

      // If changes require a reason but none provided, reject
      if (validation.requiresReason && !hasAdjustmentReason) {
        const errorMessage = `Changes to delivered load require a reason. Changed fields: ${validation.changedFields.join(', ')}`;
        console.error('Load update requires reason:', errorMessage);
        return Promise.reject(new Error(errorMessage));
      }

      // Log the adjustment if reason provided (development only)
      if (hasAdjustmentReason && import.meta.env.DEV) {
        console.log(`[ADJUSTMENT] Load ${oldLoad.loadNumber} modified. Reason: ${reason}. Fields: ${validation.changedFields.join(', ')}`);
      }
    }

    // Track adjustments for delivered loads
    const isDelivered = oldLoad.status === LoadStatus.Delivered || oldLoad.status === LoadStatus.Completed;
    const adjustmentEntries: Array<{
      id: string;
      timestamp: string;
      changedBy: string;
      field: string;
      oldValue: any;
      newValue: any;
      reason?: string;
    }> = [];

    if (isDelivered) {
      const changedBy = authUser?.displayName || authUser?.email || 'system';
      const timestamp = new Date().toISOString();

      // Compare each field in updates
      Object.keys(sanitizedUpdates).forEach((key) => {
        const oldValue = (oldLoad as any)[key];
        const newValue = (sanitizedUpdates as any)[key];

        // Only log if value actually changed
        if (oldValue !== newValue && JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          adjustmentEntries.push({
            id: generateStopId(),
            timestamp,
            changedBy,
            field: key,
            oldValue,
            newValue,
            reason: reason || `Adjustment to delivered load`
          });
        }
      });
    }

    // Merge adjustment log entries
    const existingAdjustmentLog = oldLoad.adjustmentLog || [];
    const newAdjustmentLog = [...existingAdjustmentLog, ...adjustmentEntries];

    // Lock load if status changed to Delivered or Completed
    const shouldLock = (sanitizedUpdates.status === LoadStatus.Delivered || sanitizedUpdates.status === LoadStatus.Completed) &&
      !oldLoad.isLocked;

    const updatedLoad = {
      ...oldLoad,
      ...sanitizedUpdates,
      adjustmentLog: adjustmentEntries.length > 0 ? newAdjustmentLog : oldLoad.adjustmentLog,
      isLocked: shouldLock ? true : oldLoad.isLocked,
      lockedAt: shouldLock ? new Date().toISOString() : oldLoad.lockedAt,
      updatedAt: new Date().toISOString()
    };

    // Optimistic Update
    setLoads(prev => prev.map(load => load.id === id ? updatedLoad : load));

    try {
      // Save to Firestore
      await saveLoad(tenantId || 'default', updatedLoad);

      // Audit logging (non-blocking)
      try {
        if (sanitizedUpdates.status && sanitizedUpdates.status !== oldLoad.status) {
          await auditStatusChange(
            tenantId || 'default',
            actorUid,
            actorRole,
            'load',
            id,
            oldLoad.status,
            sanitizedUpdates.status as string,
            `Load ${oldLoad.loadNumber} status changed from ${oldLoad.status} to ${sanitizedUpdates.status}`
          );
        } else if (adjustmentEntries.length > 0) {
          await auditAdjustment(
            tenantId || 'default',
            actorUid,
            actorRole,
            'load',
            id,
            oldLoad,
            updatedLoad,
            reason || 'Adjustment to delivered load',
            `Adjusted load ${oldLoad.loadNumber}`
          );
        } else {
          await auditUpdate(
            tenantId || 'default',
            actorUid,
            actorRole,
            'load',
            id,
            oldLoad,
            updatedLoad,
            `Updated load ${oldLoad.loadNumber}`
          );
        }
      } catch (auditError) {
        logger.warn('[TMSContext] Failed to write audit log', { error: auditError, loadId: id });
      }

      // Trigger workflow for status changes (non-blocking)
      if (sanitizedUpdates.status && sanitizedUpdates.status !== oldLoad.status) {
        try {
          const createdTasks = await triggerLoadStatusChanged(
            tenantId || 'default',
            id,
            oldLoad.status,
            sanitizedUpdates.status as string,
            {
              loadNumber: updatedLoad.loadNumber,
              driverId: updatedLoad.driverId,
              dispatcherId: updatedLoad.dispatcherId,
              customerName: updatedLoad.customerName,
              brokerName: updatedLoad.brokerName,
              isFactored: updatedLoad.isFactored,
            }
          );

          if (sanitizedUpdates.status === LoadStatus.Delivered || sanitizedUpdates.status === LoadStatus.Completed) {
            const deliveredTasks = await triggerLoadDelivered(tenantId || 'default', id, {
              loadNumber: updatedLoad.loadNumber,
              driverId: updatedLoad.driverId,
              deliveryDate: updatedLoad.deliveryDate,
            });
            if (deliveredTasks.length > 0) {
              setTasks(getTasks(tenantId));
            }
          }

          if (createdTasks.length > 0) {
            setTasks(getTasks(tenantId));
          }
        } catch (workflowError) {
          logger.warn('[TMSContext] Error triggering workflow', { error: workflowError, loadId: id });
        }
      }

      // AUTO-SYNC: Update associated invoice when load rate/amount changes
      const rateChanged = sanitizedUpdates.rate !== undefined && sanitizedUpdates.rate !== oldLoad.rate;
      const grandTotalChanged = sanitizedUpdates.grandTotal !== undefined && sanitizedUpdates.grandTotal !== oldLoad.grandTotal;
      const brokerChanged = sanitizedUpdates.brokerName !== undefined && sanitizedUpdates.brokerName !== oldLoad.brokerName;

      if (rateChanged || grandTotalChanged || brokerChanged) {
        const linkedInvoice = invoices.find(inv =>
          inv.loadId === id || inv.loadIds?.includes(id) || updatedLoad.invoiceId === inv.id
        );

        if (linkedInvoice) {
          const linkedLoadIds = linkedInvoice.loadIds || (linkedInvoice.loadId ? [linkedInvoice.loadId] : []);
          let newAmount = 0;

          linkedLoadIds.forEach(loadId => {
            const linkedLoad = loadId === id
              ? updatedLoad
              : loads.find(l => l.id === loadId);
            if (linkedLoad) {
              newAmount += linkedLoad.grandTotal || linkedLoad.rate || 0;
            }
          });

          const invoiceUpdates: Partial<Invoice> = {
            amount: newAmount,
            updatedAt: new Date().toISOString(),
          };

          if (brokerChanged && sanitizedUpdates.brokerName) {
            invoiceUpdates.brokerName = sanitizedUpdates.brokerName;
            invoiceUpdates.customerName = sanitizedUpdates.brokerName;
          }

          setInvoices(prev => prev.map(inv =>
            inv.id === linkedInvoice.id
              ? { ...inv, ...invoiceUpdates }
              : inv
          ));

          logger.debug('[TMSContext] Invoice synced', {
            invoiceNumber: linkedInvoice.invoiceNumber,
            newAmount,
          });
        }
      }

      // AUTO-SYNC: Update associated PlannedLoad status when Load status changes (TruckingOffice workflow)
      if (sanitizedUpdates.status && sanitizedUpdates.status !== oldLoad.status) {
        // Find PlannedLoad linked to this Load (via tripId or loadNumber match)
        const linkedPlannedLoad = plannedLoads.find(pl =>
          pl.tripId === updatedLoad.tripId ||
          pl.customLoadNumber === updatedLoad.loadNumber ||
          pl.systemLoadNumber === updatedLoad.loadNumber
        );

        if (linkedPlannedLoad) {
          // Map LoadStatus to PlannedLoadStatus and currentStep
          const statusToPlannedStatus: Record<string, { status: PlannedLoadStatus; step: number }> = {
            [LoadStatus.Available]: { status: 'planned', step: 1 },
            [LoadStatus.Dispatched]: { status: 'dispatched', step: 2 },
            [LoadStatus.InTransit]: { status: 'in_transit', step: 3 },
            [LoadStatus.Delivered]: { status: 'delivered', step: 4 },
            [LoadStatus.DeliveredWithBOL]: { status: 'delivered_with_bol', step: 5 },
            [LoadStatus.Invoiced]: { status: 'invoiced', step: 6 },
            [LoadStatus.Paid]: { status: 'paid', step: 7 },
            [LoadStatus.Completed]: { status: 'delivered', step: 4 }, // Legacy mapping
          };

          const mapping = statusToPlannedStatus[sanitizedUpdates.status];
          if (mapping) {
            updatePlannedLoad(linkedPlannedLoad.id, {
              status: mapping.status,
              currentStep: mapping.step,
            });
            logger.debug('[TMSContext] PlannedLoad synced with Load status', {
              plannedLoadId: linkedPlannedLoad.id,
              newStatus: mapping.status,
              newStep: mapping.step,
            });
          }
        }
      }

      logger.info('[TMSContext] Load updated successfully', {
        tenantId,
        loadId: id,
        hasStatusChange: sanitizedUpdates.status && sanitizedUpdates.status !== oldLoad.status,
        hasAdjustments: adjustmentEntries.length > 0,
      });

    } catch (error) {
      // Rollback optimistic update
      setLoads(prev => prev.map(load => load.id === id ? oldLoad : load));

      errorHandler.handle(
        error,
        {
          operation: 'update load',
          tenantId: tenantId || 'default',
          userId: authUser?.uid,
          metadata: { loadId: id, loadNumber: oldLoad.loadNumber },
        },
        { severity: ErrorSeverity.HIGH }
      );

      throw error;
    }
  };

  /**
   * Update load status with required person name and role tracking.
   * This function should be used for all status changes to ensure proper audit trail.
   *
   * @param id - Load ID
   * @param newStatus - New status to set
   * @param statusChangeInfo - Required info: changedByName, changedByRole, optional note
   */
  const updateLoadStatus = async (
    id: string,
    newStatus: LoadStatus,
    statusChangeInfo: StatusChangeInfo
  ): Promise<void> => {
    const load = loads.find(l => l.id === id);
    if (!load) {
      return Promise.reject(new Error('Load not found'));
    }

    // Validate required fields
    if (!statusChangeInfo.changedByName || statusChangeInfo.changedByName.trim() === '') {
      return Promise.reject(new Error('Name of person making the change is required'));
    }

    if (!statusChangeInfo.changedByRole) {
      return Promise.reject(new Error('Role (admin/dispatcher/driver/viewer) is required'));
    }

    const now = new Date().toISOString();
    const actorUid = authUser?.uid || 'system';

    // Create new status history entry
    const newStatusEntry = {
      status: newStatus,
      timestamp: now,
      changedBy: statusChangeInfo.changedByName.trim(),
      changedByRole: statusChangeInfo.changedByRole,
      changedByUserId: actorUid,
      note: statusChangeInfo.note?.trim() || undefined,
    };

    // Build updated status history
    const existingHistory = load.statusHistory || [];
    const updatedStatusHistory = [...existingHistory, newStatusEntry];

    // Determine if load should be locked
    const shouldLock = (newStatus === LoadStatus.Delivered || newStatus === LoadStatus.Completed) && !load.isLocked;

    // Build the updates
    const updates: Partial<Load> = {
      status: newStatus,
      statusHistory: updatedStatusHistory,
      updatedAt: now,
      changedBy: statusChangeInfo.changedByName.trim(),
    };

    // Add lock info if needed
    if (shouldLock) {
      updates.isLocked = true;
      updates.lockedAt = now;
    }

    // Log the status change
    logger.info('[TMSContext] Load status changed', {
      loadId: id,
      loadNumber: load.loadNumber,
      oldStatus: load.status,
      newStatus,
      changedBy: statusChangeInfo.changedByName,
      changedByRole: statusChangeInfo.changedByRole,
      changedByUserId: actorUid,
      note: statusChangeInfo.note,
      timestamp: now,
    });

    // Optimistic update
    const updatedLoad = { ...load, ...updates };
    setLoads(prev => prev.map(l => l.id === id ? updatedLoad : l));

    try {
      // Save to Firestore
      await saveLoad(tenantId || 'default', updatedLoad);

      // Audit logging
      try {
        await auditStatusChange(
          tenantId || 'default',
          actorUid,
          statusChangeInfo.changedByRole,
          'load',
          id,
          load.status,
          newStatus,
          `Load ${load.loadNumber} status changed from ${load.status} to ${newStatus} by ${statusChangeInfo.changedByName} (${statusChangeInfo.changedByRole})${statusChangeInfo.note ? ` - Note: ${statusChangeInfo.note}` : ''}`
        );
      } catch (auditError) {
        logger.warn('[TMSContext] Failed to write status change audit log', { error: auditError, loadId: id });
      }

      // Trigger workflow for status changes
      try {
        const createdTasks = await triggerLoadStatusChanged(
          tenantId || 'default',
          id,
          load.status,
          newStatus,
          {
            loadNumber: updatedLoad.loadNumber,
            driverId: updatedLoad.driverId,
            dispatcherId: updatedLoad.dispatcherId,
            customerName: updatedLoad.customerName,
            brokerName: updatedLoad.brokerName,
            isFactored: updatedLoad.isFactored,
          }
        );

        if (newStatus === LoadStatus.Delivered || newStatus === LoadStatus.Completed) {
          const deliveredTasks = await triggerLoadDelivered(tenantId || 'default', id, {
            loadNumber: updatedLoad.loadNumber,
            driverId: updatedLoad.driverId,
            deliveryDate: updatedLoad.deliveryDate,
          });
          if (deliveredTasks.length > 0) {
            setTasks(getTasks(tenantId));
          }
        }

        if (createdTasks.length > 0) {
          setTasks(getTasks(tenantId));
        }
      } catch (workflowError) {
        logger.warn('[TMSContext] Error triggering workflow for status change', { error: workflowError, loadId: id });
      }

      console.log(`✅ Load ${load.loadNumber} status changed to ${newStatus} by ${statusChangeInfo.changedByName} (${statusChangeInfo.changedByRole}) at ${now}`);

    } catch (error) {
      // Rollback optimistic update
      setLoads(prev => prev.map(l => l.id === id ? load : l));

      errorHandler.handle(
        error,
        {
          operation: 'update load status',
          tenantId: tenantId || 'default',
          userId: authUser?.uid,
          metadata: {
            loadId: id,
            loadNumber: load.loadNumber,
            oldStatus: load.status,
            newStatus,
            changedBy: statusChangeInfo.changedByName,
            changedByRole: statusChangeInfo.changedByRole,
          },
        },
        { severity: ErrorSeverity.HIGH }
      );

      throw error;
    }
  };

  const deleteLoad = async (id: string, force: boolean = false) => {
    const load = loads.find(l => l.id === id);
    if (!load) return;

    // Check for linked entities
    const linkedInvoices = invoices.filter(inv =>
      inv.loadId === id || inv.loadIds?.includes(id)
    );
    const linkedSettlements = settlements.filter(sett =>
      sett.loadId === id || sett.loadIds?.includes(id)
    );

    // If linked entities exist, ask for confirmation
    if (!force && (linkedInvoices.length > 0 || linkedSettlements.length > 0)) {
      const invoiceList = linkedInvoices.map(inv => inv.invoiceNumber).join(', ');
      const settlementList = linkedSettlements.map(sett => sett.settlementNumber || sett.id).join(', ');

      const message =
        `Load ${load.loadNumber} is linked to:\n` +
        (linkedInvoices.length > 0 ? `- Invoices: ${invoiceList}\n` : '') +
        (linkedSettlements.length > 0 ? `- Settlements: ${settlementList}\n` : '') +
        '\nDeleting this load will unlink it from these entities.\n\nAre you sure you want to delete this load?';

      if (!window.confirm(message)) {
        return; // User cancelled
      }
    }

    // Store original state for rollback
    const originalInvoices = [...invoices];
    const originalSettlements = [...settlements];

    // Optimistic update - unlink from invoices first
    setInvoices(prev => prev.map(inv => {
      if (inv.loadId === id) {
        const updated = { ...inv };
        delete updated.loadId;
        return updated;
      }
      if (inv.loadIds?.includes(id)) {
        return { ...inv, loadIds: inv.loadIds.filter(lid => lid !== id) };
      }
      return inv;
    }));

    // Optimistic update - unlink from settlements
    setSettlements(prev => prev.map(sett => {
      if (sett.loadId === id) {
        const updated = { ...sett };
        delete updated.loadId;
        return updated;
      }
      if (sett.loadIds?.includes(id)) {
        return { ...sett, loadIds: sett.loadIds.filter(lid => lid !== id) };
      }
      return sett;
    }));

    // Optimistic delete - remove the load
    setLoads(prev => prev.filter(l => l.id !== id));

    try {
      // Delete from Firestore
      await firestoreDeleteLoad(tenantId || 'default', id);

      logger.info('[TMSContext] Load deleted successfully', {
        tenantId,
        loadId: id,
        loadNumber: load.loadNumber,
      });

    } catch (error) {
      // Rollback all optimistic updates
      setLoads(prev => [...prev, load]);
      setInvoices(originalInvoices);
      setSettlements(originalSettlements);

      errorHandler.handle(
        error,
        {
          operation: 'delete load',
          tenantId: tenantId || 'default',
          userId: authUser?.uid,
          metadata: { loadId: id, loadNumber: load.loadNumber },
        },
        { severity: ErrorSeverity.HIGH }
      );

      throw error;
    }
  };

  // Employee functions
  const addEmployee = (input: NewEmployeeInput) => {
    const newEmployee: Employee = {
      ...input,
      id: generateShortId(),
      employeeNumber: input.employeeNumber || input.driverNumber || `EMP-${employees.length + 101}`,
      employeeType: input.employeeType || 'driver', // Default to driver if not specified
      // Set legacy type field based on employeeType
      type: input.type || (input.employeeType === 'owner' ? 'OwnerOperator' : 'Company'),
      driverNumber: input.driverNumber || input.employeeNumber, // Legacy compatibility
      createdAt: new Date().toISOString(),
    };
    setEmployees(prev => [...prev, newEmployee]);
    saveEmployee(tenantId || 'default', newEmployee).catch(e => console.error('Failed to save employee:', e));
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    const employee = employees.find(e => e.id === id);
    const updatedEmployee = employee ? {
      ...employee,
      ...updates,
      driverNumber: updates.employeeNumber || employee.employeeNumber || employee.driverNumber,
      employeeNumber: updates.employeeNumber || employee.employeeNumber || employee.driverNumber,
      type: updates.type || (updates.employeeType === 'owner' ? 'OwnerOperator' : 'Company') || employee.type,
      updatedAt: new Date().toISOString()
    } : null;

    setEmployees(prev => prev.map(emp => emp.id === id ? updatedEmployee! : emp));
    if (updatedEmployee) {
      saveEmployee(tenantId || 'default', updatedEmployee).catch(e => console.error('Failed to save employee:', e));
    }
  };

  const deleteEmployee = (id: string) => {
    const employee = employees.find(e => e.id === id);
    if (!employee) return;

    // Check for linked loads
    const linkedLoads = loads.filter(load => load.driverId === id);

    if (linkedLoads.length > 0) {
      const loadList = linkedLoads.map(l => l.loadNumber).slice(0, 5).join(', ');
      const more = linkedLoads.length > 5 ? ` and ${linkedLoads.length - 5} more` : '';
      const employeeName = `${employee.firstName} ${employee.lastName}`.trim() || 'This employee';
      const message =
        `${employeeName} is assigned to ${linkedLoads.length} load(s):\n` +
        `${loadList}${more}\n\n` +
        'Deleting this employee will unassign them from these loads.\n' +
        'Are you sure you want to delete?';

      if (!window.confirm(message)) {
        return;
      }

      // Unlink from loads
      setLoads(prev => prev.map(load =>
        load.driverId === id ? { ...load, driverId: undefined, driverName: undefined } : load
      ));
    }

    setEmployees(prev => prev.filter(employee => employee.id !== id));
    firestoreDeleteEmployee(tenantId || 'default', id).catch(e => console.error('Failed to delete employee:', e));
  };

  // Legacy driver functions (for backward compatibility)
  const addDriver = (input: NewDriverInput) => {
    addEmployee({
      ...input,
      employeeType: 'driver', // Drivers always have employeeType 'driver'
      employeeNumber: input.driverNumber,
    });
  };

  const updateDriver = (id: string, updates: Partial<Driver>) => {
    updateEmployee(id, {
      ...updates,
      employeeType: 'driver', // Drivers always have employeeType 'driver'
      employeeNumber: updates.driverNumber || updates.employeeNumber,
    });
  };

  const deleteDriver = (id: string) => {
    deleteEmployee(id);
  };

  const addTruck = (input: NewTruckInput): string => {
    const newTruck: Truck = {
      ...input,
      id: generateShortId(),
      createdAt: new Date().toISOString(),
    };
    setTrucks([...trucks, newTruck]);
    saveTruck(tenantId || 'default', newTruck).catch(e => console.error('Failed to save truck:', e));
    return newTruck.id; // Return the ID so it can be used immediately
  };

  const updateTruck = (id: string, updates: Partial<Truck>) => {
    const truck = trucks.find(t => t.id === id);
    const updatedTruck = truck ? { ...truck, ...updates, updatedAt: new Date().toISOString() } : null;

    setTrucks(prev => prev.map(t => t.id === id ? updatedTruck! : t));
    if (updatedTruck) {
      saveTruck(tenantId || 'default', updatedTruck).catch(e => console.error('Failed to save truck:', e));
    }
  };

  const deleteTruck = (id: string) => {
    const truck = trucks.find(t => t.id === id);
    if (!truck) return;

    // Check for linked loads
    const linkedLoads = loads.filter(load => load.truckId === id);
    // Check for linked drivers (drivers with this truck assigned via unitNumber)
    const linkedDrivers = employees.filter(e => e.unitNumber === truck.truckNumber);

    if (linkedLoads.length > 0 || linkedDrivers.length > 0) {
      const loadList = linkedLoads.map(l => l.loadNumber).slice(0, 3).join(', ');
      const driverList = linkedDrivers.map(d => `${d.firstName} ${d.lastName}`).slice(0, 3).join(', ');

      let message = `Truck ${truck.truckNumber} is linked to:\n`;
      if (linkedLoads.length > 0) {
        message += `- ${linkedLoads.length} load(s): ${loadList}${linkedLoads.length > 3 ? '...' : ''}\n`;
      }
      if (linkedDrivers.length > 0) {
        message += `- ${linkedDrivers.length} driver(s): ${driverList}${linkedDrivers.length > 3 ? '...' : ''}\n`;
      }
      message += '\nDeleting will unlink this truck. Continue?';

      if (!window.confirm(message)) {
        return;
      }

      // Unlink from loads
      setLoads(prev => prev.map(load =>
        load.truckId === id ? { ...load, truckId: undefined } : load
      ));
      // Note: Drivers are linked via unitNumber matching truckNumber, not assignedTruckId
    }

    setTrucks(prev => prev.filter(truck => truck.id !== id));
    firestoreDeleteTruck(tenantId || 'default', id).catch(e => console.error('Failed to delete truck:', e));
  };

  const addTrailer = (input: NewTrailerInput): string => {
    const newTrailer: Trailer = {
      ...input,
      id: generateShortId(),
      createdAt: new Date().toISOString(),
    };
    setTrailers([...trailers, newTrailer]);
    saveTrailer(tenantId || 'default', newTrailer).catch(e => console.error('Failed to save trailer:', e));
    return newTrailer.id;
  };

  const updateTrailer = (id: string, updates: Partial<Trailer>) => {
    const trailer = trailers.find(t => t.id === id);
    const updatedTrailer = trailer ? { ...trailer, ...updates, updatedAt: new Date().toISOString() } : null;

    setTrailers(prev => prev.map(t => t.id === id ? updatedTrailer! : t));
    if (updatedTrailer) {
      saveTrailer(tenantId || 'default', updatedTrailer).catch(e => console.error('Failed to save trailer:', e));
    }
  };

  const deleteTrailer = (id: string) => {
    const trailer = trailers.find(t => t.id === id);
    if (!trailer) return;

    // Check for linked loads
    const linkedLoads = loads.filter(load => load.trailerId === id);

    if (linkedLoads.length > 0) {
      const loadList = linkedLoads.map(l => l.loadNumber).slice(0, 5).join(', ');
      const message =
        `Trailer ${trailer.trailerNumber} is assigned to ${linkedLoads.length} load(s):\n` +
        `${loadList}${linkedLoads.length > 5 ? '...' : ''}\n\n` +
        'Deleting will unlink this trailer from these loads. Continue?';

      if (!window.confirm(message)) {
        return;
      }

      // Unlink from loads
      setLoads(prev => prev.map(load =>
        load.trailerId === id ? { ...load, trailerId: undefined } : load
      ));
    }

    setTrailers(prev => prev.filter(trailer => trailer.id !== id));
    firestoreDeleteTrailer(tenantId || 'default', id).catch(e => console.error('Failed to delete trailer:', e));
  };

  const addInvoice = async (input: Omit<Invoice, 'id'>) => {
    // DUPLICATE PREVENTION: Check if any of the loads already have an invoice
    const loadIdsToInvoice = input.loadIds || (input.loadId ? [input.loadId] : []);

    if (loadIdsToInvoice.length > 0) {
      // Check if any load is already invoiced
      const alreadyInvoicedLoadIds: string[] = [];

      loadIdsToInvoice.forEach(loadId => {
        // Check if load already has invoiceId
        const load = loads.find(l => l.id === loadId);
        if (load?.invoiceId) {
          alreadyInvoicedLoadIds.push(loadId);
        }

        // Check if any existing invoice references this load
        const existingInvoice = invoices.find(inv =>
          inv.loadIds?.includes(loadId) || inv.loadId === loadId
        );
        if (existingInvoice && !alreadyInvoicedLoadIds.includes(loadId)) {
          alreadyInvoicedLoadIds.push(loadId);
        }
      });

      if (alreadyInvoicedLoadIds.length > 0) {
        console.warn('[INVOICE] Duplicate prevention: Loads already have invoices:', alreadyInvoicedLoadIds);
        // Filter out already invoiced loads
        const filteredLoadIds = loadIdsToInvoice.filter(id => !alreadyInvoicedLoadIds.includes(id));
        if (filteredLoadIds.length === 0) {
          console.warn('[INVOICE] All loads already have invoices. Skipping invoice creation.');
          return; // Don't create duplicate invoice
        }
        // Update input to only include non-invoiced loads
        input = { ...input, loadIds: filteredLoadIds };
      }
    }

    const newInvoice: Invoice = {
      ...input,
      id: generateShortId(),
      invoiceNumber: input.invoiceNumber || generateUniqueInvoiceNumber(tenantId, invoices),
      createdAt: new Date().toISOString(),
    };
    setInvoices(prev => [newInvoice, ...prev]);
    saveInvoice(tenantId || 'default', newInvoice).catch(e => console.error('Failed to save invoice:', e));

    // Link invoice to loads and update Load status to 'invoiced' (TruckingOffice Step 6)
    const invoiceLoadIds = newInvoice.loadIds || (newInvoice.loadId ? [newInvoice.loadId] : []);
    if (invoiceLoadIds.length > 0) {
      const invoicedAt = new Date().toISOString();
      setLoads(prev => prev.map(load => {
        if (invoiceLoadIds.includes(load.id)) {
          return {
            ...load,
            invoiceId: newInvoice.id,
            invoiceNumber: newInvoice.invoiceNumber,
            invoicedAt: invoicedAt,
            status: LoadStatus.Invoiced, // TruckingOffice Step 6
          };
        }
        return load;
      }));

      // Also update associated PlannedLoads to 'invoiced' status (TruckingOffice workflow sync)
      invoiceLoadIds.forEach(loadId => {
        const load = loads.find(l => l.id === loadId);
        if (load) {
          const linkedPlannedLoad = plannedLoads.find(pl =>
            pl.tripId === load.tripId ||
            pl.customLoadNumber === load.loadNumber ||
            pl.systemLoadNumber === load.loadNumber
          );
          if (linkedPlannedLoad) {
            updatePlannedLoad(linkedPlannedLoad.id, {
              status: 'invoiced',
              currentStep: 6,
            });
          }
        }
      });
    }

    // Trigger workflow for invoice created
    try {
      const createdTasks = await triggerInvoiceCreated(tenantId || 'default', newInvoice.id, {
        invoiceNumber: newInvoice.invoiceNumber,
        customerName: newInvoice.customerName,
        amount: newInvoice.amount,
        status: newInvoice.status,
        dueDate: newInvoice.dueDate,
        loadIds: newInvoice.loadIds,
      });
      if (createdTasks.length > 0) {
        setTasks(getTasks(tenantId)); // Refresh tasks
      }
    } catch (error) {
      console.error('Error triggering workflow for invoice creation:', error);
    }
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    const invoice = invoices.find(inv => inv.id === id);
    if (!invoice) return;

    const updatedInvoice = { ...invoice, ...updates, updatedAt: new Date().toISOString() };

    setInvoices(prev => prev.map(inv => inv.id === id ? updatedInvoice : inv));
    saveInvoice(tenantId || 'default', updatedInvoice).catch(e => console.error('Failed to save invoice:', e));

    // TruckingOffice Step 7: When invoice marked as paid, update Load and PlannedLoad status
    if (updates.status === 'paid' && invoice.status !== 'paid') {
      const paidAt = new Date().toISOString();
      const invoiceLoadIds = invoice.loadIds || (invoice.loadId ? [invoice.loadId] : []);

      // Update Loads to 'paid' status
      if (invoiceLoadIds.length > 0) {
        setLoads(prev => prev.map(load => {
          if (invoiceLoadIds.includes(load.id)) {
            return { ...load, status: LoadStatus.Paid, paymentReceived: true, paymentReceivedDate: paidAt };
          }
          return load;
        }));

        // Also update PlannedLoads to 'paid' status (TruckingOffice Step 7)
        invoiceLoadIds.forEach(loadId => {
          const load = loads.find(l => l.id === loadId);
          if (load) {
            const linkedPlannedLoad = plannedLoads.find(pl =>
              pl.tripId === load.tripId ||
              pl.customLoadNumber === load.loadNumber ||
              pl.systemLoadNumber === load.loadNumber
            );
            if (linkedPlannedLoad) {
              updatePlannedLoad(linkedPlannedLoad.id, {
                status: 'paid',
                currentStep: 7,
              });
            }
          }
        });
      }
    }
  };

  const deleteInvoice = (id: string, force: boolean = false) => {
    const invoice = invoices.find(inv => inv.id === id);
    if (!invoice) return;

    // Check if invoice is paid - warn but allow with confirmation
    if (!force && invoice.status === 'paid') {
      const message =
        `Invoice ${invoice.invoiceNumber} is marked as PAID.\n\n` +
        'Deleting paid invoices may affect your accounting records.\n' +
        'Consider creating a credit memo instead.\n\n' +
        'Are you sure you want to delete this paid invoice?';

      if (!window.confirm(message)) {
        return; // User cancelled
      }
    }

    // Proceed with deletion and cleanup
    // Unlink invoice from loads
    setLoads(prev => prev.map(load => {
      if (load.invoiceId === id || invoice.loadIds?.includes(load.id)) {
        const updated = { ...load };
        if (load.invoiceId === id) {
          delete updated.invoiceId;
          updated.invoiceNumber = undefined;
          updated.invoicedAt = undefined;
        }
        return updated;
      }
      return load;
    }));
    setInvoices(prev => prev.filter(invoice => invoice.id !== id));
    firestoreDeleteInvoice(tenantId || 'default', id).catch(e => console.error('Failed to delete invoice:', e));
  };

  const addSettlement = (input: Omit<Settlement, 'id'>): string => {
    const newSettlement: Settlement = {
      ...input,
      id: generateShortId(),
      settlementNumber: input.settlementNumber || `ST-${new Date().getFullYear()}-${settlements.length + 1001}`,
      createdAt: input.createdAt || new Date().toISOString(),
    };
    setSettlements(prev => [newSettlement, ...prev]);
    saveSettlement(tenantId || 'default', newSettlement).catch(e => console.error('Failed to save settlement:', e));
    return newSettlement.id; // Return the ID so it can be used to mark loads
  };

  const updateSettlement = (id: string, updates: Partial<Settlement>) => {
    const settlement = settlements.find(s => s.id === id);
    const updatedSettlement = settlement ? { ...settlement, ...updates, updatedAt: new Date().toISOString() } : null;

    setSettlements(prev => prev.map(s => s.id === id ? updatedSettlement! : s));
    if (updatedSettlement) {
      saveSettlement(tenantId || 'default', updatedSettlement).catch(e => console.error('Failed to save settlement:', e));
    }
  };

  const deleteSettlement = (id: string, force: boolean = false) => {
    const settlement = settlements.find(s => s.id === id);
    if (!settlement) return;

    // Check if settlement is linked to loads that are invoiced
    const linkedLoadIds = [
      ...(settlement.loadId ? [settlement.loadId] : []),
      ...(settlement.loadIds || [])
    ];

    const linkedInvoicedLoads = loads.filter(load =>
      linkedLoadIds.includes(load.id) && load.invoiceId
    );

    // Warn if linked to invoiced loads, but allow with confirmation
    if (!force && linkedInvoicedLoads.length > 0) {
      const invoiceList = linkedInvoicedLoads
        .map(load => load.invoiceNumber)
        .filter(Boolean)
        .join(', ');

      const message =
        `Settlement ${settlement.settlementNumber || id} contains loads linked to invoices:\n` +
        `- Invoice Numbers: ${invoiceList}\n\n` +
        'Deleting this settlement will unlink it from these loads.\n' +
        'Are you sure you want to delete this settlement?';

      if (!window.confirm(message)) {
        return; // User cancelled
      }
    }

    // Proceed with deletion and cleanup
    setSettlements(prev => prev.filter(settlement => settlement.id !== id));
    firestoreDeleteSettlement(tenantId || 'default', id).catch(e => console.error('Failed to delete settlement:', e));
    // Clean up: Remove settlementId from all loads that were linked to this settlement
    setLoads(prev => prev.map(load => {
      if (load.settlementId === id) {
        return { ...load, settlementId: undefined };
      }
      return load;
    }));
  };

  const addExpense = (input: NewExpenseInput) => {
    const newExpense: Expense = {
      ...input,
      id: generateShortId(),
      category: input.category || input.type,
      createdAt: new Date().toISOString(),
    };
    setExpenses(prev => [newExpense, ...prev]);
    saveExpense(tenantId || 'default', newExpense).catch(e => console.error('Failed to save expense:', e));
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    const expense = expenses.find(e => e.id === id);
    const updatedExpense = expense ? { ...expense, ...updates, updatedAt: new Date().toISOString() } : null;

    setExpenses(prev => prev.map(e => e.id === id ? updatedExpense! : e));
    if (updatedExpense) {
      saveExpense(tenantId || 'default', updatedExpense).catch(e => console.error('Failed to save expense:', e));
    }
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(expense => expense.id !== id));
    firestoreDeleteExpense(tenantId || 'default', id).catch(e => console.error('Failed to delete expense:', e));
  };

  const addFactoringCompany = (input: NewFactoringCompanyInput) => {
    const aliases = (input as any).aliases || [];
    const searchKey = generateSearchKey(input.name, aliases);
    const prefixes = generatePrefixes(searchKey);

    const newCompany: FactoringCompany = {
      ...input,
      id: generateShortId(),
      searchKey,
      prefixes,
      aliases: aliases.length > 0 ? aliases : undefined,
      createdAt: new Date().toISOString(),
    };
    setFactoringCompanies(prev => [newCompany, ...prev]);
    saveFactoringCompany(tenantId || 'default', newCompany).catch(e => console.error('Failed to save factoring company:', e));
  };

  const updateFactoringCompany = (id: string, updates: Partial<FactoringCompany>) => {
    const company = factoringCompanies.find(c => c.id === id);
    const updatedCompany = company ? { ...company, ...updates, updatedAt: new Date().toISOString() } : null;

    setFactoringCompanies(prev => prev.map(c => c.id === id ? updatedCompany! : c));
    if (updatedCompany) {
      saveFactoringCompany(tenantId || 'default', updatedCompany).catch(e => console.error('Failed to save factoring company:', e));
    }
  };

  const deleteFactoringCompany = (id: string) => {
    const company = factoringCompanies.find(c => c.id === id);
    if (!company) return;

    // Check for linked loads
    const linkedLoads = loads.filter(load => load.factoringCompanyId === id);

    if (linkedLoads.length > 0) {
      const message =
        `${company.name} is used in ${linkedLoads.length} load(s).\n\n` +
        'Deleting will unlink this factoring company from these loads.\n' +
        'Continue?';

      if (!window.confirm(message)) {
        return;
      }

      // Unlink from loads
      setLoads(prev => prev.map(load =>
        load.factoringCompanyId === id
          ? { ...load, factoringCompanyId: undefined, factoringCompanyName: undefined }
          : load
      ));
    }

    setFactoringCompanies(prev => prev.filter(company => company.id !== id));
    firestoreDeleteFactoringCompany(tenantId || 'default', id).catch(e => console.error('Failed to delete factoring company:', e));
  };

  // Broker functions
  const addBroker = (input: NewBrokerInput) => {
    const searchKey = generateSearchKey(input.name, input.aliases || []);
    const prefixes = generatePrefixes(searchKey);

    const newBroker: Broker = {
      ...input,
      id: generateShortId(),
      searchKey,
      prefixes,
      createdAt: new Date().toISOString(),
    };
    setBrokers(prev => [newBroker, ...prev]);
    saveBroker(tenantId || 'default', newBroker).catch(e => console.error('Failed to save broker:', e));
  };

  const updateBroker = (id: string, updates: Partial<Broker>) => {
    let updatedBroker: Broker | null = null;

    setBrokers(prev => prev.map(broker => {
      if (broker.id === id) {
        const updated = { ...broker, ...updates, updatedAt: new Date().toISOString() };
        // Recalculate searchKey and prefixes if name or aliases changed
        if (updates.name || updates.aliases) {
          updated.searchKey = generateSearchKey(updated.name, updated.aliases || []);
          updated.prefixes = generatePrefixes(updated.searchKey);
        }
        updatedBroker = updated;
        return updated;
      }
      return broker;
    }));

    if (updatedBroker) {
      saveBroker(tenantId || 'default', updatedBroker).catch(e => console.error('Failed to save broker:', e));
    }
  };

  const deleteBroker = (id: string) => {
    const broker = brokers.find(b => b.id === id);
    if (!broker) return;

    // Check for linked loads
    const linkedLoads = loads.filter(load => load.brokerId === id);

    if (linkedLoads.length > 0) {
      const message =
        `${broker.name} is used in ${linkedLoads.length} load(s).\n\n` +
        'Deleting will unlink this broker from these loads.\n' +
        'Continue?';

      if (!window.confirm(message)) {
        return;
      }

      // Unlink from loads
      setLoads(prev => prev.map(load =>
        load.brokerId === id
          ? { ...load, brokerId: undefined, brokerName: undefined }
          : load
      ));
    }

    setBrokers(prev => prev.filter(broker => broker.id !== id));
    firestoreDeleteBroker(tenantId || 'default', id).catch(e => console.error('Failed to delete broker:', e));
  };

  // Customer functions (unified customer database)
  const addCustomer = (input: NewCustomerInput) => {
    const searchKey = generateSearchKey(input.name, input.aliases || []);
    const prefixes = generatePrefixes(searchKey);

    const newCustomer: CustomerEntity = {
      ...input,
      id: generateShortId(),
      searchKey,
      prefixes,
      isActive: input.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCustomers(prev => [newCustomer, ...prev]);
    saveCustomer(tenantId || 'default', newCustomer).catch(e => console.error('Failed to save customer:', e));
  };

  const updateCustomer = (id: string, updates: Partial<CustomerEntity>) => {
    let updatedCustomer: CustomerEntity | null = null;

    setCustomers(prev => prev.map(customer => {
      if (customer.id === id) {
        const updated = { ...customer, ...updates, updatedAt: new Date().toISOString() };
        // Recalculate searchKey and prefixes if name or aliases changed
        if (updates.name || updates.aliases) {
          updated.searchKey = generateSearchKey(updated.name, updated.aliases || []);
          updated.prefixes = generatePrefixes(updated.searchKey);
        }
        updatedCustomer = updated;
        return updated;
      }
      return customer;
    }));

    if (updatedCustomer) {
      saveCustomer(tenantId || 'default', updatedCustomer).catch(e => console.error('Failed to update customer:', e));
    }
  };

  const deleteCustomer = (id: string) => {
    const customer = customers.find(c => c.id === id);
    if (!customer) return;

    // Check for linked loads (if customerId is used)
    const linkedLoads = loads.filter(load => load.customerId === id);

    if (linkedLoads.length > 0) {
      const message =
        `${customer.name} is used in ${linkedLoads.length} load(s).\n\n` +
        'Deleting will unlink this customer from these loads.\n' +
        'Continue?';

      if (!window.confirm(message)) {
        return;
      }

      // Unlink customer from loads
      linkedLoads.forEach(load => {
        updateLoad(load.id, { customerId: undefined });
      });
    }

    setCustomers(prev => prev.filter(c => c.id !== id));
    firestoreDeleteCustomer(tenantId || 'default', id).catch(e => console.error('Failed to delete customer:', e));
  };

  // ============================================================================
  // Planned Load functions
  // ============================================================================

  const generatePlannedLoadNumber = (): string => {
    const prefix = 'PL';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  const addPlannedLoad = (input: NewPlannedLoadInput): string => {
    const now = new Date().toISOString();
    const id = generateShortId();
    const systemLoadNumber = input.systemLoadNumber || generatePlannedLoadNumber();

    const newPlannedLoad: PlannedLoad = {
      ...input,
      id,
      systemLoadNumber,
      status: 'planned',
      currentStep: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: authUser?.uid || 'system',
    };

    setPlannedLoads(prev => [newPlannedLoad, ...prev]);
    savePlannedLoad(tenantId || 'default', newPlannedLoad).catch(e => console.error('Failed to save planned load:', e));

    logger.info('[TMSContext] Planned load created', { id, systemLoadNumber });
    return id;
  };

  const updatePlannedLoad = (id: string, updates: Partial<PlannedLoad>) => {
    let updatedPlannedLoad: PlannedLoad | null = null;

    setPlannedLoads(prev => prev.map(pl => {
      if (pl.id === id) {
        const updated = { ...pl, ...updates, updatedAt: new Date().toISOString() };
        updatedPlannedLoad = updated;
        return updated;
      }
      return pl;
    }));

    if (updatedPlannedLoad) {
      savePlannedLoad(tenantId || 'default', updatedPlannedLoad).catch(e => console.error('Failed to update planned load:', e));
    }
  };

  const deletePlannedLoad = (id: string) => {
    const plannedLoad = plannedLoads.find(pl => pl.id === id);
    if (!plannedLoad) return;

    // Don't delete if already dispatched
    if (plannedLoad.status !== 'planned') {
      alert('Cannot delete a planned load that has already been dispatched.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete planned load ${plannedLoad.customLoadNumber || plannedLoad.systemLoadNumber}?`)) {
      return;
    }

    setPlannedLoads(prev => prev.filter(pl => pl.id !== id));
    firestoreDeletePlannedLoad(tenantId || 'default', id).catch(e => console.error('Failed to delete planned load:', e));
  };

  // ============================================================================
  // Trip functions
  // ============================================================================

  const generateTripNumber = (): string => {
    const prefix = 'T';
    const count = trips.length + 1;
    return `${prefix}${String(count).padStart(5, '0')}`;
  };

  const addTrip = (input: NewTripInput): string => {
    const now = new Date().toISOString();
    const id = generateShortId();
    const tripNumber = input.tripNumber || generateTripNumber();

    // Determine trip status based on dates
    const today = new Date().toISOString().split('T')[0];
    let status: TripStatus = 'future';
    if (input.pickupDate <= today && input.deliveryDate >= today) {
      status = 'in_progress';
    } else if (input.deliveryDate < today) {
      status = 'past';
    }

    const newTrip: Trip = {
      ...input,
      id,
      tripNumber,
      status,
      createdAt: now,
      updatedAt: now,
      createdBy: authUser?.uid || 'system',
    };

    setTrips(prev => [newTrip, ...prev]);
    saveTrip(tenantId || 'default', newTrip).catch(e => console.error('Failed to save trip:', e));

    logger.info('[TMSContext] Trip created', { id, tripNumber });
    return id;
  };

  const updateTrip = (id: string, updates: Partial<Trip>) => {
    let updatedTrip: Trip | null = null;

    setTrips(prev => prev.map(trip => {
      if (trip.id === id) {
        const updated = { ...trip, ...updates, updatedAt: new Date().toISOString() };
        updatedTrip = updated;
        return updated;
      }
      return trip;
    }));

    if (updatedTrip) {
      saveTrip(tenantId || 'default', updatedTrip).catch(e => console.error('Failed to update trip:', e));

      // Sync trip changes to associated loads
      // Find all loads that belong to this trip and update relevant fields
      const loadUpdates: Partial<Load> = {};
      const now = new Date().toISOString();

      // Sync driver assignment
      if (updates.driverId !== undefined) loadUpdates.driverId = updates.driverId;
      if (updates.driverName !== undefined) loadUpdates.driverName = updates.driverName;

      // Sync equipment
      if (updates.truckId !== undefined) loadUpdates.truckId = updates.truckId;
      if (updates.truckNumber !== undefined) loadUpdates.truckNumber = updates.truckNumber;
      if (updates.trailerId !== undefined) loadUpdates.trailerId = updates.trailerId;
      if (updates.trailerNumber !== undefined) loadUpdates.trailerNumber = updates.trailerNumber;

      // Sync trip number if changed
      if (updates.tripNumber !== undefined) loadUpdates.tripNumber = updates.tripNumber;

      // Sync dates
      if (updates.pickupDate !== undefined) loadUpdates.pickupDate = updates.pickupDate;
      if (updates.deliveryDate !== undefined) loadUpdates.deliveryDate = updates.deliveryDate;

      // Only update loads if there are relevant changes
      if (Object.keys(loadUpdates).length > 0) {
        loadUpdates.updatedAt = now;

        // Update all loads associated with this trip
        setLoads(prev => prev.map(load => {
          if (load.tripId === id) {
            const updatedLoad = { ...load, ...loadUpdates };
            // Persist the updated load
            saveLoad(tenantId || 'default', updatedLoad).catch(e =>
              console.error('Failed to sync load with trip update:', e)
            );
            return updatedLoad;
          }
          return load;
        }));

        logger.info('[TMSContext] Synced trip changes to associated loads', {
          tripId: id,
          tripNumber: updatedTrip.tripNumber,
          updatedFields: Object.keys(loadUpdates),
        });
      }
    }
  };

  const deleteTrip = (id: string) => {
    const trip = trips.find(t => t.id === id);
    if (!trip) return;

    // Check if trip has loads
    if (trip.plannedLoadIds.length > 0) {
      if (!window.confirm(`Trip ${trip.tripNumber} has ${trip.plannedLoadIds.length} load(s). Deleting will unlink these loads. Continue?`)) {
        return;
      }

      // Unlink loads from trip
      trip.plannedLoadIds.forEach(loadId => {
        updatePlannedLoad(loadId, {
          tripId: undefined,
          tripNumber: undefined,
          status: 'planned',
          currentStep: 1,
        });
      });
    }

    setTrips(prev => prev.filter(t => t.id !== id));
    firestoreDeleteTrip(tenantId || 'default', id).catch(e => console.error('Failed to delete trip:', e));
  };

  /**
   * Dispatch planned loads to a trip.
   * This is the key workflow function that moves loads from "planned" to "dispatched".
   *
   * Workflow: Load Planner → Trips → Loads → Dispatch Board
   *
   * When a trip is created from planned loads:
   * 1. Creates a Trip record
   * 2. Updates PlannedLoad status to 'dispatched'
   * 3. Creates Load entries for the Loads page and Dispatch Board
   */
  const dispatchPlannedLoadsToTrip = async (plannedLoadIds: string[], tripData: NewTripInput): Promise<string> => {
    // Validate all loads exist and are in "planned" status
    const loadsToDispatch = plannedLoadIds.map(id => plannedLoads.find(pl => pl.id === id)).filter(Boolean) as PlannedLoad[];

    if (loadsToDispatch.length !== plannedLoadIds.length) {
      throw new Error('One or more planned loads not found');
    }

    const nonPlannedLoads = loadsToDispatch.filter(pl => pl.status !== 'planned');
    if (nonPlannedLoads.length > 0) {
      throw new Error(`Cannot dispatch loads that are not in "planned" status: ${nonPlannedLoads.map(pl => pl.systemLoadNumber).join(', ')}`);
    }

    // Create the trip
    const tripId = addTrip({
      ...tripData,
      plannedLoadIds,
    });

    const tripNumber = trips.find(t => t.id === tripId)?.tripNumber || tripData.tripNumber || '';

    // Update each planned load and create Load entries
    const now = new Date().toISOString();
    for (const plannedLoad of loadsToDispatch) {
      // Update the PlannedLoad status
      updatePlannedLoad(plannedLoad.id, {
        status: 'dispatched',
        currentStep: 2,
        tripId,
        tripNumber,
        driverId: tripData.driverId,
        driverName: tripData.driverName,
        updatedAt: now,
      });

      // Create a Load entry for the Loads page and Dispatch Board
      // Extract first pickup and delivery info
      const firstPickup = plannedLoad.pickups?.[0];
      const lastDelivery = plannedLoad.deliveries?.[plannedLoad.deliveries?.length - 1 || 0];

      const newLoad: Load = {
        id: generateShortId(),
        loadNumber: plannedLoad.customLoadNumber || plannedLoad.systemLoadNumber,
        status: LoadStatus.Dispatched,

        // Customer/Broker info
        customerName: plannedLoad.customer?.name || '',
        customerId: plannedLoad.customerId,
        brokerName: plannedLoad.customer?.name || '',

        // Driver assignment
        driverId: tripData.driverId,
        driverName: tripData.driverName,

        // Equipment
        truckId: tripData.truckId,
        truckNumber: tripData.truckNumber,
        trailerId: tripData.trailerId,
        trailerNumber: tripData.trailerNumber,

        // Route - from first pickup to last delivery
        originCity: firstPickup?.shipper?.city || tripData.fromCity || '',
        originState: firstPickup?.shipper?.state || tripData.fromState || '',
        destCity: lastDelivery?.consignee?.city || tripData.toCity || '',
        destState: lastDelivery?.consignee?.state || tripData.toState || '',

        // Dates
        pickupDate: firstPickup?.pickupDate || tripData.pickupDate,
        deliveryDate: lastDelivery?.deliveryDate || tripData.deliveryDate,

        // Financial - Calculate complete grand total including all fees
        rate: plannedLoad.fees?.primaryFee || 0,
        miles: plannedLoad.totalMiles || tripData.totalMiles || 0,
        ratePerMile: plannedLoad.totalMiles && plannedLoad.fees?.primaryFee
          ? plannedLoad.fees.primaryFee / plannedLoad.totalMiles
          : 0,

        // FSC
        hasFSC: (plannedLoad.fees?.fscAmount || 0) > 0,
        fscAmount: plannedLoad.fees?.fscAmount || 0,

        // Accessorials
        hasDetention: (plannedLoad.fees?.accessoryFees?.detention || 0) > 0,
        detentionAmount: plannedLoad.fees?.accessoryFees?.detention || 0,
        hasLumper: (plannedLoad.fees?.accessoryFees?.lumper || 0) > 0,
        lumperAmount: plannedLoad.fees?.accessoryFees?.lumper || 0,
        totalAccessorials:
          (plannedLoad.fees?.accessoryFees?.detention || 0) +
          (plannedLoad.fees?.accessoryFees?.lumper || 0) +
          (plannedLoad.fees?.accessoryFees?.stopOff || 0) +
          (plannedLoad.fees?.accessoryFees?.tarpFee || 0),

        // Grand Total: Primary Fee + FSC + All Accessorials - Invoice Advance
        grandTotal: plannedLoad.totalCharge || (
          (plannedLoad.fees?.primaryFee || 0) +
          (plannedLoad.fees?.fscAmount || 0) +
          (plannedLoad.fees?.accessoryFees?.detention || 0) +
          (plannedLoad.fees?.accessoryFees?.lumper || 0) +
          (plannedLoad.fees?.accessoryFees?.stopOff || 0) +
          (plannedLoad.fees?.accessoryFees?.tarpFee || 0) -
          (plannedLoad.fees?.invoiceAdvance || 0)
        ),

        // Document numbers
        bolNumber: firstPickup?.bolNumber,

        // Trip Linking
        tripId,
        tripNumber,

        // Metadata
        createdAt: now,
        createdBy: authUser?.uid || 'system',

        // Status history
        statusHistory: [{
          status: LoadStatus.Dispatched,
          timestamp: now,
          changedBy: authUser?.displayName || authUser?.email || 'system',
          changedByRole: 'dispatcher',
          changedByUserId: authUser?.uid,
          note: `Dispatched from Trip ${tripNumber}`,
        }],

        // Notes
        notes: `Created from Planned Load ${plannedLoad.systemLoadNumber}. Trip: ${tripNumber}`,
      };

      // Add the load to state and persist
      setLoads(prev => [newLoad, ...prev]);
      saveLoad(tenantId || 'default', newLoad).catch(e =>
        console.error('Failed to save load from dispatch:', e)
      );

      logger.info('[TMSContext] Load created from planned load dispatch', {
        loadId: newLoad.id,
        loadNumber: newLoad.loadNumber,
        plannedLoadId: plannedLoad.id,
        tripId,
      });
    }

    logger.info('[TMSContext] Planned loads dispatched to trip', {
      tripId,
      tripNumber,
      loadCount: plannedLoadIds.length,
      loadIds: plannedLoadIds,
    });

    return tripId;
  };

  /**
   * Link or unlink a load to/from a trip.
   * When linking, copies trip data (driver, equipment, dates) to the load.
   * When unlinking (tripId = null), clears the trip reference from the load.
   */
  const linkLoadToTrip = (loadId: string, tripId: string | null) => {
    const load = loads.find(l => l.id === loadId);
    if (!load) {
      console.error('Load not found:', loadId);
      return;
    }

    const now = new Date().toISOString();
    let loadUpdates: Partial<Load> = { updatedAt: now };

    if (tripId === null) {
      // Unlink from trip
      loadUpdates.tripId = undefined;
      loadUpdates.tripNumber = undefined;
      logger.info('[TMSContext] Load unlinked from trip', { loadId, previousTripId: load.tripId });
    } else {
      // Link to trip
      const trip = trips.find(t => t.id === tripId);
      if (!trip) {
        console.error('Trip not found:', tripId);
        return;
      }

      // Copy all relevant trip data to the load
      loadUpdates = {
        ...loadUpdates,
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        driverId: trip.driverId,
        driverName: trip.driverName,
        truckId: trip.truckId,
        truckNumber: trip.truckNumber,
        trailerId: trip.trailerId,
        trailerNumber: trip.trailerNumber,
        pickupDate: trip.pickupDate,
        deliveryDate: trip.deliveryDate,
      };

      logger.info('[TMSContext] Load linked to trip', {
        loadId,
        loadNumber: load.loadNumber,
        tripId: trip.id,
        tripNumber: trip.tripNumber,
      });
    }

    // Update the load
    setLoads(prev => prev.map(l => {
      if (l.id === loadId) {
        const updatedLoad = { ...l, ...loadUpdates };
        saveLoad(tenantId || 'default', updatedLoad).catch(e =>
          console.error('Failed to save load after trip link:', e)
        );
        return updatedLoad;
      }
      return l;
    }));
  };

  // Legacy dispatcher functions (dispatchers are now employees)
  const addDispatcher = (input: NewDispatcherInput) => {
    // Convert dispatcher input to employee
    addEmployee({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || '',
      phone: input.phone || '',
      employeeType: 'dispatcher',
      status: input.status === 'active' ? 'active' : 'inactive',
      employeeNumber: input.employeeId || `DSP-${employees.filter(e => e.employeeType === 'dispatcher').length + 1}`,
      type: 'Company', // Default type for dispatchers
      rateOrSplit: 0, // Not applicable for dispatchers
    });
  };

  const updateDispatcher = (id: string, updates: Partial<Dispatcher>) => {
    // Update corresponding employee
    updateEmployee(id, {
      firstName: updates.firstName,
      lastName: updates.lastName,
      email: updates.email,
      phone: updates.phone,
      status: updates.status === 'active' ? 'active' : 'inactive',
    });
  };

  const deleteDispatcher = (id: string) => {
    deleteEmployee(id);
  };

  // Task management functions
  const updateTaskStatus = (taskId: string, status: Task['status']) => {
    const updated = updateTask(tenantId, taskId, { status });
    if (updated) {
      setTasks(getTasks(tenantId));
    }
  };

  const completeTaskById = (taskId: string) => {
    const updated = updateTask(tenantId, taskId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    if (updated) {
      setTasks(getTasks(tenantId));
    }
  };

  const deleteTaskById = (taskId: string) => {
    const deleted = deleteTask(tenantId, taskId);
    if (deleted) {
      setTasks(getTasks(tenantId));
    }
  };

  const filteredLoads = useMemo(() => {
    if (!searchTerm) return loads;
    const lowerTerm = searchTerm.toLowerCase();
    return loads.filter(load =>
      load.customerName.toLowerCase().includes(lowerTerm) ||
      load.loadNumber.toLowerCase().includes(lowerTerm) ||
      load.originCity.toLowerCase().includes(lowerTerm) ||
      load.destCity.toLowerCase().includes(lowerTerm)
    );
  }, [loads, searchTerm]);

  return (
    <TMSContext.Provider value={{
      loads: filteredLoads,
      employees,
      drivers, // Computed: filtered employees
      invoices,
      settlements,
      trucks,
      trailers,
      expenses,
      factoringCompanies,
      brokers,
      customers,
      dispatchers, // Computed: filtered employees
      plannedLoads,
      trips,
      tasks,
      kpis,
      addLoad,
      updateLoad,
      updateLoadStatus,
      deleteLoad,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      addDriver, // Legacy
      updateDriver, // Legacy
      deleteDriver, // Legacy
      addTruck,
      updateTruck,
      deleteTruck,
      addTrailer,
      updateTrailer,
      deleteTrailer,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      addSettlement,
      updateSettlement,
      deleteSettlement,
      addExpense,
      updateExpense,
      deleteExpense,
      addFactoringCompany,
      updateFactoringCompany,
      deleteFactoringCompany,
      addBroker,
      updateBroker,
      deleteBroker,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      addDispatcher, // Legacy
      updateDispatcher, // Legacy
      deleteDispatcher, // Legacy
      // Planned Load management
      addPlannedLoad,
      updatePlannedLoad,
      deletePlannedLoad,
      // Trip management
      addTrip,
      updateTrip,
      deleteTrip,
      dispatchPlannedLoadsToTrip,
      linkLoadToTrip,
      // Task management
      updateTaskStatus,
      completeTask: completeTaskById,
      deleteTaskById,
      searchTerm,
      setSearchTerm,
      // Cross-page navigation state
      pendingDispatchLoadIds,
      setPendingDispatchLoadIds,
      clearPendingDispatchLoadIds
    }}>
      {children}
    </TMSContext.Provider>
  );
};

export const useTMS = () => {
  const context = useContext(TMSContext);
  if (context === undefined) {
    // During HMR, context might be undefined temporarily
    // Return a safe fallback instead of throwing to prevent app crashes
    if (import.meta.env.DEV) {
      console.warn('useTMS called outside TMSProvider (likely during HMR)');
      // Return a minimal fallback object to prevent crashes during HMR
      return {
        loads: [],
        employees: [],
        drivers: [],
        invoices: [],
        settlements: [],
        trucks: [],
        trailers: [],
        expenses: [],
        factoringCompanies: [],
        brokers: [],
        customers: [],
        dispatchers: [],
        plannedLoads: [],
        trips: [],
        tasks: [],
        kpis: {
          revenue: 0,
          profit: 0,
          activeLoads: 0,
          activeDrivers: 0,
        },
        addLoad: () => { },
        updateLoad: () => { },
        updateLoadStatus: async () => { },
        deleteLoad: () => { },
        addEmployee: () => { },
        updateEmployee: () => { },
        deleteEmployee: () => { },
        addDriver: () => { },
        updateDriver: () => { },
        deleteDriver: () => { },
        addTruck: () => '',
        updateTruck: () => { },
        deleteTruck: () => { },
        addTrailer: () => '',
        updateTrailer: () => { },
        deleteTrailer: () => { },
        addInvoice: () => { },
        updateInvoice: () => { },
        deleteInvoice: () => { },
        addSettlement: () => '',
        updateSettlement: () => { },
        deleteSettlement: () => { },
        addExpense: () => { },
        updateExpense: () => { },
        deleteExpense: () => { },
        addFactoringCompany: () => { },
        updateFactoringCompany: () => { },
        deleteFactoringCompany: () => { },
        addBroker: () => { },
        updateBroker: () => { },
        deleteBroker: () => { },
        addCustomer: () => { },
        updateCustomer: () => { },
        deleteCustomer: () => { },
        addDispatcher: () => { },
        updateDispatcher: () => { },
        deleteDispatcher: () => { },
        // Planned Load management
        addPlannedLoad: () => '',
        updatePlannedLoad: () => { },
        deletePlannedLoad: () => { },
        // Trip management
        addTrip: () => '',
        updateTrip: () => { },
        deleteTrip: () => { },
        dispatchPlannedLoadsToTrip: async () => '',
        linkLoadToTrip: () => { },
        // Task management
        updateTaskStatus: () => { },
        completeTask: () => { },
        deleteTaskById: () => { },
        searchTerm: '',
        setSearchTerm: () => { },
      } as TMSContextType;
    }
    throw new Error('useTMS must be used within a TMSProvider');
  }
  return context;
};

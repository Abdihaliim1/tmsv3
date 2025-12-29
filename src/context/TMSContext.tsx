import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import { Load, LoadStatus, NewLoadInput, KPIMetrics, Employee, NewEmployeeInput, Driver, NewDriverInput, Invoice, Settlement, Truck, NewTruckInput, Expense, NewExpenseInput, FactoringCompany, NewFactoringCompanyInput, Dispatcher, NewDispatcherInput, EmployeeType, Trailer, NewTrailerInput, Broker, NewBrokerInput } from '../types';
import { recentLoads, generateMockKPIs, initialDrivers, initialInvoices, initialTrucks, initialTrailers, initialDispatchers } from '../services/mockData';
import { calculateCompanyRevenue } from '../services/utils';
// Tenant ID comes from TenantContext
import { autoSeedBrokers } from '../services/brokerSeed';
import { autoSeedFactoringCompanies } from '../services/factoringCompanySeed';
import { generateSearchKey, generatePrefixes } from '../services/brokerUtils';
import { generateUniqueInvoiceNumber } from '../services/invoiceService';
import { triggerLoadCreated, triggerLoadStatusChanged, triggerLoadDelivered, triggerInvoiceCreated } from '../services/workflow/workflowEngine';
import { getTasks, createTaskIfNotExists, updateTask, deleteTask } from '../services/workflow/taskService';
import { Task } from '../types';
import { useAuth } from './AuthContext';
import { auditCreate, auditUpdate, auditDelete, auditStatusChange, auditAdjustment } from '../data/audit';
import { validatePostDeliveryUpdates, isLoadLocked } from '../services/loadLocking';
import { createAdjustment } from '../services/adjustmentService';
// Firestore persistence
import {
  loadLoads, loadInvoices, loadSettlements, loadEmployees, loadTrucks, loadTrailers,
  loadExpenses, loadFactoringCompanies, loadBrokers,
  saveLoad, saveInvoice, saveSettlement, saveEmployee, saveTruck, saveTrailer,
  saveExpense, saveFactoringCompany, saveBroker,
  deleteLoad as firestoreDeleteLoad, deleteInvoice as firestoreDeleteInvoice,
  deleteSettlement as firestoreDeleteSettlement, deleteEmployee as firestoreDeleteEmployee,
  deleteTruck as firestoreDeleteTruck, deleteTrailer as firestoreDeleteTrailer,
  deleteExpense as firestoreDeleteExpense, deleteFactoringCompany as firestoreDeleteFactoringCompany,
  deleteBroker as firestoreDeleteBroker, batchSave
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
  dispatchers: Employee[]; // Computed: filtered employees where employeeType is dispatcher
  tasks: Task[]; // Workflow tasks
  kpis: KPIMetrics;
  addLoad: (load: NewLoadInput) => void;
  updateLoad: (id: string, load: Partial<Load>) => void;
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
  addDispatcher: (dispatcher: NewDispatcherInput) => void;
  updateDispatcher: (id: string, dispatcher: Partial<Dispatcher>) => void;
  deleteDispatcher: (id: string) => void;
  // Task management
  updateTaskStatus: (taskId: string, status: Task['status']) => void;
  completeTask: (taskId: string) => void;
  deleteTaskById: (taskId: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
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
        dispatchers: [],
        tasks: [],
        kpis: {
          revenue: 0,
          profit: 0,
          activeLoads: 0,
          activeDrivers: 0,
        },
        addLoad: () => { },
        updateLoad: () => { },
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
        addDispatcher: () => { },
        updateDispatcher: () => { },
        deleteDispatcher: () => { },
        updateTaskStatus: () => { },
        completeTask: () => { },
        deleteTaskById: () => { },
        searchTerm: '',
        setSearchTerm: () => { },
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
  const [searchTerm, setSearchTerm] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

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
          brokersData
        ] = await Promise.all([
          loadLoads(tenantId),
          loadEmployees(tenantId),
          loadInvoices(tenantId),
          loadSettlements(tenantId),
          loadTrucks(tenantId),
          loadTrailers(tenantId),
          loadExpenses(tenantId),
          loadFactoringCompanies(tenantId),
          loadBrokers(tenantId)
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
    return employees.filter(e => e.employeeType === 'driver' || e.employeeType === 'owner') as Driver[];
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

  const addLoad = async (input: NewLoadInput) => {
    const newLoadId = Math.random().toString(36).substr(2, 9);
    const newLoad: Load = {
      ...input,
      id: newLoadId,
      loadNumber: `LD-2025-${(loads.length + 301).toString()}`,
      createdAt: new Date().toISOString(),
      createdBy: authUser?.uid || 'system',
    };

    // Update Loads State
    setLoads([newLoad, ...loads]);

    // Save to Firestore
    try {
      await saveLoad(tenantId || 'default', newLoad);
    } catch (error) {
      console.error('Failed to save load to Firestore:', error);
    }

    // Audit logging
    try {
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
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }

    // Trigger workflow for load created
    try {
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
    } catch (error) {
      console.error('Error triggering workflow for load creation:', error);
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

    // Get current user for audit logging
    const actorUid = authUser?.uid || 'system';
    const actorRole = authUser?.role || 'viewer';

    // For delivered loads, check if a reason is needed
    const hasAdjustmentReason = reason && reason.trim().length > 0;

    if (isLoadLocked(oldLoad)) {
      const validation = validatePostDeliveryUpdates(oldLoad, updates);

      // If changes require a reason but none provided, reject
      if (validation.requiresReason && !hasAdjustmentReason) {
        const errorMessage = `Changes to delivered load require a reason. Changed fields: ${validation.changedFields.join(', ')}`;
        console.error('Load update requires reason:', errorMessage);
        return Promise.reject(new Error(errorMessage));
      }

      // Log the adjustment if reason provided
      if (hasAdjustmentReason) {
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
      Object.keys(updates).forEach((key) => {
        const oldValue = (oldLoad as any)[key];
        const newValue = (updates as any)[key];

        // Only log if value actually changed
        if (oldValue !== newValue && JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          adjustmentEntries.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    const shouldLock = (updates.status === LoadStatus.Delivered || updates.status === LoadStatus.Completed) &&
      !oldLoad.isLocked;

    const updatedLoad = {
      ...oldLoad,
      ...updates,
      adjustmentLog: adjustmentEntries.length > 0 ? newAdjustmentLog : oldLoad.adjustmentLog,
      isLocked: shouldLock ? true : oldLoad.isLocked,
      lockedAt: shouldLock ? new Date().toISOString() : oldLoad.lockedAt,
      updatedAt: new Date().toISOString()
    };
    setLoads(prev => prev.map(load => load.id === id ? updatedLoad : load));

    // Save to Firestore
    try {
      await saveLoad(tenantId || 'default', updatedLoad);
    } catch (error) {
      console.error('Failed to save load update to Firestore:', error);
    }

    // Audit logging
    try {
      if (updates.status && updates.status !== oldLoad.status) {
        // Status change audit
        await auditStatusChange(
          tenantId || 'default',
          actorUid,
          actorRole,
          'load',
          id,
          oldLoad.status,
          updates.status,
          `Load ${oldLoad.loadNumber} status changed from ${oldLoad.status} to ${updates.status}`
        );
      } else if (adjustmentEntries.length > 0) {
        // Adjustment audit
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
        // Regular update audit
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
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't throw - audit logging should never break the app
    }

    // Trigger workflow for status changes
    if (updates.status && updates.status !== oldLoad.status) {
      try {
        const createdTasks = await triggerLoadStatusChanged(
          tenantId || 'default',
          id,
          oldLoad.status,
          updates.status,
          {
            loadNumber: updatedLoad.loadNumber,
            driverId: updatedLoad.driverId,
            dispatcherId: updatedLoad.dispatcherId,
            customerName: updatedLoad.customerName,
            brokerName: updatedLoad.brokerName,
            isFactored: updatedLoad.isFactored,
          }
        );

        // If status changed to Delivered, trigger delivered event
        if (updates.status === LoadStatus.Delivered || updates.status === LoadStatus.Completed) {
          const deliveredTasks = await triggerLoadDelivered(tenantId || 'default', id, {
            loadNumber: updatedLoad.loadNumber,
            driverId: updatedLoad.driverId,
            deliveryDate: updatedLoad.deliveryDate,
          });
          if (deliveredTasks.length > 0) {
            setTasks(getTasks(tenantId)); // Refresh tasks
          }
        }

        if (createdTasks.length > 0) {
          setTasks(getTasks(tenantId)); // Refresh tasks
        }
      } catch (error) {
        console.error('Error triggering workflow for load status change:', error);
      }
    }

    // AUTO-SYNC: Update associated invoice when load rate/amount changes
    const rateChanged = updates.rate !== undefined && updates.rate !== oldLoad.rate;
    const grandTotalChanged = updates.grandTotal !== undefined && updates.grandTotal !== oldLoad.grandTotal;
    const brokerChanged = updates.brokerName !== undefined && updates.brokerName !== oldLoad.brokerName;

    if (rateChanged || grandTotalChanged || brokerChanged) {
      // Find invoice linked to this load
      const linkedInvoice = invoices.find(inv =>
        inv.loadId === id || inv.loadIds?.includes(id) || updatedLoad.invoiceId === inv.id
      );

      if (linkedInvoice) {
        // Recalculate invoice amount based on all linked loads
        const linkedLoadIds = linkedInvoice.loadIds || (linkedInvoice.loadId ? [linkedInvoice.loadId] : []);
        let newAmount = 0;

        linkedLoadIds.forEach(loadId => {
          const linkedLoad = loadId === id
            ? updatedLoad  // Use updated load for the one we just changed
            : loads.find(l => l.id === loadId);
          if (linkedLoad) {
            newAmount += linkedLoad.grandTotal || linkedLoad.rate || 0;
          }
        });

        const invoiceUpdates: Partial<Invoice> = {
          amount: newAmount,
          updatedAt: new Date().toISOString(),
        };

        // Also update broker name if it changed
        if (brokerChanged && updates.brokerName) {
          invoiceUpdates.brokerName = updates.brokerName;
          invoiceUpdates.customerName = updates.brokerName; // Keep in sync
        }

        setInvoices(prev => prev.map(inv =>
          inv.id === linkedInvoice.id
            ? { ...inv, ...invoiceUpdates }
            : inv
        ));

        console.log(`[INVOICE SYNC] Updated invoice ${linkedInvoice.invoiceNumber} amount to ${newAmount}`);
      }
    }
  };

  const deleteLoad = (id: string, force: boolean = false) => {
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

    // Proceed with deletion - unlink from invoices first
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

    // Unlink from settlements
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

    // Delete the load
    setLoads(prev => prev.filter(load => load.id !== id));

    // Delete from Firestore
    firestoreDeleteLoad(tenantId || 'default', id).catch(error => {
      console.error('Failed to delete load from Firestore:', error);
    });
  };

  // Employee functions
  const addEmployee = (input: NewEmployeeInput) => {
    const newEmployee: Employee = {
      ...input,
      id: Math.random().toString(36).substr(2, 9),
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
      id: Math.random().toString(36).substr(2, 9),
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
      id: Math.random().toString(36).substr(2, 9),
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
      id: Math.random().toString(36).substr(2, 9),
      invoiceNumber: input.invoiceNumber || generateUniqueInvoiceNumber(tenantId, invoices),
      createdAt: new Date().toISOString(),
    };
    setInvoices(prev => [newInvoice, ...prev]);
    saveInvoice(tenantId || 'default', newInvoice).catch(e => console.error('Failed to save invoice:', e));

    // Link invoice to loads (set invoiceId on each load)
    const invoiceLoadIds = newInvoice.loadIds || (newInvoice.loadId ? [newInvoice.loadId] : []);
    if (invoiceLoadIds.length > 0) {
      setLoads(prev => prev.map(load => {
        if (invoiceLoadIds.includes(load.id)) {
          return { ...load, invoiceId: newInvoice.id };
        }
        return load;
      }));
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
    const updatedInvoice = invoice ? { ...invoice, ...updates, updatedAt: new Date().toISOString() } : null;

    setInvoices(prev => prev.map(inv => inv.id === id ? updatedInvoice! : inv));
    if (updatedInvoice) {
      saveInvoice(tenantId || 'default', updatedInvoice).catch(e => console.error('Failed to save invoice:', e));
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
      id: Math.random().toString(36).substr(2, 9),
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
      id: Math.random().toString(36).substr(2, 9),
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
      id: Math.random().toString(36).substr(2, 9),
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
      id: Math.random().toString(36).substr(2, 9),
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
      dispatchers, // Computed: filtered employees
      tasks,
      kpis,
      addLoad,
      updateLoad,
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
      addDispatcher, // Legacy
      updateDispatcher, // Legacy
      deleteDispatcher, // Legacy
      updateTaskStatus,
      completeTask: completeTaskById,
      deleteTaskById,
      searchTerm,
      setSearchTerm
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
        dispatchers: [],
        tasks: [],
        kpis: {
          revenue: 0,
          profit: 0,
          activeLoads: 0,
          activeDrivers: 0,
        },
        addLoad: () => { },
        updateLoad: () => { },
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
        addDispatcher: () => { },
        updateDispatcher: () => { },
        deleteDispatcher: () => { },
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


import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { Load, LoadStatus, NewLoadInput, KPIMetrics, Employee, NewEmployeeInput, Driver, NewDriverInput, Invoice, Settlement, Truck, NewTruckInput, Expense, NewExpenseInput, FactoringCompany, NewFactoringCompanyInput, Dispatcher, NewDispatcherInput, EmployeeType, Trailer, NewTrailerInput, Broker, NewBrokerInput } from '../types';
import { recentLoads, generateMockKPIs, initialDrivers, initialInvoices, initialTrucks, initialTrailers, initialDispatchers } from '../services/mockData';
import { calculateCompanyRevenue } from '../services/utils';
import { getTenantFromSubdomain } from '../utils/tenant';
import { autoSeedBrokers } from '../services/brokerSeed';
import { autoSeedFactoringCompanies } from '../services/factoringCompanySeed';
import { generateSearchKey, generatePrefixes } from '../services/brokerUtils';
import { generateUniqueInvoiceNumber } from '../services/invoiceService';
import { triggerLoadCreated, triggerLoadStatusChanged, triggerLoadDelivered, triggerInvoiceCreated } from '../services/workflow/workflowEngine';
import { getTasks, createTaskIfNotExists, updateTask, deleteTask } from '../services/workflow/taskService';
import { Task } from '../types';

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

export const TMSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get tenant ID from subdomain (works even without TenantContext)
  const tenantId = getTenantFromSubdomain();

  // Load from localStorage or use initial data (tenant-aware)
  const loadFromStorage = <T,>(key: string, defaultValue: T[]): T[] => {
    try {
      const storageKey = getStorageKey(tenantId, key);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : defaultValue;
      }
    } catch (error) {
      console.warn(`Error loading ${key} from localStorage:`, error);
    }
    return defaultValue;
  };

  // Save to localStorage (tenant-aware)
  const saveToStorage = <T,>(key: string, data: T[]) => {
    try {
      const storageKey = getStorageKey(tenantId, key);
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  };

  // Initialize state from localStorage or defaults
  const [loads, setLoads] = useState<Load[]>(() => loadFromStorage('loads', recentLoads));
  // Employees: unified system (includes drivers, dispatchers, managers, etc.)
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const stored = loadFromStorage('employees', []);
    // If no employees but we have drivers, migrate drivers to employees and include dispatchers
    if (stored.length === 0) {
      const legacyDrivers = loadFromStorage('drivers', initialDrivers);
      const driversAsEmployees = legacyDrivers.map(d => ({
        ...d,
        employeeType: (d.type === 'Company' ? 'driver' : 'owner_operator') as EmployeeType,
        employeeNumber: d.driverNumber || d.employeeId,
        id: d.id
      }));
      // Combine drivers and dispatchers
      return [...driversAsEmployees, ...initialDispatchers];
    }
    return stored;
  });
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadFromStorage('invoices', initialInvoices));
  const [settlements, setSettlements] = useState<Settlement[]>(() => loadFromStorage('settlements', []));
  const [trucks, setTrucks] = useState<Truck[]>(() => loadFromStorage('trucks', initialTrucks));
  const [trailers, setTrailers] = useState<Trailer[]>(() => loadFromStorage('trailers', initialTrailers));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadFromStorage('expenses', []));
  // Auto-seed factoring companies if they don't exist
  const [factoringCompanies, setFactoringCompanies] = useState<FactoringCompany[]>(() => {
    const stored = loadFromStorage('factoringCompanies', []);
    if (stored.length === 0) {
      // Auto-seed factoring companies
      try {
        return autoSeedFactoringCompanies(tenantId);
      } catch (error) {
        console.warn('Could not auto-seed factoring companies:', error);
        return [];
      }
    }
    return stored;
  });
  // Auto-seed brokers if they don't exist
  const [brokers, setBrokers] = useState<Broker[]>(() => {
    const stored = loadFromStorage('brokers', []);
    if (stored.length === 0) {
      // Auto-seed brokers
      try {
        return autoSeedBrokers(tenantId);
      } catch (error) {
        console.warn('Could not auto-seed brokers:', error);
        return [];
      }
    }
    return stored;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const tasks = getTasks(tenantId);
      return tasks;
    } catch (error) {
      console.warn('Error loading tasks:', error);
      return [];
    }
  });

  // Update tenant ID when TenantContext changes
  useEffect(() => {
    try {
      // This will be handled by TenantProvider wrapper
      // For now, we'll use a simpler approach
    } catch {
      // Tenant context not available
    }
  }, []);

  // Auto-save to localStorage whenever data changes
  useEffect(() => {
    saveToStorage('loads', loads);
  }, [loads, tenantId]);

  useEffect(() => {
    saveToStorage('employees', employees);
    // Also save to legacy 'drivers' key for backward compatibility
    const driversOnly = employees.filter(e => e.employeeType === 'driver' || e.employeeType === 'owner_operator');
    saveToStorage('drivers', driversOnly);
  }, [employees, tenantId]);

  // Computed: Drivers (filtered employees)
  const drivers = useMemo(() => {
    return employees.filter(e => e.employeeType === 'driver' || e.employeeType === 'owner_operator');
  }, [employees]);

  // Computed: Dispatchers (filtered employees)
  const dispatchers = useMemo(() => {
    return employees.filter(e => e.employeeType === 'dispatcher');
  }, [employees]);

  useEffect(() => {
    saveToStorage('invoices', invoices);
  }, [invoices, tenantId]);

  useEffect(() => {
    saveToStorage('settlements', settlements);
  }, [settlements, tenantId]);

  useEffect(() => {
    saveToStorage('trucks', trucks);
  }, [trucks, tenantId]);

  useEffect(() => {
    saveToStorage('trailers', trailers);
  }, [trailers, tenantId]);

  useEffect(() => {
    saveToStorage('expenses', expenses);
  }, [expenses, tenantId]);

  useEffect(() => {
    saveToStorage('factoringCompanies', factoringCompanies);
  }, [factoringCompanies, tenantId]);

  useEffect(() => {
    saveToStorage('brokers', brokers);
  }, [brokers, tenantId]);

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
      currentRevenue += calculateCompanyRevenue(load.rate, driver);
    });

    const activeLoadCount = loads.filter(l => 
      [LoadStatus.Dispatched, LoadStatus.InTransit, LoadStatus.Available].includes(l.status)
    ).length;
    const activeDriverCount = drivers.filter(d => d.status === 'active').length;

    return {
      ...baseKPIs,
      revenue: currentRevenue,
      activeLoads: activeLoadCount,
      activeDrivers: activeDriverCount,
      profit: currentRevenue * 0.15 // Mock 15% net margin for now
    };
  }, [loads, drivers]);

  const addLoad = async (input: NewLoadInput) => {
    const newLoadId = Math.random().toString(36).substr(2, 9);
    const newLoad: Load = {
      ...input,
      id: newLoadId,
      loadNumber: `LD-2025-${(loads.length + 301).toString()}`,
    };

    // Update Loads State
    setLoads([newLoad, ...loads]);

    // Trigger workflow for load created
    try {
      const createdTasks = await triggerLoadCreated(newLoad.id, {
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
            driverId: driver.id,
            driverName: `${driver.firstName} ${driver.lastName}`,
            loadId: newLoad.loadNumber,
            grossPay: grossPay,
            deductions: {}, // Can be edited later
            totalDeductions: 0,
            netPay: grossPay,
            status: 'pending',
            date: new Date().toISOString().split('T')[0]
          };
          setSettlements(prev => [newSettlement, ...prev]);
        }
      }
    }
  };

  const updateLoad = async (id: string, updates: Partial<Load>) => {
    const oldLoad = loads.find(l => l.id === id);
    if (!oldLoad) return;

    // Check if load is delivered/completed - if so, track adjustments
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
      // Track all changes to delivered loads
      const currentUser = localStorage.getItem('tms_auth_user');
      const changedBy = currentUser ? JSON.parse(currentUser).username || 'system' : 'system';
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
            reason: `Adjustment to delivered load`
          });
        }
      });
    }

    // Merge adjustment log entries
    const existingAdjustmentLog = oldLoad.adjustmentLog || [];
    const newAdjustmentLog = [...existingAdjustmentLog, ...adjustmentEntries];

    const updatedLoad = { 
      ...oldLoad, 
      ...updates,
      adjustmentLog: adjustmentEntries.length > 0 ? newAdjustmentLog : oldLoad.adjustmentLog,
      updatedAt: new Date().toISOString()
    };
    setLoads(prev => prev.map(load => load.id === id ? updatedLoad : load));

    // Trigger workflow for status changes
    if (updates.status && updates.status !== oldLoad.status) {
      try {
        const createdTasks = await triggerLoadStatusChanged(
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
          const deliveredTasks = await triggerLoadDelivered(id, {
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

    // Block deletion if linked (unless forced)
    if (!force && (linkedInvoices.length > 0 || linkedSettlements.length > 0)) {
      const invoiceList = linkedInvoices.map(inv => inv.invoiceNumber).join(', ');
      const settlementList = linkedSettlements.map(sett => sett.settlementNumber || sett.id).join(', ');
      
      const message = 
        `Cannot delete Load ${load.loadNumber} because it is linked to:\n` +
        (linkedInvoices.length > 0 ? `- Invoices: ${invoiceList}\n` : '') +
        (linkedSettlements.length > 0 ? `- Settlements: ${settlementList}\n` : '') +
        '\nTo force delete, you must first delete or unlink these entities.';
      
      alert(message);
      throw new Error(message);
    }

    // Proceed with deletion
    setLoads(prev => prev.filter(load => load.id !== id));
  };

  // Employee functions
  const addEmployee = (input: NewEmployeeInput) => {
    const newEmployee: Employee = {
      ...input,
      id: Math.random().toString(36).substr(2, 9),
      employeeNumber: input.employeeNumber || input.driverNumber || `EMP-${employees.length + 101}`,
      employeeType: input.employeeType || 'driver', // Default to driver if not specified
      // Set legacy type field based on employeeType
      type: input.type || (input.employeeType === 'owner_operator' ? 'OwnerOperator' : 'Company'),
      driverNumber: input.driverNumber || input.employeeNumber, // Legacy compatibility
    };
    setEmployees(prev => [...prev, newEmployee]);
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(employee => 
      employee.id === id 
        ? { 
            ...employee, 
            ...updates,
            // Sync legacy fields
            driverNumber: updates.employeeNumber || employee.employeeNumber || employee.driverNumber,
            employeeNumber: updates.employeeNumber || employee.employeeNumber || employee.driverNumber,
            type: updates.type || (updates.employeeType === 'owner_operator' ? 'OwnerOperator' : 'Company') || employee.type
          }
        : employee
    ));
  };

  const deleteEmployee = (id: string) => {
    setEmployees(prev => prev.filter(employee => employee.id !== id));
  };

  // Legacy driver functions (for backward compatibility)
  const addDriver = (input: NewDriverInput) => {
    addEmployee({
      ...input,
      employeeType: input.type === 'OwnerOperator' ? 'owner_operator' : 'driver',
      employeeNumber: input.driverNumber,
    });
  };

  const updateDriver = (id: string, updates: Partial<Driver>) => {
    updateEmployee(id, {
      ...updates,
      employeeType: updates.type === 'OwnerOperator' ? 'owner_operator' : 'driver',
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
    };
    setTrucks([...trucks, newTruck]);
    return newTruck.id; // Return the ID so it can be used immediately
  };

  const updateTruck = (id: string, updates: Partial<Truck>) => {
    setTrucks(prev => prev.map(truck => truck.id === id ? { ...truck, ...updates } : truck));
  };

  const deleteTruck = (id: string) => {
    setTrucks(prev => prev.filter(truck => truck.id !== id));
  };

  const addTrailer = (input: NewTrailerInput): string => {
    const newTrailer: Trailer = {
      ...input,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    setTrailers([...trailers, newTrailer]);
    return newTrailer.id;
  };

  const updateTrailer = (id: string, updates: Partial<Trailer>) => {
    setTrailers(prev => prev.map(trailer => 
      trailer.id === id 
        ? { ...trailer, ...updates, updatedAt: new Date().toISOString() }
        : trailer
    ));
  };

  const deleteTrailer = (id: string) => {
    // Unlink trailer from trucks
    setTrucks(prev => prev.map(truck => {
      // Remove assignedTrailerId if it matches (we'll add this field to Truck)
      return truck;
    }));
    setTrailers(prev => prev.filter(trailer => trailer.id !== id));
  };

  const addInvoice = async (input: Omit<Invoice, 'id'>) => {
    const newInvoice: Invoice = {
      ...input,
      id: Math.random().toString(36).substr(2, 9),
      invoiceNumber: input.invoiceNumber || generateUniqueInvoiceNumber(tenantId, invoices),
      createdAt: new Date().toISOString(),
    };
    setInvoices(prev => [newInvoice, ...prev]);

    // Trigger workflow for invoice created
    try {
      const createdTasks = await triggerInvoiceCreated(newInvoice.id, {
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
    setInvoices(prev => prev.map(invoice => 
      invoice.id === id 
        ? { ...invoice, ...updates, updatedAt: new Date().toISOString() }
        : invoice
    ));
  };

  const deleteInvoice = (id: string, force: boolean = false) => {
    const invoice = invoices.find(inv => inv.id === id);
    if (!invoice) return;

    // Check if invoice is paid
    if (!force && invoice.status === 'paid') {
      const message = 
        `Cannot delete paid Invoice ${invoice.invoiceNumber}.\n` +
        'Paid invoices should not be deleted. If you need to correct this invoice, create a credit memo or adjustment.';
      alert(message);
      throw new Error(message);
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
  };

  const addSettlement = (input: Omit<Settlement, 'id'>): string => {
    const newSettlement: Settlement = {
      ...input,
      id: Math.random().toString(36).substr(2, 9),
      settlementNumber: input.settlementNumber || `ST-${new Date().getFullYear()}-${settlements.length + 1001}`,
      createdAt: input.createdAt || new Date().toISOString(),
    };
    setSettlements(prev => [newSettlement, ...prev]);
    return newSettlement.id; // Return the ID so it can be used to mark loads
  };

  const updateSettlement = (id: string, updates: Partial<Settlement>) => {
    setSettlements(prev => prev.map(settlement => 
      settlement.id === id 
        ? { ...settlement, ...updates }
        : settlement
    ));
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

    // Block deletion if linked to invoiced loads (unless forced)
    if (!force && linkedInvoicedLoads.length > 0) {
      const invoiceList = linkedInvoicedLoads
        .map(load => load.invoiceNumber)
        .filter(Boolean)
        .join(', ');
      
      const message = 
        `Cannot delete Settlement ${settlement.settlementNumber || id} because it contains loads that are invoiced:\n` +
        `- Invoice Numbers: ${invoiceList}\n` +
        '\nTo force delete, you must first delete or unlink these invoices.';
      
      alert(message);
      throw new Error(message);
    }

    // Proceed with deletion and cleanup
    setSettlements(prev => prev.filter(settlement => settlement.id !== id));
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
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses(prev => prev.map(expense => 
      expense.id === id 
        ? { ...expense, ...updates, updatedAt: new Date().toISOString() }
        : expense
    ));
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(expense => expense.id !== id));
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
  };

  const updateFactoringCompany = (id: string, updates: Partial<FactoringCompany>) => {
    setFactoringCompanies(prev => prev.map(company => 
      company.id === id 
        ? { ...company, ...updates, updatedAt: new Date().toISOString() }
        : company
    ));
  };

  const deleteFactoringCompany = (id: string) => {
    setFactoringCompanies(prev => prev.filter(company => company.id !== id));
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
  };

  const updateBroker = (id: string, updates: Partial<Broker>) => {
    setBrokers(prev => prev.map(broker => {
      if (broker.id === id) {
        const updated = { ...broker, ...updates, updatedAt: new Date().toISOString() };
        // Recalculate searchKey and prefixes if name or aliases changed
        if (updates.name || updates.aliases) {
          updated.searchKey = generateSearchKey(updated.name, updated.aliases || []);
          updated.prefixes = generatePrefixes(updated.searchKey);
        }
        return updated;
      }
      return broker;
    }));
  };

  const deleteBroker = (id: string) => {
    setBrokers(prev => prev.filter(broker => broker.id !== id));
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
    throw new Error('useTMS must be used within a TMSProvider');
  }
  return context;
};

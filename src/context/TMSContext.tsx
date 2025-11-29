
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { Load, LoadStatus, NewLoadInput, KPIMetrics, Employee, NewEmployeeInput, Driver, NewDriverInput, Invoice, Settlement, Truck, NewTruckInput, Expense, NewExpenseInput, FactoringCompany, NewFactoringCompanyInput, Dispatcher, NewDispatcherInput, EmployeeType, Trailer, NewTrailerInput } from '../types';
import { recentLoads, generateMockKPIs, initialDrivers, initialInvoices } from '../services/mockData';
import { calculateCompanyRevenue } from '../services/utils';
import { getTenantFromSubdomain } from '../utils/tenant';

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
  dispatchers: Employee[]; // Computed: filtered employees where employeeType is dispatcher
  kpis: KPIMetrics;
  addLoad: (load: NewLoadInput) => void;
  updateLoad: (id: string, load: Partial<Load>) => void;
  deleteLoad: (id: string) => void;
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
  deleteInvoice: (id: string) => void;
  addSettlement: (settlement: Omit<Settlement, 'id'>) => string;
  updateSettlement: (id: string, settlement: Partial<Settlement>) => void;
  deleteSettlement: (id: string) => void;
  addExpense: (expense: NewExpenseInput) => void;
  updateExpense: (id: string, expense: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  addFactoringCompany: (company: NewFactoringCompanyInput) => void;
  updateFactoringCompany: (id: string, company: Partial<FactoringCompany>) => void;
  deleteFactoringCompany: (id: string) => void;
  addDispatcher: (dispatcher: NewDispatcherInput) => void;
  updateDispatcher: (id: string, dispatcher: Partial<Dispatcher>) => void;
  deleteDispatcher: (id: string) => void;
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
    // If no employees but we have drivers, migrate drivers to employees
    if (stored.length === 0) {
      const legacyDrivers = loadFromStorage('drivers', initialDrivers);
      return legacyDrivers.map(d => ({
        ...d,
        employeeType: (d.type === 'Company' ? 'driver' : 'owner_operator') as EmployeeType,
        employeeNumber: d.driverNumber,
        id: d.id
      }));
    }
    return stored;
  });
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadFromStorage('invoices', initialInvoices));
  const [settlements, setSettlements] = useState<Settlement[]>(() => loadFromStorage('settlements', []));
  const [trucks, setTrucks] = useState<Truck[]>(() => loadFromStorage('trucks', []));
  const [trailers, setTrailers] = useState<Trailer[]>(() => loadFromStorage('trailers', []));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadFromStorage('expenses', []));
  const [factoringCompanies, setFactoringCompanies] = useState<FactoringCompany[]>(() => loadFromStorage('factoringCompanies', []));

  const [searchTerm, setSearchTerm] = useState('');

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

  const addLoad = (input: NewLoadInput) => {
    const newLoadId = Math.random().toString(36).substr(2, 9);
    const newLoad: Load = {
      ...input,
      id: newLoadId,
      loadNumber: `LD-2025-${(loads.length + 301).toString()}`,
    };

    // Update Loads State
    setLoads([newLoad, ...loads]);

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
        invoiceNumber: `INV-${new Date().getFullYear()}-${(invoices.length + 1001)}`,
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

  const updateLoad = (id: string, updates: Partial<Load>) => {
    setLoads(prev => prev.map(load => load.id === id ? { ...load, ...updates } : load));
  };

  const deleteLoad = (id: string) => {
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

  const addInvoice = (input: Omit<Invoice, 'id'>) => {
    const newInvoice: Invoice = {
      ...input,
      id: Math.random().toString(36).substr(2, 9),
      invoiceNumber: input.invoiceNumber || `INV-${new Date().getFullYear()}-${invoices.length + 1001}`,
      createdAt: new Date().toISOString(),
    };
    setInvoices(prev => [newInvoice, ...prev]);
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    setInvoices(prev => prev.map(invoice => 
      invoice.id === id 
        ? { ...invoice, ...updates, updatedAt: new Date().toISOString() }
        : invoice
    ));
  };

  const deleteInvoice = (id: string) => {
    // Unlink invoice from loads
    setLoads(prev => prev.map(load => {
      const invoice = invoices.find(inv => inv.id === id);
      if (invoice && invoice.loadIds?.includes(load.id)) {
        return { ...load } as Load; // Remove invoiceId if it exists
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

  const deleteSettlement = (id: string) => {
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
    const newCompany: FactoringCompany = {
      ...input,
      id: Math.random().toString(36).substr(2, 9),
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
      dispatchers, // Computed: filtered employees
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
      addDispatcher, // Legacy
      updateDispatcher, // Legacy
      deleteDispatcher, // Legacy
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


import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { Load, LoadStatus, NewLoadInput, KPIMetrics, Driver, NewDriverInput, Invoice, Settlement, Truck, NewTruckInput, Expense, NewExpenseInput } from '../types';
import { recentLoads, generateMockKPIs, initialDrivers, initialInvoices } from '../services/mockData';
import { calculateCompanyRevenue } from '../services/utils';

// LocalStorage keys
const STORAGE_KEYS = {
  loads: 'tms_loads',
  drivers: 'tms_drivers',
  invoices: 'tms_invoices',
  settlements: 'tms_settlements',
  trucks: 'tms_trucks',
  expenses: 'tms_expenses',
};

interface TMSContextType {
  loads: Load[];
  drivers: Driver[];
  invoices: Invoice[];
  settlements: Settlement[];
  trucks: Truck[];
  expenses: Expense[];
  kpis: KPIMetrics;
  addLoad: (load: NewLoadInput) => void;
  updateLoad: (id: string, load: Partial<Load>) => void;
  deleteLoad: (id: string) => void;
  addDriver: (driver: NewDriverInput) => void;
  updateDriver: (id: string, driver: Partial<Driver>) => void;
  deleteDriver: (id: string) => void;
  addTruck: (truck: NewTruckInput) => void;
  updateTruck: (id: string, truck: Partial<Truck>) => void;
  deleteTruck: (id: string) => void;
  addInvoice: (invoice: Omit<Invoice, 'id'>) => void;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  addSettlement: (settlement: Omit<Settlement, 'id'>) => string;
  updateSettlement: (id: string, settlement: Partial<Settlement>) => void;
  deleteSettlement: (id: string) => void;
  addExpense: (expense: NewExpenseInput) => void;
  updateExpense: (id: string, expense: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const TMSContext = createContext<TMSContextType | undefined>(undefined);

export const TMSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load from localStorage or use initial data
  const loadFromStorage = <T,>(key: string, defaultValue: T[]): T[] => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : defaultValue;
      }
    } catch (error) {
      console.warn(`Error loading ${key} from localStorage:`, error);
    }
    return defaultValue;
  };

  // Save to localStorage
  const saveToStorage = <T,>(key: string, data: T[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  };

  // Initialize state from localStorage or defaults
  const [loads, setLoads] = useState<Load[]>(() => loadFromStorage(STORAGE_KEYS.loads, recentLoads));
  const [drivers, setDrivers] = useState<Driver[]>(() => loadFromStorage(STORAGE_KEYS.drivers, initialDrivers));
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadFromStorage(STORAGE_KEYS.invoices, initialInvoices));
  const [settlements, setSettlements] = useState<Settlement[]>(() => loadFromStorage(STORAGE_KEYS.settlements, []));
  const [trucks, setTrucks] = useState<Truck[]>(() => loadFromStorage(STORAGE_KEYS.trucks, []));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadFromStorage(STORAGE_KEYS.expenses, []));

  const [searchTerm, setSearchTerm] = useState('');

  // Auto-save to localStorage whenever data changes
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.loads, loads);
  }, [loads]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.drivers, drivers);
  }, [drivers]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.invoices, invoices);
  }, [invoices]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.settlements, settlements);
  }, [settlements]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.trucks, trucks);
  }, [trucks]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.expenses, expenses);
  }, [expenses]);

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
      
      const newInvoice: Invoice = {
        id: `inv-${newLoadId}`,
        invoiceNumber: `INV-${new Date().getFullYear()}-${(invoices.length + 1001)}`,
        loadIds: [newLoad.id],
        customerName: newLoad.customerName,
        amount: newLoad.rate,
        status: 'pending',
        date: today.toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
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
            deductions: 0, // Can be edited later
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

  const addDriver = (input: NewDriverInput) => {
    const newDriver: Driver = {
      ...input,
      id: Math.random().toString(36).substr(2, 9),
      driverNumber: input.driverNumber || `DRV-${drivers.length + 101}`,
    };
    setDrivers([...drivers, newDriver]);
  };

  const updateDriver = (id: string, updates: Partial<Driver>) => {
    setDrivers(prev => prev.map(driver => driver.id === id ? { ...driver, ...updates } : driver));
  };

  const deleteDriver = (id: string) => {
    setDrivers(prev => prev.filter(driver => driver.id !== id));
  };

  const addTruck = (input: NewTruckInput) => {
    const newTruck: Truck = {
      ...input,
      id: Math.random().toString(36).substr(2, 9),
    };
    setTrucks([...trucks, newTruck]);
  };

  const updateTruck = (id: string, updates: Partial<Truck>) => {
    setTrucks(prev => prev.map(truck => truck.id === id ? { ...truck, ...updates } : truck));
  };

  const deleteTruck = (id: string) => {
    setTrucks(prev => prev.filter(truck => truck.id !== id));
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
      drivers, 
      invoices, 
      settlements,
      trucks,
      expenses,
      kpis, 
      addLoad, 
      updateLoad,
      deleteLoad,
      addDriver,
      updateDriver,
      deleteDriver,
      addTruck,
      updateTruck,
      deleteTruck,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      addSettlement,
      updateSettlement,
      deleteSettlement,
      addExpense,
      updateExpense,
      deleteExpense,
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

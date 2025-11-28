
import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { Load, LoadStatus, NewLoadInput, KPIMetrics, Driver, NewDriverInput, Invoice, Settlement } from '../types';
import { recentLoads, generateMockKPIs, initialDrivers, initialInvoices } from '../services/mockData';
import { calculateCompanyRevenue } from '../services/utils';

interface TMSContextType {
  loads: Load[];
  drivers: Driver[];
  invoices: Invoice[];
  settlements: Settlement[];
  kpis: KPIMetrics;
  addLoad: (load: NewLoadInput) => void;
  addDriver: (driver: NewDriverInput) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const TMSContext = createContext<TMSContextType | undefined>(undefined);

export const TMSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loads, setLoads] = useState<Load[]>(recentLoads);
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  // Initialize settlements from mock loads for now
  const [settlements, setSettlements] = useState<Settlement[]>([]); 

  const [searchTerm, setSearchTerm] = useState('');

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
      const newInvoice: Invoice = {
        id: `inv-${newLoadId}`,
        invoiceNumber: `INV-${(invoices.length + 1001)}`,
        loadId: newLoad.id,
        customerName: newLoad.customerName,
        amount: newLoad.rate,
        status: 'Pending',
        date: new Date().toISOString().split('T')[0]
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
            status: 'Pending',
            date: new Date().toISOString().split('T')[0]
          };
          setSettlements(prev => [newSettlement, ...prev]);
        }
      }
    }
  };

  const addDriver = (input: NewDriverInput) => {
    const newDriver: Driver = {
      ...input,
      id: Math.random().toString(36).substr(2, 9),
    };
    setDrivers([...drivers, newDriver]);
  }

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
      kpis, 
      addLoad, 
      addDriver, 
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

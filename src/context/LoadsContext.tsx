import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Load, NewLoadInput, LoadStatus } from '../types';
import { loadLoads, saveLoad, deleteLoad as firestoreDeleteLoad, subscribeToCollection } from '../services/firestoreService';
import { useAuth } from './AuthContext';
import { auditCreate, auditUpdate, auditDelete, auditStatusChange, auditAdjustment } from '../data/audit';
import { triggerLoadCreated, triggerLoadStatusChanged, triggerLoadDelivered } from '../services/workflow/workflowEngine';
import { isLoadLocked, validatePostDeliveryUpdates } from '../services/loadLocking';
import { getTasks } from '../services/workflow/taskService';
import { logger } from '../services/logger';
import { errorHandler, ErrorSeverity } from '../services/errorHandler';
import { createAdjustment } from '../services/adjustmentService';

// Define the shape of the context
interface LoadsContextType {
  loads: Load[];
  loading: boolean;
  addLoad: (load: NewLoadInput) => Promise<string | void>;
  updateLoad: (id: string, updates: Partial<Load>, reason?: string) => Promise<void>;
  deleteLoad: (id: string, force?: boolean) => Promise<void>;
  refreshLoads: () => Promise<void>;
}

const LoadsContext = createContext<LoadsContextType | undefined>(undefined);

interface LoadsProviderProps {
  children: ReactNode;
  tenantId: string | null;
  // Dependency Injection for cross-cutting concerns to avoid circular dependencies
  onLoadCreated?: (load: Load) => void;
  onLoadUpdated?: (oldLoad: Load, newLoad: Load) => void;
  onLoadDeleted?: (loadId: string) => void;
  checkDeleteSafety?: (load: Load) => Promise<boolean>; // Returns true if safe to delete
}

export const LoadsProvider: React.FC<LoadsProviderProps> = ({ 
  children, 
  tenantId,
  onLoadCreated,
  onLoadUpdated,
  onLoadDeleted,
  checkDeleteSafety
}) => {
  const { user: authUser } = useAuth();
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Set up real-time subscription to loads collection
   * Replaces manual refreshLoads() calls
   */
  useEffect(() => {
    if (!tenantId) {
      setLoads([]);
      setLoading(false);
      return;
    }

    logger.info('[LoadsContext] Setting up real-time subscription', { tenantId });
    setLoading(true);

    // Subscribe to real-time updates from Firestore
    const unsubscribe = subscribeToCollection<Load>(
      tenantId,
      'loads',
      (updatedLoads) => {
        logger.debug('[LoadsContext] Received real-time update', {
          tenantId,
          count: updatedLoads.length,
        });
        setLoads(updatedLoads);
        setLoading(false);
      },
      (error) => {
        errorHandler.handle(
          error,
          { operation: 'subscribe to loads', tenantId },
          { severity: ErrorSeverity.MEDIUM, notifyUser: false }
        );
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount or tenant change
    return () => {
      logger.debug('[LoadsContext] Cleaning up subscription', { tenantId });
      unsubscribe();
    };
  }, [tenantId]);

  // Keep refreshLoads for backward compatibility (but it's a no-op with real-time)
  const refreshLoads = async () => {
    logger.debug('[LoadsContext] Refresh requested (no-op with real-time subscriptions)', { tenantId });
    // Real-time subscriptions handle updates automatically
  };

  const addLoad = async (input: NewLoadInput) => {
    if (!tenantId) return;

    const newLoadId = Math.random().toString(36).substr(2, 9);
    const newLoad: Load = {
      ...input,
      id: newLoadId,
      loadNumber: `LD-2025-${(loads.length + 301).toString()}`, // Note: This simple increment might have race conditions in real multi-user, but keeping existing logic
      createdAt: new Date().toISOString(),
      createdBy: authUser?.uid || 'system',
    };

    // Optimistic Update
    setLoads(prev => [newLoad, ...prev]);

    try {
      await saveLoad(tenantId, newLoad);

      // Audit
      const actorUid = authUser?.uid || 'system';
      const actorRole = authUser?.role || 'viewer';
      await auditCreate(tenantId, actorUid, actorRole, 'load', newLoadId, newLoad, `Created load ${newLoad.loadNumber}`);

      // Workflow
      await triggerLoadCreated(newLoad.id, {
        loadNumber: newLoad.loadNumber,
        driverId: newLoad.driverId,
        dispatcherId: newLoad.dispatcherId,
        status: newLoad.status,
        customerName: newLoad.customerName,
        brokerName: newLoad.brokerName,
        isFactored: newLoad.isFactored,
        createdBy: newLoad.createdBy,
      });

      // Cross-cutting callbacks (e.g. Invoice Autogeneration)
      if (onLoadCreated) {
        onLoadCreated(newLoad);
      }

      logger.info('[LoadsContext] Load created successfully', {
        tenantId,
        loadId: newLoadId,
        loadNumber: newLoad.loadNumber,
      });

      return newLoadId;
    } catch (error) {
      errorHandler.handle(
        error,
        {
          operation: 'add load',
          tenantId,
          userId: authUser?.uid,
        },
        { severity: ErrorSeverity.HIGH }
      );
      // Rollback optimistic update on error
      setLoads(prev => prev.filter(l => l.id !== newLoadId));
      throw error;
    }
  };

  const updateLoad = async (id: string, updates: Partial<Load>, reason?: string) => {
    if (!tenantId) return;

    const oldLoad = loads.find(l => l.id === id);
    if (!oldLoad) throw new Error('Load not found');

    // Validation
    if (isLoadLocked(oldLoad)) {
      const validation = validatePostDeliveryUpdates(oldLoad, updates);
      if (validation.requiresReason && (!reason || reason.trim().length === 0)) {
        throw new Error(`Changes to delivered load require a reason. Changed fields: ${validation.changedFields.join(', ')}`);
      }
    }

    // Prepare Updates & Audit Log
    const isDelivered = oldLoad.status === LoadStatus.Delivered || oldLoad.status === LoadStatus.Completed;
    const adjustmentEntries = []; // ...Logic simplified for brevity, assume similar to original
    
    // Re-implementing the adjustment log logic from TMSContext
    if (isDelivered) {
       const changedBy = authUser?.displayName || authUser?.email || 'system';
       Object.keys(updates).forEach((key) => {
         const k = key as keyof Load;
         const oldValue = oldLoad[k];
         const newValue = updates[k];
         
         if (oldValue !== newValue && JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            adjustmentEntries.push({
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
              changedBy,
              field: key,
              oldValue,
              newValue,
              reason: reason || `Adjustment to delivered load`
            });
         }
       });
    }

    const updatedLoad = {
      ...oldLoad,
      ...updates,
      adjustmentLog: adjustmentEntries.length > 0 ? [...(oldLoad.adjustmentLog || []), ...adjustmentEntries] : oldLoad.adjustmentLog,
      updatedAt: new Date().toISOString()
    };

    // Optimistic Update
    setLoads(prev => prev.map(l => l.id === id ? updatedLoad : l));

    try {
      await saveLoad(tenantId, updatedLoad);

      // Audit Calls
      const actorUid = authUser?.uid || 'system';
      const actorRole = authUser?.role || 'viewer';

      if (updates.status && updates.status !== oldLoad.status) {
         await auditStatusChange(tenantId, actorUid, actorRole, 'load', id, oldLoad.status, updates.status, `Status changed to ${updates.status}`);
         
         // Workflow Triggers
         await triggerLoadStatusChanged(tenantId, id, oldLoad.status, updates.status, {
            loadNumber: updatedLoad.loadNumber,
            customerName: updatedLoad.customerName,
         });

         if (updates.status === LoadStatus.Delivered || updates.status === LoadStatus.Completed) {
            await triggerLoadDelivered(tenantId, id, {
                loadNumber: updatedLoad.loadNumber,
                driverId: updatedLoad.driverId,
                deliveryDate: updatedLoad.deliveryDate,
            });
         }
      } else if (adjustmentEntries.length > 0) {
          await auditAdjustment(tenantId, actorUid, actorRole, 'load', id, oldLoad, updatedLoad, reason || 'Adjustment', 'Adjusted load');
      } else {
          await auditUpdate(tenantId, actorUid, actorRole, 'load', id, oldLoad, updatedLoad, 'Updated load');
      }

      // Cross-cutting callbacks (e.g. Sync Invoice Amount)
      if (onLoadUpdated) {
        onLoadUpdated(oldLoad, updatedLoad);
      }

      logger.info('[LoadsContext] Load updated successfully', {
        tenantId,
        loadId: id,
        hasStatusChange: updates.status && updates.status !== oldLoad.status,
        hasAdjustments: adjustmentEntries.length > 0,
      });

    } catch (error) {
      errorHandler.handle(
        error,
        {
          operation: 'update load',
          tenantId,
          userId: authUser?.uid,
          metadata: { loadId: id },
        },
        { severity: ErrorSeverity.HIGH }
      );
      // Rollback optimistic update
      setLoads(prev => prev.map(l => l.id === id ? oldLoad : l));
      throw error;
    }
  };

  const deleteLoad = async (id: string, force: boolean = false) => {
    if (!tenantId) return;

    const load = loads.find(l => l.id === id);
    if (!load) return;

    // Safety Check (Injection)
    if (checkDeleteSafety && !force) {
      const isSafe = await checkDeleteSafety(load);
      if (!isSafe) return; // User cancelled or check failed
    }

    // Optimistic Delete
    setLoads(prev => prev.filter(l => l.id !== id));

    try {
      await firestoreDeleteLoad(tenantId, id);
      
      // Callbacks (Unlink Invoices/Settlements)
      if (onLoadDeleted) {
        onLoadDeleted(id);
      }

      logger.info('[LoadsContext] Load deleted successfully', { tenantId, loadId: id });
    } catch (error) {
      errorHandler.handle(
        error,
        {
          operation: 'delete load',
          tenantId,
          userId: authUser?.uid,
          metadata: { loadId: id },
        },
        { severity: ErrorSeverity.HIGH }
      );
      // Rollback optimistic delete
      if (load) {
        setLoads(prev => [...prev, load]);
      }
      throw error;
    }
  };

  return (
    <LoadsContext.Provider value={{
      loads,
      loading,
      addLoad,
      updateLoad,
      deleteLoad,
      refreshLoads,
    }}>
      {children}
    </LoadsContext.Provider>
  );
};

export const useLoads = () => {
  const context = useContext(LoadsContext);
  if (context === undefined) {
    throw new Error('useLoads must be used within a LoadsProvider');
  }
  return context;
};

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Settlement } from '../types';
import {
    loadSettlements,
    saveSettlement,
    deleteSettlement as firestoreDeleteSettlement,
    subscribeToCollection,
} from '../services/firestoreService';
import { useAuth } from './AuthContext';
import { auditCreate, auditUpdate, auditDelete } from '../data/audit';
import { logger } from '../services/logger';
import { errorHandler, ErrorSeverity } from '../services/errorHandler';

interface SettlementsContextType {
    settlements: Settlement[];
    loading: boolean;
    addSettlement: (settlement: Omit<Settlement, 'id'>) => Promise<string | void>;
    updateSettlement: (id: string, updates: Partial<Settlement>) => Promise<void>;
    deleteSettlement: (id: string, force?: boolean) => Promise<void>;
    refreshSettlements: () => Promise<void>;
}

const SettlementsContext = createContext<SettlementsContextType | undefined>(undefined);

interface SettlementsProviderProps {
    children: ReactNode;
    tenantId: string | null;
    // Dependency injection
    onSettlementCreated?: (settlement: Settlement) => void;
    onSettlementDeleted?: (settlementId: string) => void;
    checkDeleteSafety?: (settlement: Settlement) => Promise<boolean>;
}

export const SettlementsProvider: React.FC<SettlementsProviderProps> = ({
    children,
    tenantId,
    onSettlementCreated,
    onSettlementDeleted,
    checkDeleteSafety,
}) => {
    const { user: authUser } = useAuth();
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    // Real-time subscription
    useEffect(() => {
        if (!tenantId) {
            setSettlements([]);
            setLoading(false);
            return;
        }

        logger.info('[SettlementsContext] Setting up real-time subscription', { tenantId });
        setLoading(true);

        const unsubscribe = subscribeToCollection<Settlement>(
            tenantId,
            'settlements',
            (updatedSettlements) => {
                logger.debug('[SettlementsContext] Received real-time update', {
                    tenantId,
                    count: updatedSettlements.length,
                });
                setSettlements(updatedSettlements);
                setLoading(false);
            },
            (error) => {
                errorHandler.handle(
                    error,
                    { operation: 'subscribe to settlements', tenantId },
                    { severity: ErrorSeverity.MEDIUM, notifyUser: false }
                );
                setLoading(false);
            }
        );

        return () => {
            logger.debug('[SettlementsContext] Cleaning up subscription', { tenantId });
            unsubscribe();
        };
    }, [tenantId]);

    const refreshSettlements = async () => {
        logger.debug('[SettlementsContext] Refresh requested (no-op with real-time)', { tenantId });
    };

    const addSettlement = async (input: Omit<Settlement, 'id'>) => {
        if (!tenantId) return;

        const newSettlementId = Math.random().toString(36).substr(2, 9);
        const newSettlement: Settlement = {
            ...input,
            id: newSettlementId,
            settlementNumber:
                input.settlementNumber ||
                `ST-${new Date().getFullYear()}-${settlements.length + 1001}`,
            createdAt: input.createdAt || new Date().toISOString(),
        };

        // Optimistic update
        setSettlements(prev => [newSettlement, ...prev]);

        try {
            await saveSettlement(tenantId, newSettlement);

            // Audit
            const actorUid = authUser?.uid || 'system';
            const actorRole = authUser?.role || 'viewer';
            await auditCreate(
                tenantId,
                actorUid,
                actorRole,
                'settlement',
                newSettlementId,
                newSettlement,
                `Created settlement ${newSettlement.settlementNumber}`
            );

            // Callbacks
            if (onSettlementCreated) {
                onSettlementCreated(newSettlement);
            }

            logger.info('[SettlementsContext] Settlement created successfully', {
                tenantId,
                settlementId: newSettlementId,
                settlementNumber: newSettlement.settlementNumber,
            });

            return newSettlementId;
        } catch (error) {
            errorHandler.handle(
                error,
                {
                    operation: 'add settlement',
                    tenantId,
                    userId: authUser?.uid,
                },
                { severity: ErrorSeverity.HIGH }
            );
            // Rollback
            setSettlements(prev => prev.filter(s => s.id !== newSettlementId));
            throw error;
        }
    };

    const updateSettlement = async (id: string, updates: Partial<Settlement>) => {
        if (!tenantId) return;

        const oldSettlement = settlements.find(s => s.id === id);
        if (!oldSettlement) throw new Error('Settlement not found');

        const updatedSettlement = {
            ...oldSettlement,
            ...updates,
            updatedAt: new Date().toISOString(),
        };

        // Optimistic update
        setSettlements(prev => prev.map(s => (s.id === id ? updatedSettlement : s)));

        try {
            await saveSettlement(tenantId, updatedSettlement);

            // Audit
            const actorUid = authUser?.uid || 'system';
            const actorRole = authUser?.role || 'viewer';
            await auditUpdate(
                tenantId,
                actorUid,
                actorRole,
                'settlement',
                id,
                oldSettlement,
                updatedSettlement,
                'Updated settlement'
            );

            logger.info('[SettlementsContext] Settlement updated successfully', {
                tenantId,
                settlementId: id,
            });
        } catch (error) {
            errorHandler.handle(
                error,
                {
                    operation: 'update settlement',
                    tenantId,
                    userId: authUser?.uid,
                    metadata: { settlementId: id },
                },
                { severity: ErrorSeverity.HIGH }
            );
            // Rollback
            setSettlements(prev => prev.map(s => (s.id === id ? oldSettlement : s)));
            throw error;
        }
    };

    const deleteSettlement = async (id: string, force: boolean = false) => {
        if (!tenantId) return;

        const settlement = settlements.find(s => s.id === id);
        if (!settlement) return;

        // Safety check
        if (checkDeleteSafety && !force) {
            const isSafe = await checkDeleteSafety(settlement);
            if (!isSafe) return;
        }

        // Optimistic delete
        setSettlements(prev => prev.filter(s => s.id !== id));

        try {
            await firestoreDeleteSettlement(tenantId, id);

            // Callbacks
            if (onSettlementDeleted) {
                onSettlementDeleted(id);
            }

            logger.info('[SettlementsContext] Settlement deleted successfully', {
                tenantId,
                settlementId: id,
            });
        } catch (error) {
            errorHandler.handle(
                error,
                {
                    operation: 'delete settlement',
                    tenantId,
                    userId: authUser?.uid,
                    metadata: { settlementId: id },
                },
                { severity: ErrorSeverity.HIGH }
            );
            // Rollback
            if (settlement) {
                setSettlements(prev => [...prev, settlement]);
            }
            throw error;
        }
    };

    return (
        <SettlementsContext.Provider
            value={{
                settlements,
                loading,
                addSettlement,
                updateSettlement,
                deleteSettlement,
                refreshSettlements,
            }}
        >
            {children}
        </SettlementsContext.Provider>
    );
};

export const useSettlements = () => {
    const context = useContext(SettlementsContext);
    if (context === undefined) {
        throw new Error('useSettlements must be used within a SettlementsProvider');
    }
    return context;
};

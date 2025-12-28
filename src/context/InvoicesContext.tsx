import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Invoice } from '../types';
import {
    loadInvoices,
    saveInvoice,
    deleteInvoice as firestoreDeleteInvoice,
    subscribeToCollection
} from '../services/firestoreService';
import { useAuth } from './AuthContext';
import { auditCreate, auditUpdate, auditDelete } from '../data/audit';
import { triggerInvoiceCreated } from '../services/workflow/workflowEngine';
import { getTasks } from '../services/workflow/taskService';
import { logger } from '../services/logger';
import { errorHandler, ErrorSeverity } from '../services/errorHandler';
import { generateUniqueInvoiceNumber } from '../services/invoiceService';

interface InvoicesContextType {
    invoices: Invoice[];
    loading: boolean;
    addInvoice: (invoice: Omit<Invoice, 'id'>) => Promise<string | void>;
    updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
    deleteInvoice: (id: string, force?: boolean) => Promise<void>;
    refreshInvoices: () => Promise<void>;
}

const InvoicesContext = createContext<InvoicesContextType | undefined>(undefined);

interface InvoicesProviderProps {
    children: ReactNode;
    tenantId: string | null;
    // Dependency injection
    onInvoiceCreated?: (invoice: Invoice) => void;
    onInvoiceDeleted?: (invoiceId: string) => void;
    checkDeleteSafety?: (invoice: Invoice) => Promise<boolean>;
}

export const InvoicesProvider: React.FC<InvoicesProviderProps> = ({
    children,
    tenantId,
    onInvoiceCreated,
    onInvoiceDeleted,
    checkDeleteSafety,
}) => {
    const { user: authUser } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    // Real-time subscription
    useEffect(() => {
        if (!tenantId) {
            setInvoices([]);
            setLoading(false);
            return;
        }

        logger.info('[InvoicesContext] Setting up real-time subscription', { tenantId });
        setLoading(true);

        const unsubscribe = subscribeToCollection<Invoice>(
            tenantId,
            'invoices',
            (updatedInvoices) => {
                logger.debug('[InvoicesContext] Received real-time update', {
                    tenantId,
                    count: updatedInvoices.length,
                });
                setInvoices(updatedInvoices);
                setLoading(false);
            },
            (error) => {
                errorHandler.handle(
                    error,
                    { operation: 'subscribe to invoices', tenantId },
                    { severity: ErrorSeverity.MEDIUM, notifyUser: false }
                );
                setLoading(false);
            }
        );

        return () => {
            logger.debug('[InvoicesContext] Cleaning up subscription', { tenantId });
            unsubscribe();
        };
    }, [tenantId]);

    const refreshInvoices = async () => {
        logger.debug('[InvoicesContext] Refresh requested (no-op with real-time)', { tenantId });
    };

    const addInvoice = async (input: Omit<Invoice, 'id'>) => {
        if (!tenantId) return;

        const newInvoiceId = Math.random().toString(36).substr(2, 9);
        const newInvoice: Invoice = {
            ...input,
            id: newInvoiceId,
            invoiceNumber: input.invoiceNumber || generateUniqueInvoiceNumber(tenantId, invoices),
            createdAt: new Date().toISOString(),
        };

        // Optimistic update
        setInvoices(prev => [newInvoice, ...prev]);

        try {
            await saveInvoice(tenantId, newInvoice);

            // Audit
            const actorUid = authUser?.uid || 'system';
            const actorRole = authUser?.role || 'viewer';
            await auditCreate(
                tenantId,
                actorUid,
                actorRole,
                'invoice',
                newInvoiceId,
                newInvoice,
                `Created invoice ${newInvoice.invoiceNumber}`
            );

            // Workflow
            await triggerInvoiceCreated(tenantId, newInvoice.id, {
                invoiceNumber: newInvoice.invoiceNumber,
                customerName: newInvoice.customerName,
                amount: newInvoice.amount,
                status: newInvoice.status,
                dueDate: newInvoice.dueDate,
                loadIds: newInvoice.loadIds,
            });

            // Callbacks
            if (onInvoiceCreated) {
                onInvoiceCreated(newInvoice);
            }

            logger.info('[InvoicesContext] Invoice created successfully', {
                tenantId,
                invoiceId: newInvoiceId,
                invoiceNumber: newInvoice.invoiceNumber,
            });

            return newInvoiceId;
        } catch (error) {
            errorHandler.handle(
                error,
                {
                    operation: 'add invoice',
                    tenantId,
                    userId: authUser?.uid,
                },
                { severity: ErrorSeverity.HIGH }
            );
            // Rollback
            setInvoices(prev => prev.filter(inv => inv.id !== newInvoiceId));
            throw error;
        }
    };

    const updateInvoice = async (id: string, updates: Partial<Invoice>) => {
        if (!tenantId) return;

        const oldInvoice = invoices.find(inv => inv.id === id);
        if (!oldInvoice) throw new Error('Invoice not found');

        const updatedInvoice = {
            ...oldInvoice,
            ...updates,
            updatedAt: new Date().toISOString(),
        };

        // Optimistic update
        setInvoices(prev => prev.map(inv => inv.id === id ? updatedInvoice : inv));

        try {
            await saveInvoice(tenantId, updatedInvoice);

            // Audit
            const actorUid = authUser?.uid || 'system';
            const actorRole = authUser?.role || 'viewer';
            await auditUpdate(
                tenantId,
                actorUid,
                actorRole,
                'invoice',
                id,
                oldInvoice,
                updatedInvoice,
                'Updated invoice'
            );

            logger.info('[InvoicesContext] Invoice updated successfully', {
                tenantId,
                invoiceId: id,
            });
        } catch (error) {
            errorHandler.handle(
                error,
                {
                    operation: 'update invoice',
                    tenantId,
                    userId: authUser?.uid,
                    metadata: { invoiceId: id },
                },
                { severity: ErrorSeverity.HIGH }
            );
            // Rollback
            setInvoices(prev => prev.map(inv => inv.id === id ? oldInvoice : inv));
            throw error;
        }
    };

    const deleteInvoice = async (id: string, force: boolean = false) => {
        if (!tenantId) return;

        const invoice = invoices.find(inv => inv.id === id);
        if (!invoice) return;

        // Safety check
        if (checkDeleteSafety && !force) {
            const isSafe = await checkDeleteSafety(invoice);
            if (!isSafe) return;
        }

        // Optimistic delete
        setInvoices(prev => prev.filter(inv => inv.id !== id));

        try {
            await firestoreDeleteInvoice(tenantId, id);

            // Callbacks
            if (onInvoiceDeleted) {
                onInvoiceDeleted(id);
            }

            logger.info('[InvoicesContext] Invoice deleted successfully', { tenantId, invoiceId: id });
        } catch (error) {
            errorHandler.handle(
                error,
                {
                    operation: 'delete invoice',
                    tenantId,
                    userId: authUser?.uid,
                    metadata: { invoiceId: id },
                },
                { severity: ErrorSeverity.HIGH }
            );
            // Rollback
            if (invoice) {
                setInvoices(prev => [...prev, invoice]);
            }
            throw error;
        }
    };

    return (
        <InvoicesContext.Provider
            value={{
                invoices,
                loading,
                addInvoice,
                updateInvoice,
                deleteInvoice,
                refreshInvoices,
            }}
        >
            {children}
        </InvoicesContext.Provider>
    );
};

export const useInvoices = () => {
    const context = useContext(InvoicesContext);
    if (context === undefined) {
        throw new Error('useInvoices must be used within an InvoicesProvider');
    }
    return context;
};

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Employee, NewEmployeeInput, Driver, NewDriverInput, EmployeeType } from '../types';
import {
    loadEmployees,
    saveEmployee,
    deleteEmployee as firestoreDeleteEmployee,
    subscribeToCollection,
} from '../services/firestoreService';
import { useAuth } from './AuthContext';
import { auditCreate, auditUpdate, auditDelete } from '../data/audit';
import { logger } from '../services/logger';
import { errorHandler, ErrorSeverity } from '../services/errorHandler';

interface EmployeesContextType {
    employees: Employee[];
    drivers: Driver[]; // Computed: filtered employees
    dispatchers: Employee[]; // Computed: filtered employees
    loading: boolean;
    addEmployee: (employee: NewEmployeeInput) => Promise<string | void>;
    updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
    deleteEmployee: (id: string) => Promise<void>;
    // Legacy driver functions for backward compatibility
    addDriver: (driver: NewDriverInput) => Promise<string | void>;
    updateDriver: (id: string, updates: Partial<Driver>) => Promise<void>;
    deleteDriver: (id: string) => Promise<void>;
    refreshEmployees: () => Promise<void>;
}

const EmployeesContext = createContext<EmployeesContextType | undefined>(undefined);

interface EmployeesProviderProps {
    children: ReactNode;
    tenantId: string | null;
    // Dependency injection
    onEmployeeDeleted?: (employeeId: string) => void;
    checkDeleteSafety?: (employee: Employee) => Promise<boolean>;
}

export const EmployeesProvider: React.FC<EmployeesProviderProps> = ({
    children,
    tenantId,
    onEmployeeDeleted,
    checkDeleteSafety,
}) => {
    const { user: authUser } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    // Computed: Drivers (filtered employees)
    const drivers = useMemo(() => {
        return employees.filter(
            e => e.employeeType === 'driver' || e.employeeType === 'owner_operator'
        ) as Driver[];
    }, [employees]);

    // Computed: Dispatchers (filtered employees)
    const dispatchers = useMemo(() => {
        return employees.filter(e => e.employeeType === 'dispatcher');
    }, [employees]);

    // Real-time subscription
    useEffect(() => {
        if (!tenantId) {
            setEmployees([]);
            setLoading(false);
            return;
        }

        logger.info('[EmployeesContext] Setting up real-time subscription', { tenantId });
        setLoading(true);

        const unsubscribe = subscribeToCollection<Employee>(
            tenantId,
            'employees',
            (updatedEmployees) => {
                logger.debug('[EmployeesContext] Received real-time update', {
                    tenantId,
                    count: updatedEmployees.length,
                });
                setEmployees(updatedEmployees);
                setLoading(false);
            },
            (error) => {
                errorHandler.handle(
                    error,
                    { operation: 'subscribe to employees', tenantId },
                    { severity: ErrorSeverity.MEDIUM, notifyUser: false }
                );
                setLoading(false);
            }
        );

        return () => {
            logger.debug('[EmployeesContext] Cleaning up subscription', { tenantId });
            unsubscribe();
        };
    }, [tenantId]);

    const refreshEmployees = async () => {
        logger.debug('[EmployeesContext] Refresh requested (no-op with real-time)', { tenantId });
    };

    const addEmployee = async (input: NewEmployeeInput) => {
        if (!tenantId) return;

        const newEmployeeId = Math.random().toString(36).substr(2, 9);
        const newEmployee: Employee = {
            ...input,
            id: newEmployeeId,
            employeeNumber: input.employeeNumber || input.driverNumber || `EMP-${employees.length + 101}`,
            employeeType: input.employeeType || 'driver',
            type: input.type || (input.employeeType === 'owner_operator' ? 'OwnerOperator' : 'Company'),
            driverNumber: input.driverNumber || input.employeeNumber,
            createdAt: new Date().toISOString(),
        };

        // Optimistic update
        setEmployees(prev => [...prev, newEmployee]);

        try {
            await saveEmployee(tenantId, newEmployee);

            // Audit
            const actorUid = authUser?.uid || 'system';
            const actorRole = authUser?.role || 'viewer';
            await auditCreate(
                tenantId,
                actorUid,
                actorRole,
                'employee',
                newEmployeeId,
                newEmployee,
                `Created employee ${newEmployee.firstName} ${newEmployee.lastName}`
            );

            logger.info('[EmployeesContext] Employee created successfully', {
                tenantId,
                employeeId: newEmployeeId,
                employeeType: newEmployee.employeeType,
            });

            return newEmployeeId;
        } catch (error) {
            errorHandler.handle(
                error,
                {
                    operation: 'add employee',
                    tenantId,
                    userId: authUser?.uid,
                },
                { severity: ErrorSeverity.HIGH }
            );
            // Rollback
            setEmployees(prev => prev.filter(e => e.id !== newEmployeeId));
            throw error;
        }
    };

    const updateEmployee = async (id: string, updates: Partial<Employee>) => {
        if (!tenantId) return;

        const oldEmployee = employees.find(e => e.id === id);
        if (!oldEmployee) throw new Error('Employee not found');

        const updatedEmployee = {
            ...oldEmployee,
            ...updates,
            driverNumber: updates.employeeNumber || oldEmployee.employeeNumber || oldEmployee.driverNumber,
            employeeNumber: updates.employeeNumber || oldEmployee.employeeNumber || oldEmployee.driverNumber,
            type:
                updates.type ||
                (updates.employeeType === 'owner_operator' ? 'OwnerOperator' : 'Company') ||
                oldEmployee.type,
            updatedAt: new Date().toISOString(),
        };

        // Optimistic update
        setEmployees(prev => prev.map(emp => (emp.id === id ? updatedEmployee : emp)));

        try {
            await saveEmployee(tenantId, updatedEmployee);

            // Audit
            const actorUid = authUser?.uid || 'system';
            const actorRole = authUser?.role || 'viewer';
            await auditUpdate(
                tenantId,
                actorUid,
                actorRole,
                'employee',
                id,
                oldEmployee,
                updatedEmployee,
                'Updated employee'
            );

            logger.info('[EmployeesContext] Employee updated successfully', {
                tenantId,
                employeeId: id,
            });
        } catch (error) {
            errorHandler.handle(
                error,
                {
                    operation: 'update employee',
                    tenantId,
                    userId: authUser?.uid,
                    metadata: { employeeId: id },
                },
                { severity: ErrorSeverity.HIGH }
            );
            // Rollback
            setEmployees(prev => prev.map(emp => (emp.id === id ? oldEmployee : emp)));
            throw error;
        }
    };

    const deleteEmployee = async (id: string) => {
        if (!tenantId) return;

        const employee = employees.find(e => e.id === id);
        if (!employee) return;

        // Safety check
        if (checkDeleteSafety) {
            const isSafe = await checkDeleteSafety(employee);
            if (!isSafe) return;
        }

        // Optimistic delete
        setEmployees(prev => prev.filter(e => e.id !== id));

        try {
            await firestoreDeleteEmployee(tenantId, id);

            // Callbacks
            if (onEmployeeDeleted) {
                onEmployeeDeleted(id);
            }

            logger.info('[EmployeesContext] Employee deleted successfully', {
                tenantId,
                employeeId: id,
            });
        } catch (error) {
            errorHandler.handle(
                error,
                {
                    operation: 'delete employee',
                    tenantId,
                    userId: authUser?.uid,
                    metadata: { employeeId: id },
                },
                { severity: ErrorSeverity.HIGH }
            );
            // Rollback
            if (employee) {
                setEmployees(prev => [...prev, employee]);
            }
            throw error;
        }
    };

    // Legacy driver functions (for backward compatibility)
    const addDriver = async (input: NewDriverInput) => {
        return addEmployee({
            ...input,
            employeeType: input.type === 'OwnerOperator' ? 'owner_operator' : 'driver',
            employeeNumber: input.driverNumber,
        });
    };

    const updateDriver = async (id: string, updates: Partial<Driver>) => {
        return updateEmployee(id, {
            ...updates,
            employeeType: updates.type === 'OwnerOperator' ? 'owner_operator' : 'driver',
            employeeNumber: updates.driverNumber || updates.employeeNumber,
        });
    };

    const deleteDriver = async (id: string) => {
        return deleteEmployee(id);
    };

    return (
        <EmployeesContext.Provider
            value={{
                employees,
                drivers,
                dispatchers,
                loading,
                addEmployee,
                updateEmployee,
                deleteEmployee,
                addDriver,
                updateDriver,
                deleteDriver,
                refreshEmployees,
            }}
        >
            {children}
        </EmployeesContext.Provider>
    );
};

export const useEmployees = () => {
    const context = useContext(EmployeesContext);
    if (context === undefined) {
        throw new Error('useEmployees must be used within an EmployeesProvider');
    }
    return context;
};

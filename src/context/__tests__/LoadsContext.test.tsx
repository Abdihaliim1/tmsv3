/**
 * Tests for LoadsContext
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { LoadsProvider, useLoads } from '../LoadsContext';
import { LoadStatus } from '../../types';
import * as firestoreService from '../../services/firestoreService';

// Mock dependencies
vi.mock('../../services/firestoreService');
vi.mock('../AuthContext', () => ({
    useAuth: () => ({ user: { uid: 'test-user', role: 'admin' } }),
}));
vi.mock('../../data/audit');
vi.mock('../../services/workflow/workflowEngine');

describe('LoadsContext', () => {
    const mockTenantId = 'test-tenant';
    const mockLoad = {
        id: 'load-1',
        loadNumber: 'LD-2025-301',
        status: LoadStatus.Available,
        rate: 1000,
        miles: 500,
        customerName: 'Test Customer',
        originCity: 'Chicago',
        originState: 'IL',
        destCity: 'Dallas',
        destState: 'TX',
        createdAt: new Date().toISOString(),
        createdBy: 'test-user',
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock subscribeToCollection to return empty array and unsubscribe function
        vi.mocked(firestoreService.subscribeToCollection).mockImplementation(
            (_tenantId, _collection, onUpdate) => {
                onUpdate([]);
                return () => { };
            }
        );
    });

    it('should provide loads context', () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <LoadsProvider tenantId={mockTenantId}>{children}</LoadsProvider>
        );

        const { result } = renderHook(() => useLoads(), { wrapper });

        expect(result.current).toBeDefined();
        expect(result.current.loads).toEqual([]);
        expect(result.current.loading).toBe(false);
    });

    it('should add a load', async () => {
        vi.mocked(firestoreService.saveLoad).mockResolvedValue();

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <LoadsProvider tenantId={mockTenantId}>{children}</LoadsProvider>
        );

        const { result } = renderHook(() => useLoads(), { wrapper });

        await act(async () => {
            await result.current.addLoad({
                status: LoadStatus.Available,
                rate: 1000,
                miles: 500,
                customerName: 'Test Customer',
                originCity: 'Chicago',
                originState: 'IL',
                destCity: 'Dallas',
                destState: 'TX',
            });
        });

        expect(firestoreService.saveLoad).toHaveBeenCalled();
    });

    it('should update a load', async () => {
        // Setup: Add a load first
        vi.mocked(firestoreService.subscribeToCollection).mockImplementation(
            (_tenantId, _collection, onUpdate) => {
                onUpdate([mockLoad]);
                return () => { };
            }
        );
        vi.mocked(firestoreService.saveLoad).mockResolvedValue();

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <LoadsProvider tenantId={mockTenantId}>{children}</LoadsProvider>
        );

        const { result } = renderHook(() => useLoads(), { wrapper });

        await waitFor(() => {
            expect(result.current.loads.length).toBe(1);
        });

        await act(async () => {
            await result.current.updateLoad('load-1', { status: LoadStatus.Dispatched });
        });

        expect(firestoreService.saveLoad).toHaveBeenCalled();
    });

    it('should delete a load', async () => {
        vi.mocked(firestoreService.subscribeToCollection).mockImplementation(
            (_tenantId, _collection, onUpdate) => {
                onUpdate([mockLoad]);
                return () => { };
            }
        );
        vi.mocked(firestoreService.deleteLoad).mockResolvedValue();

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <LoadsProvider tenantId={mockTenantId}>{children}</LoadsProvider>
        );

        const { result } = renderHook(() => useLoads(), { wrapper });

        await waitFor(() => {
            expect(result.current.loads.length).toBe(1);
        });

        await act(async () => {
            await result.current.deleteLoad('load-1', true);
        });

        expect(firestoreService.deleteLoad).toHaveBeenCalledWith(mockTenantId, 'load-1');
    });

    it('should rollback on add error', async () => {
        vi.mocked(firestoreService.saveLoad).mockRejectedValue(new Error('Save failed'));

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <LoadsProvider tenantId={mockTenantId}>{children}</LoadsProvider>
        );

        const { result } = renderHook(() => useLoads(), { wrapper });

        await expect(async () => {
            await act(async () => {
                await result.current.addLoad({
                    status: LoadStatus.Available,
                    rate: 1000,
                    miles: 500,
                    customerName: 'Test Customer',
                    originCity: 'Chicago',
                    originState: 'IL',
                    destCity: 'Dallas',
                    destState: 'TX',
                });
            });
        }).rejects.toThrow();

        // Should rollback - loads should still be empty
        expect(result.current.loads).toEqual([]);
    });
});

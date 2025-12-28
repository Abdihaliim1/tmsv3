/**
 * Test Utilities
 * Common utilities for testing TMS components
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { TMSProvider } from '../context/TMSContext';
import { AuthProvider } from '../context/AuthContext';
import { CompanyProvider } from '../context/CompanyContext';
import { TenantProvider } from '../context/TenantContext';

/**
 * Custom render function with all providers
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  function AllTheProviders({ children }: { children: React.ReactNode }) {
    return (
      <TenantProvider>
        <CompanyProvider>
          <AuthProvider>
            <TMSProvider>
              {children}
            </TMSProvider>
          </AuthProvider>
        </CompanyProvider>
      </TenantProvider>
    );
  }

  return render(ui, { wrapper: AllTheProviders, ...options });
}

/**
 * Mock data generators for tests
 */
export const mockLoad = (overrides?: any) => ({
  id: 'load-1',
  loadNumber: 'LD-2025-001',
  status: 'available',
  originCity: 'Columbus',
  originState: 'OH',
  destCity: 'Chicago',
  destState: 'IL',
  rate: 1000,
  miles: 300,
  pickupDate: '2025-01-15',
  deliveryDate: '2025-01-16',
  createdAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

export const mockDriver = (overrides?: any) => ({
  id: 'driver-1',
  firstName: 'John',
  lastName: 'Doe',
  employeeType: 'driver',
  type: 'Company',
  status: 'active',
  payment: {
    type: 'percentage',
    percentage: 0.35,
  },
  createdAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Wait for async operations
 */
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));



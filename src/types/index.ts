/**
 * Types Index
 * 
 * Re-exports all types for backward compatibility.
 * Import from here or directly from domain files.
 * 
 * Usage:
 *   import { Load, Driver } from '@/types';
 *   // or
 *   import { Load } from '@/types/load';
 *   import { Driver } from '@/types/employee';
 */

// Shared types
export * from './shared';

// Domain types
export * from './tenant';
export * from './load';
export * from './employee';
export * from './fleet';
export * from './invoice';
export * from './settlement';
export * from './expense';
export * from './workflow';
export * from './plannedLoad';
// Customer module - rename exports to avoid conflict with plannedLoad.ts
export {
  type Customer as CustomerEntity,
  type NewCustomerInput,
  type CustomerSearchResult,
  type CustomerFilterOptions,
  type CustomerType as CustomerEntityType
} from './customer';

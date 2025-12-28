/**
 * Tenant Utilities - Single Domain Multi-Tenant
 * 
 * Helper functions for tenant operations
 * NO subdomain/hostname parsing - tenant is resolved from user memberships
 */

/**
 * Get tenant storage path (for Firebase Storage)
 */
export const getTenantStoragePath = (tenantId: string, path: string = ''): string => {
  return `tenants/${tenantId}/${path}`.replace(/\/+/g, '/').replace(/\/$/, '');
};

/**
 * Get Firestore collection path for tenant
 */
export const getTenantCollectionPath = (tenantId: string, collection: string): string => {
  return `tenants/${tenantId}/${collection}`;
};

/**
 * SessionStorage keys for tenant persistence
 */
export const TENANT_STORAGE_KEYS = {
  ACTIVE_TENANT_ID: 'somtms_activeTenantId',
  REDIRECT_AFTER_SELECT: 'somtms_redirectAfterTenantSelect',
} as const;

/**
 * Role-Based Access Control (RBAC) Service
 * 
 * Defines roles, permissions, and access control checks
 */

export type UserRole = 'admin' | 'dispatcher' | 'driver' | 'accountant' | 'viewer';

export interface Permission {
  resource: string;
  actions: string[];
}

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}

/**
 * Permission definitions
 */
const PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    role: 'admin',
    permissions: [
      { resource: 'loads', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'drivers', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'invoices', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'settlements', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'expenses', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'fleet', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'reports', actions: ['read'] },
      { resource: 'settings', actions: ['read', 'update'] },
      { resource: 'tasks', actions: ['read', 'update', 'delete'] },
    ],
  },
  dispatcher: {
    role: 'dispatcher',
    permissions: [
      { resource: 'loads', actions: ['create', 'read', 'update'] },
      { resource: 'drivers', actions: ['read'] },
      { resource: 'invoices', actions: ['read'] },
      { resource: 'settlements', actions: ['read'] },
      { resource: 'expenses', actions: ['read'] },
      { resource: 'fleet', actions: ['read'] },
      { resource: 'reports', actions: ['read'] },
      { resource: 'tasks', actions: ['read', 'update'] },
    ],
  },
  driver: {
    role: 'driver',
    permissions: [
      { resource: 'loads', actions: ['read'] },
      { resource: 'settlements', actions: ['read'] },
      { resource: 'tasks', actions: ['read', 'update'] },
    ],
  },
  accountant: {
    role: 'accountant',
    permissions: [
      { resource: 'loads', actions: ['read'] },
      { resource: 'invoices', actions: ['create', 'read', 'update'] },
      { resource: 'settlements', actions: ['create', 'read', 'update'] },
      { resource: 'expenses', actions: ['create', 'read', 'update'] },
      { resource: 'reports', actions: ['read'] },
      { resource: 'tasks', actions: ['read', 'update'] },
    ],
  },
  viewer: {
    role: 'viewer',
    permissions: [
      { resource: 'loads', actions: ['read'] },
      { resource: 'drivers', actions: ['read'] },
      { resource: 'invoices', actions: ['read'] },
      { resource: 'settlements', actions: ['read'] },
      { resource: 'expenses', actions: ['read'] },
      { resource: 'fleet', actions: ['read'] },
      { resource: 'reports', actions: ['read'] },
    ],
  },
};

/**
 * Check if user has permission for an action on a resource
 */
export function hasPermission(
  role: UserRole,
  resource: string,
  action: string
): boolean {
  const rolePerms = PERMISSIONS[role];
  if (!rolePerms) return false;

  const resourcePerm = rolePerms.permissions.find(p => p.resource === resource);
  if (!resourcePerm) return false;

  return resourcePerm.actions.includes(action);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return PERMISSIONS[role]?.permissions || [];
}

/**
 * Check if user can access a page/route
 */
export function canAccessPage(role: UserRole, page: string): boolean {
  // Admin can access everything
  if (role === 'admin') return true;

  // Map pages to resources
  const pageResourceMap: Record<string, string> = {
    'Dashboard': 'loads',
    'Loads': 'loads',
    'Drivers': 'drivers',
    'Fleet': 'fleet',
    'Expenses': 'expenses',
    'Settlements': 'settlements',
    'Reports': 'reports',
    'AccountReceivables': 'invoices',
    'Tasks': 'tasks',
    'Settings': 'settings',
    'Import': 'loads',
  };

  const resource = pageResourceMap[page] || page.toLowerCase();
  return hasPermission(role, resource, 'read');
}

/**
 * Check if user can perform action (used in UI components)
 */
export function canPerformAction(
  role: UserRole,
  resource: string,
  action: string
): boolean {
  return hasPermission(role, resource, action);
}


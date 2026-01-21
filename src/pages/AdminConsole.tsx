/**
 * Admin Console - Platform Admin Only
 * 
 * Features:
 * - Search and list all companies
 * - Enter company (impersonation mode)
 * - Global issues overview
 * - Support tools
 */

import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { isPlatformAdmin, hasPermission } from '../services/rbac';
import {
  Building2,
  Search,
  Users,
  AlertTriangle,
  FileWarning,
  Clock,
  ArrowRight,
  Shield,
  ShieldAlert,
  Activity,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  Lock
} from 'lucide-react';

interface TenantIndexEntry {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt?: string;
  userCount?: number;
  lastActivityAt?: string;
  mcNumber?: string;
  dotNumber?: string;
}

interface GlobalIssue {
  type: 'missing_pod' | 'overdue_invoice' | 'sync_error' | 'membership_error';
  count: number;
  tenants: string[];
}

interface AdminConsoleProps {
  onNavigate: (page: string) => void;
  selectTenant?: (tenantId: string) => Promise<void>;
}

const AdminConsole: React.FC<AdminConsoleProps> = ({ onNavigate, selectTenant }) => {
  const { user, role } = useAuth();

  const [tenants, setTenants] = useState<TenantIndexEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<TenantIndexEntry | null>(null);
  const [globalIssues, setGlobalIssues] = useState<GlobalIssue[]>([]);
  const [isEntering, setIsEntering] = useState(false);

  // RBAC Check - Only admins can access this page
  const isAdmin = isPlatformAdmin(role);
  const canManageTenants = hasPermission(role, 'admin', 'manage_tenants');
  const canImpersonate = hasPermission(role, 'admin', 'impersonate');

  // Load all tenants from tenantsIndex (only if admin)
  useEffect(() => {
    if (isAdmin) {
      loadTenants();
    }
  }, [isAdmin]);

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      // Try tenantsIndex first, fall back to tenants collection
      let tenantsData: TenantIndexEntry[] = [];
      
      // Try tenantsIndex
      const indexSnapshot = await getDocs(collection(db, 'tenantsIndex'));
      if (!indexSnapshot.empty) {
        indexSnapshot.forEach((doc) => {
          const data = doc.data();
          tenantsData.push({
            id: doc.id,
            name: data.name || 'Unknown',
            status: data.status || 'active',
            createdAt: data.createdAt,
            userCount: data.userCount || 0,
            lastActivityAt: data.lastActivityAt,
            mcNumber: data.mcNumber,
            dotNumber: data.dotNumber,
          });
        });
      } else {
        // Fall back to tenants collection
        const tenantsSnapshot = await getDocs(collection(db, 'tenants'));
        tenantsSnapshot.forEach((doc) => {
          const data = doc.data();
          tenantsData.push({
            id: doc.id,
            name: data.name || 'Unknown',
            status: data.status || 'active',
            createdAt: data.createdAt,
            userCount: 0,
            mcNumber: data.mcNumber,
            dotNumber: data.dotNumber,
          });
        });
      }

      setTenants(tenantsData);

      // Mock global issues for now (would come from aggregation in production)
      setGlobalIssues([
        { type: 'missing_pod', count: 12, tenants: ['ats-freight', 'sars-logistics'] },
        { type: 'overdue_invoice', count: 5, tenants: ['ats-freight'] },
        { type: 'sync_error', count: 0, tenants: [] },
        { type: 'membership_error', count: 1, tenants: ['sars-logistics'] },
      ]);
    } catch (error) {
      console.error('Error loading tenants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter tenants by search
  const filteredTenants = useMemo(() => {
    if (!searchTerm) return tenants;
    const term = searchTerm.toLowerCase();
    return tenants.filter(t => 
      t.name.toLowerCase().includes(term) ||
      t.id.toLowerCase().includes(term) ||
      t.mcNumber?.toLowerCase().includes(term) ||
      t.dotNumber?.toLowerCase().includes(term)
    );
  }, [tenants, searchTerm]);

  // Enter company (admin impersonation)
  const handleEnterCompany = async (tenant: TenantIndexEntry) => {
    setIsEntering(true);
    try {
      // Store admin mode flag
      sessionStorage.setItem('somtms_adminMode', 'true');
      sessionStorage.setItem('somtms_adminViewingTenant', tenant.id);
      sessionStorage.setItem('somtms_adminViewingTenantName', tenant.name);
      sessionStorage.setItem('somtms_activeTenantId', tenant.id);
      
      // Select the tenant if function available, otherwise reload
      if (selectTenant) {
        await selectTenant(tenant.id);
        onNavigate('Dashboard');
      } else {
        // Reload to re-initialize with new tenant
        window.location.reload();
      }
    } catch (error) {
      console.error('Error entering company:', error);
      // Fallback: reload the page
      window.location.reload();
    } finally {
      setIsEntering(false);
    }
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'missing_pod': return <FileWarning className="text-orange-500" size={20} />;
      case 'overdue_invoice': return <Clock className="text-red-500" size={20} />;
      case 'sync_error': return <AlertTriangle className="text-yellow-500" size={20} />;
      case 'membership_error': return <Users className="text-purple-500" size={20} />;
      default: return <AlertTriangle size={20} />;
    }
  };

  const getIssueLabel = (type: string) => {
    switch (type) {
      case 'missing_pod': return 'Missing POD';
      case 'overdue_invoice': return 'Overdue Invoices';
      case 'sync_error': return 'Sync Errors';
      case 'membership_error': return 'Membership Issues';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Active</span>;
      case 'suspended':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Suspended</span>;
      case 'inactive':
        return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">Inactive</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">{status}</span>;
    }
  };

  // Access Denied Screen for non-admins
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-6">
            You don't have permission to access the Admin Console.
            This area is restricted to platform administrators only.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mb-6">
            <Lock size={14} />
            <span>Your role: <span className="font-medium capitalize">{role}</span></span>
          </div>
          <button
            onClick={() => onNavigate('Dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Admin Header */}
      <header className="bg-slate-900 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-400" size={28} />
            <div>
              <h1 className="text-xl font-bold">Admin Console</h1>
              <p className="text-slate-400 text-sm">Platform Administration</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              Logged in as <span className="text-white font-medium">{user?.email}</span>
            </span>
            <button
              onClick={loadTenants}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Global Issues Overview */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Activity size={20} />
            Global Issues Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {globalIssues.map((issue) => (
              <div
                key={issue.type}
                className={`bg-white rounded-xl p-4 border ${
                  issue.count > 0 ? 'border-orange-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  {getIssueIcon(issue.type)}
                  <span className={`text-2xl font-bold ${
                    issue.count > 0 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {issue.count}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-700">{getIssueLabel(issue.type)}</p>
                {issue.count > 0 && issue.tenants.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    in {issue.tenants.slice(0, 2).join(', ')}
                    {issue.tenants.length > 2 && ` +${issue.tenants.length - 2} more`}
                  </p>
                )}
                {issue.count === 0 && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle size={12} /> All clear
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Company Search & List */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Building2 size={20} />
                Companies ({tenants.length})
              </h2>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, tenant ID, MC#, or DOT#..."
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Company List */}
          <div className="divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-slate-600">Loading companies...</p>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="p-8 text-center">
                <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-600">
                  {searchTerm ? 'No companies match your search' : 'No companies found'}
                </p>
              </div>
            ) : (
              filteredTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900">{tenant.name}</h3>
                        {getStatusBadge(tenant.status)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                          {tenant.id}
                        </span>
                        {tenant.mcNumber && <span>MC# {tenant.mcNumber}</span>}
                        {tenant.dotNumber && <span>DOT# {tenant.dotNumber}</span>}
                        {tenant.userCount !== undefined && (
                          <span className="flex items-center gap-1">
                            <Users size={14} /> {tenant.userCount} users
                          </span>
                        )}
                        {tenant.createdAt && (
                          <span className="flex items-center gap-1">
                            <Calendar size={14} /> {new Date(tenant.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTenant(tenant)}
                        className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        View Details
                      </button>
                      {canImpersonate && (
                        <button
                          onClick={() => handleEnterCompany(tenant)}
                          disabled={isEntering}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          {isEntering ? 'Entering...' : 'Enter Company'}
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Selected Tenant Details Modal */}
        {selectedTenant && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedTenant.name}</h2>
                  <p className="text-sm text-slate-500 font-mono">{selectedTenant.id}</p>
                </div>
                <button
                  onClick={() => setSelectedTenant(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <XCircle size={20} className="text-slate-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-500">Status</label>
                    <p className="mt-1">{getStatusBadge(selectedTenant.status)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-500">Users</label>
                    <p className="mt-1 text-slate-900">{selectedTenant.userCount || 0}</p>
                  </div>
                  {selectedTenant.mcNumber && (
                    <div>
                      <label className="text-sm font-medium text-slate-500">MC Number</label>
                      <p className="mt-1 text-slate-900">{selectedTenant.mcNumber}</p>
                    </div>
                  )}
                  {selectedTenant.dotNumber && (
                    <div>
                      <label className="text-sm font-medium text-slate-500">DOT Number</label>
                      <p className="mt-1 text-slate-900">{selectedTenant.dotNumber}</p>
                    </div>
                  )}
                  {selectedTenant.createdAt && (
                    <div>
                      <label className="text-sm font-medium text-slate-500">Created</label>
                      <p className="mt-1 text-slate-900">
                        {new Date(selectedTenant.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-200 flex gap-3">
                  {canImpersonate ? (
                    <button
                      onClick={() => {
                        setSelectedTenant(null);
                        handleEnterCompany(selectedTenant);
                      }}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      Enter Company <ArrowRight size={18} />
                    </button>
                  ) : (
                    <div className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center gap-2 text-sm">
                      <Lock size={16} /> Impersonation not permitted
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminConsole;


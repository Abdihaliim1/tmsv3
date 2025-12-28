/**
 * Company Selection Page
 * 
 * Shown when user has multiple company memberships
 * Allows user to select which company to access
 */

import React, { useEffect } from 'react';
import { Building2, Check, ArrowRight } from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { PageType } from '../App';

interface SelectCompanyProps {
  onNavigate?: (page: PageType) => void;
}

const SelectCompany: React.FC<SelectCompanyProps> = ({ onNavigate }) => {
  const { memberships, selectTenant, isLoading, error } = useTenant();
  const { user } = useAuth();
  const [selecting, setSelecting] = React.useState<string | null>(null);

  // Auto-redirect if only one membership
  useEffect(() => {
    if (memberships.length === 1 && !isLoading) {
      selectTenant(memberships[0].tenantId).then(() => {
        if (onNavigate) {
          onNavigate('Dashboard');
        }
      });
    }
  }, [memberships, isLoading, selectTenant, onNavigate]);

  const handleSelect = async (tenantId: string) => {
    setSelecting(tenantId);
    try {
      await selectTenant(tenantId);
      if (onNavigate) {
        onNavigate('Dashboard');
      }
    } catch (err) {
      console.error('Error selecting company:', err);
    } finally {
      setSelecting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-slate-600">Loading companies...</p>
        </div>
      </div>
    );
  }

  if (error && memberships.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <Building2 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">No Company Access</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <p className="text-sm text-slate-500">
            Please contact your administrator to grant you access to a company.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Select Company</h1>
          <p className="text-slate-600">
            {user?.displayName || user?.email}, you have access to {memberships.length} {memberships.length === 1 ? 'company' : 'companies'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memberships.map((membership) => (
            <button
              key={membership.tenantId}
              onClick={() => handleSelect(membership.tenantId)}
              disabled={selecting === membership.tenantId}
              className="bg-white rounded-lg border-2 border-slate-200 p-6 hover:border-blue-500 hover:shadow-md transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-lg">{membership.tenantName}</h3>
                    <p className="text-sm text-slate-500 capitalize">{membership.role}</p>
                  </div>
                </div>
                {selecting === membership.tenantId ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                ) : (
                  <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                )}
              </div>
              {membership.joinedAt && (
                <p className="text-xs text-slate-400">
                  Member since {new Date(membership.joinedAt).toLocaleDateString()}
                </p>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectCompany;



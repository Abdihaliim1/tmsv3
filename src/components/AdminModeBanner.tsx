/**
 * Admin Mode Banner
 * 
 * Shows when a platform admin is viewing a company in "impersonation" mode.
 * Provides a way to exit back to Admin Console.
 */

import React from 'react';
import { Shield, X, ArrowLeft } from 'lucide-react';

interface AdminModeBannerProps {
  companyName: string;
  onExit: () => void;
}

const AdminModeBanner: React.FC<AdminModeBannerProps> = ({ companyName, onExit }) => {
  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between z-50 fixed top-0 left-0 right-0">
      <div className="flex items-center gap-3">
        <Shield size={18} className="text-amber-800" />
        <span className="font-medium text-sm">
          ADMIN MODE: Viewing <span className="font-bold">{companyName}</span>
        </span>
      </div>
      <button
        onClick={onExit}
        className="flex items-center gap-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <ArrowLeft size={16} />
        Exit Admin Mode
      </button>
    </div>
  );
};

export default AdminModeBanner;

/**
 * Helper functions for admin mode
 */
export const isAdminMode = (): boolean => {
  return sessionStorage.getItem('somtms_adminMode') === 'true';
};

export const getAdminViewingTenant = (): { id: string; name: string } | null => {
  const id = sessionStorage.getItem('somtms_adminViewingTenant');
  const name = sessionStorage.getItem('somtms_adminViewingTenantName');
  if (id && name) {
    return { id, name };
  }
  return null;
};

export const exitAdminMode = (): void => {
  sessionStorage.removeItem('somtms_adminMode');
  sessionStorage.removeItem('somtms_adminViewingTenant');
  sessionStorage.removeItem('somtms_adminViewingTenantName');
  sessionStorage.removeItem('somtms_activeTenantId');
};



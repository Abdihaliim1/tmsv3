
import React, { useState, useEffect, Suspense, lazy } from 'react';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import AdminModeBanner, { isAdminMode, getAdminViewingTenant, exitAdminMode } from './components/AdminModeBanner';
import { TMSProvider } from './context/TMSContext';
import { TenantProvider, useTenant } from './context/TenantContext';
import { CompanyProvider } from './context/CompanyContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { setupGlobalErrorHandlers } from './services/errorLogger';
import { canAccessPage } from './services/rbac';

// Lazy load pages for code splitting - reduces initial bundle size
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Loads = lazy(() => import('./pages/Loads'));
const Drivers = lazy(() => import('./pages/Drivers'));
const Fleet = lazy(() => import('./pages/Fleet'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Settlements = lazy(() => import('./pages/Settlements'));
const Reports = lazy(() => import('./pages/Reports'));
const AccountReceivables = lazy(() => import('./pages/AccountReceivables'));
const Import = lazy(() => import('./pages/Import'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Tasks = lazy(() => import('./pages/Tasks'));
const DispatchBoard = lazy(() => import('./pages/DispatchBoard'));
const AdminConsole = lazy(() => import('./pages/AdminConsole'));
const SelectCompany = lazy(() => import('./pages/SelectCompany'));
// New pages for restructured navigation
const LoadPlanner = lazy(() => import('./pages/LoadPlanner'));
const Trips = lazy(() => import('./pages/Trips'));
const Invoices = lazy(() => import('./pages/Invoices'));
const ReportsCombined = lazy(() => import('./pages/ReportsCombined'));
const SettingsMore = lazy(() => import('./pages/SettingsMore'));

// Loading fallback component for Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
      <p className="text-slate-500 text-sm">Loading...</p>
    </div>
  </div>
);

export type PageType = 'Dashboard' | 'Loads' | 'DispatchBoard' | 'Drivers' | 'Fleet' | 'Expenses' | 'Settlements' | 'Reports' | 'AccountReceivables' | 'Tasks' | 'Import' | 'Settings' | 'SelectCompany' | 'AdminConsole' | 'LoadPlanner' | 'Trips' | 'Invoices' | 'ReportsCombined' | 'SettingsMore';

// Setup global error handlers
setupGlobalErrorHandlers();

/**
 * Main app content - requires AuthProvider and TenantProvider to be available
 */
function MainAppContent() {
  const [currentPage, setCurrentPage] = useState<PageType>('Dashboard');
  const { user, logout } = useAuth();
  const { activeTenantId, isLoading: tenantLoading, error: tenantError, isPlatformAdmin, selectTenant } = useTenant();

  // Check if in admin mode (viewing a company)
  const [adminModeInfo, setAdminModeInfo] = useState<{ id: string; name: string } | null>(null);
  
  useEffect(() => {
    if (isAdminMode()) {
      setAdminModeInfo(getAdminViewingTenant());
    } else {
      setAdminModeInfo(null);
    }
  }, [currentPage, activeTenantId]);

  // Handle exit admin mode
  const handleExitAdminMode = () => {
    exitAdminMode();
    setAdminModeInfo(null);
    setCurrentPage('AdminConsole');
    window.location.reload();
  };

  // ========================================
  // TENANT LOADING STATE
  // ========================================
  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // ========================================
  // PLATFORM ADMIN → ADMIN CONSOLE (if no tenant selected)
  // ========================================
  if (isPlatformAdmin && !activeTenantId && currentPage !== 'AdminConsole') {
    return <AdminConsole onNavigate={(page) => setCurrentPage(page as PageType)} selectTenant={selectTenant} />;
  }

  // ========================================
  // ADMIN CONSOLE PAGE (admin only)
  // ========================================
  if (currentPage === 'AdminConsole') {
    if (isPlatformAdmin) {
      return <AdminConsole onNavigate={(page) => setCurrentPage(page as PageType)} selectTenant={selectTenant} />;
    } else {
      // Non-admins redirect to dashboard
      setTimeout(() => setCurrentPage('Dashboard'), 0);
      return null;
    }
  }

  // ========================================
  // NO ACCESS → BLOCK MESSAGE (for non-admins only)
  // ========================================
  if ((tenantError || !activeTenantId) && !isPlatformAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">No Access</h2>
          <p className="text-slate-600 mb-6">
            {tenantError || 'Your account is not associated with any company. Please contact support for assistance.'}
          </p>
          <button
            onClick={() => logout()}
            className="w-full py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
          >
            Sign Out
          </button>
          <p className="text-sm text-slate-500 mt-4">
            Need help? Contact <a href="mailto:support@somtms.com" className="text-blue-600 hover:underline">support@somtms.com</a>
          </p>
        </div>
      </div>
    );
  }

  // If still no tenant for admin, show admin console
  if (!activeTenantId && isPlatformAdmin) {
    return <AdminConsole onNavigate={(page) => setCurrentPage(page as PageType)} selectTenant={selectTenant} />;
  }

  // ========================================
  // RBAC: PAGE ACCESS CHECK
  // ========================================
  const userRole = user?.role || 'admin';
  if (!canAccessPage(userRole, currentPage)) {
    return (
      <CompanyProvider>
        <TMSProvider tenantId={activeTenantId}>
          <ErrorBoundary>
            {adminModeInfo && (
              <AdminModeBanner 
                companyName={adminModeInfo.name} 
                onExit={handleExitAdminMode} 
              />
            )}
            <Layout currentPage={currentPage} onNavigate={setCurrentPage} hasAdminBanner={!!adminModeInfo}>
              <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
                <p className="text-slate-600">You don't have permission to access this page.</p>
                <button
                  onClick={() => setCurrentPage('Dashboard')}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Go to Dashboard
                </button>
              </div>
            </Layout>
          </ErrorBoundary>
        </TMSProvider>
      </CompanyProvider>
    );
  }

  // ========================================
  // MAIN APP RENDER
  // ========================================
  const renderPage = () => {
    const pageContent = (() => {
      switch (currentPage) {
        case 'Dashboard': return <Dashboard onNavigate={setCurrentPage} />;
        case 'Loads': return <Loads onNavigate={setCurrentPage} />;
        case 'DispatchBoard': return <DispatchBoard />;
        case 'Drivers': return <Drivers />;
        case 'Fleet': return <Fleet />;
        case 'Expenses': return <Expenses />;
        case 'Settlements': return <Settlements />;
        case 'Reports': return <Reports />;
        case 'AccountReceivables': return <AccountReceivables />;
        case 'Tasks': return <Tasks />;
        case 'Import': return <Import />;
        case 'Settings': return <Settings />;
        case 'SelectCompany': return <SelectCompany onNavigate={setCurrentPage} />;
        // New pages for restructured navigation
        case 'LoadPlanner': return <LoadPlanner onNavigate={setCurrentPage} />;
        case 'Trips': return <Trips />;
        case 'Invoices': return <Invoices />;
        case 'ReportsCombined': return <ReportsCombined />;
        case 'SettingsMore': return <SettingsMore />;
        default: return <Dashboard onNavigate={setCurrentPage} />;
      }
    })();

    return <Suspense fallback={<PageLoader />}>{pageContent}</Suspense>;
  };

  return (
    <CompanyProvider>
      <TMSProvider tenantId={activeTenantId}>
        <ErrorBoundary>
          {/* Admin Mode Banner */}
          {adminModeInfo && (
            <AdminModeBanner 
              companyName={adminModeInfo.name} 
              onExit={handleExitAdminMode} 
            />
          )}
          <Layout currentPage={currentPage} onNavigate={setCurrentPage} hasAdminBanner={!!adminModeInfo}>
            {renderPage()}
          </Layout>
        </ErrorBoundary>
      </TMSProvider>
    </CompanyProvider>
  );
}

/**
 * Auth-gated content - shows login if not authenticated
 */
function AuthGatedContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    );
  }

  // User is authenticated - show main app with tenant context
  return (
    <TenantProvider>
      <MainAppContent />
    </TenantProvider>
  );
}

/**
 * Root App component
 */
function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AuthGatedContent />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;

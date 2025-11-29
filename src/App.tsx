
import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Loads from './pages/Loads';
import Drivers from './pages/Drivers';
import Fleet from './pages/Fleet';
import Expenses from './pages/Expenses';
import Settlements from './pages/Settlements';
import Reports from './pages/Reports';
import AccountReceivables from './pages/AccountReceivables';
import Import from './pages/Import';
import Settings from './pages/Settings';
import { TMSProvider } from './context/TMSContext';
import { TenantProvider } from './context/TenantContext';
import { CompanyProvider } from './context/CompanyContext';

export type PageType = 'Dashboard' | 'Loads' | 'Drivers' | 'Fleet' | 'Expenses' | 'Settlements' | 'Reports' | 'AccountReceivables' | 'Import' | 'Settings';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('Dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'Dashboard': return <Dashboard onNavigate={setCurrentPage} />;
      case 'Loads': return <Loads />;
      case 'Drivers': return <Drivers />;
      case 'Fleet': return <Fleet />;
      case 'Expenses': return <Expenses />;
      case 'Settlements': return <Settlements />;
      case 'Reports': return <Reports />;
      case 'AccountReceivables': return <AccountReceivables />;
      case 'Import': return <Import />;
      case 'Settings': return <Settings />;
      // Fallback for pages not yet implemented
      default: return <Dashboard onNavigate={setCurrentPage} />; 
    }
  };

  return (
    <TenantProvider>
      <CompanyProvider>
        <TMSProvider>
          <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
            {renderPage()}
          </Layout>
        </TMSProvider>
      </CompanyProvider>
    </TenantProvider>
  );
}

export default App;

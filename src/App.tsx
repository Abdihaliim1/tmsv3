
import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Loads from './pages/Loads';
import Drivers from './pages/Drivers';
import Fleet from './pages/Fleet';
import Expenses from './pages/Expenses';
import Invoices from './pages/Invoices';
import Settlements from './pages/Settlements';
import Reports from './pages/Reports';
import { TMSProvider } from './context/TMSContext';

export type PageType = 'Dashboard' | 'Loads' | 'Drivers' | 'Fleet' | 'Expenses' | 'Invoices' | 'Settlements' | 'Reports' | 'Import' | 'Settings';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('Dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'Dashboard': return <Dashboard onNavigate={setCurrentPage} />;
      case 'Loads': return <Loads />;
      case 'Drivers': return <Drivers />;
      case 'Fleet': return <Fleet />;
      case 'Expenses': return <Expenses />;
      case 'Invoices': return <Invoices />;
      case 'Settlements': return <Settlements />;
      case 'Reports': return <Reports />;
      // Fallback for pages not yet implemented
      default: return <Dashboard onNavigate={setCurrentPage} />; 
    }
  };

  return (
    <TMSProvider>
      <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
        {renderPage()}
      </Layout>
    </TMSProvider>
  );
}

export default App;


import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { PageType } from '../App';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  hasAdminBanner?: boolean; // When admin is viewing a company
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate, hasAdminBanner = false }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleNavigate = (page: PageType) => {
    onNavigate(page);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar 
        isOpen={isSidebarOpen} 
        currentPage={currentPage} 
        onNavigate={handleNavigate}
        isMobile={isMobile}
      />
      
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        isMobile ? 'ml-0' : isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        <Header toggleSidebar={toggleSidebar} isMobile={isMobile} onNavigate={handleNavigate} />
        
        <main className={`flex-1 overflow-x-hidden p-4 md:p-6 ${
          hasAdminBanner ? 'mt-24' : 'mt-16'
        }`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;

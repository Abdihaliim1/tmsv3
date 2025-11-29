
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { PageType } from '../App';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar isOpen={isSidebarOpen} currentPage={currentPage} onNavigate={onNavigate} />
      
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <Header toggleSidebar={toggleSidebar} />
        
        <main className="flex-1 mt-16 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;

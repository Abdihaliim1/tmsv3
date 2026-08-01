
import React, { useState, useEffect, useRef } from 'react';
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
  const mainRef = useRef<HTMLElement>(null);

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

  // Lock document scroll while the authenticated app shell is mounted
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('app-shell-lock');
    // Ensure we are not left mid-overscroll on the document
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    html.scrollTop = 0;
    return () => {
      html.classList.remove('app-shell-lock');
    };
  }, []);

  // Reset main panel scroll on page change (document scroll is disabled)
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [currentPage]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleNavigate = (page: PageType) => {
    onNavigate(page);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="app-shell bg-slate-50 flex">
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

      <div
        className={`flex-1 flex flex-col min-h-0 min-w-0 transition-all duration-300 ${
          isMobile ? 'ml-0' : isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        }`}
      >
        <Header
          toggleSidebar={toggleSidebar}
          isMobile={isMobile}
          isSidebarOpen={isSidebarOpen}
          onNavigate={handleNavigate}
        />

        <main
          ref={mainRef}
          className={`app-shell-main flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-6 ${
            hasAdminBanner ? 'pt-24' : 'pt-16'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;

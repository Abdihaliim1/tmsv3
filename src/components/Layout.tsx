
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileBottomNav from './MobileBottomNav';
import { PageType } from '../App';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  hasAdminBanner?: boolean; // When admin is viewing a company
}

const MOBILE_BREAKPOINT = 1024;

const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate, hasAdminBanner = false }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= MOBILE_BREAKPOINT : true
  );
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );
  const mainRef = useRef<HTMLElement>(null);
  const wasMobileRef = useRef(isMobile);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      // Close drawer when entering mobile; restore open sidebar on desktop
      if (mobile && !wasMobileRef.current) {
        setIsSidebarOpen(false);
      } else if (!mobile && wasMobileRef.current) {
        setIsSidebarOpen(true);
      }
      wasMobileRef.current = mobile;
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Escape closes the mobile drawer
  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, isSidebarOpen]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (!isMobile) return;
    document.body.classList.toggle('mobile-drawer-open', isSidebarOpen);
    return () => document.body.classList.remove('mobile-drawer-open');
  }, [isMobile, isSidebarOpen]);

  // Lock document scroll while the authenticated app shell is mounted
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('app-shell-lock');
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
          aria-hidden="true"
        />
      )}

      <Sidebar
        isOpen={isSidebarOpen}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        isMobile={isMobile}
        onClose={() => setIsSidebarOpen(false)}
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
          className={`app-shell-main flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 ${
            hasAdminBanner ? 'pt-24' : 'pt-16'
          } pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] lg:pb-6`}
        >
          {children}
        </main>
      </div>

      {isMobile && (
        <MobileBottomNav currentPage={currentPage} onNavigate={handleNavigate} />
      )}
    </div>
  );
};

export default Layout;

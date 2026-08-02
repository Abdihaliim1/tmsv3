
import React, { useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Package,
  ClipboardList,
  Route,
  KanbanSquare,
  X,
} from 'lucide-react';
import { PageType } from '../App';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  isMobile?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  currentPage,
  onNavigate,
  isMobile = false,
  onClose,
}) => {
  const { theme } = useCompany();
  const { logout } = useAuth();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Streamlined menu structure with Dispatch Board included
  const menuItems: { icon: any; label: PageType; displayLabel?: string }[] = [
    { icon: LayoutDashboard, label: 'Dashboard' },
    { icon: ClipboardList, label: 'LoadPlanner', displayLabel: 'Load Planner' },
    { icon: Route, label: 'Trips' },
    { icon: Package, label: 'Loads' },
    { icon: KanbanSquare, label: 'DispatchBoard', displayLabel: 'Dispatch Board' },
    { icon: FileText, label: 'Invoices' },
    { icon: Receipt, label: 'Expenses' },
    { icon: BarChart3, label: 'ReportsCombined', displayLabel: 'Reports' },
    { icon: Settings, label: 'SettingsMore', displayLabel: 'Settings & More' },
  ];

  return (
    <div
      className={`fixed left-0 top-0 h-dvh max-h-dvh bg-slate-900 text-white transition-all duration-300 z-40 flex flex-col overscroll-contain safe-area-top ${
        isMobile
          ? `${isOpen ? 'w-[min(18rem,85vw)] translate-x-0' : '-translate-x-full w-[min(18rem,85vw)]'} lg:translate-x-0`
          : isOpen
          ? 'w-64'
          : 'w-20'
      }`}
      role={isMobile && isOpen ? 'dialog' : undefined}
      aria-modal={isMobile && isOpen ? true : undefined}
      aria-label={isMobile ? 'Navigation menu' : undefined}
      aria-hidden={isMobile && !isOpen ? true : undefined}
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center px-4 sm:px-6 border-b border-slate-700 shrink-0">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-lg"
          style={{ backgroundColor: theme.primary }}
        >
          T
        </div>
        {(isOpen || isMobile) && (
          <div className="ml-3 fade-in flex-1 min-w-0">
            <h1 className="font-bold text-lg leading-tight text-white truncate">TMS Pro</h1>
            <p className="text-xs text-slate-400 truncate">Transportation Management</p>
          </div>
        )}
        {isMobile && isOpen && (
          <button
            type="button"
            onClick={onClose}
            className="ml-2 p-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <ul className="space-y-1 px-3">
          {menuItems.map((item, index) => {
            const isActive = currentPage === item.label;
            const displayName = item.displayLabel || item.label;

            return (
              <li key={index} className="relative">
                <button
                  type="button"
                  onClick={() => onNavigate(item.label)}
                  onMouseEnter={() => setHoveredItem(item.label)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`w-full flex items-center px-3 py-3 rounded-lg transition-all duration-200 min-h-[44px] ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={!isOpen && !isMobile ? displayName : undefined}
                >
                  <item.icon
                    size={20}
                    className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}
                  />
                  {(isOpen || isMobile) && (
                    <span
                      className={`ml-3 font-medium text-sm ${
                        isActive ? 'text-white' : 'text-slate-200'
                      }`}
                    >
                      {displayName}
                    </span>
                  )}
                </button>

                {/* Tooltip for collapsed sidebar (desktop only) */}
                {!isMobile && !isOpen && hoveredItem === item.label && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg shadow-lg whitespace-nowrap z-50">
                    {displayName}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className="p-4 border-t border-slate-700 shrink-0"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          className="flex items-center w-full px-3 py-2 min-h-[44px] text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          onClick={() => {
            void logout();
          }}
          onMouseEnter={() => setHoveredItem('logout')}
          onMouseLeave={() => setHoveredItem(null)}
          title={!isOpen && !isMobile ? 'Logout' : undefined}
        >
          <LogOut size={20} className="shrink-0 text-slate-400" />
          {(isOpen || isMobile) && <span className="ml-3 font-medium text-sm">Logout</span>}
        </button>

        {!isMobile && !isOpen && hoveredItem === 'logout' && (
          <div className="absolute left-full bottom-4 ml-2 px-3 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg shadow-lg whitespace-nowrap z-50">
            Logout
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;

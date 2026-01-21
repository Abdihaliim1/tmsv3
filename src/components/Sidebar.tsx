
import React, { useState } from 'react';
import {
  LayoutDashboard,
  Truck,
  Receipt,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Package,
  ClipboardList,
  Route,
  KanbanSquare
} from 'lucide-react';
import { PageType } from '../App';
import { useCompany } from '../context/CompanyContext';

interface SidebarProps {
  isOpen: boolean;
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  isMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, currentPage, onNavigate, isMobile = false }) => {
  const { theme } = useCompany();
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
      className={`fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-40 flex flex-col ${
        isMobile
          ? `${isOpen ? 'w-64' : '-translate-x-full'} lg:translate-x-0`
          : isOpen
          ? 'w-64'
          : 'w-20'
      }`}
    >
      {/* Logo Section - Only shows TMS Pro */}
      <div className="h-16 flex items-center px-6 border-b border-slate-700">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-lg"
          style={{ backgroundColor: theme.primary }}
        >
          T
        </div>
        {isOpen && (
          <div className="ml-3 fade-in">
            <h1 className="font-bold text-lg leading-tight text-white">TMS Pro</h1>
            <p className="text-xs text-slate-400">Transportation Management</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {menuItems.map((item, index) => {
            const isActive = currentPage === item.label;
            const displayName = item.displayLabel || item.label;

            return (
              <li key={index} className="relative">
                <button
                  onClick={() => onNavigate(item.label)}
                  onMouseEnter={() => setHoveredItem(item.label)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`w-full flex items-center px-3 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={!isOpen ? displayName : undefined}
                >
                  <item.icon
                    size={20}
                    className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}
                  />
                  {isOpen && (
                    <span
                      className={`ml-3 font-medium text-sm ${
                        isActive ? 'text-white' : 'text-slate-200'
                      }`}
                    >
                      {displayName}
                    </span>
                  )}
                </button>

                {/* Tooltip for collapsed sidebar */}
                {!isOpen && hoveredItem === item.label && (
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
      <div className="p-4 border-t border-slate-700">
        <button
          className="flex items-center w-full px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          onMouseEnter={() => setHoveredItem('logout')}
          onMouseLeave={() => setHoveredItem(null)}
          title={!isOpen ? 'Logout' : undefined}
        >
          <LogOut size={20} className="shrink-0 text-slate-400" />
          {isOpen && <span className="ml-3 font-medium text-sm">Logout</span>}
        </button>

        {/* Tooltip for logout in collapsed mode */}
        {!isOpen && hoveredItem === 'logout' && (
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

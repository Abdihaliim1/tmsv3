
import React from 'react';
import { 
  LayoutDashboard, 
  Truck, 
  Users, 
  Receipt, 
  FileText, 
  Calculator, 
  BarChart3, 
  Settings, 
  LogOut,
  Upload,
  Building2,
  Package,
  CheckSquare,
  KanbanSquare
} from 'lucide-react';
import { PageType } from '../App';
import { useCompany } from '../context/CompanyContext';

const CompanyName: React.FC = () => {
  const { companyProfile } = useCompany();
  return (
    <>
      <h1 className="font-bold text-lg leading-tight">{companyProfile.companyName || 'TMS Pro'}</h1>
      {companyProfile.tagline && (
        <p className="text-xs text-slate-400">{companyProfile.tagline}</p>
      )}
      {!companyProfile.tagline && (
        <p className="text-xs text-slate-400">TMS Pro</p>
      )}
    </>
  );
};

interface SidebarProps {
  isOpen: boolean;
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  isMobile?: boolean;
}

const SidebarLogo: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
  const { companyProfile, theme } = useCompany();
  return (
    <div className="h-16 flex items-center px-6 border-b border-slate-800">
      {companyProfile.logoUrl ? (
        <img 
          src={companyProfile.logoUrl} 
          alt="Company logo" 
          className="h-10 w-auto object-contain shrink-0"
        />
      ) : (
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-lg"
          style={{ backgroundColor: theme.primary }}
        >
          {(companyProfile.companyName || 'TMS').charAt(0).toUpperCase()}
        </div>
      )}
      {isOpen && (
        <div className="ml-3 fade-in">
          <CompanyName />
        </div>
      )}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, currentPage, onNavigate, isMobile = false }) => {
  const { theme } = useCompany();
  const menuItems: { icon: any, label: PageType, displayLabel?: string }[] = [
    { icon: LayoutDashboard, label: 'Dashboard' },
    { icon: Truck, label: 'Loads' },
    { icon: KanbanSquare, label: 'DispatchBoard', displayLabel: 'Dispatch Board' },
    { icon: Users, label: 'Drivers', displayLabel: 'Employees' },
    { icon: Truck, label: 'Fleet' },
    { icon: Receipt, label: 'Expenses' },
    { icon: Calculator, label: 'Settlements' },
    { icon: BarChart3, label: 'Reports' },
    { icon: Building2, label: 'AccountReceivables', displayLabel: 'Account Receivables' },
    { icon: CheckSquare, label: 'Tasks', displayLabel: 'Tasks' },
    { icon: Upload, label: 'Import' },
    { icon: Settings, label: 'Settings' },
  ];

  return (
    <div className={`fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-40 flex flex-col ${
      isMobile 
        ? `${isOpen ? 'w-64' : '-translate-x-full'} lg:translate-x-0`
        : isOpen ? 'w-64' : 'w-20'
    }`}>
      {/* Logo Section */}
      <SidebarLogo isOpen={isOpen} />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {menuItems.map((item, index) => (
            <li key={index}>
              <button 
                onClick={() => onNavigate(item.label)}
                className={`w-full flex items-center px-3 py-3 rounded-lg transition-colors ${
                  currentPage === item.label
                    ? 'text-white border-l-2' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                style={currentPage === item.label ? {
                  backgroundColor: `${theme.primary}40`,
                  borderLeftColor: theme.primary,
                  color: theme.accent,
                } : {}}
              >
                <item.icon size={20} className="shrink-0" />
                {isOpen && (
                  <span className="ml-3 font-medium">
                    {item.displayLabel || item.label}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <button className="flex items-center w-full px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
          <LogOut size={20} className="shrink-0" />
          {isOpen && <span className="ml-3 font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

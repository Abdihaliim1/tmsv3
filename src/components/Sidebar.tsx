
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
  Upload
} from 'lucide-react';
import { PageType } from '../App';

interface SidebarProps {
  isOpen: boolean;
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  isMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, currentPage, onNavigate, isMobile = false }) => {
  const menuItems: { icon: any, label: PageType }[] = [
    { icon: LayoutDashboard, label: 'Dashboard' },
    { icon: Truck, label: 'Loads' },
    { icon: Users, label: 'Drivers' },
    { icon: Truck, label: 'Fleet' }, 
    { icon: Receipt, label: 'Expenses' },
    { icon: FileText, label: 'Invoices' },
    { icon: Calculator, label: 'Settlements' },
    { icon: BarChart3, label: 'Reports' },
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
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <span className="font-bold text-lg">AT</span>
        </div>
        {isOpen && (
          <div className="ml-3 fade-in">
            <h1 className="font-bold text-lg leading-tight">ATS Freight</h1>
            <p className="text-xs text-slate-400">TMS Pro</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {menuItems.map((item, index) => (
            <li key={index}>
              <button 
                onClick={() => onNavigate(item.label)}
                className={`w-full flex items-center px-3 py-3 rounded-lg transition-colors ${
                  currentPage === item.label
                    ? 'bg-blue-600/10 text-blue-400 border-l-2 border-blue-500' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon size={20} className="shrink-0" />
                {isOpen && <span className="ml-3 font-medium">{item.label}</span>}
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

import React from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Route,
  Package,
  MoreHorizontal,
} from 'lucide-react';
import { PageType } from '../App';

interface MobileBottomNavProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
}

const items: Array<{
  page: PageType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  match?: PageType[];
}> = [
  { page: 'Dashboard', label: 'Home', icon: LayoutDashboard },
  { page: 'LoadPlanner', label: 'Planner', icon: ClipboardList },
  { page: 'Trips', label: 'Trips', icon: Route },
  { page: 'Loads', label: 'Loads', icon: Package },
  {
    page: 'SettingsMore',
    label: 'More',
    icon: MoreHorizontal,
    match: [
      'SettingsMore',
      'Settings',
      'ReportsCombined',
      'Reports',
      'Invoices',
      'Expenses',
      'Settlements',
      'Drivers',
      'Fleet',
      'DispatchBoard',
      'AccountReceivables',
      'Tasks',
      'Import',
    ],
  },
];

/**
 * Thumb-friendly primary navigation for phones / small tablets.
 * Complements the hamburger sidebar (full menu).
 */
const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentPage, onNavigate }) => {
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5 h-14">
        {items.map((item) => {
          const active = item.match
            ? item.match.includes(currentPage)
            : currentPage === item.page;
          const Icon = item.icon;
          return (
            <li key={item.page}>
              <button
                type="button"
                onClick={() => onNavigate(item.page)}
                className={`w-full h-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-blue-600' : 'text-slate-500'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} className={active ? 'text-blue-600' : 'text-slate-400'} />
                <span>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;

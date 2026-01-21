import React, { useState, Suspense, lazy } from 'react';
import {
  Settings, Users, Truck, MapPin, FileDown, Upload, HelpCircle, MessageSquare,
  Headphones, User, ClipboardList, ChevronRight, Wrench, UserCircle
} from 'lucide-react';

// Lazy load existing pages
const SettingsPage = lazy(() => import('./Settings'));
const DriversPage = lazy(() => import('./Drivers'));
const FleetPage = lazy(() => import('./Fleet'));
const ImportPage = lazy(() => import('./Import'));
const TasksPage = lazy(() => import('./Tasks'));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
      <p className="text-slate-500 text-sm">Loading...</p>
    </div>
  </div>
);

// Placeholder component for pages not yet implemented
const PlaceholderPage: React.FC<{ title: string; description: string; icon: React.ReactNode }> = ({
  title,
  description,
  icon,
}) => (
  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12">
    <div className="text-center max-w-md mx-auto">
      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <h2 className="text-xl font-semibold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-600">{description}</p>
    </div>
  </div>
);

type SubPage =
  | 'menu'
  | 'employees'
  | 'drivers'
  | 'fleet'
  | 'units'
  | 'maintenances'
  | 'addresses'
  | 'dataExport'
  | 'import'
  | 'userGuide'
  | 'faq'
  | 'support'
  | 'profile'
  | 'tasks'
  | 'settings';

interface MenuItem {
  id: SubPage;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

const SettingsMore: React.FC = () => {
  const [currentSubPage, setCurrentSubPage] = useState<SubPage>('menu');

  const menuItems: MenuItem[] = [
    // Team Management
    {
      id: 'employees',
      label: 'Employees',
      description: 'Manage employee accounts and permissions',
      icon: <Users className="w-5 h-5" />,
      category: 'Team Management',
    },
    {
      id: 'drivers',
      label: 'Drivers',
      description: 'Manage driver profiles and assignments',
      icon: <UserCircle className="w-5 h-5" />,
      category: 'Team Management',
    },

    // Fleet Management
    {
      id: 'fleet',
      label: 'Fleet',
      description: 'Manage trucks and trailers',
      icon: <Truck className="w-5 h-5" />,
      category: 'Fleet Management',
    },
    {
      id: 'units',
      label: 'Units',
      description: 'View and manage all units',
      icon: <Truck className="w-5 h-5" />,
      category: 'Fleet Management',
    },
    {
      id: 'maintenances',
      label: 'Maintenances',
      description: 'Track and schedule maintenance',
      icon: <Wrench className="w-5 h-5" />,
      category: 'Fleet Management',
    },

    // System Settings
    {
      id: 'addresses',
      label: 'Addresses',
      description: 'Manage saved addresses and locations',
      icon: <MapPin className="w-5 h-5" />,
      category: 'System Settings',
    },
    {
      id: 'dataExport',
      label: 'Data Export',
      description: 'Export your data in various formats',
      icon: <FileDown className="w-5 h-5" />,
      category: 'System Settings',
    },
    {
      id: 'import',
      label: 'Import',
      description: 'Import data from external sources',
      icon: <Upload className="w-5 h-5" />,
      category: 'System Settings',
    },
    {
      id: 'settings',
      label: 'System Settings',
      description: 'Configure system preferences',
      icon: <Settings className="w-5 h-5" />,
      category: 'System Settings',
    },

    // Support & Help
    {
      id: 'userGuide',
      label: 'User Guide',
      description: 'Learn how to use TMS Pro',
      icon: <HelpCircle className="w-5 h-5" />,
      category: 'Support & Help',
    },
    {
      id: 'faq',
      label: 'FAQ',
      description: 'Frequently asked questions',
      icon: <MessageSquare className="w-5 h-5" />,
      category: 'Support & Help',
    },
    {
      id: 'support',
      label: 'Support',
      description: 'Contact our support team',
      icon: <Headphones className="w-5 h-5" />,
      category: 'Support & Help',
    },

    // Account
    {
      id: 'profile',
      label: 'Profile',
      description: 'View and edit your profile',
      icon: <User className="w-5 h-5" />,
      category: 'Account',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      description: 'Manage your tasks and to-dos',
      icon: <ClipboardList className="w-5 h-5" />,
      category: 'Account',
    },
  ];

  const categories = ['Team Management', 'Fleet Management', 'System Settings', 'Support & Help', 'Account'];

  const renderSubPage = () => {
    switch (currentSubPage) {
      case 'drivers':
        return (
          <Suspense fallback={<PageLoader />}>
            <DriversPage />
          </Suspense>
        );
      case 'fleet':
        return (
          <Suspense fallback={<PageLoader />}>
            <FleetPage />
          </Suspense>
        );
      case 'import':
        return (
          <Suspense fallback={<PageLoader />}>
            <ImportPage />
          </Suspense>
        );
      case 'tasks':
        return (
          <Suspense fallback={<PageLoader />}>
            <TasksPage />
          </Suspense>
        );
      case 'settings':
        return (
          <Suspense fallback={<PageLoader />}>
            <SettingsPage />
          </Suspense>
        );
      case 'employees':
        return (
          <PlaceholderPage
            title="Employees"
            description="Employee management coming soon. Manage user accounts, roles, and permissions."
            icon={<Users className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'units':
        return (
          <PlaceholderPage
            title="Units"
            description="Unit management coming soon. View and manage all fleet units in one place."
            icon={<Truck className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'maintenances':
        return (
          <PlaceholderPage
            title="Maintenances"
            description="Maintenance tracking coming soon. Schedule and track maintenance for your fleet."
            icon={<Wrench className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'addresses':
        return (
          <PlaceholderPage
            title="Addresses"
            description="Address management coming soon. Save and organize frequently used addresses."
            icon={<MapPin className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'dataExport':
        return (
          <PlaceholderPage
            title="Data Export"
            description="Data export coming soon. Export your data in CSV, Excel, or PDF formats."
            icon={<FileDown className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'userGuide':
        return (
          <PlaceholderPage
            title="User Guide"
            description="User guide coming soon. Learn how to use all features of TMS Pro."
            icon={<HelpCircle className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'faq':
        return (
          <PlaceholderPage
            title="FAQ"
            description="FAQ coming soon. Find answers to common questions."
            icon={<MessageSquare className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'support':
        return (
          <PlaceholderPage
            title="Support"
            description="Support page coming soon. Contact our team for assistance."
            icon={<Headphones className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'profile':
        return (
          <PlaceholderPage
            title="Profile"
            description="Profile settings coming soon. View and edit your account details."
            icon={<User className="w-8 h-8 text-blue-600" />}
          />
        );
      default:
        return null;
    }
  };

  if (currentSubPage !== 'menu') {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setCurrentSubPage('menu')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Settings & More
        </button>
        {renderSubPage()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings & More</h1>
        <p className="text-gray-600 mt-1">Manage your account, team, fleet, and system settings</p>
      </div>

      {/* Menu Categories */}
      <div className="space-y-6">
        {categories.map((category) => {
          const categoryItems = menuItems.filter((item) => item.category === category);
          if (categoryItems.length === 0) return null;

          return (
            <div key={category} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{category}</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {categoryItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentSubPage(item.id)}
                    className="w-full px-4 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-100 rounded-lg text-blue-600">{item.icon}</div>
                      <div className="text-left">
                        <p className="font-medium text-slate-900">{item.label}</p>
                        <p className="text-sm text-slate-500">{item.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SettingsMore;

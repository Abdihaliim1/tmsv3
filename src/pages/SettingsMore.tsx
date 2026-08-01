import React, { useState, Suspense, lazy } from 'react';
import {
  Settings, Users, Truck, MapPin, FileDown, Upload, HelpCircle, MessageSquare,
  Headphones, User, ClipboardList, ChevronRight, Wrench, UserCircle, Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import ExportMenu from '../components/ExportMenu';

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
  | 'dispatchers'
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
  const { user } = useAuth();
  const { companyProfile } = useCompany();

  const menuItems: MenuItem[] = [
    // Team Management
    {
      id: 'employees',
      label: 'Employees',
      description: 'All employees, roles, and permissions',
      icon: <Users className="w-5 h-5" />,
      category: 'Team Management',
    },
    {
      id: 'drivers',
      label: 'Drivers',
      description: 'Drivers and owner-operators only',
      icon: <UserCircle className="w-5 h-5" />,
      category: 'Team Management',
    },
    {
      id: 'dispatchers',
      label: 'Dispatchers',
      description: 'Dispatcher profiles and commissions',
      icon: <Radio className="w-5 h-5" />,
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
      case 'employees':
        return (
          <Suspense fallback={<PageLoader />}>
            <DriversPage mode="all" />
          </Suspense>
        );
      case 'drivers':
        return (
          <Suspense fallback={<PageLoader />}>
            <DriversPage mode="drivers" />
          </Suspense>
        );
      case 'dispatchers':
        return (
          <Suspense fallback={<PageLoader />}>
            <DriversPage mode="dispatchers" />
          </Suspense>
        );
      case 'fleet':
      case 'units':
        return (
          <Suspense fallback={<PageLoader />}>
            <FleetPage />
          </Suspense>
        );
      case 'maintenances':
        return (
          <PlaceholderPage
            title="Maintenances"
            description="Track maintenance expenses under Expenses (type: maintenance) and Fleet truck status. Full scheduling calendar is planned next."
            icon={<Wrench className="w-8 h-8 text-blue-600" />}
          />
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
      case 'dataExport':
        return (
          <div className="bg-white rounded-lg border border-slate-200 p-8 space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Data Export</h2>
            <p className="text-slate-600">Download a tenant snapshot or use the export menu for CSV/JSON backups.</p>
            <ExportMenu />
          </div>
        );
      case 'addresses':
        return (
          <PlaceholderPage
            title="Addresses"
            description="Saved address book is planned. Pickup/delivery addresses are currently stored on each load and trip."
            icon={<MapPin className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'userGuide':
        return (
          <PlaceholderPage
            title="User Guide"
            description="In-app guide coming soon. For now use Support to contact the team."
            icon={<HelpCircle className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'faq':
        return (
          <PlaceholderPage
            title="FAQ"
            description="FAQ content coming soon."
            icon={<MessageSquare className="w-8 h-8 text-blue-600" />}
          />
        );
      case 'support':
        return (
          <div className="bg-white rounded-lg border border-slate-200 p-8 space-y-3">
            <h2 className="text-2xl font-bold text-slate-900">Support</h2>
            <p className="text-slate-600">Need help with SomTMS?</p>
            <p className="text-sm text-slate-700">Email: <a className="text-blue-600 hover:underline" href="mailto:support@somtms.com">support@somtms.com</a></p>
            <p className="text-sm text-slate-500">Include your company name and a short description of the issue.</p>
          </div>
        );
      case 'profile':
        return (
          <div className="bg-white rounded-lg border border-slate-200 p-8 space-y-4 max-w-xl">
            <h2 className="text-2xl font-bold text-slate-900">Profile</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-900">{user?.displayName || '—'}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-900">{user?.email || '—'}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-slate-500">App Role</dt>
                <dd className="font-medium text-slate-900">{user?.role || '—'}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-slate-500">Company</dt>
                <dd className="font-medium text-slate-900">{companyProfile?.companyName || '—'}</dd>
              </div>
            </dl>
          </div>
        );
      default:
        return null;
    }
  };

  if (currentSubPage !== 'menu') {
    return (
      <div className="space-y-6">
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings & More</h1>
        <p className="text-gray-600 mt-1">Manage your account, team, fleet, and system settings</p>
      </div>

      <div className="space-y-6">
        {categories.map((category) => {
          const categoryItems = menuItems.filter((item) => item.category === category);
          if (categoryItems.length === 0) return null;

          return (
            <div key={category}>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {categoryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCurrentSubPage(item.id)}
                    className="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm text-left transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">{item.label}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>
                    </div>
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

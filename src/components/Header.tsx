
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Bell, Menu, User, X, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { getAllNotifications, Notification } from '../services/notifications';
import { PageType } from '../App';

interface HeaderProps {
  toggleSidebar: () => void;
  isMobile?: boolean;
  onNavigate?: (page: PageType) => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, isMobile = false, onNavigate }) => {
  const { searchTerm, setSearchTerm, employees, trucks, trailers } = useTMS();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Calculate notifications - filter employees to only drivers for CDL/medical checks
  const notifications = useMemo(() => {
    const drivers = employees.filter(e => e.employeeType === 'driver' || e.employeeType === 'owner_operator');
    return getAllNotifications(drivers, trucks, trailers);
  }, [employees, trucks, trailers]);

  const criticalCount = notifications.filter(n => n.type === 'critical').length;
  const warningCount = notifications.filter(n => n.type === 'warning').length;
  const totalUnread = notifications.length;

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };

    if (isNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationsOpen]);

  const handleNotificationClick = (notification: Notification) => {
    if (notification.linkTo && onNavigate) {
      onNavigate(notification.linkTo as PageType);
      setIsNotificationsOpen(false);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'critical':
        return <AlertCircle size={16} className="text-red-600" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-yellow-600" />;
      case 'info':
        return <Info size={16} className="text-blue-600" />;
    }
  };

  const getNotificationBadgeColor = (type: Notification['type']) => {
    switch (type) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <header className={`h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 fixed top-0 right-0 left-0 z-30 transition-all duration-300 ${
      isMobile ? 'ml-0' : 'lg:ml-64'
    }`}>
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-slate-100 rounded-lg lg:hidden text-slate-600"
        >
          <Menu size={24} />
        </button>
        
        {/* Global Search */}
        <div className="relative hidden md:block w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search loads by number, customer, or city..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
          />
        </div>
        
        {/* Mobile Search Button */}
        <button className="md:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-600">
          <Search size={20} />
        </button>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
          >
            <Bell size={20} />
            {totalUnread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-slate-200 max-h-[600px] overflow-hidden flex flex-col z-50">
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                  {totalUnread > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {totalUnread} notification{totalUnread === 1 ? '' : 's'}
                      {criticalCount > 0 && (
                        <span className="ml-2 text-red-600 font-medium">
                          {criticalCount} critical
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setIsNotificationsOpen(false)}
                  className="p-1 hover:bg-slate-200 rounded transition-colors"
                >
                  <X size={16} className="text-slate-500" />
                </button>
              </div>

              {/* Notifications List */}
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">No notifications</p>
                    <p className="text-xs text-slate-400 mt-1">All documents are up to date</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors focus:outline-none focus:bg-slate-50"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex-shrink-0">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {notification.title}
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-xs px-2 py-0.5 rounded border ${getNotificationBadgeColor(notification.type)}`}>
                                {notification.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </span>
                              {notification.linkTo && (
                                <span className="text-xs text-blue-600">
                                  View →
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-2 border-t border-slate-200 bg-slate-50">
                  <p className="text-xs text-slate-500 text-center">
                    Click a notification to view details
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-700">Admin User</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-200 transition-colors">
            <User size={20} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

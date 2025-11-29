
import React from 'react';
import { Search, Bell, Menu, User } from 'lucide-react';
import { useTMS } from '../context/TMSContext';

interface HeaderProps {
  toggleSidebar: () => void;
  isMobile?: boolean;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, isMobile = false }) => {
  const { searchTerm, setSearchTerm } = useTMS();

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
        <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
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

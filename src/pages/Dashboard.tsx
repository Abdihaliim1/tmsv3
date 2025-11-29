
import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  Truck, 
  Users, 
  TrendingUp, 
  MoreHorizontal
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import StatsCard from '../components/StatsCard';
import AddLoadModal from '../components/AddLoadModal';
import { LoadStatus } from '../types';
import { useTMS } from '../context/TMSContext';
import { calculateCompanyRevenue } from '../services/utils';

import { PageType } from '../App';

interface DashboardProps {
  onNavigate?: (page: PageType) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { loads, kpis, addLoad, drivers, invoices } = useTMS();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Calculate real revenue trends from loads (last 6 months)
  const revenueChartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const data: { name: string; value: number }[] = [];

    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      // Calculate revenue for this month from delivered/completed loads
      const monthLoads = loads.filter(load => {
        if (load.status !== LoadStatus.Delivered && load.status !== LoadStatus.Completed) return false;
        const loadDate = new Date(load.deliveryDate || load.pickupDate || '');
        return loadDate >= monthStart && loadDate <= monthEnd;
      });

      let monthRevenue = 0;
      monthLoads.forEach(load => {
        const grossAmount = load.rate || 0;
        if (load.driverId) {
          const driver = drivers.find(d => d.id === load.driverId);
          monthRevenue += calculateCompanyRevenue(grossAmount, driver);
        } else {
          monthRevenue += grossAmount;
        }
      });

      data.push({
        name: months[date.getMonth()],
        value: monthRevenue
      });
    }

    return data;
  }, [loads, drivers]);

  // Calculate real load status data
  const loadStatusData = useMemo(() => {
    const statusCounts: Record<string, number> = {
      'Available': 0,
      'Dispatched': 0,
      'In Transit': 0,
      'Delivered': 0,
      'Completed': 0,
      'Cancelled': 0
    };

    loads.forEach(load => {
      const status = load.status;
      if (status === LoadStatus.Available) statusCounts['Available']++;
      else if (status === LoadStatus.Dispatched) statusCounts['Dispatched']++;
      else if (status === LoadStatus.InTransit) statusCounts['In Transit']++;
      else if (status === LoadStatus.Delivered) statusCounts['Delivered']++;
      else if (status === LoadStatus.Completed) statusCounts['Completed']++;
      else if (status === LoadStatus.Cancelled) statusCounts['Cancelled']++;
    });

    // Convert to array format, filter out zeros
    return Object.entries(statusCounts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [loads]);

  const getStatusColor = (status: LoadStatus) => {
    switch (status) {
      case LoadStatus.Available: return 'bg-gray-100 text-gray-700 border-gray-200';
      case LoadStatus.Dispatched: return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case LoadStatus.InTransit: return 'bg-blue-50 text-blue-700 border-blue-200';
      case LoadStatus.Delivered: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case LoadStatus.Completed: return 'bg-purple-50 text-purple-700 border-purple-200';
      case LoadStatus.Cancelled: return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const COLORS = ['#94a3b8', '#facc15', '#3b82f6', '#10b981', '#a855f7', '#ef4444'];

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
          <p className="text-slate-500 mt-1">Welcome back, here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => {
              if (onNavigate) {
                onNavigate('Reports' as PageType);
              }
            }}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
          >
            View Reports
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm shadow-blue-200 transition-colors flex items-center gap-2"
          >
            <Truck size={18} />
            <span>New Load</span>
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          label="Total Revenue" 
          value={`$${kpis.revenue.toLocaleString()}`} 
          icon={DollarSign} 
          trend={kpis.revenueChange}
          color="green"
        />
        <StatsCard 
          label="Active Loads" 
          value={kpis.activeLoads} 
          icon={Truck} 
          trend={kpis.loadsChange}
          color="blue"
        />
        <StatsCard 
          label="Active Drivers" 
          value={kpis.activeDrivers} 
          icon={Users} 
          trend={kpis.driversChange}
          color="purple"
        />
        <StatsCard 
          label="Net Profit" 
          value={`$${kpis.profit.toLocaleString()}`} 
          icon={TrendingUp} 
          trend={kpis.profitChange}
          color="orange"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Revenue Trends</h2>
              <p className="text-sm text-slate-500 mt-1">Last 6 months from delivered loads</p>
            </div>
            <button 
              onClick={() => {
                if (onNavigate) {
                  onNavigate('Reports');
                }
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View Details →
            </button>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueChartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `$${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Load Status Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Load Status</h2>
              <p className="text-sm text-slate-500 mt-1">Real-time load distribution</p>
            </div>
            <button 
              onClick={() => {
                if (onNavigate) {
                  onNavigate('Loads' as PageType);
                }
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View All →
            </button>
          </div>
          <div className="h-[220px] w-full relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={loadStatusData as any}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {loadStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <span className="text-3xl font-bold text-slate-900">{kpis.activeLoads}</span>
               <span className="text-xs text-slate-500 font-medium uppercase">Total</span>
             </div>
          </div>
          <div className="mt-6 space-y-3">
            {loadStatusData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Recent Loads</h2>
          <button 
            onClick={() => {
              if (onNavigate) {
                onNavigate('Loads' as PageType);
              }
            }}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View All →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Load #</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Route</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                 <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loads.length === 0 ? (
                 <tr>
                   <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                     No loads found. Create a new load to get started.
                   </td>
                 </tr>
              ) : (
                loads.slice(0, 10).map((load) => (
                  <tr 
                    key={load.id} 
                    onClick={() => {
                      if (onNavigate) {
                        // Store the selected load ID in sessionStorage so Loads page can open it
                        sessionStorage.setItem('selectedLoadId', load.id);
                        onNavigate('Loads' as PageType);
                      }
                    }}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-blue-600 hover:text-blue-700">{load.loadNumber}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(load.status)}`}>
                        {load.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="font-medium text-slate-900">{load.originCity}</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-medium text-slate-900">{load.destCity}</span>
                      </div>
                    </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {load.customerName}
                    </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {load.driverName || <span className="text-slate-400 italic">Unassigned</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-900">
                      ${load.rate.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AddLoadModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSubmit={(data) => {
          addLoad(data);
          setIsAddModalOpen(false);
        }}
      />
    </div>
  );
};

export default Dashboard;

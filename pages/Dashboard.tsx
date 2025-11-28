
import React, { useState } from 'react';
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
import { revenueChartData, loadStatusData } from '../services/mockData';
import { LoadStatus } from '../types';
import { useTMS } from '../context/TMSContext';

const Dashboard: React.FC = () => {
  const { loads, kpis, addLoad } = useTMS();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

  const COLORS = ['#94a3b8', '#facc15', '#3b82f6', '#10b981'];

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
          <p className="text-slate-500 mt-1">Welcome back, here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
           <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors">
            Download Report
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
            <h2 className="text-lg font-bold text-slate-900">Revenue Trends</h2>
            <button className="text-slate-400 hover:text-slate-600">
              <MoreHorizontal size={20} />
            </button>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
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
            <h2 className="text-lg font-bold text-slate-900">Load Status</h2>
            <button className="text-slate-400 hover:text-slate-600">
              <MoreHorizontal size={20} />
            </button>
          </div>
          <div className="h-[220px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={loadStatusData}
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
          <button className="text-sm font-medium text-blue-600 hover:text-blue-700">View All</button>
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
                loads.map((load) => (
                  <tr key={load.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-blue-600">{load.loadNumber}</span>
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

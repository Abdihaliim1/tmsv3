
import React, { useState } from 'react';
import { Plus, Filter, MoreHorizontal, Calendar, MapPin } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { LoadStatus } from '../types';
import AddLoadModal from '../components/AddLoadModal';

const Loads: React.FC = () => {
  const { loads, addLoad } = useTMS();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const getStatusBadge = (status: LoadStatus) => {
    const styles = {
      [LoadStatus.Available]: 'bg-slate-100 text-slate-700',
      [LoadStatus.Dispatched]: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      [LoadStatus.InTransit]: 'bg-blue-50 text-blue-700 border-blue-200',
      [LoadStatus.Delivered]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      [LoadStatus.Completed]: 'bg-purple-50 text-purple-700 border-purple-200',
      [LoadStatus.Cancelled]: 'bg-red-50 text-red-700 border-red-200',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles[LoadStatus.Available]}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Load Management</h1>
          <p className="text-slate-500">Manage active shipments, assignments, and history</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors flex items-center gap-2">
            <Filter size={18} />
            <span>Filter</span>
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm shadow-blue-200 transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            <span>Create Load</span>
          </button>
        </div>
      </div>

      {/* Load List */}
      <div className="grid grid-cols-1 gap-4">
        {loads.length === 0 ? (
           <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500">
             No loads found. Use the "Create Load" button to add one.
           </div>
        ) : (
          loads.map(load => (
            <div key={load.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 group">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                {/* Top Section: ID & Status */}
                <div className="flex items-center justify-between lg:justify-start lg:w-1/4 gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-lg text-blue-600">{load.loadNumber}</span>
                      {getStatusBadge(load.status)}
                    </div>
                    <div className="text-sm text-slate-500 font-medium">{load.customerName}</div>
                  </div>
                  <button className="lg:hidden text-slate-400">
                    <MoreHorizontal size={20} />
                  </button>
                </div>

                {/* Middle Section: Route */}
                <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-6 lg:px-8 lg:border-x lg:border-slate-100">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-slate-900 font-medium mb-1">
                      <MapPin size={16} className="text-blue-500" />
                      {load.originCity}, {load.originState}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 pl-6">
                      <Calendar size={12} /> {load.pickupDate}
                    </div>
                  </div>

                  <div className="hidden sm:flex flex-col items-center px-4">
                    <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full mb-1">{load.miles} mi</span>
                    <div className="w-24 h-[2px] bg-slate-200 relative">
                      <div className="absolute -right-1 -top-1 w-2 h-2 border-t-2 border-r-2 border-slate-300 rotate-45"></div>
                    </div>
                  </div>

                  <div className="flex-1 sm:text-right">
                    <div className="flex items-center sm:justify-end gap-2 text-slate-900 font-medium mb-1">
                      <MapPin size={16} className="text-emerald-500" />
                      {load.destCity}, {load.destState}
                    </div>
                    <div className="flex items-center sm:justify-end gap-2 text-xs text-slate-500 sm:pr-6">
                      <Calendar size={12} /> {load.deliveryDate}
                    </div>
                  </div>
                </div>

                {/* Right Section: Financials & Driver */}
                <div className="lg:w-1/4 flex flex-row lg:flex-col justify-between lg:items-end gap-1 lg:gap-2">
                  <div className="text-right">
                    <div className="text-xl font-bold text-slate-900">${load.rate.toLocaleString()}</div>
                    <div className="text-xs text-slate-500 font-medium">${(load.rate / (load.miles || 1)).toFixed(2)} / mi</div>
                  </div>
                  
                  <div className="flex items-center gap-2 lg:mt-2">
                    <div className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-600 font-medium max-w-[120px] truncate">
                      {load.driverName || 'Unassigned'}
                    </div>
                    <button className="text-slate-300 hover:text-blue-600 hidden lg:block">
                      <MoreHorizontal size={20} />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          ))
        )}
      </div>

      <AddLoadModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSubmit={addLoad} 
      />
    </div>
  );
};

export default Loads;

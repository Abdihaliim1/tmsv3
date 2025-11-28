
import React, { useState } from 'react';
import { UserPlus, Phone, Mail, Truck } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import AddDriverModal from '../components/AddDriverModal';

const Drivers: React.FC = () => {
  const { drivers, addDriver } = useTMS();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Driver Management</h1>
          <p className="text-slate-500">Manage fleet drivers and owner operators</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <UserPlus size={18} />
          <span>Add Driver</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {drivers.map(driver => (
          <div key={driver.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-lg">
                  {driver.firstName[0]}{driver.lastName[0]}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{driver.firstName} {driver.lastName}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${driver.type === 'Company' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                    {driver.type === 'Company' ? 'Company Driver' : 'Owner Operator'}
                  </span>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${driver.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} title={driver.status} />
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-slate-400" />
                <span>Truck: <span className="font-medium text-slate-900">{driver.truckId}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-slate-400" />
                <span>{driver.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-slate-400" />
                <span>{driver.email}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-sm">
              <span className="text-slate-500">Pay Rate</span>
              <span className="font-semibold text-slate-900">
                {driver.type === 'Company' ? `$${driver.rateOrSplit.toFixed(2)} / mi` : `${driver.rateOrSplit}% Split`}
              </span>
            </div>
          </div>
        ))}
      </div>

      <AddDriverModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={addDriver} 
      />
    </div>
  );
};

export default Drivers;

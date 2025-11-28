
import React from 'react';
import { Calculator, DollarSign } from 'lucide-react';
import { useTMS } from '../context/TMSContext';

const Settlements: React.FC = () => {
  const { settlements } = useTMS();

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Driver Settlements</h1>
          <p className="text-slate-500">Review and process driver pay</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {settlements.length === 0 ? (
           <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500">
             No pending settlements found. Deliver loads to generate settlements.
           </div>
        ) : (
          settlements.map(settlement => (
            <div key={settlement.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                    <Calculator size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{settlement.driverName}</h3>
                    <p className="text-sm text-slate-500">Load #{settlement.loadId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                   <span className="px-3 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full text-sm font-medium">
                     {settlement.status}
                   </span>
                   <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm">
                     Process Payment
                   </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-slate-50/50">
                <div className="p-6">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Gross Pay</p>
                  <p className="text-2xl font-bold text-slate-900">${settlement.grossPay.toFixed(2)}</p>
                  <p className="text-xs text-slate-400 mt-1">Based on Rate/Mile or Split %</p>
                </div>
                <div className="p-6">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Deductions</p>
                  <p className="text-2xl font-bold text-red-600">-${settlement.deductions.toFixed(2)}</p>
                  <p className="text-xs text-slate-400 mt-1">Fuel, Insurance, Advances</p>
                </div>
                <div className="p-6 bg-green-50/50">
                  <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-1">Net Pay</p>
                  <p className="text-2xl font-bold text-emerald-700 flex items-center gap-2">
                    <DollarSign size={20} />
                    {settlement.netPay.toFixed(2)}
                  </p>
                  <p className="text-xs text-emerald-600/70 mt-1">Final Payout Amount</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Settlements;

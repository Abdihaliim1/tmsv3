
import React from 'react';
import { BarChart3 } from 'lucide-react';

const Reports: React.FC = () => {
  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto text-center py-20">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <BarChart3 size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Reports Module</h2>
        <p className="text-slate-500">Advanced reporting and analytics coming soon.</p>
    </div>
  );
};

export default Reports;

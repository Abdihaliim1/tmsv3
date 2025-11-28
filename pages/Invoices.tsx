
import React from 'react';
import { FileText, Download } from 'lucide-react';
import { useTMS } from '../context/TMSContext';

const Invoices: React.FC = () => {
  const { invoices } = useTMS();

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-500">Manage customer billing and payments</p>
        </div>
        <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2">
          <Download size={18} />
          <span>Export All</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Invoice #</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Load Ref</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-blue-600">{inv.invoiceNumber}</td>
                <td className="px-6 py-4 text-slate-600">{inv.date}</td>
                <td className="px-6 py-4 text-slate-900 font-medium">{inv.customerName}</td>
                <td className="px-6 py-4 text-slate-500 text-sm">Ref: LD-2025-00{inv.loadId}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                    inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                  }`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-bold text-slate-900">${inv.amount.toLocaleString()}</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-slate-400 hover:text-blue-600">
                    <FileText size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Invoices;

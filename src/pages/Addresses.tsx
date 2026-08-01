import React, { useMemo, useState } from 'react';
import { MapPin, Search, Trash2 } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import type { CustomerEntity as Customer } from '../types';

const AddressesPage: React.FC = () => {
  const { customers, deleteCustomer } = useTMS();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'broker' | 'shipper' | 'consignee' | 'customer'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (typeFilter !== 'all' && (c.type || 'customer') !== typeFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (c.name || '').toLowerCase().includes(q)
        || (c.city || '').toLowerCase().includes(q)
        || (c.state || '').toLowerCase().includes(q)
        || (c.address || '').toLowerCase().includes(q)
      );
    });
  }, [customers, search, typeFilter]);

  const handleDelete = async (customer: Customer) => {
    if (!window.confirm(`Delete "${customer.name}"? This cannot be undone.`)) return;
    setBusyId(customer.id);
    try {
      await Promise.resolve(deleteCustomer(customer.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete customer.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Addresses & Customers</h2>
            <p className="text-sm text-slate-600">
              Manage customers, shippers, and consignees created from Load Planner.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, city, or address…"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="px-3 py-2 border border-slate-300 rounded-lg"
          >
            <option value="all">All types</option>
            <option value="broker">Broker / Customer</option>
            <option value="shipper">Shipper</option>
            <option value="consignee">Consignee</option>
            <option value="customer">Customer</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Location</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  No addresses found.
                </td>
              </tr>
            ) : (
              filtered.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{customer.name}</div>
                    {customer.contactName && (
                      <div className="text-xs text-slate-500">{customer.contactName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 capitalize">
                    {customer.type || 'customer'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {[customer.address, customer.city, customer.state, customer.zipCode]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={busyId === customer.id}
                      onClick={() => void handleDelete(customer)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AddressesPage;

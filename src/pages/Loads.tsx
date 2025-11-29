import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Filter, Download, Search, Edit, Trash2, Eye, MoreHorizontal, X } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { LoadStatus, Load } from '../types';
import { calculateDistance } from '../services/utils';

const Loads: React.FC = () => {
  const { loads, drivers, addLoad, updateLoad, deleteLoad } = useTMS();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoad, setEditingLoad] = useState<Load | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [driverFilter, setDriverFilter] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Check for selected load from Dashboard navigation
  useEffect(() => {
    const selectedLoadId = sessionStorage.getItem('selectedLoadId');
    if (selectedLoadId) {
      const load = loads.find(l => l.id === selectedLoadId);
      if (load) {
        setEditingLoad(load);
        setIsModalOpen(true);
        // Clear the selected load ID after opening
        sessionStorage.removeItem('selectedLoadId');
      } else {
        // Load not found, clear the ID
        sessionStorage.removeItem('selectedLoadId');
      }
    }
  }, [loads]);

  // Get unique customers from loads
  const customers = useMemo(() => {
    const unique = new Set(loads.map(l => l.customerName));
    return Array.from(unique).sort();
  }, [loads]);

  // Filter loads
  const filteredLoads = useMemo(() => {
    return loads.filter(load => {
      const matchesStatus = !statusFilter || load.status === statusFilter;
      const matchesDriver = !driverFilter || load.driverId === driverFilter;
      const matchesCustomer = !customerFilter || load.customerName === customerFilter;
      const matchesSearch = !searchTerm ||
        load.loadNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        load.originCity.toLowerCase().includes(searchTerm.toLowerCase()) ||
        load.destCity.toLowerCase().includes(searchTerm.toLowerCase()) ||
        load.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesDriver && matchesCustomer && matchesSearch;
    });
  }, [loads, statusFilter, driverFilter, customerFilter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredLoads.length / itemsPerPage);
  const paginatedLoads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLoads.slice(start, start + itemsPerPage);
  }, [filteredLoads, currentPage]);

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

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleEdit = (load: Load) => {
    setEditingLoad(load);
    setIsModalOpen(true);
  };

  const handleDelete = (loadId: string) => {
    if (window.confirm('Are you sure you want to delete this load?')) {
      deleteLoad(loadId);
    }
  };

  const handleExport = () => {
    const csv = [
      ['Load #', 'Status', 'Customer', 'Driver', 'Origin', 'Destination', 'Rate', 'Miles', 'Rate/Mile'].join(','),
      ...filteredLoads.map(load => [
        load.loadNumber,
        load.status,
        load.customerName,
        load.driverName || 'Unassigned',
        `${load.originCity}, ${load.originState}`,
        `${load.destCity}, ${load.destState}`,
        load.rate,
        load.miles,
        (load.rate / (load.miles || 1)).toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `loads-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Load Management</h1>
          <p className="text-slate-600 mt-2">Manage all freight loads and shipments</p>
        </div>
        <button
          onClick={() => {
            setEditingLoad(null);
            setIsModalOpen(true);
          }}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Create New Load
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              {Object.values(LoadStatus).map(status => (
                <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Driver</label>
            <select
              value={driverFilter}
              onChange={(e) => {
                setDriverFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Drivers</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.firstName} {driver.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Customer</label>
            <select
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Customers</option>
              {customers.map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Load #, origin, destination..."
                className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Loads Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">All Loads</h3>
          <div className="flex items-center gap-4">
            <button
              onClick={handleExport}
              className="text-slate-600 hover:text-slate-800 flex items-center gap-2"
            >
              <Download size={18} />
              Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Load #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Origin → Destination
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {paginatedLoads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No loads found. Create a new load to get started.
                  </td>
                </tr>
              ) : (
                paginatedLoads.map(load => (
                  <tr key={load.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{load.loadNumber}</div>
                      <div className="text-sm text-slate-500">
                        Created: {new Date(load.pickupDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">
                        {load.originCity}, {load.originState}
                      </div>
                      <div className="text-sm text-slate-500">
                        → {load.destCity}, {load.destState}
                      </div>
                      <div className="text-xs text-slate-400">{load.miles} miles</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {load.customerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {load.driverName || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">
                        {formatCurrency(load.rate)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatCurrency(load.rate / (load.miles || 1))}/mile
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(load.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(load)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => {
                            alert(`Load #${load.loadNumber}\nStatus: ${load.status}\nCustomer: ${load.customerName}\nDriver: ${load.driverName || 'Unassigned'}\nRate: ${formatCurrency(load.rate)}\nMiles: ${load.miles}`);
                          }}
                          className="text-green-600 hover:text-green-900"
                          title="View"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(load.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-700">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(currentPage * itemsPerPage, filteredLoads.length)}
              </span>{' '}
              of <span className="font-medium">{filteredLoads.length}</span> loads
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    currentPage === page
                      ? 'text-white bg-blue-600 border border-transparent'
                      : 'text-slate-500 bg-white border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Load Modal */}
      {isModalOpen && (
        <LoadModal
          load={editingLoad}
          onClose={() => {
            setIsModalOpen(false);
            setEditingLoad(null);
          }}
          onSave={(loadData) => {
            if (editingLoad) {
              updateLoad(editingLoad.id, loadData);
            } else {
              addLoad(loadData);
            }
            setIsModalOpen(false);
            setEditingLoad(null);
          }}
        />
      )}
    </div>
  );
};

// Enhanced Load Modal Component
interface LoadModalProps {
  load: Load | null;
  onClose: () => void;
  onSave: (load: any) => void;
}

const LoadModal: React.FC<LoadModalProps> = ({ load, onClose, onSave }) => {
  const { drivers } = useTMS();
  const [formData, setFormData] = useState({
    loadNumber: load?.loadNumber || `LD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    status: load?.status || LoadStatus.Available,
    customerName: load?.customerName || '',
    driverId: load?.driverId || '',
    driverName: load?.driverName || '',
    originCity: load?.originCity || '',
    originState: load?.originState || '',
    destCity: load?.destCity || '',
    destState: load?.destState || '',
    pickupAddress: '',
    pickupZip: '',
    pickupDate: load?.pickupDate || '',
    deliveryAddress: '',
    deliveryZip: '',
    deliveryDate: load?.deliveryDate || '',
    rate: load?.rate || 0,
    ratePerMile: load?.rate / (load?.miles || 1) || 0,
    miles: load?.miles || 0,
    advanceAmount: 0,
    detentionPay: 0,
    lumperFees: 0,
    truckId: '',
  });

  const [selectedTruckId, setSelectedTruckId] = useState(load?.driverId ? drivers.find(d => d.id === load.driverId)?.truckId || '' : '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'rate' || name === 'ratePerMile' || name === 'miles' || name === 'advanceAmount' || name === 'detentionPay' || name === 'lumperFees'
        ? parseFloat(value) || 0
        : value
    }));

    // Auto-calculate rate per mile
    if (name === 'rate' || name === 'miles') {
      const rate = name === 'rate' ? parseFloat(value) || 0 : formData.rate;
      const miles = name === 'miles' ? parseFloat(value) || 0 : formData.miles;
      if (miles > 0) {
        setFormData(prev => ({ ...prev, ratePerMile: rate / miles }));
      }
    }
  };

  const handleDriverChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const driverId = e.target.value;
    const driver = drivers.find(d => d.id === driverId);
    
    if (driver) {
      setFormData(prev => ({
        ...prev,
        driverId: driver.id,
        driverName: `${driver.firstName} ${driver.lastName}`
      }));
      setSelectedTruckId(driver.truckId);
    } else {
      setFormData(prev => ({ ...prev, driverId: '', driverName: '' }));
      setSelectedTruckId('');
    }
  };

  const handleCalculateMiles = () => {
    if (!formData.originCity || !formData.originState || !formData.destCity || !formData.destState) {
      alert('Please enter pickup and delivery cities and states first');
      return;
    }

    const distance = calculateDistance(
      formData.originCity,
      formData.originState,
      formData.destCity,
      formData.destState
    );

    if (distance > 0) {
      setFormData(prev => ({
        ...prev,
        miles: distance,
        ratePerMile: prev.rate > 0 ? prev.rate / distance : 0
      }));
      alert(`Calculated ${distance} miles`);
    } else {
      alert('Could not calculate distance. Please enter miles manually.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      status: formData.status as LoadStatus,
    });
  };

  const US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-semibold">
            {load ? `Edit Load - ${load.loadNumber}` : 'Create New Load'}
          </h3>
          <button onClick={onClose} className="text-white hover:text-slate-200">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto p-6 flex-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Load Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Load Number</label>
                <input
                  type="text"
                  name="loadNumber"
                  value={formData.loadNumber}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  {Object.values(LoadStatus).map(status => (
                    <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Customer */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Customer</label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="Customer Name"
              />
            </div>

            {/* Pickup Information */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Pickup Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                  <input
                    type="text"
                    name="pickupAddress"
                    value={formData.pickupAddress}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                  <input
                    type="text"
                    name="originCity"
                    value={formData.originCity}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">State</label>
                  <select
                    name="originState"
                    value={formData.originState}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select State</option>
                    {US_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">ZIP Code</label>
                  <input
                    type="text"
                    name="pickupZip"
                    value={formData.pickupZip}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Scheduled Date</label>
                  <input
                    type="datetime-local"
                    name="pickupDate"
                    value={formData.pickupDate}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Information */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Delivery Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                  <input
                    type="text"
                    name="deliveryAddress"
                    value={formData.deliveryAddress}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                  <input
                    type="text"
                    name="destCity"
                    value={formData.destCity}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">State</label>
                  <select
                    name="destState"
                    value={formData.destState}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select State</option>
                    {US_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">ZIP Code</label>
                  <input
                    type="text"
                    name="deliveryZip"
                    value={formData.deliveryZip}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Scheduled Date</label>
                  <input
                    type="datetime-local"
                    name="deliveryDate"
                    value={formData.deliveryDate}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Financial Information */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Financial Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Total Rate</label>
                  <input
                    type="number"
                    name="rate"
                    value={formData.rate}
                    onChange={handleChange}
                    step="0.01"
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Rate Per Mile</label>
                  <input
                    type="number"
                    name="ratePerMile"
                    value={formData.ratePerMile.toFixed(2)}
                    onChange={handleChange}
                    step="0.01"
                    disabled
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Total Miles</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      name="miles"
                      value={formData.miles}
                      onChange={handleChange}
                      required
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleCalculateMiles}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      Calculate
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Advance Amount</label>
                  <input
                    type="number"
                    name="advanceAmount"
                    value={formData.advanceAmount}
                    onChange={handleChange}
                    step="0.01"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Detention Pay</label>
                  <input
                    type="number"
                    name="detentionPay"
                    value={formData.detentionPay}
                    onChange={handleChange}
                    step="0.01"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Lumper Fees</label>
                  <input
                    type="number"
                    name="lumperFees"
                    value={formData.lumperFees}
                    onChange={handleChange}
                    step="0.01"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Driver Assignment */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Driver Assignment</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Driver</label>
                  <select
                    name="driverId"
                    value={formData.driverId}
                    onChange={handleDriverChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.firstName} {driver.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Truck</label>
                  <input
                    type="text"
                    value={selectedTruckId || 'N/A'}
                    disabled
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="border-t pt-6 flex justify-end gap-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCalculateMiles}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Calculate Mileage
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Load
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Loads;

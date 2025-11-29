import React, { useState, useMemo } from 'react';
import { Plus, Truck, CheckCircle, Wrench, Search, Edit, Trash2, X, Calculator } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { Truck as TruckType, TruckStatus, TruckOwnership, InsurancePaidBy, NewTruckInput } from '../types';

const Fleet: React.FC = () => {
  const { trucks, drivers, loads, addTruck, updateTruck, deleteTruck } = useTMS();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<TruckType | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [profitDateFrom, setProfitDateFrom] = useState<string>(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  const [profitDateTo, setProfitDateTo] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Filter trucks
  const filteredTrucks = useMemo(() => {
    return trucks.filter(truck => {
      const matchesStatus = !statusFilter || truck.status === statusFilter;
      const matchesSearch = !searchTerm ||
        truck.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.licensePlate.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [trucks, statusFilter, searchTerm]);

  // Overview stats
  const stats = useMemo(() => {
    return {
      total: trucks.length,
      available: trucks.filter(t => t.status === 'available').length,
      inTransit: trucks.filter(t => t.status === 'in_transit').length,
      maintenance: trucks.filter(t => t.status === 'maintenance' || t.status === 'repair').length,
    };
  }, [trucks]);

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusColor = (status: TruckStatus) => {
    const colors = {
      'available': 'bg-green-100 text-green-800',
      'in_transit': 'bg-blue-100 text-blue-800',
      'maintenance': 'bg-red-100 text-red-800',
      'repair': 'bg-yellow-100 text-yellow-800',
      'out_of_service': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getOwnershipLabel = (ownership: TruckOwnership) => {
    const labels = {
      'owned': 'Company Owned',
      'leased': 'Company Leased',
      'financed': 'Financed (Loan)',
      'owner_operator': 'Owner Operator',
    };
    return labels[ownership] || 'Unknown';
  };

  const handleEdit = (truck: TruckType) => {
    setEditingTruck(truck);
    setIsModalOpen(true);
  };

  const handleDelete = (truckId: string) => {
    if (window.confirm('Are you sure you want to delete this truck?')) {
      deleteTruck(truckId);
    }
  };

  const calculateTruckProfitability = () => {
    if (!profitDateFrom || !profitDateTo) {
      alert('Please select both start and end dates');
      return;
    }

    const startDate = new Date(profitDateFrom);
    const endDate = new Date(profitDateTo);
    endDate.setHours(23, 59, 59, 999);

    // Filter only company-owned, leased, or financed trucks
    const companyTrucks = trucks.filter(t =>
      t.ownership === 'owned' || t.ownership === 'leased' || t.ownership === 'financed'
    );

    if (companyTrucks.length === 0) {
      alert('No company-owned or leased trucks found');
      return;
    }

    // This would calculate profitability - for now just show alert
    alert(`Calculating profitability for ${companyTrucks.length} truck(s) from ${profitDateFrom} to ${profitDateTo}`);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Fleet Management</h1>
          <p className="text-slate-600 mt-2">Manage your trucks and maintenance schedules</p>
        </div>
        <button
          onClick={() => {
            setEditingTruck(null);
            setIsModalOpen(true);
          }}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Add Truck
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Trucks</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Truck size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Available</p>
              <p className="text-2xl font-bold text-green-600">{stats.available}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={24} className="text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">In Transit</p>
              <p className="text-2xl font-bold text-blue-600">{stats.inTransit}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Truck size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Maintenance</p>
              <p className="text-2xl font-bold text-red-600">{stats.maintenance}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <Wrench size={24} className="text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Truck Profitability Section */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900">Truck Profitability</h2>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={profitDateFrom}
                onChange={(e) => setProfitDateFrom(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={profitDateTo}
                onChange={(e) => setProfitDateTo(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={calculateTruckProfitability}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
              >
                <Calculator size={16} />
                Calculate Profit
              </button>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="text-center text-slate-500 py-8">
            Select date range and click "Calculate Profit" to see truck profitability
          </div>
        </div>
      </div>

      {/* Fleet Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900">Fleet Inventory</h2>
            <div className="flex gap-3">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search trucks..."
                  className="pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                {(['available', 'in_transit', 'maintenance', 'repair', 'out_of_service'] as TruckStatus[]).map(status => (
                  <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Truck</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ownership</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Driver</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mileage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Last Service</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredTrucks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    No trucks found. Add a new truck to get started.
                  </td>
                </tr>
              ) : (
                filteredTrucks.map(truck => {
                  const driver = drivers.find(d => d.truckId === truck.id || d.id === truck.assignedDriver);
                  const driverName = driver ? `${driver.firstName} ${driver.lastName}` : 'Unassigned';

                  return (
                    <tr key={truck.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{truck.number}</div>
                        <div className="text-sm text-slate-500">{truck.make} {truck.model}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-900">{getOwnershipLabel(truck.ownership)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(truck.status)}`}>
                          {truck.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {driverName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {(truck.currentMileage || 0).toLocaleString()} mi
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {truck.lastServiceDate ? new Date(truck.lastServiceDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(truck)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(truck.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Truck Modal */}
      {isModalOpen && (
        <TruckModal
          truck={editingTruck}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTruck(null);
          }}
          onSave={(truckData) => {
            if (editingTruck) {
              updateTruck(editingTruck.id, truckData);
            } else {
              addTruck(truckData);
            }
            setIsModalOpen(false);
            setEditingTruck(null);
          }}
        />
      )}
    </div>
  );
};

// Truck Modal Component
interface TruckModalProps {
  truck: TruckType | null;
  onClose: () => void;
  onSave: (truck: NewTruckInput) => void;
}

const TruckModal: React.FC<TruckModalProps> = ({ truck, onClose, onSave }) => {
  const { drivers } = useTMS();
  const [formData, setFormData] = useState<Partial<NewTruckInput>>({
    number: truck?.number || '',
    licensePlate: truck?.licensePlate || '',
    make: truck?.make || '',
    model: truck?.model || '',
    year: truck?.year || new Date().getFullYear(),
    vin: truck?.vin || '',
    status: truck?.status || 'available',
    ownership: truck?.ownership || 'owned',
    currentMileage: truck?.currentMileage || 0,
    assignedDriver: truck?.assignedDriver || '',
    lastServiceDate: truck?.lastServiceDate || '',
    registrationExpiry: truck?.registrationExpiry || '',
    inspectionDueDate: truck?.inspectionDueDate || '',
    cabCardRenewalDate: truck?.cabCardRenewalDate || '',
    monthlyPayment: truck?.monthlyPayment || 0,
    purchasePrice: truck?.purchasePrice || 0,
    leaseEndDate: truck?.leaseEndDate || '',
    payoffAmount: truck?.payoffAmount || 0,
    ownerOperatorDriverId: truck?.ownerOperatorDriverId || '',
    insurancePaidBy: truck?.insurancePaidBy || 'company',
    monthlyInsuranceCost: truck?.monthlyInsuranceCost || 0,
    insuranceExpirationDate: truck?.insuranceExpirationDate || '',
    notes: truck?.notes || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'year' || name === 'currentMileage' || name === 'monthlyPayment' || name === 'purchasePrice' || name === 'payoffAmount' || name === 'monthlyInsuranceCost'
        ? (value ? parseFloat(value) : 0)
        : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as NewTruckInput);
  };

  const TRUCK_MAKES = ['Freightliner', 'Peterbilt', 'Kenworth', 'Volvo', 'Mack', 'International', 'Western Star'];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-semibold">
            {truck ? `Edit Truck ${truck.number}` : 'Add New Vehicle'}
          </h3>
          <button onClick={onClose} className="text-white hover:text-slate-200">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto p-6 flex-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Truck Number *</label>
                <input
                  type="text"
                  name="number"
                  value={formData.number}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">License Plate *</label>
                <input
                  type="text"
                  name="licensePlate"
                  value={formData.licensePlate}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Make *</label>
                <select
                  name="make"
                  value={formData.make}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Make</option>
                  {TRUCK_MAKES.map(make => (
                    <option key={make} value={make}>{make}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Model *</label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Year *</label>
                <input
                  type="number"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  min="1990"
                  max="2030"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">VIN *</label>
                <input
                  type="text"
                  name="vin"
                  value={formData.vin}
                  onChange={handleChange}
                  maxLength={17}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status *</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(['available', 'in_transit', 'maintenance', 'repair', 'out_of_service'] as TruckStatus[]).map(status => (
                    <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ownership Type *</label>
                <select
                  name="ownership"
                  value={formData.ownership}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Ownership</option>
                  {(['owned', 'leased', 'financed', 'owner_operator'] as TruckOwnership[]).map(ownership => (
                    <option key={ownership} value={ownership}>
                      {ownership === 'owned' ? 'Owned (Fully Paid)' :
                       ownership === 'leased' ? 'Leased' :
                       ownership === 'financed' ? 'Financed (Loan)' :
                       'Owner Operator'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  <strong>Owned:</strong> Fully paid, company owns title<br />
                  <strong>Leased:</strong> Monthly lease payment, return at end<br />
                  <strong>Financed:</strong> Monthly loan payment, company owns eventually<br />
                  <strong>Owner Operator:</strong> O/O truck, not included in company P&L
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Mileage</label>
                <input
                  type="number"
                  name="currentMileage"
                  value={formData.currentMileage}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Driver</label>
                <select
                  name="assignedDriver"
                  value={formData.assignedDriver}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {drivers.filter(d => d.status === 'active').map(driver => (
                    <option key={driver.id} value={driver.id}>
                      {driver.firstName} {driver.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last Service Date</label>
                <input
                  type="date"
                  name="lastServiceDate"
                  value={formData.lastServiceDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Insurance Configuration */}
            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Insurance Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Insurance Paid By *</label>
                  <select
                    name="insurancePaidBy"
                    value={formData.insurancePaidBy}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="company">Company</option>
                    <option value="owner_operator">Owner Operator</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    <strong>Company:</strong> Monthly recurring expense, allocated to truck<br />
                    <strong>Owner Operator:</strong> O/O provides proof, track expiration
                  </p>
                </div>
                {formData.insurancePaidBy === 'company' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Insurance Cost</label>
                    <input
                      type="number"
                      name="monthlyInsuranceCost"
                      value={formData.monthlyInsuranceCost}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="500.00"
                    />
                    <p className="text-xs text-slate-500 mt-1">Monthly insurance premium (e.g., $500/month)</p>
                  </div>
                )}
                {formData.insurancePaidBy === 'owner_operator' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Insurance Expiration Date</label>
                    <input
                      type="date"
                      name="insuranceExpirationDate"
                      value={formData.insuranceExpirationDate}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">O/O insurance certificate expiration</p>
                  </div>
                )}
              </div>
            </div>

            {/* Financial Information */}
            {(formData.ownership === 'owned' || formData.ownership === 'leased' || formData.ownership === 'financed') && (
              <div className="border-t pt-4">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Financial Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(formData.ownership === 'leased' || formData.ownership === 'financed') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Payment *</label>
                      <input
                        type="number"
                        name="monthlyPayment"
                        value={formData.monthlyPayment}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        required={formData.ownership === 'leased' || formData.ownership === 'financed'}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                      <p className="text-xs text-slate-500 mt-1">Monthly lease or loan payment</p>
                    </div>
                  )}
                  {(formData.ownership === 'owned' || formData.ownership === 'financed') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Price</label>
                      <input
                        type="number"
                        name="purchasePrice"
                        value={formData.purchasePrice}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                      <p className="text-xs text-slate-500 mt-1">Original purchase price (for ROI/depreciation)</p>
                    </div>
                  )}
                  {formData.ownership === 'leased' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Lease End Date</label>
                      <input
                        type="date"
                        name="leaseEndDate"
                        value={formData.leaseEndDate}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">When lease expires (return or buy out)</p>
                    </div>
                  )}
                  {formData.ownership === 'financed' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Remaining Payoff Amount</label>
                      <input
                        type="number"
                        name="payoffAmount"
                        value={formData.payoffAmount}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                      <p className="text-xs text-slate-500 mt-1">Current remaining loan balance</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Owner Operator Link */}
            {formData.ownership === 'owner_operator' && (
              <div className="border-t pt-4">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Owner Operator Information</h4>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Owner Operator Driver</label>
                  <select
                    name="ownerOperatorDriverId"
                    value={formData.ownerOperatorDriverId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select O/O Driver</option>
                    {drivers.filter(d => d.type === 'OwnerOperator').map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.firstName} {driver.lastName}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Link this truck to an Owner Operator driver</p>
                </div>
              </div>
            )}

            {/* Compliance & Expiration Dates */}
            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Compliance & Expiration Dates</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Registration Expiry *</label>
                  <input
                    type="date"
                    name="registrationExpiry"
                    value={formData.registrationExpiry}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Vehicle registration expiration</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Annual Inspection Due *</label>
                  <input
                    type="date"
                    name="inspectionDueDate"
                    value={formData.inspectionDueDate}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Next annual inspection date</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cab Card (IRP) Renewal</label>
                  <input
                    type="date"
                    name="cabCardRenewalDate"
                    value={formData.cabCardRenewalDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">IRP cab card renewal date</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Save Truck
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Fleet;


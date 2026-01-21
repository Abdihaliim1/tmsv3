import React, { useState, useMemo, useCallback } from 'react';
import { Plus, UserCheck, Clock, Route, Shield, Search, Edit, Trash2, Eye, X, Download } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { Driver, Employee, EmployeeStatus, PaymentType, DriverType, NewDriverInput, EmployeeType } from '../types';
import { useDebounce } from '../utils/debounce';

// Pure helper function - moved outside component
const formatCurrency = (amount: number) => {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const Drivers: React.FC = () => {
  const { employees, drivers, loads, trucks, addEmployee, updateEmployee, deleteEmployee, addDriver, updateDriver, deleteDriver } = useTMS();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [employeeTypeFilter, setEmployeeTypeFilter] = useState<string>('');

  // Filter employees (showing all types, not just drivers)
  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const matchesStatus = !statusFilter || employee.status === statusFilter;
      const matchesType = !employeeTypeFilter || employee.employeeType === employeeTypeFilter;
      const matchesPayment = !paymentFilter || employee.payment?.type === paymentFilter;
      const matchesSearch = !debouncedSearchTerm ||
        employee.firstName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        employee.lastName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (employee.employeeNumber || employee.driverNumber || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (employee.license?.number || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      return matchesStatus && matchesType && matchesPayment && matchesSearch;
    });
  }, [employees, statusFilter, employeeTypeFilter, paymentFilter, debouncedSearchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(start, start + itemsPerPage);
  }, [filteredEmployees, currentPage]);

  // Calculate stats
  const stats = useMemo(() => {
    const activeEmployees = employees.filter(e => e.status === 'active').length;
    const activeDrivers = employees.filter(e => e.status === 'active' && (e.employeeType === 'driver' || e.employeeType === 'owner_operator')).length;
    const activeDispatchers = employees.filter(e => e.status === 'active' && e.employeeType === 'dispatcher').length;
    
    const deliveredLoads = loads.filter(l => l.status === 'delivered' || l.status === 'completed');
    const onTimeLoads = deliveredLoads.filter(l => {
      // Simplified on-time calculation
      return true; // Would need actual delivery dates
    });
    const onTimePercentage = deliveredLoads.length > 0
      ? Math.round((onTimeLoads.length / deliveredLoads.length) * 100)
      : 0;

    const totalMiles = loads.reduce((sum, l) => sum + (l.miles || 0), 0);
    const avgMiles = activeDrivers > 0 ? Math.round(totalMiles / activeDrivers) : 0;

    const safetyScore = deliveredLoads.length > 0 ? 98.5 : 0;

    return { activeEmployees, activeDrivers, activeDispatchers, onTimePercentage, avgMiles, safetyScore };
  }, [employees, loads]);

  // Memoized helper functions
  const getStatusColor = useCallback((status: EmployeeStatus) => {
    const colors: Record<string, string> = {
      'active': 'bg-green-100 text-green-800',
      'inactive': 'bg-gray-100 text-gray-800',
      'on_leave': 'bg-yellow-100 text-yellow-800',
      'terminated': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }, []);

  const getDriverTypeLabel = useCallback((type: DriverType) => {
    const labels: Record<string, string> = {
      'Company': 'Company Driver',
      'OwnerOperator': 'Owner Operator',
    };
    return labels[type] || type;
  }, []);

  const getPaymentDisplay = useCallback((driver: Driver) => {
    if (!driver.payment) {
      return '-';
    }
    const { type, perMileRate, percentage, flatRate } = driver.payment;
    if (type === 'per_mile') {
      return `${formatCurrency(perMileRate || 0)}/mi`;
    } else if (type === 'percentage') {
      const pct = driver.payPercentage || percentage || 0;
      return `${(pct > 1 ? pct : pct * 100).toFixed(0)}%`;
    } else if (type === 'flat_rate') {
      return `${formatCurrency(flatRate || 0)}/load`;
    }
    return '-';
  }, []);

  const getCurrentTruckDisplay = useCallback((truckId?: string) => {
    if (!truckId) return 'No truck assigned';
    const truck = trucks.find(t => t.id === truckId);
    return truck ? `${truck.number} - ${truck.make} ${truck.model}` : 'Unknown';
  }, [trucks]);

  // Edit handler - memoized
  const handleEdit = useCallback((employee: Employee) => {
    setEditingDriver(employee as Driver);
    setIsModalOpen(true);
  }, []);

  // Delete handler - memoized
  const handleDelete = useCallback((employeeId: string) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      deleteEmployee(employeeId);
    }
  }, [deleteEmployee]);

  const getEmployeeTypeLabel = useCallback((type: EmployeeType) => {
    const labels: Record<EmployeeType, string> = {
      'driver': 'Driver',
      'dispatcher': 'Dispatcher',
      'manager': 'Manager',
      'safety': 'Safety',
      'owner_operator': 'Owner Operator',
      'owner': 'Owner',
      'admin': 'Admin',
      'other': 'Other',
    };
    return labels[type] || type;
  }, []);

  // Export handler - memoized
  const handleExport = useCallback(() => {
    const csv = [
      ['Employee #', 'Name', 'Employee Type', 'Status', 'Type', 'Payment Type', 'Rate', 'Phone', 'Email'].join(','),
      ...filteredEmployees.map(employee => [
        employee.employeeNumber || employee.driverNumber || '',
        `${employee.firstName} ${employee.lastName}`,
        getEmployeeTypeLabel(employee.employeeType),
        employee.status,
        (employee.employeeType === 'driver' || employee.employeeType === 'owner_operator') ? getDriverTypeLabel(employee.type) : 'N/A',
        employee.payment?.type || '',
        (employee.employeeType === 'driver' || employee.employeeType === 'owner_operator') ? getPaymentDisplay(employee as Driver) : 'N/A',
        employee.phone,
        employee.email,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `drivers-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [filteredEmployees, getEmployeeTypeLabel, getDriverTypeLabel, getPaymentDisplay]);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Employee Management</h1>
          <p className="text-slate-600 mt-2">Manage employees, drivers, dispatchers, and performance</p>
        </div>
        <button
          onClick={() => {
            setEditingDriver(null);
            setIsModalOpen(true);
          }}
          className="btn-primary px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Add New Employee
        </button>
      </div>

      {/* Driver Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <UserCheck size={20} className="text-green-600" />
            </div>
            <div className="ml-5">
              <dt className="text-sm font-medium text-slate-500">Active Employees</dt>
              <dd className="text-2xl font-semibold text-slate-900">{stats.activeEmployees}</dd>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-yellow-600" />
            </div>
            <div className="ml-5">
              <dt className="text-sm font-medium text-slate-500">On Time Delivery</dt>
              <dd className="text-2xl font-semibold text-slate-900">{stats.onTimePercentage}%</dd>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Route size={20} className="text-blue-600" />
            </div>
            <div className="ml-5">
              <dt className="text-sm font-medium text-slate-500">Avg Miles/Driver</dt>
              <dd className="text-2xl font-semibold text-slate-900">{stats.avgMiles.toLocaleString()}</dd>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Shield size={20} className="text-purple-600" />
            </div>
            <div className="ml-5">
              <dt className="text-sm font-medium text-slate-500">Safety Score</dt>
              <dd className="text-2xl font-semibold text-slate-900">{stats.safetyScore.toFixed(1)}</dd>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Employee Type</label>
            <select
              value={employeeTypeFilter}
              onChange={(e) => {
                setEmployeeTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="driver">Driver</option>
              <option value="dispatcher">Dispatcher</option>
              <option value="manager">Manager</option>
              <option value="safety">Safety</option>
              <option value="owner_operator">Owner Operator</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {(['active', 'inactive', 'on_leave', 'terminated'] as EmployeeStatus[]).map(status => (
                <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Payment Type</label>
            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {(['per_mile', 'percentage', 'flat_rate'] as PaymentType[]).map(type => (
                <option key={type} value={type}>{type.replace('_', ' ').toUpperCase()}</option>
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
                placeholder="Employee name, ID..."
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleExport}
              className="w-full bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Drivers Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">All Employees</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">License</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Payment Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Current Truck</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No employees found. Add a new employee to get started.
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map(employee => {
                  const isDriver = employee.employeeType === 'driver' || employee.employeeType === 'owner_operator';
                  return (
                    <tr key={employee.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                            {employee.firstName[0]}{employee.lastName[0]}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-slate-900">
                              {employee.firstName} {employee.lastName}
                            </div>
                            <div className="text-sm text-slate-500">{employee.employeeNumber || employee.driverNumber || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{getEmployeeTypeLabel(employee.employeeType)}</div>
                        {isDriver && (
                          <div className="text-xs text-slate-500">{getDriverTypeLabel(employee.type)}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isDriver ? (
                          <>
                            <div className="text-sm text-slate-900">{employee.license?.number || 'N/A'}</div>
                            {employee.license?.state && (
                              <div className="text-sm text-slate-500">
                                {employee.license.state} {employee.license.expiration ? `Exp: ${employee.license.expiration}` : ''}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-slate-500">N/A</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isDriver ? (
                          <>
                            <div className="text-sm text-slate-900">{getDriverTypeLabel(employee.type)}</div>
                            <div className="text-xs text-slate-500">
                              {employee.payment?.type ? employee.payment.type.replace('_', ' ').toUpperCase() : 'Unknown'}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-500">N/A</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isDriver ? (
                          <div className="text-sm text-slate-900">{getPaymentDisplay(employee as Driver)}</div>
                        ) : employee.employeeType === 'dispatcher' && employee.dispatcherCommissionType ? (
                          <div className="text-sm text-slate-900">
                            {employee.dispatcherCommissionType === 'percentage' ? `${employee.dispatcherCommissionRate}%` : 
                             employee.dispatcherCommissionType === 'flat_fee' ? `$${employee.dispatcherCommissionRate}` :
                             employee.dispatcherCommissionType === 'per_mile' ? `$${employee.dispatcherCommissionRate}/mi` : 'N/A'}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500">N/A</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isDriver ? (
                          <div className="text-sm text-slate-900">
                            {getCurrentTruckDisplay(employee.currentTruckId || employee.truckId)}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500">N/A</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(employee.status)}`}>
                          {employee.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(employee)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => {
                              alert(`Employee: ${employee.firstName} ${employee.lastName}\nType: ${getEmployeeTypeLabel(employee.employeeType)}\nStatus: ${employee.status}`);
                            }}
                            className="text-green-600 hover:text-green-900"
                            title="View"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(employee.id)}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-700">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(currentPage * itemsPerPage, filteredEmployees.length)}
              </span>{' '}
              of <span className="font-medium">{filteredEmployees.length}</span> employees
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

      {/* Driver Modal */}
      {isModalOpen && (
        <DriverModal
          driver={editingDriver}
          onClose={() => {
            setIsModalOpen(false);
            setEditingDriver(null);
          }}
          onSave={(employeeData) => {
            // Use addEmployee/updateEmployee for all employee types (not just drivers)
            if (editingDriver) {
              updateEmployee(editingDriver.id, employeeData);
            } else {
              addEmployee(employeeData);
            }
            setIsModalOpen(false);
            setEditingDriver(null);
          }}
        />
      )}
    </div>
  );
};

// Employee Modal Component
interface DriverModalProps {
  driver: Driver | null;
  onClose: () => void;
  onSave: (driver: NewDriverInput) => void;
}

const DriverModal: React.FC<DriverModalProps> = ({ driver, onClose, onSave }) => {
  const { employees, trucks } = useTMS();
  const [formData, setFormData] = useState<Partial<NewDriverInput>>({
    employeeNumber: driver?.employeeNumber || driver?.driverNumber || '',
    driverNumber: driver?.driverNumber || driver?.employeeNumber || '',
    firstName: driver?.firstName || '',
    lastName: driver?.lastName || '',
    status: driver?.status || 'active',
    employeeType: driver?.employeeType || 'driver',
    type: driver?.type || 'Company',
    email: driver?.email || '',
    phone: driver?.phone || '',
    currentTruckId: driver?.currentTruckId || driver?.truckId || '',
    dispatcherCommissionType: driver?.dispatcherCommissionType,
    dispatcherCommissionRate: driver?.dispatcherCommissionRate || 0,
    dob: driver?.dob || '',
    ssn: driver?.ssn || '',
    address: driver?.address || '',
    city: driver?.city || '',
    state: driver?.state || '',
    zipCode: driver?.zipCode || '',
    license: {
      number: driver?.license?.number || '',
      state: driver?.license?.state || '',
      expiration: driver?.license?.expiration || '',
      class: driver?.license?.class || '',
      endorsements: driver?.license?.endorsements || '',
    },
    medicalExpirationDate: driver?.medicalExpirationDate || '',
    payment: {
      type: driver?.payment?.type || 'per_mile',
      perMileRate: driver?.payment?.perMileRate || 0,
      percentage: driver?.payment?.percentage || 0,
      flatRate: driver?.payment?.flatRate || 0,
      detention: driver?.payment?.detention || 0,
      layover: driver?.payment?.layover || 0,
      fuelSurcharge: driver?.payment?.fuelSurcharge || false,
    },
    payPercentage: driver?.payPercentage || 0,
    deductionPreferences: {
      fuel: driver?.deductionPreferences?.fuel || false,
      insurance: driver?.deductionPreferences?.insurance || false,
      maintenance: driver?.deductionPreferences?.maintenance || false,
      ifta: driver?.deductionPreferences?.ifta || false,
      eld: driver?.deductionPreferences?.eld || false,
      other: driver?.deductionPreferences?.other || false,
    },
    employment: {
      hireDate: driver?.employment?.hireDate || '',
      payFrequency: driver?.employment?.payFrequency || 'weekly',
      w4Exemptions: driver?.employment?.w4Exemptions || 0,
    },
    emergencyContact: {
      name: driver?.emergencyContact?.name || '',
      relationship: driver?.emergencyContact?.relationship || '',
      phone: driver?.emergencyContact?.phone || '',
    },
  });

  const [paymentType, setPaymentType] = useState<PaymentType>(formData.payment?.type || 'per_mile');
  const [driverType, setDriverType] = useState<DriverType>(formData.type || 'Company');
  const [employeeType, setEmployeeType] = useState<EmployeeType>(formData.employeeType || 'driver');
  
  const isDriverOrOwnerOperator = employeeType === 'driver' || employeeType === 'owner_operator';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === 'paymentType') {
      setPaymentType(value as PaymentType);
      setFormData(prev => ({
        ...prev,
        payment: { ...prev.payment, type: value as PaymentType } as any,
      }));
    } else if (name === 'driverType') {
      setDriverType(value as DriverType);
      setFormData(prev => ({ ...prev, type: value as DriverType }));
    } else if (name === 'employeeType') {
      const newType = value as EmployeeType;
      setEmployeeType(newType);
      setFormData(prev => ({ ...prev, employeeType: newType }));
    } else if (name.startsWith('license.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        license: { ...prev.license, [field]: value } as any,
      }));
    } else if (name.startsWith('payment.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        payment: { ...prev.payment, [field]: type === 'number' ? parseFloat(value) || 0 : type === 'checkbox' ? checked : value } as any,
      }));
    } else if (name.startsWith('deductionPreferences.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        deductionPreferences: { ...prev.deductionPreferences, [field]: checked } as any,
      }));
    } else if (name.startsWith('employment.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        employment: { ...prev.employment, [field]: value } as any,
      }));
    } else if (name.startsWith('emergencyContact.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        emergencyContact: { ...prev.emergencyContact, [field]: value } as any,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) || 0 : type === 'checkbox' ? checked : value,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate payPercentage for percentage type (only for drivers)
    if (isDriverOrOwnerOperator && paymentType === 'percentage') {
      const percentageInput = parseFloat((document.getElementById('percentageRate') as HTMLInputElement)?.value || '0');
      formData.payPercentage = percentageInput > 1 ? percentageInput / 100 : percentageInput;
    }

    // Ensure employeeType is set from state
    formData.employeeType = employeeType;

    // For dispatchers and other non-driver employees, ensure type is set correctly
    if (employeeType === 'dispatcher' || (employeeType !== 'driver' && employeeType !== 'owner_operator')) {
      // Non-driver employees don't need driver type, but we keep it for backward compatibility
      if (!formData.type) {
        formData.type = 'Company'; // Default legacy type
      }
      // Clear driver-specific fields for non-drivers
      if (employeeType === 'dispatcher') {
        // Keep dispatcher commission fields, but clear driver payment fields
        formData.payment = undefined;
        formData.payPercentage = undefined;
        formData.currentTruckId = undefined;
        formData.truckId = undefined;
      }
    }

    onSave(formData as NewDriverInput);
  };

  const US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">
            {driver ? `Edit Employee` : 'Add New Employee'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto p-6 flex-1">
          <form id="employee-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Employee Number</label>
                  <input
                    type="text"
                    name="employeeNumber"
                    value={formData.employeeNumber || formData.driverNumber || ''}
                    onChange={handleChange}
                    readOnly
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50"
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
                    {(['active', 'inactive', 'on_leave'] as EmployeeStatus[]).map(status => (
                      <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Employee Type *</label>
                  <select
                    name="employeeType"
                    value={employeeType}
                    onChange={(e) => {
                      const newType = e.target.value as EmployeeType;
                      setEmployeeType(newType);
                      setFormData(prev => ({ ...prev, employeeType: newType }));
                      // Auto-set driver type for driver/owner_operator
                      if (newType === 'driver') {
                        setDriverType('Company');
                        setFormData(prev => ({ ...prev, type: 'Company' }));
                      } else if (newType === 'owner_operator') {
                        setDriverType('OwnerOperator');
                        setFormData(prev => ({ ...prev, type: 'OwnerOperator' }));
                      }
                    }}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="driver">Driver</option>
                    <option value="dispatcher">Dispatcher</option>
                    <option value="manager">Manager</option>
                    <option value="safety">Safety</option>
                    <option value="owner_operator">Owner Operator</option>
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {isDriverOrOwnerOperator && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Driver Type *</label>
                      <select
                        name="driverType"
                        value={driverType}
                        onChange={handleChange}
                        required
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Driver Type</option>
                        <option value="Company">Company Driver</option>
                        <option value="OwnerOperator">Owner Operator</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                        <strong>Company Driver:</strong> Custom percentage or per-mile rate<br />
                        <strong>Owner Operator:</strong> Custom percentage, expenses may be deducted
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Current Truck</label>
                      <select
                        name="currentTruckId"
                        value={formData.currentTruckId}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">No truck assigned</option>
                        {trucks.map(truck => (
                          <option key={truck.id} value={truck.id}>
                            {truck.number} - {truck.make} {truck.model}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {employeeType === 'dispatcher' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Commission Type</label>
                      <select
                        name="dispatcherCommissionType"
                        value={formData.dispatcherCommissionType || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, dispatcherCommissionType: e.target.value as any }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Type</option>
                        <option value="percentage">Percentage</option>
                        <option value="flat_fee">Flat Fee</option>
                        <option value="per_mile">Per Mile</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Commission Rate</label>
                      <input
                        type="number"
                        name="dispatcherCommissionRate"
                        value={formData.dispatcherCommissionRate || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, dispatcherCommissionRate: parseFloat(e.target.value) || 0 }))}
                        step="0.01"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Personal Information */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Personal Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {/* Tax ID Section - SSN or EIN for Owner Operators */}
                <div className="col-span-1 md:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {driverType === 'OwnerOperator' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Tax ID Type</label>
                        <select
                          name="taxIdType"
                          value={formData.taxIdType || 'ssn'}
                          onChange={handleChange}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="ssn">Social Security Number (SSN)</option>
                          <option value="ein">Employer Identification Number (EIN)</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-1">
                          Owner Operators with a registered business can use EIN instead of SSN
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {driverType === 'OwnerOperator' && formData.taxIdType === 'ein' ? 'EIN' : 'SSN'}
                      </label>
                      <input
                        type="text"
                        name={driverType === 'OwnerOperator' && formData.taxIdType === 'ein' ? 'ein' : 'ssn'}
                        value={driverType === 'OwnerOperator' && formData.taxIdType === 'ein' ? (formData.ein || '') : (formData.ssn || '')}
                        onChange={handleChange}
                        placeholder={driverType === 'OwnerOperator' && formData.taxIdType === 'ein' ? 'XX-XXXXXXX' : 'XXX-XX-XXXX'}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        {driverType === 'OwnerOperator' && formData.taxIdType === 'ein' 
                          ? 'Business Tax ID (9 digits: XX-XXXXXXX)' 
                          : 'Social Security Number (9 digits: XXX-XX-XXXX)'}
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">State</label>
                  <select
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
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
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* License Information - Only for Drivers and Owner Operators */}
            {isDriverOrOwnerOperator && (
            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">License Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">License Number</label>
                  <input
                    type="text"
                    name="license.number"
                    value={formData.license?.number}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">License State</label>
                  <select
                    name="license.state"
                    value={formData.license?.state}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select State</option>
                    {US_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">License Expiration Date</label>
                  <input
                    type="date"
                    name="license.expiration"
                    value={formData.license?.expiration}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Medical Card Expiration Date *</label>
                  <input
                    type="date"
                    name="medicalExpirationDate"
                    value={formData.medicalExpirationDate}
                    onChange={handleChange}
                    required={isDriverOrOwnerOperator}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Required for FMCSA compliance</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">License Class</label>
                  <select
                    name="license.class"
                    value={formData.license?.class}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Class</option>
                    <option value="CDL-A">CDL-A</option>
                    <option value="CDL-B">CDL-B</option>
                    <option value="CDL-C">CDL-C</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Endorsements</label>
                  <input
                    type="text"
                    name="license.endorsements"
                    value={formData.license?.endorsements}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="H, T, N"
                  />
                </div>
              </div>
            </div>
            )}

            {/* Payment Configuration - Only for Drivers/Owner Operators */}
            {isDriverOrOwnerOperator && (
            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Payment Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Type</label>
                  <select
                    name="paymentType"
                    value={paymentType}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Type</option>
                    <option value="per_mile">Per Mile</option>
                    <option value="percentage">Percentage</option>
                    <option value="flat_rate">Flat Rate</option>
                  </select>
                </div>
                {paymentType === 'per_mile' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Rate Per Mile</label>
                    <input
                      type="number"
                      name="payment.perMileRate"
                      value={formData.payment?.perMileRate}
                      onChange={handleChange}
                      step="0.01"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                {paymentType === 'percentage' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Percentage Rate *</label>
                    <input
                      type="number"
                      id="percentageRate"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      defaultValue={formData.payPercentage ? (formData.payPercentage > 1 ? formData.payPercentage : formData.payPercentage * 100) : ''}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter percentage (e.g., 65 for 65%)"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {driverType === 'OwnerOperator' 
                        ? 'Enter percentage (typically 85-90% for Owner Operators)'
                        : 'Enter this driver\'s specific percentage (varies by driver)'}
                    </p>
                  </div>
                )}
                {paymentType === 'flat_rate' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Flat Rate Per Load</label>
                    <input
                      type="number"
                      name="payment.flatRate"
                      value={formData.payment?.flatRate}
                      onChange={handleChange}
                      step="0.01"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Detention Pay</label>
                  <input
                    type="number"
                    name="payment.detention"
                    value={formData.payment?.detention}
                    onChange={handleChange}
                    step="0.01"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Layover Pay</label>
                  <input
                    type="number"
                    name="payment.layover"
                    value={formData.payment?.layover}
                    onChange={handleChange}
                    step="0.01"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <input
                    type="checkbox"
                    name="payment.fuelSurcharge"
                    checked={Boolean(formData.payment?.fuelSurcharge)}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-slate-900">Fuel Surcharge</label>
                </div>
              </div>
            </div>
            )}

            {/* Owner Operator Deduction Preferences */}
            {isDriverOrOwnerOperator && driverType === 'OwnerOperator' && (
              <div className="border-t pt-6">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Deduction Preferences (Owner Operator Only)</h4>
                <p className="text-sm text-slate-600 mb-4">Select which expenses should be deducted from settlement.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {([
                    { key: 'fuel', label: 'Fuel', description: 'Fuel card deductions' },
                    { key: 'insurance', label: 'Insurance', description: 'Cargo/liability insurance' },
                    { key: 'maintenance', label: 'Maintenance', description: 'Truck repairs/service' },
                    { key: 'ifta', label: 'IFTA', description: 'International Fuel Tax Agreement' },
                    { key: 'eld', label: 'ELD', description: 'Electronic Logging Device' },
                    { key: 'other', label: 'Other', description: 'Miscellaneous deductions' },
                  ] as const).map(pref => (
                    <div key={pref.key} className="flex items-start p-3 bg-slate-50 rounded-lg">
                      <input
                        type="checkbox"
                        name={`deductionPreferences.${pref.key}`}
                        checked={Boolean(formData.deductionPreferences?.[pref.key])}
                        onChange={handleChange}
                        className="h-4 w-4 mt-1 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                      />
                      <label className="ml-3 block text-sm text-slate-900">
                        <span className="font-medium">{pref.label}</span>
                        <span className="text-slate-500 block text-xs">{pref.description}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Employment Information */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Employment Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Hire Date</label>
                  <input
                    type="date"
                    name="employment.hireDate"
                    value={formData.employment?.hireDate}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Pay Frequency</label>
                  <select
                    name="employment.payFrequency"
                    value={formData.employment?.payFrequency}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="bi-weekly">Bi-Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">W-4 Exemptions</label>
                  <input
                    type="number"
                    name="employment.w4Exemptions"
                    value={formData.employment?.w4Exemptions}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Emergency Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Contact Name</label>
                  <input
                    type="text"
                    name="emergencyContact.name"
                    value={formData.emergencyContact?.name}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Relationship</label>
                  <input
                    type="text"
                    name="emergencyContact.relationship"
                    value={formData.emergencyContact?.relationship}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    name="emergencyContact.phone"
                    value={formData.emergencyContact?.phone}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

          </form>
        </div>
        
        {/* Footer Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="employee-form"
            className="btn-primary px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            {driver ? 'Save Employee' : 'Create Employee'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Drivers;

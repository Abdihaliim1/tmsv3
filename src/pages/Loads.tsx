import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Filter, Download, Search, Edit, Trash2, Eye, MoreHorizontal, X, ChevronDown, Clock } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { LoadStatus, Load, NewLoadInput } from '../types';
import AddLoadModal from '../components/AddLoadModal';
import { useDebounce } from '../utils/debounce';

const Loads: React.FC = () => {
  const { loads, drivers, addLoad, updateLoad, deleteLoad } = useTMS();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoad, setEditingLoad] = useState<Load | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [driverFilter, setDriverFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Check for selected load from Dashboard navigation
  useEffect(() => {
    if (!loads || !Array.isArray(loads)) return;
    const selectedLoadId = sessionStorage.getItem('selectedLoadId');
    if (selectedLoadId) {
      const load = loads.find(l => l && l.id === selectedLoadId);
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


  // Filter loads
  const filteredLoads = useMemo(() => {
    if (!loads || !Array.isArray(loads)) return [];
    return loads.filter(load => {
      if (!load) return false;
      const matchesStatus = !statusFilter || load.status === statusFilter;
      const matchesDriver = !driverFilter || load.driverId === driverFilter;
      const matchesSearch = !debouncedSearchTerm ||
        (load.loadNumber && load.loadNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (load.originCity && load.originCity.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (load.destCity && load.destCity.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (load.brokerName && load.brokerName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
      return matchesStatus && matchesDriver && matchesSearch;
    });
  }, [loads, statusFilter, driverFilter, debouncedSearchTerm]);

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
      [LoadStatus.TONU]: 'bg-orange-50 text-orange-700 border-orange-200',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles[LoadStatus.Available]}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  // Quick status update handler
  const handleQuickStatusUpdate = async (loadId: string, newStatus: LoadStatus) => {
    if (!loads || !Array.isArray(loads)) return;
    const load = loads.find(l => l && l.id === loadId);
    if (!load) return;

    // For destructive statuses, ask for confirmation
    if (newStatus === LoadStatus.Cancelled || newStatus === LoadStatus.TONU) {
      if (!window.confirm(`Are you sure you want to mark load ${load.loadNumber} as ${newStatus.replace('_', ' ').toUpperCase()}?`)) {
        return;
      }
    }

    // Update load with new status and add to status history
    const updatedLoad: Load = {
      ...load,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      statusHistory: [
        ...(load.statusHistory || []),
        {
          status: newStatus,
          timestamp: new Date().toISOString(),
          changedBy: 'User', // TODO: Get actual user name from auth context
          note: `Status changed to ${newStatus.replace('_', ' ')}`
        }
      ]
    };

    try {
      await updateLoad(loadId, updatedLoad);
    } catch (error: any) {
      // Show user-friendly error message for locked loads
      alert(error.message || 'Cannot update this load. It may be locked after delivery.');
      console.error('Load status update error:', error);
    }
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
      ['Load #', 'Status', 'Broker', 'Driver', 'Origin', 'Destination', 'Rate', 'Miles', 'Rate/Mile'].join(','),
      ...filteredLoads.map(load => [
        load.loadNumber,
        load.status,
        load.brokerName || '',
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
          className="btn-primary px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
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
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Origin → Destination
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Broker
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Dispatcher
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Factored
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {paginatedLoads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
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
                      <select
                        value={load.status}
                        onChange={(e) => handleQuickStatusUpdate(load.id, e.target.value as LoadStatus)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all cursor-pointer ${
                          load.status === LoadStatus.Available ? 'bg-slate-100 text-slate-700 border-slate-300' :
                          load.status === LoadStatus.Dispatched ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          load.status === LoadStatus.InTransit ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          load.status === LoadStatus.Delivered ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          load.status === LoadStatus.Completed ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          load.status === LoadStatus.Cancelled ? 'bg-red-50 text-red-700 border-red-200' :
                          load.status === LoadStatus.TONU ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {Object.values(LoadStatus).map(status => (
                          <option key={status} value={status}>
                            {status.replace('_', ' ').toUpperCase()}
                          </option>
                        ))}
                      </select>
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
                      {load.brokerName ? (
                        <div>
                          <div className="font-medium">{load.brokerName}</div>
                          {load.brokerReference && (
                            <div className="text-xs text-slate-500">Ref: {load.brokerReference}</div>
                          )}
           </div>
        ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {load.dispatcherName ? (
                  <div>
                          <div className="font-medium">{load.dispatcherName}</div>
                          {load.dispatcherCommissionAmount && load.dispatcherCommissionAmount > 0 && (
                            <div className="text-xs text-slate-500">
                              Commission: {formatCurrency(load.dispatcherCommissionAmount)}
                            </div>
                          )}
                          {load.isExternalDispatch && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                              External
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
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
                      {load.isFactored ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Yes
                          </span>
                          {load.factoredAmount && (
                            <div className="text-xs text-slate-600">
                              {formatCurrency(load.factoredAmount)}
                            </div>
                          )}
                          {load.factoringFee && load.factoringFee > 0 && (
                            <div className="text-xs text-red-600">
                              Fee: {formatCurrency(load.factoringFee)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
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
                            alert(`Load #${load.loadNumber}\nStatus: ${load.status}\nBroker: ${load.brokerName || 'N/A'}\nDriver: ${load.driverName || 'Unassigned'}\nRate: ${formatCurrency(load.rate)}\nMiles: ${load.miles}`);
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

      {/* Load Modal - Using comprehensive AddLoadModal */}
      <AddLoadModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLoad(null);
        }}
        onSubmit={async (loadData: NewLoadInput) => {
          if (editingLoad) {
            try {
              // Extract adjustment reason if provided (from adjustment workflow)
              const adjustmentReason = (loadData as any).adjustmentReason;
              // Remove adjustmentReason from loadData before saving
              const cleanLoadData = { ...loadData };
              delete (cleanLoadData as any).adjustmentReason;
              
              await updateLoad(editingLoad.id, cleanLoadData, adjustmentReason);
              setIsModalOpen(false);
              setEditingLoad(null);
            } catch (error: any) {
              // Show user-friendly error message
              alert(error.message || 'Failed to update load. Please check the error and try again.');
              console.error('Load update error:', error);
            }
          } else {
            addLoad(loadData);
            setIsModalOpen(false);
            setEditingLoad(null);
          }
        }}
        editingLoad={editingLoad}
      />
    </div>
  );
};
export default Loads;

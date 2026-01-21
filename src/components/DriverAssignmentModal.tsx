/**
 * Driver Assignment Modal
 *
 * Quick modal to assign a driver to a load from the dispatch board.
 */

import React, { useState, useMemo } from 'react';
import { X, User, Truck, Search } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { Load, Driver } from '../types';

interface DriverAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  load: Load;
  onAssign?: (driverId: string, driverName: string) => void;
}

const DriverAssignmentModal: React.FC<DriverAssignmentModalProps> = ({
  isOpen,
  onClose,
  load,
  onAssign,
}) => {
  const { drivers, trucks, updateLoad } = useTMS();
  const [selectedDriverId, setSelectedDriverId] = useState<string>(load.driverId || '');
  const [selectedTruckId, setSelectedTruckId] = useState<string>(load.truckId || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter active drivers
  const activeDrivers = useMemo(() => {
    return drivers.filter(d => d.status === 'active');
  }, [drivers]);

  // Filter drivers by search term
  const filteredDrivers = useMemo(() => {
    if (!searchTerm) return activeDrivers;
    const term = searchTerm.toLowerCase();
    return activeDrivers.filter(d =>
      `${d.firstName} ${d.lastName}`.toLowerCase().includes(term) ||
      d.driverNumber?.toLowerCase().includes(term) ||
      d.phone?.toLowerCase().includes(term)
    );
  }, [activeDrivers, searchTerm]);

  // Get available trucks (available and not assigned to another load in transit)
  const availableTrucks = useMemo(() => {
    return trucks.filter(t => t.status === 'available' || t.status === 'in_transit');
  }, [trucks]);

  const handleAssign = async () => {
    if (!selectedDriverId) return;

    setIsSubmitting(true);
    try {
      const driver = drivers.find(d => d.id === selectedDriverId);
      const truck = trucks.find(t => t.id === selectedTruckId);

      const updates: Partial<Load> = {
        driverId: selectedDriverId,
        driverName: driver ? `${driver.firstName} ${driver.lastName}` : undefined,
      };

      if (selectedTruckId) {
        updates.truckId = selectedTruckId;
        updates.truckNumber = truck?.truckNumber;
      }

      await updateLoad(load.id, updates);

      if (onAssign && driver) {
        onAssign(selectedDriverId, `${driver.firstName} ${driver.lastName}`);
      }

      onClose();
    } catch (error) {
      console.error('Failed to assign driver:', error);
      alert('Failed to assign driver. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Assign Driver</h2>
            <p className="text-sm text-slate-500">Load {load.loadNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search drivers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Driver Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Select Driver
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">
              {filteredDrivers.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No drivers found
                </p>
              ) : (
                filteredDrivers.map((driver) => (
                  <label
                    key={driver.id}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedDriverId === driver.id
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <input
                      type="radio"
                      name="driver"
                      value={driver.id}
                      checked={selectedDriverId === driver.id}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">
                        {driver.firstName} {driver.lastName}
                      </div>
                      <div className="text-sm text-slate-500">
                        {driver.driverNumber || 'No ID'} &bull; {driver.type || 'Company'}
                      </div>
                    </div>
                    {selectedDriverId === driver.id && (
                      <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Truck Selection (Optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Truck className="w-4 h-4 inline mr-1" />
              Assign Truck (Optional)
            </label>
            <select
              value={selectedTruckId}
              onChange={(e) => setSelectedTruckId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a truck...</option>
              {availableTrucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.truckNumber} - {truck.make} {truck.model} ({truck.year || 'N/A'})
                </option>
              ))}
            </select>
          </div>

          {/* Load Info Summary */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Load Details</h4>
            <div className="text-sm text-slate-600 space-y-1">
              <p><span className="font-medium">Route:</span> {load.originCity}, {load.originState} → {load.destCity}, {load.destState}</p>
              <p><span className="font-medium">Miles:</span> {load.miles || 'N/A'}</p>
              <p><span className="font-medium">Rate:</span> ${load.rate?.toLocaleString() || 0}</p>
              <p><span className="font-medium">Pickup:</span> {load.pickupDate ? new Date(load.pickupDate).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedDriverId || isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign Driver'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriverAssignmentModal;

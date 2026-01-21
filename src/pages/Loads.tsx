import React, { useState, useMemo, useCallback } from 'react';
import {
  Calendar, Plus, Search, Eye, Edit, Copy, ChevronLeft, ChevronRight,
  Download, X, MapPin, Truck, DollarSign, FileText, Users, Box, Clock, Check, Trash2
} from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { useAuth } from '../context/AuthContext';
import { LoadStatus, Load, StatusChangeInfo } from '../types';
import { PageType } from '../App';

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (amount: number) => {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

// ============================================================================
// View Load Modal Component
// ============================================================================

interface ViewLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  load: Load | null;
  onEdit: () => void;
}

const ViewLoadModal: React.FC<ViewLoadModalProps> = ({ isOpen, onClose, load, onEdit }) => {
  if (!isOpen || !load) return null;

  const getStatusColor = (status: LoadStatus) => {
    const colors: Record<LoadStatus, string> = {
      [LoadStatus.Available]: 'bg-slate-100 text-slate-700',
      [LoadStatus.Dispatched]: 'bg-yellow-100 text-yellow-700',
      [LoadStatus.InTransit]: 'bg-blue-100 text-blue-700',
      [LoadStatus.Delivered]: 'bg-green-100 text-green-700',
      [LoadStatus.Completed]: 'bg-purple-100 text-purple-700',
      [LoadStatus.Cancelled]: 'bg-red-100 text-red-700',
      [LoadStatus.TONU]: 'bg-orange-100 text-orange-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Load #{load.loadNumber}</h2>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(load.status)}`}>
                {load.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Route */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <MapPin size={16} />
                Route
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">From:</span>
                  <span className="font-medium">{load.originCity}, {load.originState}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">To:</span>
                  <span className="font-medium">{load.destCity}, {load.destState}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Miles:</span>
                  <span className="font-medium">{load.miles.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Calendar size={16} />
                Schedule
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Pickup:</span>
                  <span className="font-medium">{formatDate(load.pickupDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Delivery:</span>
                  <span className="font-medium">{formatDate(load.deliveryDate)}</span>
                </div>
              </div>
            </div>

            {/* Financial */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <DollarSign size={16} />
                Financial
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Rate:</span>
                  <span className="font-medium text-green-600">{formatCurrency(load.rate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Rate/Mile:</span>
                  <span className="font-medium">{formatCurrency(load.miles > 0 ? load.rate / load.miles : 0)}</span>
                </div>
                {load.grandTotal && load.grandTotal !== load.rate && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total:</span>
                    <span className="font-medium">{formatCurrency(load.grandTotal)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Assignment */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Users size={16} />
                Assignment
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Driver:</span>
                  <span className="font-medium">{load.driverName || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Truck:</span>
                  <span className="font-medium">{load.truckNumber || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Trailer:</span>
                  <span className="font-medium">{load.trailerNumber || '-'}</span>
                </div>
                {load.tripNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Trip #:</span>
                    <span className="font-medium">{load.tripNumber}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Customer/Broker */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Box size={16} />
                Customer/Broker
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Customer:</span>
                  <span className="font-medium">{load.customerName || load.brokerName || '-'}</span>
                </div>
                {load.brokerReference && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Reference:</span>
                    <span className="font-medium">{load.brokerReference}</span>
                  </div>
                )}
                {load.bolNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">BOL #:</span>
                    <span className="font-medium">{load.bolNumber}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Accessorials */}
          {(load.hasFSC || load.hasDetention || load.hasLumper || load.totalAccessorials) && (
            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Accessorials</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {load.hasFSC && (
                  <div>
                    <span className="text-slate-600">FSC:</span>
                    <span className="font-medium ml-2">{formatCurrency(load.fscAmount || 0)}</span>
                  </div>
                )}
                {load.hasDetention && (
                  <div>
                    <span className="text-slate-600">Detention:</span>
                    <span className="font-medium ml-2">{formatCurrency(load.detentionAmount || 0)}</span>
                  </div>
                )}
                {load.hasLumper && (
                  <div>
                    <span className="text-slate-600">Lumper:</span>
                    <span className="font-medium ml-2">{formatCurrency(load.lumperAmount || 0)}</span>
                  </div>
                )}
                {load.totalAccessorials && (
                  <div>
                    <span className="text-slate-600">Total Accessorials:</span>
                    <span className="font-medium ml-2">{formatCurrency(load.totalAccessorials)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {load.notes && (
            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <FileText size={16} />
                Notes
              </h3>
              <p className="text-sm text-slate-600">{load.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              onEdit();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Edit size={16} />
            Edit Load
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Edit Load Modal Component
// ============================================================================

interface EditLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  load: Load | null;
  onSave: (updates: Partial<Load>) => void;
  onLinkToTrip: (loadId: string, tripId: string | null) => void;
}

const EditLoadModal: React.FC<EditLoadModalProps> = ({ isOpen, onClose, load, onSave, onLinkToTrip }) => {
  const { drivers, trucks, trailers, trips } = useTMS();

  const [formData, setFormData] = useState<Partial<Load>>({});
  const [selectedTripId, setSelectedTripId] = useState<string>('');

  // Populate form when load changes
  React.useEffect(() => {
    if (load) {
      setFormData({
        loadNumber: load.loadNumber,
        status: load.status,
        driverId: load.driverId || '',
        driverName: load.driverName || '',
        truckId: load.truckId || '',
        truckNumber: load.truckNumber || '',
        trailerId: load.trailerId || '',
        trailerNumber: load.trailerNumber || '',
        originCity: load.originCity,
        originState: load.originState,
        destCity: load.destCity,
        destState: load.destState,
        pickupDate: load.pickupDate,
        deliveryDate: load.deliveryDate,
        rate: load.rate,
        miles: load.miles,
        customerName: load.customerName || '',
        brokerName: load.brokerName || '',
        bolNumber: load.bolNumber || '',
        notes: load.notes || '',
      });
      setSelectedTripId(load.tripId || '');
    }
  }, [load]);

  const handleDriverChange = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    setFormData(prev => ({
      ...prev,
      driverId,
      driverName: driver ? `${driver.firstName} ${driver.lastName}` : '',
    }));
  };

  const handleTruckChange = (truckId: string) => {
    const truck = trucks.find(t => t.id === truckId);
    setFormData(prev => ({
      ...prev,
      truckId,
      truckNumber: truck?.truckNumber || '',
    }));
  };

  const handleTrailerChange = (trailerId: string) => {
    const trailer = trailers.find(t => t.id === trailerId);
    setFormData(prev => ({
      ...prev,
      trailerId,
      trailerNumber: trailer?.trailerNumber || trailer?.number || '',
    }));
  };

  const handleTripChange = (tripId: string) => {
    setSelectedTripId(tripId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Handle trip linking/unlinking
    if (load) {
      const currentTripId = load.tripId || '';
      if (selectedTripId !== currentTripId) {
        // Trip selection changed - link or unlink
        onLinkToTrip(load.id, selectedTripId || null);
      }
    }

    onSave({
      ...formData,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  if (!isOpen || !load) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Edit Load #{load.loadNumber}</h2>
            <p className="text-sm text-slate-600 mt-1">Update load details</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={formData.status || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as LoadStatus }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {Object.values(LoadStatus).map(status => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Load Number</label>
              <input
                type="text"
                value={formData.loadNumber || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, loadNumber: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Assignment */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Assignment</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Driver</label>
                <select
                  value={formData.driverId || ''}
                  onChange={(e) => handleDriverChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Driver</option>
                  {drivers.map(driver => (
                    <option key={driver.id} value={driver.id}>
                      {driver.firstName} {driver.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Truck</label>
                <select
                  value={formData.truckId || ''}
                  onChange={(e) => handleTruckChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Truck</option>
                  {trucks.map(truck => (
                    <option key={truck.id} value={truck.id}>
                      {truck.truckNumber} - {truck.make} {truck.model}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trailer</label>
                <select
                  value={formData.trailerId || ''}
                  onChange={(e) => handleTrailerChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No Trailer</option>
                  {trailers.map(trailer => (
                    <option key={trailer.id} value={trailer.id}>
                      {trailer.trailerNumber || trailer.number} - {trailer.type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Trip Linking */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Trip Linking</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Link to Trip</label>
                <select
                  value={selectedTripId}
                  onChange={(e) => handleTripChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No Trip (Unlinked)</option>
                  {trips.map(trip => (
                    <option key={trip.id} value={trip.id}>
                      {trip.tripNumber} - {trip.fromCity}, {trip.fromState} → {trip.toCity}, {trip.toState} ({formatDate(trip.pickupDate)})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Linking to a trip will sync driver, equipment, and dates from the trip.
                </p>
              </div>
              {selectedTripId && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium">Trip Info</p>
                  {(() => {
                    const trip = trips.find(t => t.id === selectedTripId);
                    if (!trip) return null;
                    return (
                      <div className="text-xs text-blue-600 mt-1 space-y-1">
                        <p>Trip #: {trip.tripNumber}</p>
                        <p>Driver: {trip.driverName || 'Unassigned'}</p>
                        <p>Pickup: {formatDate(trip.pickupDate)}</p>
                        <p>Delivery: {formatDate(trip.deliveryDate)}</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Route */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Route</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Origin City</label>
                <input
                  type="text"
                  value={formData.originCity || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, originCity: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Origin State</label>
                <input
                  type="text"
                  value={formData.originState || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, originState: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dest City</label>
                <input
                  type="text"
                  value={formData.destCity || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, destCity: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dest State</label>
                <input
                  type="text"
                  value={formData.destState || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, destState: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          {/* Schedule & Financial */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Schedule & Financial</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pickup Date</label>
                <input
                  type="date"
                  value={formData.pickupDate || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, pickupDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Date</label>
                <input
                  type="date"
                  value={formData.deliveryDate || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, deliveryDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rate</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    value={formData.rate || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Miles</label>
                <input
                  type="number"
                  value={formData.miles || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, miles: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Customer & Documents */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Customer & Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                <input
                  type="text"
                  value={formData.customerName || formData.brokerName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value, brokerName: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">BOL #</label>
                <input
                  type="text"
                  value={formData.bolNumber || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, bolNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="border-t pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Check size={16} />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// Main Loads Component
// ============================================================================

interface LoadsProps {
  onNavigate?: (page: PageType) => void;
}

const Loads: React.FC<LoadsProps> = ({ onNavigate }) => {
  const { loads, updateLoad, addLoad, linkLoadToTrip, deleteLoad } = useTMS();
  const { user } = useAuth();

  // State
  const [deliveryFilter, setDeliveryFilter] = useState<'future' | 'today' | 'past'>('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Modal states
  const [viewingLoad, setViewingLoad] = useState<Load | null>(null);
  const [editingLoad, setEditingLoad] = useState<Load | null>(null);

  // Filter loads based on delivery date
  const filteredLoads = useMemo(() => {
    if (!loads || !Array.isArray(loads)) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return loads.filter(load => {
      if (!load) return false;

      // Date filter
      const deliveryDate = load.deliveryDate ? new Date(load.deliveryDate) : null;
      if (deliveryDate) {
        deliveryDate.setHours(0, 0, 0, 0);

        if (deliveryFilter === 'future' && deliveryDate <= today) return false;
        if (deliveryFilter === 'today' && deliveryDate.getTime() !== today.getTime()) return false;
        if (deliveryFilter === 'past' && deliveryDate >= today) return false;
      }

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          load.loadNumber?.toLowerCase().includes(search) ||
          load.tripNumber?.toLowerCase().includes(search) ||
          load.driverName?.toLowerCase().includes(search) ||
          load.customerName?.toLowerCase().includes(search) ||
          load.brokerName?.toLowerCase().includes(search) ||
          load.originCity?.toLowerCase().includes(search) ||
          load.destCity?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort by delivery date descending
      const dateA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0;
      const dateB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [loads, deliveryFilter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredLoads.length / itemsPerPage);
  const paginatedLoads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLoads.slice(start, start + itemsPerPage);
  }, [filteredLoads, currentPage, itemsPerPage]);

  // Handlers
  const handleViewLoad = useCallback((load: Load) => {
    setViewingLoad(load);
  }, []);

  const handleEditLoad = useCallback((load: Load) => {
    setEditingLoad(load);
  }, []);

  const handleCopyLoad = useCallback((load: Load) => {
    // Create a copy of the load with new ID
    const newLoad = {
      ...load,
      loadNumber: `${load.loadNumber}-COPY`,
      status: LoadStatus.Available,
      invoiceId: undefined,
      invoiceNumber: undefined,
      settlementId: undefined,
      settlementNumber: undefined,
      tripId: undefined,
      tripNumber: undefined,
    };
    delete (newLoad as any).id;
    delete (newLoad as any).createdAt;
    delete (newLoad as any).updatedAt;
    delete (newLoad as any).statusHistory;

    addLoad(newLoad);
    alert(`Load copied as ${newLoad.loadNumber}`);
  }, [addLoad]);

  const handleUpdateLoad = useCallback((updates: Partial<Load>) => {
    if (editingLoad) {
      updateLoad(editingLoad.id, updates);
      setEditingLoad(null);
    }
  }, [editingLoad, updateLoad]);

  const handleDeleteLoad = useCallback((load: Load) => {
    const confirmMessage = load.invoiceId
      ? `This load (${load.loadNumber}) is linked to an invoice. Are you sure you want to delete it? This action cannot be undone.`
      : `Are you sure you want to delete load ${load.loadNumber}? This action cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      deleteLoad(load.id, true); // force delete
    }
  }, [deleteLoad]);

  const getStatusColor = (status: LoadStatus) => {
    const colors: Record<LoadStatus, string> = {
      [LoadStatus.Available]: 'text-slate-600',
      [LoadStatus.Dispatched]: 'text-yellow-600',
      [LoadStatus.InTransit]: 'text-blue-600',
      [LoadStatus.Delivered]: 'text-green-600',
      [LoadStatus.Completed]: 'text-purple-600',
      [LoadStatus.Cancelled]: 'text-red-600',
      [LoadStatus.TONU]: 'text-orange-600',
    };
    return colors[status] || 'text-slate-600';
  };

  return (
    <div className="space-y-6">
      {/* Header with Navigation Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-900">Loads</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate?.('LoadPlanner')}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2"
          >
            <Calendar size={18} />
            Planned Loads
          </button>
          <button
            onClick={() => onNavigate?.('LoadPlanner')}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2"
          >
            <Plus size={18} />
            Add Planned Load
          </button>
          <button
            onClick={() => onNavigate?.('Trips')}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2"
          >
            <Plus size={18} />
            Add Trip
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setDeliveryFilter('future'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            deliveryFilter === 'future'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Loads delivered in the future
        </button>
        <button
          onClick={() => { setDeliveryFilter('today'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            deliveryFilter === 'today'
              ? 'bg-yellow-500 text-white'
              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Loads delivered today
        </button>
        <button
          onClick={() => { setDeliveryFilter('past'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            deliveryFilter === 'past'
              ? 'bg-slate-600 text-white'
              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Loads delivered in the past
        </button>
      </div>

      {/* Pagination Info & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>
            {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredLoads.length)} of {filteredLoads.length}
          </span>
          <span>with</span>
          <select
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
            className="px-2 py-1 border border-slate-300 rounded text-sm"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>per page</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`px-3 py-1 rounded ${
                currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Loads Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Load #</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Trip #</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Pickup</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Delivery</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Driver</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Truck</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">From</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">To</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">BOL</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Total</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedLoads.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-slate-500">
                    <Box size={40} className="mx-auto mb-2 text-slate-300" />
                    <p>No loads found for this filter.</p>
                    <p className="text-sm mt-1">Loads are created when trips are dispatched from the Load Planner.</p>
                  </td>
                </tr>
              ) : (
                paginatedLoads.map(load => (
                  <tr key={load.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-blue-600">
                      {load.loadNumber}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {load.tripNumber ? (
                        <button
                          onClick={() => onNavigate?.('Trips')}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          title={`View Trip ${load.tripNumber}`}
                        >
                          {load.tripNumber}
                        </button>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`font-medium ${getStatusColor(load.status)}`}>
                        {load.status.replace('_', ' ').charAt(0).toUpperCase() + load.status.replace('_', ' ').slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(load.pickupDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(load.deliveryDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {load.driverName || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {load.truckNumber || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-[150px] truncate" title={load.customerName || load.brokerName || ''}>
                      {load.customerName || load.brokerName || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {load.originCity}, {load.originState}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {load.destCity}, {load.destState}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {load.bolNumber || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 text-right font-medium">
                      {formatCurrency(load.grandTotal || load.rate)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleViewLoad(load)}
                          className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200 flex items-center gap-1"
                          title="View"
                        >
                          <Eye size={12} />
                          View
                        </button>
                        <button
                          onClick={() => handleEditLoad(load)}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
                          title="Edit"
                        >
                          <Edit size={12} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleCopyLoad(load)}
                          className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200 flex items-center gap-1"
                          title="Copy"
                        >
                          <Copy size={12} />
                          Copy
                        </button>
                        <button
                          onClick={() => handleDeleteLoad(load)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center gap-1"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Load Modal */}
      <ViewLoadModal
        isOpen={viewingLoad !== null}
        onClose={() => setViewingLoad(null)}
        load={viewingLoad}
        onEdit={() => {
          if (viewingLoad) {
            setEditingLoad(viewingLoad);
            setViewingLoad(null);
          }
        }}
      />

      {/* Edit Load Modal */}
      <EditLoadModal
        isOpen={editingLoad !== null}
        onClose={() => setEditingLoad(null)}
        load={editingLoad}
        onSave={handleUpdateLoad}
        onLinkToTrip={linkLoadToTrip}
      />
    </div>
  );
};

export default Loads;

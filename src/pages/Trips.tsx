import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Route, Plus, Calendar, MapPin, Truck, Clock, DollarSign, Search,
  ChevronLeft, ChevronRight, Eye, Edit, Trash2, List, LayoutGrid,
  Info, Users, Box, Check, X, FileText, Phone, Mail, Hash
} from 'lucide-react';
import { Trip, TripStatus, TripType, NewTripInput, PlannedLoad } from '../types/plannedLoad';
import { useTMS } from '../context/TMSContext';
import { NewDriverInput, NewTruckInput, NewTrailerInput, TruckStatus, TruckOwnership, TrailerStatus, TrailerType } from '../types';

// ============================================================================
// Create Driver Modal Component
// ============================================================================

interface CreateDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (driverId: string) => void;
}

const CreateDriverModal: React.FC<CreateDriverModalProps> = ({ isOpen, onClose, onSave }) => {
  const { addDriver, drivers } = useTMS();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    licenseNumber: '',
    licenseState: '',
    licenseExpiration: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    rateOrSplit: 0,
    type: 'Company' as 'Company' | 'OwnerOperator',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName) {
      alert('First Name and Last Name are required');
      return;
    }

    // Add the driver using TMSContext
    addDriver({
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      email: formData.email,
      licenseNumber: formData.licenseNumber,
      licenseState: formData.licenseState,
      licenseExpiration: formData.licenseExpiration,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      zipCode: formData.zipCode,
      rateOrSplit: formData.rateOrSplit,
      type: formData.type,
      notes: formData.notes,
      status: 'active',
      employeeType: 'driver',
    });

    // Find the newly created driver (last one added)
    // Note: We'll use a timeout to ensure state is updated
    setTimeout(() => {
      // Get the driver that matches our input (newest first in most implementations)
      const newDriver = drivers.find(d =>
        d.firstName === formData.firstName &&
        d.lastName === formData.lastName
      );
      if (newDriver) {
        onSave(newDriver.id);
      }
    }, 100);

    // Reset form
    setFormData({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      licenseNumber: '',
      licenseState: '',
      licenseExpiration: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      rateOrSplit: 0,
      type: 'Company',
      notes: '',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-slate-900">Create New Driver</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">License Number</label>
              <input
                type="text"
                value={formData.licenseNumber}
                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">License State</label>
              <input
                type="text"
                value={formData.licenseState}
                onChange={(e) => setFormData({ ...formData, licenseState: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                maxLength={2}
                placeholder="XX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">License Expiration</label>
              <input
                type="date"
                value={formData.licenseExpiration}
                onChange={(e) => setFormData({ ...formData, licenseExpiration: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                maxLength={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ZIP</label>
              <input
                type="text"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Driver Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'Company' | 'OwnerOperator' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Company">Company Driver</option>
                <option value="OwnerOperator">Owner Operator</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {formData.type === 'Company' ? 'Pay Rate (per mile)' : 'Split %'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {formData.type === 'Company' ? '$' : '%'}
                </span>
                <input
                  type="number"
                  value={formData.rateOrSplit || ''}
                  onChange={(e) => setFormData({ ...formData, rateOrSplit: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  step="0.01"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Driver
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// Create Truck Modal Component
// ============================================================================

interface CreateTruckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (truckId: string) => void;
}

const CreateTruckModal: React.FC<CreateTruckModalProps> = ({ isOpen, onClose, onSave }) => {
  const { addTruck } = useTMS();

  const [formData, setFormData] = useState({
    truckNumber: '',
    vin: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    licensePlate: '',
    status: 'available' as TruckStatus,
    ownerType: 'owned' as TruckOwnership,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.truckNumber) {
      alert('Unit Number is required');
      return;
    }

    // Add the truck using TMSContext - returns the ID
    const newTruckId = addTruck({
      truckNumber: formData.truckNumber,
      vin: formData.vin,
      make: formData.make,
      model: formData.model,
      year: formData.year,
      licensePlate: formData.licensePlate,
      status: formData.status,
      ownerType: formData.ownerType,
    });

    // Auto-select the new truck
    onSave(newTruckId);

    // Reset form
    setFormData({
      truckNumber: '',
      vin: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      licensePlate: '',
      status: 'available',
      ownerType: 'owned',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-slate-900">Create New Truck</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Unit Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.truckNumber}
              onChange={(e) => setFormData({ ...formData, truckNumber: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., T101"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">VIN</label>
            <input
              type="text"
              value={formData.vin}
              onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="17-character VIN"
              maxLength={17}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Make</label>
              <input
                type="text"
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Freightliner"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Cascadia"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min={1990}
                max={new Date().getFullYear() + 1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">License Plate</label>
              <input
                type="text"
                value={formData.licensePlate}
                onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TruckStatus })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="available">Available</option>
                <option value="in_transit">In Transit</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ownership</label>
              <select
                value={formData.ownerType}
                onChange={(e) => setFormData({ ...formData, ownerType: e.target.value as TruckOwnership })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="owned">Owned</option>
                <option value="leased">Leased</option>
                <option value="financed">Financed</option>
                <option value="owner_operator">Owner Operator</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Truck
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// Create Trailer Modal Component
// ============================================================================

interface CreateTrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (trailerId: string) => void;
}

const CreateTrailerModal: React.FC<CreateTrailerModalProps> = ({ isOpen, onClose, onSave }) => {
  const { addTrailer } = useTMS();

  const [formData, setFormData] = useState({
    trailerNumber: '',
    vin: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    licensePlate: '',
    type: 'dry_van' as TrailerType,
    status: 'available' as TrailerStatus,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.trailerNumber) {
      alert('Trailer Number is required');
      return;
    }

    // Add the trailer using TMSContext - returns the ID
    const newTrailerId = addTrailer({
      trailerNumber: formData.trailerNumber,
      vin: formData.vin,
      make: formData.make,
      model: formData.model,
      year: formData.year,
      licensePlate: formData.licensePlate,
      type: formData.type,
      status: formData.status,
    });

    // Auto-select the new trailer
    onSave(newTrailerId);

    // Reset form
    setFormData({
      trailerNumber: '',
      vin: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      licensePlate: '',
      type: 'dry_van',
      status: 'available',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-slate-900">Create New Trailer</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Trailer Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.trailerNumber}
              onChange={(e) => setFormData({ ...formData, trailerNumber: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., TR101"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">VIN</label>
            <input
              type="text"
              value={formData.vin}
              onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="17-character VIN"
              maxLength={17}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Make</label>
              <input
                type="text"
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Great Dane"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min={1990}
                max={new Date().getFullYear() + 1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">License Plate</label>
              <input
                type="text"
                value={formData.licensePlate}
                onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Trailer Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as TrailerType })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="dry_van">Dry Van</option>
                <option value="reefer">Reefer</option>
                <option value="flatbed">Flatbed</option>
                <option value="step_deck">Step Deck</option>
                <option value="lowboy">Lowboy</option>
                <option value="tanker">Tanker</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TrailerStatus })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="available">Available</option>
                <option value="in_use">In Use</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Trailer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// View Trip Modal Component
// ============================================================================

interface ViewTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip | null;
  onEdit: () => void;
}

const ViewTripModal: React.FC<ViewTripModalProps> = ({ isOpen, onClose, trip, onEdit }) => {
  const { plannedLoads, loads, drivers, trucks, trailers } = useTMS();

  if (!isOpen || !trip) return null;

  // Get associated planned loads
  const associatedPlannedLoads = plannedLoads.filter(pl =>
    trip.plannedLoadIds?.includes(pl.id)
  );

  // Get associated loads (from Loads page) - linked by tripId
  const associatedLoads = loads.filter(l => l.tripId === trip.id);

  // Get driver details
  const driver = drivers.find(d => d.id === trip.driverId);
  const truck = trucks.find(t => t.id === trip.truckId);
  const trailer = trailers.find(t => t.id === trip.trailerId);

  const getStatusBadge = (status: TripStatus) => {
    const styles: Record<TripStatus, string> = {
      future: 'bg-blue-100 text-blue-700',
      today: 'bg-yellow-100 text-yellow-700',
      past: 'bg-slate-100 text-slate-700',
      in_progress: 'bg-green-100 text-green-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Trip #{trip.tripNumber}</h2>
              <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusBadge(trip.status)}`}>
                {trip.status.replace('_', ' ')}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${trip.type === 'company' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                {trip.type}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              {trip.fromCity}, {trip.fromState} → {trip.toCity}, {trip.toState}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Trip Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Route Info */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <MapPin size={16} />
                Route Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">From:</span>
                  <span className="font-medium">{trip.fromCity}, {trip.fromState}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">To:</span>
                  <span className="font-medium">{trip.toCity}, {trip.toState}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Miles:</span>
                  <span className="font-medium">{trip.totalMiles.toLocaleString()} mi</span>
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
                  <span className="text-slate-600">Pickup Date:</span>
                  <span className="font-medium">{trip.pickupDate || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Delivery Date:</span>
                  <span className="font-medium">{trip.deliveryDate || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Created:</span>
                  <span className="font-medium">{new Date(trip.createdAt).toLocaleDateString()}</span>
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
                  <span className="text-slate-600">Revenue:</span>
                  <span className="font-medium text-green-600">${trip.revenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Driver Pay:</span>
                  <span className="font-medium">${(trip.driverPay || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Rate/Mile:</span>
                  <span className="font-medium">
                    ${trip.totalMiles > 0 ? (trip.revenue / trip.totalMiles).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Driver & Equipment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Driver Info */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Users size={16} />
                Driver Information
              </h3>
              {driver ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Name:</span>
                    <span className="font-medium">{driver.firstName} {driver.lastName}</span>
                  </div>
                  {driver.phone && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Phone:</span>
                      <span className="font-medium">{driver.phone}</span>
                    </div>
                  )}
                  {driver.email && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Email:</span>
                      <span className="font-medium">{driver.email}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Type:</span>
                    <span className="font-medium">{driver.type}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No driver assigned</p>
              )}
            </div>

            {/* Equipment Info */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Truck size={16} />
                Equipment
              </h3>
              <div className="space-y-3">
                {truck ? (
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">Truck: {truck.truckNumber}</p>
                    <p className="text-slate-600">{truck.year} {truck.make} {truck.model}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No truck assigned</p>
                )}
                {trailer ? (
                  <div className="space-y-1 text-sm border-t pt-2">
                    <p className="font-medium">Trailer: {trailer.trailerNumber || trailer.number}</p>
                    <p className="text-slate-600">{trailer.type}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 border-t pt-2">No trailer assigned</p>
                )}
              </div>
            </div>
          </div>

          {/* Dispatched Loads (from Loads page) */}
          <div className="border border-slate-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Box size={16} />
              Dispatched Loads ({associatedLoads.length})
            </h3>
            {associatedLoads.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">Load #</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">Customer</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">From</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">To</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">Status</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-700">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {associatedLoads.map((load) => (
                      <tr key={load.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-blue-600">{load.loadNumber}</td>
                        <td className="px-3 py-2">{load.customerName || load.brokerName || '-'}</td>
                        <td className="px-3 py-2">{load.originCity}, {load.originState}</td>
                        <td className="px-3 py-2">{load.destCity}, {load.destState}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            load.status === 'delivered' || load.status === 'completed' ? 'bg-green-100 text-green-700' :
                            load.status === 'in_transit' ? 'bg-blue-100 text-blue-700' :
                            load.status === 'dispatched' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {load.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">${(load.grandTotal || load.rate || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : associatedPlannedLoads.length > 0 ? (
              <div className="text-sm text-slate-500">
                <p className="mb-2">Loads pending dispatch:</p>
                <ul className="list-disc list-inside">
                  {associatedPlannedLoads.map((pl) => (
                    <li key={pl.id}>{pl.customLoadNumber || pl.systemLoadNumber} - {pl.status}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No loads associated with this trip</p>
            )}
          </div>

          {/* Planned Loads (if different from dispatched) */}
          {associatedPlannedLoads.length > 0 && associatedLoads.length !== associatedPlannedLoads.length && (
            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <ClipboardList size={16} />
                Planned Loads ({associatedPlannedLoads.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">Load #</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">Customer</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">From</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">To</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">Status</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-700">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {associatedPlannedLoads.map((load) => (
                      <tr key={load.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">{load.customLoadNumber || load.systemLoadNumber}</td>
                        <td className="px-3 py-2">{load.customer?.name || '-'}</td>
                        <td className="px-3 py-2">{load.pickups[0]?.shipper?.city}, {load.pickups[0]?.shipper?.state}</td>
                        <td className="px-3 py-2">{load.deliveries[0]?.consignee?.city}, {load.deliveries[0]?.consignee?.state}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            {load.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">${(load.fees?.primaryFee || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {trip.notes && (
            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <FileText size={16} />
                Notes
              </h3>
              <p className="text-sm text-slate-600">{trip.notes}</p>
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
            Edit Trip
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Edit Trip Modal Component
// ============================================================================

interface EditTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip | null;
  onSave: (updatedTrip: Partial<Trip>) => void;
}

const EditTripModal: React.FC<EditTripModalProps> = ({ isOpen, onClose, trip, onSave }) => {
  const { drivers, trucks, trailers } = useTMS();

  const [formData, setFormData] = useState({
    tripNumber: '',
    status: 'today' as TripStatus,
    type: 'company' as TripType,
    driverId: '',
    driverName: '',
    truckId: '',
    truckNumber: '',
    trailerId: '',
    trailerNumber: '',
    fromCity: '',
    fromState: '',
    toCity: '',
    toState: '',
    pickupDate: '',
    deliveryDate: '',
    totalMiles: 0,
    revenue: 0,
    driverPay: 0,
    notes: '',
  });

  // Populate form when trip changes
  useEffect(() => {
    if (trip) {
      setFormData({
        tripNumber: trip.tripNumber || '',
        status: trip.status,
        type: trip.type,
        driverId: trip.driverId || '',
        driverName: trip.driverName || '',
        truckId: trip.truckId || '',
        truckNumber: trip.truckNumber || '',
        trailerId: trip.trailerId || '',
        trailerNumber: trip.trailerNumber || '',
        fromCity: trip.fromCity || '',
        fromState: trip.fromState || '',
        toCity: trip.toCity || '',
        toState: trip.toState || '',
        pickupDate: trip.pickupDate || '',
        deliveryDate: trip.deliveryDate || '',
        totalMiles: trip.totalMiles || 0,
        revenue: trip.revenue || 0,
        driverPay: trip.driverPay || 0,
        notes: trip.notes || '',
      });
    }
  }, [trip]);

  const handleDriverChange = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    setFormData({
      ...formData,
      driverId,
      driverName: driver ? `${driver.firstName} ${driver.lastName}` : '',
    });
  };

  const handleTruckChange = (truckId: string) => {
    const truck = trucks.find(t => t.id === truckId);
    setFormData({
      ...formData,
      truckId,
      truckNumber: truck?.truckNumber || '',
    });
  };

  const handleTrailerChange = (trailerId: string) => {
    const trailer = trailers.find(t => t.id === trailerId);
    setFormData({
      ...formData,
      trailerId,
      trailerNumber: trailer?.trailerNumber || trailer?.number || '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  if (!isOpen || !trip) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Edit Trip #{trip.tripNumber}</h2>
            <p className="text-sm text-slate-600 mt-1">Update trip details and assignments</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Trip Number</label>
              <input
                type="text"
                value={formData.tripNumber}
                onChange={(e) => setFormData({ ...formData, tripNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TripStatus })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="future">Future</option>
                <option value="today">Today</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="past">Past</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as TripType })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="company">Company</option>
                <option value="broker">Broker</option>
              </select>
            </div>
          </div>

          {/* Driver & Equipment */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Users size={16} />
              Driver & Equipment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Driver</label>
                <select
                  value={formData.driverId}
                  onChange={(e) => handleDriverChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Driver</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.firstName} {driver.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Truck</label>
                <select
                  value={formData.truckId}
                  onChange={(e) => handleTruckChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Truck</option>
                  {trucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.truckNumber} - {truck.make} {truck.model}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trailer</label>
                <select
                  value={formData.trailerId}
                  onChange={(e) => handleTrailerChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No Trailer</option>
                  {trailers.map((trailer) => (
                    <option key={trailer.id} value={trailer.id}>
                      {trailer.trailerNumber || trailer.number} - {trailer.type || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Route */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <MapPin size={16} />
              Route
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">From City</label>
                <input
                  type="text"
                  value={formData.fromCity}
                  onChange={(e) => setFormData({ ...formData, fromCity: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">From State</label>
                <input
                  type="text"
                  value={formData.fromState}
                  onChange={(e) => setFormData({ ...formData, fromState: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To City</label>
                <input
                  type="text"
                  value={formData.toCity}
                  onChange={(e) => setFormData({ ...formData, toCity: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To State</label>
                <input
                  type="text"
                  value={formData.toState}
                  onChange={(e) => setFormData({ ...formData, toState: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Calendar size={16} />
              Schedule
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pickup Date</label>
                <input
                  type="date"
                  value={formData.pickupDate}
                  onChange={(e) => setFormData({ ...formData, pickupDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Date</label>
                <input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Miles</label>
                <input
                  type="number"
                  value={formData.totalMiles || ''}
                  onChange={(e) => setFormData({ ...formData, totalMiles: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Financial */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <DollarSign size={16} />
              Financial
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Revenue</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    value={formData.revenue || ''}
                    onChange={(e) => setFormData({ ...formData, revenue: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Driver Pay</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    value={formData.driverPay || ''}
                    onChange={(e) => setFormData({ ...formData, driverPay: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    step="0.01"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Add any notes about this trip..."
            />
          </div>

          {/* Form Actions */}
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
// Stats Card Component
// ============================================================================

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  iconBg: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ icon, label, value, iconBg }) => (
  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
      <div>
        <p className="text-sm text-slate-600">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  </div>
);

// ============================================================================
// Add Trip Form Component
// ============================================================================

interface AddTripFormProps {
  onSave: (tripData: NewTripInput, selectedLoadIds: string[]) => void;
  onCancel: () => void;
  preSelectedLoadIds?: string[];
}

const AddTripForm: React.FC<AddTripFormProps> = ({ onSave, onCancel, preSelectedLoadIds = [] }) => {
  const { drivers, trucks, trailers, plannedLoads, dispatchPlannedLoadsToTrip } = useTMS();

  // Form state
  const [customTripNumber, setCustomTripNumber] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [accessoryDriverPay, setAccessoryDriverPay] = useState(0);
  const [driverAdvance, setDriverAdvance] = useState(0);
  const [teamDriverId, setTeamDriverId] = useState('');
  const [showTeamDriver, setShowTeamDriver] = useState(false);
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [selectedTrailerId, setSelectedTrailerId] = useState('');
  const [beginningOdometer, setBeginningOdometer] = useState('');
  const [selectedLoadIds, setSelectedLoadIds] = useState<string[]>(preSelectedLoadIds);

  // Modal states for create dialogs
  const [showCreateDriver, setShowCreateDriver] = useState(false);
  const [showCreateTruck, setShowCreateTruck] = useState(false);
  const [showCreateTrailer, setShowCreateTrailer] = useState(false);

  // Filter planned loads - only show loads that are not yet dispatched
  const availablePlannedLoads = useMemo(() => {
    return plannedLoads.filter(load => load.status === 'planned' && !load.tripId);
  }, [plannedLoads]);

  const handleLoadToggle = (loadId: string) => {
    setSelectedLoadIds(prev =>
      prev.includes(loadId)
        ? prev.filter(id => id !== loadId)
        : [...prev, loadId]
    );
  };

  const handleSelectAllLoads = () => {
    if (selectedLoadIds.length === availablePlannedLoads.length) {
      setSelectedLoadIds([]);
    } else {
      setSelectedLoadIds(availablePlannedLoads.map(l => l.id));
    }
  };

  const handleSubmit = async () => {
    if (!selectedDriverId) {
      alert('Please select a driver');
      return;
    }
    if (!selectedTruckId) {
      alert('Please select a truck');
      return;
    }
    if (selectedLoadIds.length === 0) {
      alert('Please select at least one load');
      return;
    }

    const driver = drivers.find(d => d.id === selectedDriverId);
    const truck = trucks.find(t => t.id === selectedTruckId);
    const trailer = trailers.find(t => t.id === selectedTrailerId);

    // Get route info from selected loads
    const selectedLoads = availablePlannedLoads.filter(l => selectedLoadIds.includes(l.id));
    const firstLoad = selectedLoads[0];
    const lastLoad = selectedLoads[selectedLoads.length - 1];

    const tripData: NewTripInput = {
      tripNumber: customTripNumber || undefined,
      type: 'company',
      driverId: selectedDriverId,
      driverName: driver ? `${driver.firstName} ${driver.lastName}` : '',
      truckId: selectedTruckId,
      truckNumber: truck?.truckNumber,
      trailerId: selectedTrailerId || undefined,
      trailerNumber: trailer?.trailerNumber,
      plannedLoadIds: selectedLoadIds,
      pickupDate: firstLoad?.pickups[0]?.pickupDate || '',
      deliveryDate: lastLoad?.deliveries[0]?.deliveryDate || '',
      fromCity: firstLoad?.pickups[0]?.shipper?.city || '',
      fromState: firstLoad?.pickups[0]?.shipper?.state || '',
      toCity: lastLoad?.deliveries[0]?.consignee?.city || '',
      toState: lastLoad?.deliveries[0]?.consignee?.state || '',
      status: 'today',
      totalMiles: 0,
      revenue: selectedLoads.reduce((sum, l) => sum + (l.fees?.primaryFee || 0), 0),
      driverPay: accessoryDriverPay,
    };

    try {
      await dispatchPlannedLoadsToTrip(selectedLoadIds, tripData);
      onCancel();
    } catch (error) {
      console.error('Error creating trip:', error);
      alert('Failed to create trip. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onCancel} className="text-slate-600 hover:text-slate-900">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          Add a Trip
          <Info size={18} className="text-slate-400" />
        </h1>
      </div>

      {/* Basic Details Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Basic Details</h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Custom Trip Number</label>
          <input
            type="text"
            value={customTripNumber}
            onChange={(e) => setCustomTripNumber(e.target.value)}
            placeholder="Enter custom trip number (optional)"
            className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-slate-500 mt-1">
            Optional custom trip number that will override the system generated trip number.
          </p>
        </div>
      </div>

      {/* Drivers Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Users size={20} />
          Drivers
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Driver <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Driver</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.firstName} {driver.lastName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowCreateDriver(true)}
              className="text-sm text-blue-600 hover:text-blue-800 mt-1"
            >
              + Create Driver
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Accessory Driver Pay</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  value={accessoryDriverPay || ''}
                  onChange={(e) => setAccessoryDriverPay(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Driver Advance</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  value={driverAdvance || ''}
                  onChange={(e) => setDriverAdvance(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {showTeamDriver ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team Driver</label>
              <select
                value={teamDriverId}
                onChange={(e) => setTeamDriverId(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Team Driver</option>
                {drivers.filter(d => d.id !== selectedDriverId).map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.firstName} {driver.lastName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <button
              onClick={() => setShowTeamDriver(true)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + Add Team Driver
            </button>
          )}
        </div>
      </div>

      {/* Truck Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Truck size={20} />
          Truck
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Truck <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTruckId}
              onChange={(e) => setSelectedTruckId(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Truck</option>
              {trucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.truckNumber} - {truck.make} {truck.model}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowCreateTruck(true)}
              className="text-sm text-blue-600 hover:text-blue-800 mt-1"
            >
              + Create Truck
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Trailer</label>
            <select
              value={selectedTrailerId}
              onChange={(e) => setSelectedTrailerId(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No Trailer</option>
              {trailers.map((trailer) => (
                <option key={trailer.id} value={trailer.id}>
                  {trailer.trailerNumber || trailer.number} - {trailer.type || 'Unknown'}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowCreateTrailer(true)}
              className="text-sm text-blue-600 hover:text-blue-800 mt-1"
            >
              + Create Trailer
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Beginning Odometer</label>
            <input
              type="text"
              value={beginningOdometer}
              onChange={(e) => setBeginningOdometer(e.target.value)}
              placeholder="Enter odometer reading"
              className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Loads Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Box size={20} />
          Loads
        </h3>
        <div className="text-sm text-slate-600 mb-4 space-y-2">
          <p>Select one or more loads to dispatch them on a trip. More than one load can be selected to create an LTL trip, however a new trip should be added each time the truck is empty.</p>
          <p>A trip is defined as starting from empty miles to the first pick up, and ends when the last delivery is made. Then empty miles starts the next trip.</p>
        </div>

        {availablePlannedLoads.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Box size={40} className="mx-auto mb-2 text-slate-300" />
            <p>No planned loads available.</p>
            <p className="text-sm">Create loads in the Load Planner first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedLoadIds.length === availablePlannedLoads.length && availablePlannedLoads.length > 0}
                      onChange={handleSelectAllLoads}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Custom Load Number</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Customer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Pickup</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Delivery</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">From</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">To</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">BOL</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {availablePlannedLoads.map((load) => (
                  <tr
                    key={load.id}
                    className={`hover:bg-slate-50 ${selectedLoadIds.includes(load.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedLoadIds.includes(load.id)}
                        onChange={() => handleLoadToggle(load.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {load.customLoadNumber || load.systemLoadNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <div>{load.customer?.name || '-'}</div>
                      <div className="text-xs text-slate-400">
                        {load.customer?.city}, {load.customer?.state}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {load.pickups[0]?.pickupDate || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {load.deliveries[0]?.deliveryDate || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {load.pickups[0]?.shipper?.city}, {load.pickups[0]?.shipper?.state}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {load.deliveries[0]?.consignee?.city}, {load.deliveries[0]?.consignee?.state}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {load.pickups[0]?.bolNumber || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1 text-slate-400 hover:text-slate-600">
                        <Edit size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedLoadIds.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <Check size={16} className="inline mr-1" />
              {selectedLoadIds.length} load{selectedLoadIds.length > 1 ? 's' : ''} selected for this trip
            </p>
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSubmit}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="text-slate-600 hover:text-slate-900"
        >
          or Cancel
        </button>
      </div>

      {/* Create Modals */}
      <CreateDriverModal
        isOpen={showCreateDriver}
        onClose={() => setShowCreateDriver(false)}
        onSave={(driverId) => setSelectedDriverId(driverId)}
      />
      <CreateTruckModal
        isOpen={showCreateTruck}
        onClose={() => setShowCreateTruck(false)}
        onSave={(truckId) => setSelectedTruckId(truckId)}
      />
      <CreateTrailerModal
        isOpen={showCreateTrailer}
        onClose={() => setShowCreateTrailer(false)}
        onSave={(trailerId) => setSelectedTrailerId(trailerId)}
      />
    </div>
  );
};

// ============================================================================
// Main Trips Component
// ============================================================================

const Trips: React.FC = () => {
  const {
    trips, addTrip, deleteTrip, updateTrip, drivers, trucks, trailers, plannedLoads, loads, dispatchPlannedLoadsToTrip,
    pendingDispatchLoadIds, clearPendingDispatchLoadIds
  } = useTMS();

  const [showAddTrip, setShowAddTrip] = useState(false);
  const [showAddBrokerTrip, setShowAddBrokerTrip] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'future' | 'today' | 'past'>('today');
  const [viewMode, setViewMode] = useState<'list' | 'detailed'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [preSelectedLoadIds, setPreSelectedLoadIds] = useState<string[]>([]);
  const itemsPerPage = 25;

  // View and Edit Trip modal states
  const [viewingTrip, setViewingTrip] = useState<Trip | null>(null);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  // Handle pre-selected loads from LoadPlanner via TMSContext
  useEffect(() => {
    if (pendingDispatchLoadIds && pendingDispatchLoadIds.length > 0) {
      setPreSelectedLoadIds(pendingDispatchLoadIds);
      setShowAddTrip(true);
      // Clear the pending state after consuming
      clearPendingDispatchLoadIds();
    }
  }, [pendingDispatchLoadIds, clearPendingDispatchLoadIds]);

  // Form state for Add Broker Trip modal
  const [brokerTripForm, setBrokerTripForm] = useState<Partial<NewTripInput & { carrierName: string; mcNumber: string; contactPhone: string; carrierPay: number }>>({
    type: 'broker',
    status: 'today',
  });

  // Filter trips
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      if (statusFilter !== 'all' && trip.status !== statusFilter) {
        return false;
      }
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          trip.tripNumber.toLowerCase().includes(searchLower) ||
          trip.driverName?.toLowerCase().includes(searchLower) ||
          trip.truckNumber?.toLowerCase().includes(searchLower) ||
          trip.fromCity.toLowerCase().includes(searchLower) ||
          trip.toCity.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [trips, statusFilter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredTrips.length / itemsPerPage);
  const paginatedTrips = filteredTrips.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate stats
  const stats = useMemo(() => {
    return {
      total: trips.length,
      inProgress: trips.filter((t) => t.status === 'today' || t.status === 'in_progress').length,
      totalMiles: trips.reduce((sum, t) => sum + t.totalMiles, 0),
      revenue: trips.reduce((sum, t) => sum + t.revenue, 0),
    };
  }, [trips]);

  const getStatusBadge = (status: TripStatus) => {
    const styles: Record<TripStatus, string> = {
      future: 'bg-blue-100 text-blue-700',
      today: 'bg-yellow-100 text-yellow-700',
      past: 'bg-slate-100 text-slate-700',
      in_progress: 'bg-green-100 text-green-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-slate-100 text-slate-700';
  };

  const getTypeBadge = (type: TripType) => {
    return type === 'company'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-purple-100 text-purple-700';
  };

  const handleDeleteTrip = useCallback((id: string) => {
    if (confirm('Are you sure you want to delete this trip?')) {
      deleteTrip(id);
    }
  }, [deleteTrip]);

  const handleCreateBrokerTrip = useCallback(() => {
    if (!brokerTripForm.carrierName || !brokerTripForm.fromCity || !brokerTripForm.toCity) {
      alert('Please fill in all required fields');
      return;
    }

    const newTrip: NewTripInput = {
      type: 'broker',
      driverId: '',
      driverName: brokerTripForm.carrierName || '',
      truckId: undefined,
      truckNumber: undefined,
      plannedLoadIds: [],
      pickupDate: brokerTripForm.pickupDate || '',
      deliveryDate: brokerTripForm.deliveryDate || '',
      fromCity: brokerTripForm.fromCity!,
      fromState: brokerTripForm.fromState || '',
      toCity: brokerTripForm.toCity!,
      toState: brokerTripForm.toState || '',
      status: brokerTripForm.status || 'today',
      totalMiles: 0,
      revenue: brokerTripForm.revenue || 0,
    };

    addTrip(newTrip);
    setShowAddBrokerTrip(false);
    setBrokerTripForm({ type: 'broker', status: 'today' });
  }, [brokerTripForm, addTrip]);

  const handleSaveTrip = useCallback(async (tripData: NewTripInput, selectedLoadIds: string[]) => {
    try {
      await dispatchPlannedLoadsToTrip(selectedLoadIds, tripData);
      setShowAddTrip(false);
      setPreSelectedLoadIds([]);
    } catch (error) {
      console.error('Error creating trip:', error);
      alert('Failed to create trip. Please try again.');
    }
  }, [dispatchPlannedLoadsToTrip]);

  const handleUpdateTrip = useCallback((updatedData: Partial<Trip>) => {
    if (editingTrip) {
      updateTrip(editingTrip.id, updatedData);
      setEditingTrip(null);
    }
  }, [editingTrip, updateTrip]);

  const handleViewTrip = useCallback((trip: Trip) => {
    setViewingTrip(trip);
  }, []);

  const handleEditTrip = useCallback((trip: Trip) => {
    setEditingTrip(trip);
  }, []);

  // Show Add Trip Form
  if (showAddTrip) {
    return (
      <AddTripForm
        onSave={handleSaveTrip}
        onCancel={() => {
          setShowAddTrip(false);
          setPreSelectedLoadIds([]);
        }}
        preSelectedLoadIds={preSelectedLoadIds}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Trips</h1>
          <p className="text-slate-600 mt-1">Manage and track multi-stop trips</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'detailed' : 'list')}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2"
          >
            {viewMode === 'list' ? <LayoutGrid size={18} /> : <List size={18} />}
            {viewMode === 'list' ? 'Detailed List' : 'Simple List'}
          </button>
          <button
            onClick={() => setShowAddTrip(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={18} />
            Add Trip
          </button>
          <button
            onClick={() => setShowAddBrokerTrip(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Plus size={18} />
            Add Broker Trip
          </button>
          <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2">
            Add Empty Move
          </button>
          <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2">
            <MapPin size={18} />
            Driver Locations
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          icon={<Route className="w-5 h-5 text-blue-600" />}
          label="Total Trips"
          value={stats.total}
          iconBg="bg-blue-100"
        />
        <StatsCard
          icon={<Clock className="w-5 h-5 text-yellow-600" />}
          label="In Progress"
          value={stats.inProgress}
          iconBg="bg-yellow-100"
        />
        <StatsCard
          icon={<MapPin className="w-5 h-5 text-green-600" />}
          label="Total Miles"
          value={stats.totalMiles.toLocaleString()}
          iconBg="bg-green-100"
        />
        <StatsCard
          icon={<DollarSign className="w-5 h-5 text-purple-600" />}
          label="Revenue"
          value={`$${stats.revenue.toLocaleString()}`}
          iconBg="bg-purple-100"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(['future', 'today', 'past'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => {
                setStatusFilter(filter);
                setCurrentPage(1);
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === filter
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {filter === 'future' && 'Future Trip'}
              {filter === 'today' && "Today's Trip"}
              {filter === 'past' && 'Past Trip'}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search trips..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Search
          </button>
          <button className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium">
            Advanced Search
          </button>
        </div>
      </div>

      {/* Pagination Info */}
      {filteredTrips.length > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            {(currentPage - 1) * itemsPerPage + 1} -{' '}
            {Math.min(currentPage * itemsPerPage, filteredTrips.length)} of {filteredTrips.length}{' '}
            with{' '}
            <select
              value={itemsPerPage}
              className="px-2 py-1 border border-slate-300 rounded"
              disabled
            >
              <option value={25}>25</option>
            </select>{' '}
            per page
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => i + 1).map((page) => (
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Trips List / Empty State */}
      {filteredTrips.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12">
          <div className="text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Route className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Trips Yet</h2>
            <p className="text-slate-600 mb-6">
              Create your first trip to start tracking multi-stop routes, assign drivers, and
              monitor progress.
            </p>
            <button
              onClick={() => setShowAddTrip(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
            >
              <Plus size={18} />
              Create First Trip
            </button>

            {/* Feature Preview */}
            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="p-4 bg-slate-50 rounded-lg text-left">
                <Truck className="w-5 h-5 text-blue-600 mb-2" />
                <p className="text-sm font-medium text-slate-900">Multi-Stop Routes</p>
                <p className="text-xs text-slate-600">
                  Plan trips with multiple pickup and delivery stops
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg text-left">
                <Calendar className="w-5 h-5 text-green-600 mb-2" />
                <p className="text-sm font-medium text-slate-900">Schedule Management</p>
                <p className="text-xs text-slate-600">
                  Track dates, deadlines, and driver availability
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Trip</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Loads</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Pickup</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Delivery</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Driver</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Truck</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">From</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">To</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedTrips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getTypeBadge(trip.type)}`}
                      >
                        {trip.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{trip.tripNumber}</div>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${getStatusBadge(trip.status)}`}
                      >
                        {trip.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const tripLoads = loads.filter(l => l.tripId === trip.id);
                        const count = tripLoads.length;
                        return count > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                            <Box size={10} />
                            {count}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{trip.pickupDate}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{trip.deliveryDate}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{trip.driverName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{trip.truckNumber || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {trip.fromCity}, {trip.fromState}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {trip.toCity}, {trip.toState}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleViewTrip(trip)}
                          className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200 flex items-center gap-1"
                        >
                          <Eye size={12} />
                          View
                        </button>
                        <button
                          onClick={() => handleEditTrip(trip)}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
                        >
                          <Edit size={12} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTrip(trip.id)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Broker Trip Modal */}
      {showAddBrokerTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Add Broker Trip</h2>
              <p className="text-sm text-slate-600 mt-1">
                Create a trip for loads brokered to external carriers
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Carrier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={brokerTripForm.carrierName || ''}
                  onChange={(e) => setBrokerTripForm({ ...brokerTripForm, carrierName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter carrier name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">MC Number</label>
                  <input
                    type="text"
                    value={brokerTripForm.mcNumber || ''}
                    onChange={(e) => setBrokerTripForm({ ...brokerTripForm, mcNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="MC-XXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={brokerTripForm.contactPhone || ''}
                    onChange={(e) => setBrokerTripForm({ ...brokerTripForm, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="(XXX) XXX-XXXX"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pickup Date</label>
                  <input
                    type="date"
                    value={brokerTripForm.pickupDate || ''}
                    onChange={(e) => setBrokerTripForm({ ...brokerTripForm, pickupDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Date</label>
                  <input
                    type="date"
                    value={brokerTripForm.deliveryDate || ''}
                    onChange={(e) => setBrokerTripForm({ ...brokerTripForm, deliveryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">From City <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={brokerTripForm.fromCity || ''}
                    onChange={(e) => setBrokerTripForm({ ...brokerTripForm, fromCity: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">From State</label>
                  <input
                    type="text"
                    value={brokerTripForm.fromState || ''}
                    onChange={(e) => setBrokerTripForm({ ...brokerTripForm, fromState: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="State"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">To City <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={brokerTripForm.toCity || ''}
                    onChange={(e) => setBrokerTripForm({ ...brokerTripForm, toCity: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">To State</label>
                  <input
                    type="text"
                    value={brokerTripForm.toState || ''}
                    onChange={(e) => setBrokerTripForm({ ...brokerTripForm, toState: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="State"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Carrier Pay</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={brokerTripForm.carrierPay || ''}
                      onChange={(e) => setBrokerTripForm({ ...brokerTripForm, carrierPay: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Our Revenue</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={brokerTripForm.revenue || ''}
                      onChange={(e) => setBrokerTripForm({ ...brokerTripForm, revenue: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddBrokerTrip(false);
                  setBrokerTripForm({ type: 'broker', status: 'today' });
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBrokerTrip}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Save Broker Trip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Trip Modal */}
      <ViewTripModal
        isOpen={viewingTrip !== null}
        onClose={() => setViewingTrip(null)}
        trip={viewingTrip}
        onEdit={() => {
          if (viewingTrip) {
            setEditingTrip(viewingTrip);
            setViewingTrip(null);
          }
        }}
      />

      {/* Edit Trip Modal */}
      <EditTripModal
        isOpen={editingTrip !== null}
        onClose={() => setEditingTrip(null)}
        trip={editingTrip}
        onSave={handleUpdateTrip}
      />
    </div>
  );
};

export default Trips;

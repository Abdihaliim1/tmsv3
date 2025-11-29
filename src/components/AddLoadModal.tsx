
import React, { useState, useEffect } from 'react';
import { X, MapPin, Calculator } from 'lucide-react';
import { LoadStatus, NewLoadInput } from '../types';
import { useTMS } from '../context/TMSContext';
import { calculateDistance } from '../services/utils';

interface AddLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (load: NewLoadInput) => void;
}

const AddLoadModal: React.FC<AddLoadModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { drivers } = useTMS();
  
  const initialState: NewLoadInput = {
    status: LoadStatus.Available,
    customerName: '',
    originCity: '',
    originState: '',
    destCity: '',
    destState: '',
    rate: 0,
    miles: 0,
    pickupDate: '',
    deliveryDate: '',
    driverId: '',
    driverName: ''
  };

  const [formData, setFormData] = useState<NewLoadInput>(initialState);
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [rpm, setRpm] = useState<string>('0.00');

  // Reset form on open
  useEffect(() => {
    if(isOpen) {
      setFormData(initialState);
      setSelectedTruckId('');
      setRpm('0.00');
    }
  }, [isOpen]);

  // Auto-calculate Rate Per Mile when Rate or Miles change
  useEffect(() => {
    if (formData.miles > 0 && formData.rate > 0) {
      setRpm((formData.rate / formData.miles).toFixed(2));
    } else {
      setRpm('0.00');
    }
  }, [formData.rate, formData.miles]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'rate' || name === 'miles' ? parseFloat(value) : value
    }));
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
      // Auto-fill Truck logic from old app
      setSelectedTruckId(driver.truckId);
    } else {
      setFormData(prev => ({ ...prev, driverId: '', driverName: '' }));
      setSelectedTruckId('');
    }
  };

  const handleCalculateMiles = () => {
    const dist = calculateDistance(
      formData.originCity, 
      formData.originState, 
      formData.destCity, 
      formData.destState
    );
    
    if (dist > 0) {
      setFormData(prev => ({ ...prev, miles: dist }));
    } else {
      alert("Could not calculate distance automatically. Please enter manually.");
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity p-4 md:p-0"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Create New Load</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form Scrollable Area */}
        <div className="overflow-y-auto p-6">
          <form id="add-load-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Section: Route */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                  <MapPin size={16} /> Route Details
                </h3>
                <button 
                  type="button"
                  onClick={handleCalculateMiles}
                  className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200 transition-colors flex items-center gap-1 font-medium"
                >
                  <Calculator size={12} /> Calculate Miles
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Origin City</label>
                  <input required name="originCity" value={formData.originCity} onChange={handleChange} type="text" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="e.g. Columbus" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Origin State</label>
                  <input required name="originState" value={formData.originState} onChange={handleChange} type="text" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all uppercase" placeholder="OH" maxLength={2} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Destination City</label>
                  <input required name="destCity" value={formData.destCity} onChange={handleChange} type="text" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="e.g. Chicago" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Destination State</label>
                  <input required name="destState" value={formData.destState} onChange={handleChange} type="text" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all uppercase" placeholder="IL" maxLength={2} />
                </div>
              </div>
            </div>

            {/* Section: Financials */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2">Financials</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Total Rate ($)</label>
                  <input required name="rate" value={formData.rate || ''} onChange={handleChange} type="number" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Total Miles</label>
                  <input required name="miles" value={formData.miles || ''} onChange={handleChange} type="number" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Rate Per Mile</label>
                  <input disabled value={`$${rpm}`} className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed" />
                </div>
              </div>
            </div>

            {/* Section: Assignment & Status */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2">Assignment & Status</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Assign Driver</label>
                  <select name="driverId" value={formData.driverId} onChange={handleDriverChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                    <option value="">Select Driver...</option>
                    {drivers.filter(d => d.status === 'active').map(driver => (
                      <option key={driver.id} value={driver.id}>{driver.firstName} {driver.lastName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Assigned Truck</label>
                  <input disabled value={selectedTruckId || 'N/A'} className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Customer Name</label>
                  <input required name="customerName" value={formData.customerName} onChange={handleChange} type="text" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="e.g. Midwest Distribution" />
                </div>

                 <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Status</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                    {Object.values(LoadStatus).map(status => (
                      <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Pickup Date</label>
                  <input required name="pickupDate" value={formData.pickupDate} onChange={handleChange} type="date" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Delivery Date</label>
                  <input required name="deliveryDate" value={formData.deliveryDate} onChange={handleChange} type="date" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button form="add-load-form" type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-200 transition-colors">
            Create Load
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddLoadModal;

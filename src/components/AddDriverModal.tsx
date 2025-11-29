
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { NewDriverInput } from '../types';

interface AddDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (driver: NewDriverInput) => void;
}

const AddDriverModal: React.FC<AddDriverModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const initialState: NewDriverInput = {
    firstName: '',
    lastName: '',
    status: 'active',
    type: 'Company',
    rateOrSplit: 0,
    email: '',
    phone: '',
    truckId: ''
  };

  const [formData, setFormData] = useState<NewDriverInput>(initialState);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData(initialState);
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'rateOrSplit' ? parseFloat(value) : value
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Onboard New Driver</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">First Name</label>
              <input required name="firstName" value={formData.firstName} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Last Name</label>
              <input required name="lastName" value={formData.lastName} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600">Driver Type</label>
            <select name="type" value={formData.type} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="Company">Company Driver</option>
              <option value="OwnerOperator">Owner Operator</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600">
              {formData.type === 'Company' ? 'Rate per Mile ($)' : 'Split Percentage (%)'}
            </label>
            <input required name="rateOrSplit" type="number" step="0.01" value={formData.rateOrSplit} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Phone</label>
              <input required name="phone" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Truck ID</label>
              <input required name="truckId" value={formData.truckId} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Driver</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDriverModal;

import React, { useState, useMemo, useCallback } from 'react';
import {
  ClipboardList, Plus, Search, Eye, Edit, Copy, Trash2, Route, Building2,
  MapPin, Calendar, FileText, DollarSign, ChevronRight, X, Check, Clock,
  Truck, Package, Receipt, Upload, Paperclip
} from 'lucide-react';
import { PlannedLoad, PlannedLoadStatus, Pickup, Delivery, Customer, PlannedLoadFees, NewPlannedLoadInput, FeeType } from '../types/plannedLoad';
import { useTMS } from '../context/TMSContext';

// Quantity unit type for form
type QuantityUnit = 'pallets' | 'boxes' | 'cases' | 'pieces' | 'lbs' | 'kg';

// ============================================================================
// Progress Tracker Component
// ============================================================================

interface ProgressTrackerProps {
  currentStep: number;
  status: PlannedLoadStatus;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({ currentStep, status }) => {
  const steps = [
    { num: 1, label: 'Planned Load', status: 'planned' },
    { num: 2, label: 'Trip (Dispatched)', status: 'dispatched' },
    { num: 3, label: 'In transit', status: 'in_transit', note: '(from ELD)' },
    { num: 4, label: 'Delivered', status: 'delivered', note: '(from ELD)' },
    { num: 5, label: 'Delivered w/BOL', status: 'delivered_with_bol', note: '(from ELD)' },
    { num: 6, label: 'Invoice', status: 'invoiced' },
    { num: 7, label: 'Paid', status: 'paid' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
      <div className="flex items-center justify-between overflow-x-auto">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.num;
          const isCurrent = currentStep === step.num;
          const isFuture = currentStep < step.num;

          return (
            <React.Fragment key={step.num}>
              <div className="flex flex-col items-center min-w-[100px]">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check size={16} /> : step.num}
                </div>
                <span
                  className={`mt-1 text-xs font-medium text-center ${
                    isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
                {step.note && (
                  <span className="text-[10px] text-slate-400">{step.note}</span>
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    currentStep > step.num ? 'bg-green-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Create Location Modal Component (for Customer, Shipper, Consignee)
// ============================================================================

interface CreateLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (location: LocationFormData) => void;
  title: string;
  type: 'customer' | 'shipper' | 'consignee';
}

interface LocationFormData {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  contactName: string;
}

const CreateLocationModal: React.FC<CreateLocationModalProps> = ({ isOpen, onClose, onSave, title, type }) => {
  const [formData, setFormData] = useState<LocationFormData>({
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    email: '',
    contactName: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Company Name is required');
      return;
    }
    onSave(formData);
    setFormData({
      name: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      phone: '',
      email: '',
      contactName: '',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter company name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Street address"
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
                placeholder="XX"
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
            <input
              type="text"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              Create {type === 'customer' ? 'Customer' : type === 'shipper' ? 'Shipper' : 'Consignee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// Search Dropdown Component
// ============================================================================

interface SearchDropdownProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (item: { id: string; name: string; address?: string; city?: string; state?: string }) => void;
  items: Array<{ id: string; name: string; address?: string; city?: string; state?: string }>;
  placeholder: string;
  onCreateNew: () => void;
  createLabel: string;
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({
  value,
  onChange,
  onSelect,
  items,
  placeholder,
  onCreateNew,
  createLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items.slice(0, 10);
    const lower = searchTerm.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(lower) ||
      item.address?.toLowerCase().includes(lower) ||
      item.city?.toLowerCase().includes(lower) ||
      item.state?.toLowerCase().includes(lower)
    ).slice(0, 10);
  }, [items, searchTerm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  const handleSelect = (item: { id: string; name: string; address?: string; city?: string; state?: string }) => {
    setSearchTerm(item.name);
    onChange(item.name);
    onSelect(item);
    setIsOpen(false);
  };

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        placeholder={placeholder}
      />
      {isOpen && (filteredItems.length > 0 || searchTerm) && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full px-3 py-2 text-left hover:bg-slate-100 border-b border-slate-100 last:border-b-0"
            >
              <div className="font-medium text-slate-900">{item.name}</div>
              {(item.city || item.state) && (
                <div className="text-sm text-slate-500">
                  {item.address && <span>{item.address}, </span>}
                  {item.city}, {item.state}
                </div>
              )}
            </button>
          ))}
          {filteredItems.length === 0 && searchTerm && (
            <div className="px-3 py-2 text-sm text-slate-500">No results found</div>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onCreateNew();
            }}
            className="w-full px-3 py-2 text-left text-blue-600 hover:bg-blue-50 flex items-center gap-2 border-t"
          >
            <Plus size={16} />
            {createLabel}
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Pickup Form Section
// ============================================================================

interface PickupFormData {
  id: string;
  shipperId: string;
  shipperName: string;
  shipperAddress: string;
  shipperCity: string;
  shipperState: string;
  shipperZipCode: string;
  pickupDate: string;
  driverInstructions: string;
  bolNumber: string;
  customerRequiredInfo: string;
  weight: string;
  quantity: string;
  quantityUnit: QuantityUnit;
  notes: string;
  commodity: string;
}

interface PickupSectionProps {
  pickup: PickupFormData;
  index: number;
  onUpdate: (pickup: PickupFormData) => void;
  onRemove: () => void;
  canRemove: boolean;
  shippers: Array<{ id: string; name: string; address?: string; city?: string; state?: string }>;
  onCreateShipper: () => void;
}

const PickupSection: React.FC<PickupSectionProps> = ({
  pickup,
  index,
  onUpdate,
  onRemove,
  canRemove,
  shippers,
  onCreateShipper,
}) => {
  const handleShipperSelect = (item: { id: string; name: string; address?: string; city?: string; state?: string }) => {
    onUpdate({
      ...pickup,
      shipperId: item.id,
      shipperName: item.name,
      shipperAddress: item.address || '',
      shipperCity: item.city || '',
      shipperState: item.state || '',
    });
  };

  return (
    <div className="relative border border-slate-200 rounded-lg p-4 bg-slate-50">
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
        >
          <X size={18} />
        </button>
      )}
      <h4 className="text-sm font-medium text-slate-700 mb-3">Pickup #{index + 1}</h4>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Shipper</label>
          <div className="flex gap-2">
            <SearchDropdown
              value={pickup.shipperName}
              onChange={(value) => onUpdate({ ...pickup, shipperName: value })}
              onSelect={handleShipperSelect}
              items={shippers}
              placeholder="Search shipper by name, address, city..."
              onCreateNew={onCreateShipper}
              createLabel="Create New Shipper"
            />
            <button
              type="button"
              onClick={onCreateShipper}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              title="Create Shipper"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pickup Date</label>
            <input
              type="date"
              value={pickup.pickupDate}
              onChange={(e) => onUpdate({ ...pickup, pickupDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">BOL #</label>
            <input
              type="text"
              value={pickup.bolNumber}
              onChange={(e) => onUpdate({ ...pickup, bolNumber: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Driver Instructions</label>
          <textarea
            value={pickup.driverInstructions}
            onChange={(e) => onUpdate({ ...pickup, driverInstructions: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Customer Required Info</label>
          <input
            type="text"
            value={pickup.customerRequiredInfo}
            onChange={(e) => onUpdate({ ...pickup, customerRequiredInfo: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="PO#, Reference#, etc."
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Weight (lbs)</label>
            <input
              type="number"
              value={pickup.weight}
              onChange={(e) => onUpdate({ ...pickup, weight: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input
              type="number"
              value={pickup.quantity}
              onChange={(e) => onUpdate({ ...pickup, quantity: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
            <select
              value={pickup.quantityUnit}
              onChange={(e) => onUpdate({ ...pickup, quantityUnit: e.target.value as QuantityUnit })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="pallets">Pallets</option>
              <option value="boxes">Boxes</option>
              <option value="cases">Cases</option>
              <option value="pieces">Pieces</option>
              <option value="lbs">Lbs</option>
              <option value="kg">Kg</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Commodity</label>
          <input
            type="text"
            value={pickup.commodity}
            onChange={(e) => onUpdate({ ...pickup, commodity: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={pickup.notes}
            onChange={(e) => onUpdate({ ...pickup, notes: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Delivery Form Section
// ============================================================================

interface DeliveryFormData {
  id: string;
  consigneeId: string;
  consigneeName: string;
  consigneeAddress: string;
  consigneeCity: string;
  consigneeState: string;
  consigneeZipCode: string;
  deliveryDate: string;
  driverInstructions: string;
}

interface DeliverySectionProps {
  delivery: DeliveryFormData;
  index: number;
  onUpdate: (delivery: DeliveryFormData) => void;
  onRemove: () => void;
  canRemove: boolean;
  consignees: Array<{ id: string; name: string; address?: string; city?: string; state?: string }>;
  onCreateConsignee: () => void;
}

const DeliverySection: React.FC<DeliverySectionProps> = ({
  delivery,
  index,
  onUpdate,
  onRemove,
  canRemove,
  consignees,
  onCreateConsignee,
}) => {
  const handleConsigneeSelect = (item: { id: string; name: string; address?: string; city?: string; state?: string }) => {
    onUpdate({
      ...delivery,
      consigneeId: item.id,
      consigneeName: item.name,
      consigneeAddress: item.address || '',
      consigneeCity: item.city || '',
      consigneeState: item.state || '',
    });
  };

  return (
    <div className="relative border border-slate-200 rounded-lg p-4 bg-slate-50">
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
        >
          <X size={18} />
        </button>
      )}
      <h4 className="text-sm font-medium text-slate-700 mb-3">Delivery #{index + 1}</h4>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Consignee</label>
          <div className="flex gap-2">
            <SearchDropdown
              value={delivery.consigneeName}
              onChange={(value) => onUpdate({ ...delivery, consigneeName: value })}
              onSelect={handleConsigneeSelect}
              items={consignees}
              placeholder="Search consignee by name, address, city..."
              onCreateNew={onCreateConsignee}
              createLabel="Create New Consignee"
            />
            <button
              type="button"
              onClick={onCreateConsignee}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              title="Create Consignee"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Date</label>
          <input
            type="date"
            value={delivery.deliveryDate}
            onChange={(e) => onUpdate({ ...delivery, deliveryDate: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Driver Instructions</label>
          <textarea
            value={delivery.driverInstructions}
            onChange={(e) => onUpdate({ ...delivery, driverInstructions: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Add/Edit Planned Load Form
// ============================================================================

interface PlannedLoadFormProps {
  load?: PlannedLoad;
  onSave: (load: Partial<PlannedLoad>) => void;
  onCancel: () => void;
}

const PlannedLoadForm: React.FC<PlannedLoadFormProps> = ({ load, onSave, onCancel }) => {
  const { customers, addCustomer } = useTMS();

  // Basic form data
  const [customLoadNumber, setCustomLoadNumber] = useState(load?.customLoadNumber || '');
  const [customerId, setCustomerId] = useState(load?.customerId || '');
  const [customerName, setCustomerName] = useState(load?.customer?.name || '');
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string; address?: string; city?: string; state?: string } | null>(
    load?.customer ? { id: load.customer.id, name: load.customer.name, address: load.customer.address, city: load.customer.city, state: load.customer.state } : null
  );

  // Pickups - dynamic array
  const [pickups, setPickups] = useState<PickupFormData[]>(() => {
    if (load?.pickups?.length) {
      return load.pickups.map((p, idx) => ({
        id: p.id || `pickup_${idx}`,
        shipperId: p.shipper?.id || '',
        shipperName: p.shipper?.name || '',
        shipperAddress: p.shipper?.address || '',
        shipperCity: p.shipper?.city || '',
        shipperState: p.shipper?.state || '',
        shipperZipCode: p.shipper?.zipCode || '',
        pickupDate: p.pickupDate || '',
        driverInstructions: p.driverInstructions || '',
        bolNumber: p.bolNumber || '',
        customerRequiredInfo: p.customerRequiredInfo || '',
        weight: p.weight?.toString() || '',
        quantity: p.quantity?.toString() || '',
        quantityUnit: (p.quantityUnit as QuantityUnit) || 'pallets',
        notes: p.notes || '',
        commodity: p.commodity || '',
      }));
    }
    return [{
      id: `pickup_${Date.now()}`,
      shipperId: '',
      shipperName: '',
      shipperAddress: '',
      shipperCity: '',
      shipperState: '',
      shipperZipCode: '',
      pickupDate: '',
      driverInstructions: '',
      bolNumber: '',
      customerRequiredInfo: '',
      weight: '',
      quantity: '',
      quantityUnit: 'pallets' as QuantityUnit,
      notes: '',
      commodity: '',
    }];
  });

  // Deliveries - dynamic array
  const [deliveries, setDeliveries] = useState<DeliveryFormData[]>(() => {
    if (load?.deliveries?.length) {
      return load.deliveries.map((d, idx) => ({
        id: d.id || `delivery_${idx}`,
        consigneeId: d.consignee?.id || '',
        consigneeName: d.consignee?.name || '',
        consigneeAddress: d.consignee?.address || '',
        consigneeCity: d.consignee?.city || '',
        consigneeState: d.consignee?.state || '',
        consigneeZipCode: d.consignee?.zipCode || '',
        deliveryDate: d.deliveryDate || '',
        driverInstructions: d.driverInstructions || '',
      }));
    }
    return [{
      id: `delivery_${Date.now()}`,
      consigneeId: '',
      consigneeName: '',
      consigneeAddress: '',
      consigneeCity: '',
      consigneeState: '',
      consigneeZipCode: '',
      deliveryDate: '',
      driverInstructions: '',
    }];
  });

  // Fees
  const [fees, setFees] = useState({
    primaryFee: load?.fees?.primaryFee?.toString() || '',
    primaryFeeType: load?.fees?.primaryFeeType || 'flat',
    fscAmount: load?.fees?.fscAmount?.toString() || '0',
    fscType: load?.fees?.fscType || 'flat',
    detention: load?.fees?.accessoryFees?.detention?.toString() || '0',
    lumper: load?.fees?.accessoryFees?.lumper?.toString() || '0',
    stopOff: load?.fees?.accessoryFees?.stopOff?.toString() || '0',
    tarpFee: load?.fees?.accessoryFees?.tarpFee?.toString() || '0',
    invoiceAdvance: load?.fees?.invoiceAdvance?.toString() || '0',
  });

  // Legal
  const [legalDisclaimer, setLegalDisclaimer] = useState(load?.legalDisclaimer || '');

  // Modals
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showCreateShipper, setShowCreateShipper] = useState(false);
  const [showCreateConsignee, setShowCreateConsignee] = useState(false);

  // Get customers as searchable items, filter by type
  const customerItems = useMemo(() => {
    return customers
      .filter(c => c.type === 'customer' || c.type === 'broker')
      .map(c => ({
        id: c.id,
        name: c.name,
        address: c.address,
        city: c.city,
        state: c.state,
      }));
  }, [customers]);

  const shipperItems = useMemo(() => {
    return customers
      .filter(c => c.type === 'shipper' || c.type === 'customer')
      .map(c => ({
        id: c.id,
        name: c.name,
        address: c.address,
        city: c.city,
        state: c.state,
      }));
  }, [customers]);

  const consigneeItems = useMemo(() => {
    return customers
      .filter(c => c.type === 'consignee' || c.type === 'customer')
      .map(c => ({
        id: c.id,
        name: c.name,
        address: c.address,
        city: c.city,
        state: c.state,
      }));
  }, [customers]);

  // Add pickup
  const addPickup = () => {
    setPickups([...pickups, {
      id: `pickup_${Date.now()}`,
      shipperId: '',
      shipperName: '',
      shipperAddress: '',
      shipperCity: '',
      shipperState: '',
      shipperZipCode: '',
      pickupDate: '',
      driverInstructions: '',
      bolNumber: '',
      customerRequiredInfo: '',
      weight: '',
      quantity: '',
      quantityUnit: 'pallets',
      notes: '',
      commodity: '',
    }]);
  };

  // Remove pickup
  const removePickup = (id: string) => {
    setPickups(pickups.filter(p => p.id !== id));
  };

  // Update pickup
  const updatePickup = (updatedPickup: PickupFormData) => {
    setPickups(pickups.map(p => p.id === updatedPickup.id ? updatedPickup : p));
  };

  // Add delivery
  const addDelivery = () => {
    setDeliveries([...deliveries, {
      id: `delivery_${Date.now()}`,
      consigneeId: '',
      consigneeName: '',
      consigneeAddress: '',
      consigneeCity: '',
      consigneeState: '',
      consigneeZipCode: '',
      deliveryDate: '',
      driverInstructions: '',
    }]);
  };

  // Remove delivery
  const removeDelivery = (id: string) => {
    setDeliveries(deliveries.filter(d => d.id !== id));
  };

  // Update delivery
  const updateDelivery = (updatedDelivery: DeliveryFormData) => {
    setDeliveries(deliveries.map(d => d.id === updatedDelivery.id ? updatedDelivery : d));
  };

  // Handle customer select
  const handleCustomerSelect = (item: { id: string; name: string; address?: string; city?: string; state?: string }) => {
    setSelectedCustomer(item);
    setCustomerId(item.id);
    setCustomerName(item.name);
  };

  // Handle create customer
  const handleCreateCustomer = (data: LocationFormData) => {
    addCustomer({
      name: data.name,
      type: 'customer',
      address: data.address,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      phone: data.phone,
      email: data.email,
      contactName: data.contactName,
      isActive: true,
    });
    // Auto-select the new customer
    setCustomerName(data.name);
    setSelectedCustomer({
      id: 'new',
      name: data.name,
      address: data.address,
      city: data.city,
      state: data.state,
    });
  };

  // Handle create shipper
  const handleCreateShipper = (data: LocationFormData) => {
    addCustomer({
      name: data.name,
      type: 'shipper',
      address: data.address,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      phone: data.phone,
      email: data.email,
      contactName: data.contactName,
      isActive: true,
    });
    // Auto-select in first empty pickup
    const emptyPickupIdx = pickups.findIndex(p => !p.shipperName);
    if (emptyPickupIdx >= 0) {
      const updated = { ...pickups[emptyPickupIdx] };
      updated.shipperName = data.name;
      updated.shipperAddress = data.address;
      updated.shipperCity = data.city;
      updated.shipperState = data.state;
      updated.shipperZipCode = data.zipCode;
      updatePickup(updated);
    }
  };

  // Handle create consignee
  const handleCreateConsignee = (data: LocationFormData) => {
    addCustomer({
      name: data.name,
      type: 'consignee',
      address: data.address,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      phone: data.phone,
      email: data.email,
      contactName: data.contactName,
      isActive: true,
    });
    // Auto-select in first empty delivery
    const emptyDeliveryIdx = deliveries.findIndex(d => !d.consigneeName);
    if (emptyDeliveryIdx >= 0) {
      const updated = { ...deliveries[emptyDeliveryIdx] };
      updated.consigneeName = data.name;
      updated.consigneeAddress = data.address;
      updated.consigneeCity = data.city;
      updated.consigneeState = data.state;
      updated.consigneeZipCode = data.zipCode;
      updateDelivery(updated);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      customLoadNumber,
      customerId,
      customer: selectedCustomer ? {
        id: selectedCustomer.id,
        name: selectedCustomer.name,
        address: selectedCustomer.address,
        city: selectedCustomer.city,
        state: selectedCustomer.state,
      } : {
        id: 'new',
        name: customerName,
      },
      pickups: pickups.map(p => ({
        id: p.id,
        shipper: {
          id: p.shipperId || `shipper_${Date.now()}`,
          name: p.shipperName,
          address: p.shipperAddress,
          city: p.shipperCity,
          state: p.shipperState,
          zipCode: p.shipperZipCode,
        },
        pickupDate: p.pickupDate,
        driverInstructions: p.driverInstructions,
        bolNumber: p.bolNumber,
        customerRequiredInfo: p.customerRequiredInfo,
        weight: parseFloat(p.weight) || 0,
        quantity: parseFloat(p.quantity) || 0,
        quantityUnit: p.quantityUnit,
        notes: p.notes,
        commodity: p.commodity,
      })),
      deliveries: deliveries.map(d => ({
        id: d.id,
        consignee: {
          id: d.consigneeId || `consignee_${Date.now()}`,
          name: d.consigneeName,
          address: d.consigneeAddress,
          city: d.consigneeCity,
          state: d.consigneeState,
          zipCode: d.consigneeZipCode,
        },
        deliveryDate: d.deliveryDate,
        driverInstructions: d.driverInstructions,
      })),
      fees: {
        primaryFee: parseFloat(fees.primaryFee) || 0,
        primaryFeeType: fees.primaryFeeType as FeeType,
        fscAmount: parseFloat(fees.fscAmount) || 0,
        fscType: fees.fscType as FeeType,
        accessoryFees: {
          detention: parseFloat(fees.detention) || 0,
          lumper: parseFloat(fees.lumper) || 0,
          stopOff: parseFloat(fees.stopOff) || 0,
          tarpFee: parseFloat(fees.tarpFee) || 0,
          additional: [],
        },
        invoiceAdvance: parseFloat(fees.invoiceAdvance) || 0,
      },
      legalDisclaimer,
    });
  };

  return (
    <>
      {/* Create Modals */}
      <CreateLocationModal
        isOpen={showCreateCustomer}
        onClose={() => setShowCreateCustomer(false)}
        onSave={handleCreateCustomer}
        title="Create New Customer"
        type="customer"
      />
      <CreateLocationModal
        isOpen={showCreateShipper}
        onClose={() => setShowCreateShipper(false)}
        onSave={handleCreateShipper}
        title="Create New Shipper"
        type="shipper"
      />
      <CreateLocationModal
        isOpen={showCreateConsignee}
        onClose={() => setShowCreateConsignee(false)}
        onSave={handleCreateConsignee}
        title="Create New Consignee"
        type="consignee"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Details */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Basic Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Custom Load Number
              </label>
              <input
                type="text"
                value={customLoadNumber}
                onChange={(e) => setCustomLoadNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optional custom load number"
              />
              <p className="text-xs text-slate-500 mt-1">
                Optional custom load number that will override the system generated load number
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Customer
              </label>
              <div className="flex gap-2">
                <SearchDropdown
                  value={customerName}
                  onChange={setCustomerName}
                  onSelect={handleCustomerSelect}
                  items={customerItems}
                  placeholder="Search for name, street, city, or state"
                  onCreateNew={() => setShowCreateCustomer(true)}
                  createLabel="Create New Customer"
                />
                <button
                  type="button"
                  onClick={() => setShowCreateCustomer(true)}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 text-sm whitespace-nowrap"
                >
                  <Plus size={16} />
                  Create Customer
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stops Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pickups */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="text-green-600" size={20} />
              Pickups
            </h3>
            <div className="space-y-4">
              {pickups.map((pickup, index) => (
                <PickupSection
                  key={pickup.id}
                  pickup={pickup}
                  index={index}
                  onUpdate={updatePickup}
                  onRemove={() => removePickup(pickup.id)}
                  canRemove={pickups.length > 1}
                  shippers={shipperItems}
                  onCreateShipper={() => setShowCreateShipper(true)}
                />
              ))}
              <button
                type="button"
                onClick={addPickup}
                className="w-full py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg text-sm font-medium flex items-center justify-center gap-1 border border-dashed border-blue-300"
              >
                <Plus size={16} />
                Add Another Pickup
              </button>
            </div>
          </div>

          {/* Deliveries */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="text-red-600" size={20} />
              Deliveries
            </h3>
            <div className="space-y-4">
              {deliveries.map((delivery, index) => (
                <DeliverySection
                  key={delivery.id}
                  delivery={delivery}
                  index={index}
                  onUpdate={updateDelivery}
                  onRemove={() => removeDelivery(delivery.id)}
                  canRemove={deliveries.length > 1}
                  consignees={consigneeItems}
                  onCreateConsignee={() => setShowCreateConsignee(true)}
                />
              ))}
              <button
                type="button"
                onClick={addDelivery}
                className="w-full py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg text-sm font-medium flex items-center justify-center gap-1 border border-dashed border-blue-300"
              >
                <Plus size={16} />
                Add Another Delivery
              </button>
            </div>
          </div>
        </div>

      {/* Fees Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Primary Fee */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <DollarSign className="text-green-600" size={20} />
              Primary Fee
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Primary Fee</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={fees.primaryFee}
                      onChange={(e) => setFees({ ...fees, primaryFee: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fee Type</label>
                  <select
                    value={fees.primaryFeeType}
                    onChange={(e) => setFees({ ...fees, primaryFeeType: e.target.value as FeeType })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="flat">Flat Fee</option>
                    <option value="per_mile">Per Mile</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Fuel Surcharge Fee</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">FSC Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                      <input
                        type="number"
                        value={fees.fscAmount}
                        onChange={(e) => setFees({ ...fees, fscAmount: e.target.value })}
                        className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">FSC Type</label>
                    <select
                      value={fees.fscType}
                      onChange={(e) => setFees({ ...fees, fscType: e.target.value as FeeType })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="flat">Flat Fee</option>
                      <option value="per_mile">Per Mile</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Accessory Fees */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Accessory Fees</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Detention</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={fees.detention}
                      onChange={(e) => setFees({ ...fees, detention: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lumper</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={fees.lumper}
                      onChange={(e) => setFees({ ...fees, lumper: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stop Off</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={fees.stopOff}
                      onChange={(e) => setFees({ ...fees, stopOff: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tarp Fee</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={fees.tarpFee}
                      onChange={(e) => setFees({ ...fees, tarpFee: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Advance</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    value={fees.invoiceAdvance}
                    onChange={(e) => setFees({ ...fees, invoiceAdvance: e.target.value })}
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Disclaimer */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Legal Disclaimer</h3>
          <textarea
            value={legalDisclaimer}
            onChange={(e) => setLegalDisclaimer(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Enter any legal disclaimer text..."
          />
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 text-red-600 hover:text-red-800 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Save
          </button>
        </div>
      </form>
    </>
  );
};

// ============================================================================
// View Planned Load Component
// ============================================================================

interface ViewPlannedLoadProps {
  load: PlannedLoad;
  onEdit: () => void;
  onBack: () => void;
  onAddTrip: () => void;
  onBrokerTrip: () => void;
  onDispatch: (driverId: string) => void;
}

const ViewPlannedLoad: React.FC<ViewPlannedLoadProps> = ({ load, onEdit, onBack, onAddTrip, onBrokerTrip, onDispatch }) => {
  const { drivers, trucks } = useTMS();
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedTruckId, setSelectedTruckId] = useState('');

  const totalAccessoryFees =
    (load.fees?.accessoryFees?.detention || 0) +
    (load.fees?.accessoryFees?.lumper || 0) +
    (load.fees?.accessoryFees?.stopOff || 0) +
    (load.fees?.accessoryFees?.tarpFee || 0);

  const handleDispatchClick = () => {
    if (!selectedDriverId) {
      alert('Please select a driver');
      return;
    }
    onDispatch(selectedDriverId);
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
          <ChevronRight className="rotate-180" size={20} />
          Back to Planned Loads
        </button>
        <div className="flex flex-wrap gap-2">
          <button onClick={onEdit} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2">
            <Edit size={16} />
            Edit Planned Load
          </button>
          <button onClick={onAddTrip} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Plus size={16} />
            Add Trip
          </button>
          <button onClick={onBrokerTrip} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
            <Plus size={16} />
            Broker Trip
          </button>
          <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2">
            <Copy size={16} />
            Copy
          </button>
          <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2">
            <Paperclip size={16} />
            Attach Rate Con
          </button>
          <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2">
            <FileText size={16} />
            Attach BOL
          </button>
          <button className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2">
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>

      {/* Progress Tracker */}
      <ProgressTracker currentStep={load.currentStep} status={load.status} />

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Dispatch & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dispatch Section */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Dispatch</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Driver *</label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Driver</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.firstName} {driver.lastName} {driver.type === 'OwnerOperator' ? '(O/O)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Truck (Optional)</label>
                <select
                  value={selectedTruckId}
                  onChange={(e) => setSelectedTruckId(e.target.value)}
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
              <button
                onClick={handleDispatchClick}
                disabled={!selectedDriverId || load.status !== 'planned'}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {load.status === 'planned' ? 'Dispatch this load to a trip' : `Already ${load.status.replace('_', ' ')}`}
              </button>
            </div>
          </div>

          {/* Details Section */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Details</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-slate-600">Custom Load Number:</dt>
                <dd className="font-medium text-slate-900">{load.customLoadNumber || load.systemLoadNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Customer:</dt>
                <dd className="font-medium text-slate-900">{load.customer?.name || 'N/A'}</dd>
              </div>
              {load.customer && (
                <div className="pl-4 text-sm text-slate-600">
                  <p>{load.customer.address}</p>
                  <p>{load.customer.city}, {load.customer.state} {load.customer.zipCode}</p>
                  {load.customer.phone && <p className="flex items-center gap-1 mt-1">📞 {load.customer.phone}</p>}
                  {load.customer.email && <p className="flex items-center gap-1">✉️ {load.customer.email}</p>}
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-600">BOL:</dt>
                <dd className="font-medium text-slate-900">{load.pickups[0]?.bolNumber || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Pickup Date:</dt>
                <dd className="font-medium text-slate-900">{load.pickups[0]?.pickupDate || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Delivery Date:</dt>
                <dd className="font-medium text-slate-900">{load.deliveries[0]?.deliveryDate || '-'}</dd>
              </div>
            </dl>
          </div>

          {/* Route Section */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Route</h3>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">No</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">Entered Address</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">Arrive at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {load.pickups.map((pickup, idx) => (
                  <tr key={`p-${idx}`}>
                    <td className="px-4 py-3 text-sm">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{pickup.shipper.name}</div>
                      <div className="text-sm text-slate-600">{pickup.shipper.address}</div>
                      <div className="text-sm text-slate-600">{pickup.shipper.city}, {pickup.shipper.state}</div>
                      {pickup.puNumber && <div className="text-xs text-slate-500 mt-1">PU Number: {pickup.puNumber}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">{pickup.pickupDate}</td>
                  </tr>
                ))}
                {load.deliveries.map((delivery, idx) => (
                  <tr key={`d-${idx}`}>
                    <td className="px-4 py-3 text-sm">{load.pickups.length + idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{delivery.consignee.name}</div>
                      <div className="text-sm text-slate-600">{delivery.consignee.address}</div>
                      <div className="text-sm text-slate-600">{delivery.consignee.city}, {delivery.consignee.state}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{delivery.deliveryDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column - Fees */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Fees</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-slate-600">Primary Fee</dt>
                <dd className="text-lg font-semibold text-slate-900">
                  {load.fees?.primaryFeeType === 'flat' ? 'Flat Fee' : load.fees?.primaryFeeType} - ${load.fees?.primaryFee?.toLocaleString() || '0.00'}
                </dd>
              </div>
              <div className="border-t pt-3">
                <dt className="text-sm text-slate-600">Fuel Surcharge Fee</dt>
                <dd className="text-lg font-semibold text-slate-900">
                  {load.fees?.fscType === 'flat' ? 'Flat Fee' : load.fees?.fscType} - ${load.fees?.fscAmount?.toLocaleString() || '0.00'}
                </dd>
              </div>
              <div className="border-t pt-3">
                <dt className="text-sm text-slate-600">Total Charge</dt>
                <dd className="text-slate-500 italic">
                  Calculated when trip is created
                </dd>
              </div>
              <div className="border-t pt-3">
                <dt className="text-sm text-slate-600">Invoice Advance</dt>
                <dd className="text-lg font-semibold text-slate-900">${load.fees?.invoiceAdvance?.toLocaleString() || '0.00'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Load Planner Component
// ============================================================================

type ViewMode = 'list' | 'add' | 'edit' | 'view' | 'addTrip';

interface LoadPlannerProps {
  onNavigate?: (page: string) => void;
}

const LoadPlanner: React.FC<LoadPlannerProps> = ({ onNavigate }) => {
  // Use TMSContext for data persistence
  const {
    plannedLoads,
    addPlannedLoad,
    updatePlannedLoad,
    deletePlannedLoad,
    drivers,
    trucks,
    dispatchPlannedLoadsToTrip,
    setPendingDispatchLoadIds
  } = useTMS();

  // Navigate to Trips page with pre-selected load
  const navigateToTripsWithLoad = (loadIds: string[]) => {
    setPendingDispatchLoadIds(loadIds);
    if (onNavigate) {
      onNavigate('Trips');
    }
  };

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLoad, setSelectedLoad] = useState<PlannedLoad | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');

  // TruckingOffice: Load Planner is a STAGING area - only show 'planned' status loads
  // Dispatched loads move to Trips/Loads pages
  const filteredLoads = useMemo(() => {
    return plannedLoads.filter(load => {
      // Only show loads in 'planned' status (Step 1 of the workflow)
      if (load.status !== 'planned') return false;

      // Apply search filter
      const searchLower = searchTerm.toLowerCase();
      if (!searchTerm) return true;

      return (
        load.customLoadNumber?.toLowerCase().includes(searchLower) ||
        load.systemLoadNumber.toLowerCase().includes(searchLower) ||
        load.customer?.name?.toLowerCase().includes(searchLower) ||
        load.pickups[0]?.shipper?.city?.toLowerCase().includes(searchLower) ||
        load.deliveries[0]?.consignee?.city?.toLowerCase().includes(searchLower)
      );
    });
  }, [plannedLoads, searchTerm]);

  const handleSaveLoad = useCallback((loadData: Partial<PlannedLoad>) => {
    if (viewMode === 'edit' && selectedLoad) {
      // Update existing planned load
      updatePlannedLoad(selectedLoad.id, loadData);
    } else {
      // Create new planned load
      const newLoadInput: NewPlannedLoadInput = {
        customLoadNumber: loadData.customLoadNumber,
        customerId: loadData.customerId,
        customer: loadData.customer,
        pickups: loadData.pickups || [],
        deliveries: loadData.deliveries || [],
        fees: loadData.fees || {
          primaryFee: 0,
          primaryFeeType: 'flat',
          fscAmount: 0,
          fscType: 'flat',
          accessoryFees: { detention: 0, lumper: 0, stopOff: 0, tarpFee: 0, additional: [] },
          invoiceAdvance: 0,
        },
        legalDisclaimer: loadData.legalDisclaimer,
      };
      addPlannedLoad(newLoadInput);
    }
    setViewMode('list');
    setSelectedLoad(null);
  }, [viewMode, selectedLoad, addPlannedLoad, updatePlannedLoad]);

  const handleDeleteLoad = useCallback((id: string) => {
    if (confirm('Are you sure you want to delete this planned load?')) {
      deletePlannedLoad(id);
    }
  }, [deletePlannedLoad]);

  const handleCopyLoad = useCallback((load: PlannedLoad) => {
    const copiedLoadInput: NewPlannedLoadInput = {
      customLoadNumber: load.customLoadNumber ? `${load.customLoadNumber}-COPY` : undefined,
      customerId: load.customerId,
      customer: load.customer,
      pickups: load.pickups,
      deliveries: load.deliveries,
      fees: load.fees,
      legalDisclaimer: load.legalDisclaimer,
    };
    addPlannedLoad(copiedLoadInput);
  }, [addPlannedLoad]);

  // Handle dispatching planned load to trip (from addTrip view)
  const handleDispatchToTrip = useCallback(async () => {
    if (!selectedLoad) return;

    const driver = drivers.find(d => d.id === selectedDriverId);
    const truck = trucks.find(t => t.id === selectedTruckId);

    if (!driver) {
      alert('Please select a driver');
      return;
    }

    try {
      await dispatchPlannedLoadsToTrip(
        [selectedLoad.id],
        {
          type: 'company',
          driverId: driver.id,
          driverName: `${driver.firstName} ${driver.lastName}`,
          truckId: truck?.id,
          truckNumber: truck?.truckNumber,
          plannedLoadIds: [selectedLoad.id],
          pickupDate: selectedLoad.pickups[0]?.pickupDate || '',
          deliveryDate: selectedLoad.deliveries[0]?.deliveryDate || '',
          fromCity: selectedLoad.pickups[0]?.shipper?.city || '',
          fromState: selectedLoad.pickups[0]?.shipper?.state || '',
          toCity: selectedLoad.deliveries[0]?.consignee?.city || '',
          toState: selectedLoad.deliveries[0]?.consignee?.state || '',
          totalMiles: 0, // Can be calculated later
          revenue: selectedLoad.fees?.primaryFee || 0,
          status: 'today',
        }
      );
      setViewMode('list');
      setSelectedLoad(null);
      setSelectedDriverId('');
      setSelectedTruckId('');
      alert('Load dispatched to trip successfully!');
    } catch (error) {
      console.error('Error dispatching load:', error);
      alert('Failed to dispatch load. Please try again.');
    }
  }, [selectedLoad, selectedDriverId, selectedTruckId, drivers, trucks, dispatchPlannedLoadsToTrip]);

  // Handle dispatching from ViewPlannedLoad component (accepts driverId from its internal state)
  const handleDispatchFromView = useCallback(async (driverId: string) => {
    if (!selectedLoad) return;

    const driver = drivers.find(d => d.id === driverId);

    if (!driver) {
      alert('Driver not found');
      return;
    }

    try {
      await dispatchPlannedLoadsToTrip(
        [selectedLoad.id],
        {
          type: driver.type === 'OwnerOperator' ? 'owner_operator' : 'company',
          driverId: driver.id,
          driverName: `${driver.firstName} ${driver.lastName}`,
          truckId: driver.truckId,
          truckNumber: trucks.find(t => t.id === driver.truckId)?.truckNumber,
          plannedLoadIds: [selectedLoad.id],
          pickupDate: selectedLoad.pickups[0]?.pickupDate || '',
          deliveryDate: selectedLoad.deliveries[0]?.deliveryDate || '',
          fromCity: selectedLoad.pickups[0]?.shipper?.city || '',
          fromState: selectedLoad.pickups[0]?.shipper?.state || '',
          toCity: selectedLoad.deliveries[0]?.consignee?.city || '',
          toState: selectedLoad.deliveries[0]?.consignee?.state || '',
          totalMiles: 0, // Can be calculated later
          revenue: selectedLoad.fees?.primaryFee || 0,
          status: 'today',
        }
      );
      setViewMode('list');
      setSelectedLoad(null);
      alert('Load dispatched to trip successfully! A new Trip and Load entry have been created.');
    } catch (error) {
      console.error('Error dispatching load:', error);
      alert('Failed to dispatch load. Please try again.');
    }
  }, [selectedLoad, drivers, trucks, dispatchPlannedLoadsToTrip]);

  // Render based on view mode
  if (viewMode === 'add') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('list')} className="text-slate-600 hover:text-slate-900">
            <ChevronRight className="rotate-180" size={20} />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Add Planned Load</h1>
        </div>
        <PlannedLoadForm onSave={handleSaveLoad} onCancel={() => setViewMode('list')} />
      </div>
    );
  }

  if (viewMode === 'edit' && selectedLoad) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <button onClick={() => { setViewMode('list'); setSelectedLoad(null); }} className="text-slate-600 hover:text-slate-900">
            <ChevronRight className="rotate-180" size={20} />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Editing Planned Load</h1>
        </div>
        <PlannedLoadForm load={selectedLoad} onSave={handleSaveLoad} onCancel={() => { setViewMode('list'); setSelectedLoad(null); }} />
      </div>
    );
  }

  if (viewMode === 'view' && selectedLoad) {
    return (
      <ViewPlannedLoad
        load={selectedLoad}
        onEdit={() => setViewMode('edit')}
        onBack={() => { setViewMode('list'); setSelectedLoad(null); }}
        onAddTrip={() => navigateToTripsWithLoad([selectedLoad.id])}
        onBrokerTrip={() => alert('Broker Trip functionality coming soon')}
        onDispatch={handleDispatchFromView}
      />
    );
  }

  // Add Trip View - Select driver and dispatch
  if (viewMode === 'addTrip' && selectedLoad) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('view')} className="text-slate-600 hover:text-slate-900">
            <ChevronRight className="rotate-180" size={20} />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Dispatch to Trip</h1>
        </div>

        {/* Progress Tracker */}
        <ProgressTracker currentStep={selectedLoad.currentStep} status={selectedLoad.status} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Load Details Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Load Details</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-slate-600">Load Number:</dt>
                <dd className="font-medium text-slate-900">{selectedLoad.customLoadNumber || selectedLoad.systemLoadNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Customer:</dt>
                <dd className="font-medium text-slate-900">{selectedLoad.customer?.name || 'N/A'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Pickup:</dt>
                <dd className="font-medium text-slate-900">
                  {selectedLoad.pickups[0]?.shipper?.city}, {selectedLoad.pickups[0]?.shipper?.state} - {selectedLoad.pickups[0]?.pickupDate}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Delivery:</dt>
                <dd className="font-medium text-slate-900">
                  {selectedLoad.deliveries[0]?.consignee?.city}, {selectedLoad.deliveries[0]?.consignee?.state} - {selectedLoad.deliveries[0]?.deliveryDate}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Rate:</dt>
                <dd className="font-medium text-green-600">${selectedLoad.fees?.primaryFee?.toLocaleString() || '0'}</dd>
              </div>
            </dl>
          </div>

          {/* Dispatch Form */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Dispatch Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Driver <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
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
                  value={selectedTruckId}
                  onChange={(e) => setSelectedTruckId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Truck (Optional)</option>
                  {trucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.truckNumber} - {truck.make} {truck.model}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-200 flex gap-4">
                <button
                  onClick={() => {
                    setViewMode('view');
                    setSelectedDriverId('');
                    setSelectedTruckId('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDispatchToTrip}
                  disabled={!selectedDriverId}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Dispatch to Trip
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Load Planner</h1>
          <p className="text-slate-600 mt-1">Plan and manage loads before dispatch</p>
        </div>
        <button
          onClick={() => setViewMode('add')}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <Plus size={18} />
          Add Planned Load
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by load number, customer, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Search
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Custom Load Number</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Pickup</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Delivery</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">From</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">To</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">BOL</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLoads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <ClipboardList className="w-12 h-12 text-slate-300 mb-4" />
                      <p className="text-slate-600 font-medium">No planned loads found</p>
                      <p className="text-slate-500 text-sm mt-1">Create your first planned load to get started</p>
                      <button
                        onClick={() => setViewMode('add')}
                        className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                      >
                        <Plus size={18} />
                        Add Planned Load
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLoads.map((load) => (
                  <tr key={load.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {load.customLoadNumber || load.systemLoadNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{load.pickups[0]?.pickupDate || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{load.deliveries[0]?.deliveryDate || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{load.customer?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {load.pickups[0]?.shipper?.city}, {load.pickups[0]?.shipper?.state}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {load.deliveries[0]?.consignee?.city}, {load.deliveries[0]?.consignee?.state}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{load.pickups[0]?.bolNumber || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setSelectedLoad(load); setViewMode('view'); }}
                          className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                        >
                          View
                        </button>
                        <button
                          onClick={() => { setSelectedLoad(load); setViewMode('edit'); }}
                          className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleCopyLoad(load)}
                          className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => navigateToTripsWithLoad([load.id])}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          + Add Trip
                        </button>
                        <button className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200">
                          + Broker Trip
                        </button>
                        <button
                          onClick={() => handleDeleteLoad(load.id)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
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
    </div>
  );
};

export default LoadPlanner;

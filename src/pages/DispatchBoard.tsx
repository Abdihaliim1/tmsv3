/**
 * Dispatch Board - Professional TMS Core Feature
 * 
 * Features:
 * - Column status board (Kanban-style)
 * - Quick actions per card (Assign/Update status/Upload POD/Create invoice)
 * - Lifecycle checklist on each card
 * - Missing documents alerts
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Truck,
  User,
  MapPin,
  DollarSign,
  Calendar,
  MoreVertical,
  FileCheck
} from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { useTenant } from '../context/TenantContext';
import { useToast } from '../components/Toast';
import { Load, LoadStatus, DocumentType } from '../types';
import { getMissingDocuments } from '../services/documentService';
import { TmsDocument } from '../types';
import { generateUniqueInvoiceNumber } from '../services/invoiceService';
import AddLoadModal from '../components/AddLoadModal';
import DocumentUploadModal from '../components/DocumentUploadModal';
import DriverAssignmentModal from '../components/DriverAssignmentModal';

interface LoadCardProps {
  load: Load;
  onEdit: (load: Load) => void;
  onStatusChange: (loadId: string, newStatus: LoadStatus) => void;
  onUploadPOD: (loadId: string) => void;
  onCreateInvoice: (loadId: string) => void;
  onAssignDriver: (loadId: string) => void;
}

const LoadCard: React.FC<LoadCardProps> = ({
  load,
  onEdit,
  onStatusChange,
  onUploadPOD,
  onCreateInvoice,
  onAssignDriver,
}) => {
  const [showChecklist, setShowChecklist] = useState(false);
  
  const missingDocs = getMissingDocuments('load', load.documents || []);
  const hasMissingDocs = missingDocs.length > 0;
  
  // Lifecycle checklist items
  const checklistItems = [
    {
      id: 'assigned',
      label: 'Driver Assigned',
      completed: !!load.driverId,
      required: true,
    },
    {
      id: 'dispatched',
      label: 'Dispatched',
      completed: [LoadStatus.Dispatched, LoadStatus.InTransit, LoadStatus.Delivered, LoadStatus.Completed].includes(load.status),
      required: true,
    },
    {
      id: 'rate_con',
      label: 'Rate Confirmation',
      completed: (load.documents || []).some(d => d.type === 'RATE_CON'),
      required: true,
    },
    {
      id: 'bol',
      label: 'Bill of Lading',
      completed: (load.documents || []).some(d => d.type === 'BOL'),
      required: true,
    },
    {
      id: 'in_transit',
      label: 'In Transit',
      completed: [LoadStatus.InTransit, LoadStatus.Delivered, LoadStatus.Completed].includes(load.status),
      required: true,
    },
    {
      id: 'pod',
      label: 'Proof of Delivery',
      completed: (load.documents || []).some(d => d.type === 'POD'),
      required: load.status === LoadStatus.Delivered || load.status === LoadStatus.Completed,
    },
    {
      id: 'delivered',
      label: 'Delivered',
      completed: [LoadStatus.Delivered, LoadStatus.Completed].includes(load.status),
      required: true,
    },
    {
      id: 'invoiced',
      label: 'Invoiced',
      completed: !!load.invoiceId,
      required: load.status === LoadStatus.Delivered || load.status === LoadStatus.Completed,
    },
  ];

  const completedCount = checklistItems.filter(item => item.completed).length;
  const requiredCount = checklistItems.filter(item => item.required).length;
  const progress = requiredCount > 0 ? (completedCount / requiredCount) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-slate-900">{load.loadNumber}</span>
            {hasMissingDocs && (
              <span title="Missing documents">
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {load.brokerName || 'No Broker'}
          </div>
        </div>
        <button
          onClick={() => onEdit(load)}
          className="p-1 text-slate-400 hover:text-slate-600"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Route */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <MapPin className="w-4 h-4 text-slate-400" />
        <span className="text-slate-700">
          {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
        </span>
      </div>

      {/* Driver */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <User className="w-4 h-4 text-slate-400" />
        <span className="text-slate-700">
          {load.driverName || (
            <button
              onClick={() => onAssignDriver(load.id)}
              className="text-blue-600 hover:text-blue-700 underline"
            >
              Assign Driver
            </button>
          )}
        </span>
      </div>

      {/* Financial Info */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
        <div className="flex items-center gap-1">
          <DollarSign className="w-4 h-4 text-slate-400" />
          <span className="text-slate-700">${load.rate?.toLocaleString() || 0}</span>
        </div>
        <div className="flex items-center gap-1">
          <Truck className="w-4 h-4 text-slate-400" />
          <span className="text-slate-700">{load.miles || 0} mi</span>
        </div>
      </div>

      {/* Dates */}
      <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
        <Calendar className="w-3 h-3" />
        <span>Pickup: {load.pickupDate ? new Date(load.pickupDate).toLocaleDateString() : 'N/A'}</span>
        {load.deliveryDate && (
          <>
            <span>•</span>
            <span>Delivery: {new Date(load.deliveryDate).toLocaleDateString()}</span>
          </>
        )}
      </div>

      {/* Checklist Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => setShowChecklist(!showChecklist)}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            <FileCheck className="w-3 h-3" />
            Checklist ({completedCount}/{requiredCount})
          </button>
          <span className="text-xs text-slate-500">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-1.5">
          <div
            className="bg-blue-600 h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Checklist Details */}
      {showChecklist && (
        <div className="mb-3 p-2 bg-slate-50 rounded text-xs">
          {checklistItems.map(item => (
            <div key={item.id} className="flex items-center gap-2 py-1">
              {item.completed ? (
                <CheckCircle2 className="w-3 h-3 text-green-600" />
              ) : (
                <XCircle className="w-3 h-3 text-slate-300" />
              )}
              <span className={item.completed ? 'text-slate-700' : 'text-slate-400'}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Missing Documents Alert with Quick Upload */}
      {hasMissingDocs && (
        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
          <div className="font-medium text-amber-800 mb-2">Missing Documents:</div>
          <div className="space-y-1">
            {missingDocs.map(docType => (
              <div key={docType} className="flex items-center justify-between">
                <span className="text-amber-700">{docType.replace('_', ' ')}</span>
                <button
                  onClick={() => {
                    // Trigger document upload modal for this doc type
                    const event = new CustomEvent('upload-document', {
                      detail: { loadId: load.id, documentType: docType }
                    });
                    window.dispatchEvent(event);
                  }}
                  className="text-amber-800 hover:text-amber-900 font-medium underline text-xs"
                >
                  Upload
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
        {!load.driverId && (
          <button
            onClick={() => onAssignDriver(load.id)}
            className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 flex items-center gap-1"
          >
            <User className="w-3 h-3" />
            Assign
          </button>
        )}
        {load.status !== LoadStatus.Delivered && load.status !== LoadStatus.Completed && (
          <button
            onClick={() => {
              const nextStatus = load.status === LoadStatus.Available 
                ? LoadStatus.Dispatched 
                : load.status === LoadStatus.Dispatched
                ? LoadStatus.InTransit
                : LoadStatus.Delivered;
              onStatusChange(load.id, nextStatus);
            }}
            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 flex items-center gap-1"
          >
            <CheckCircle2 className="w-3 h-3" />
            Update Status
          </button>
        )}
        {!load.documents?.some(d => d.type === 'POD') && (
          <button
            onClick={() => {
              const event = new CustomEvent('upload-document', {
                detail: { loadId: load.id, documentType: 'POD' }
              });
              window.dispatchEvent(event);
              onUploadPOD(load.id);
            }}
            className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100 flex items-center gap-1"
          >
            <Upload className="w-3 h-3" />
            Upload POD
          </button>
        )}
        {!load.documents?.some(d => d.type === 'BOL') && (
          <button
            onClick={() => {
              const event = new CustomEvent('upload-document', {
                detail: { loadId: load.id, documentType: 'BOL' }
              });
              window.dispatchEvent(event);
            }}
            className="px-2 py-1 text-xs bg-orange-50 text-orange-700 rounded hover:bg-orange-100 flex items-center gap-1"
          >
            <Upload className="w-3 h-3" />
            Upload BOL
          </button>
        )}
        {!load.documents?.some(d => d.type === 'RATE_CON') && (
          <button
            onClick={() => {
              const event = new CustomEvent('upload-document', {
                detail: { loadId: load.id, documentType: 'RATE_CON' }
              });
              window.dispatchEvent(event);
            }}
            className="px-2 py-1 text-xs bg-teal-50 text-teal-700 rounded hover:bg-teal-100 flex items-center gap-1"
          >
            <Upload className="w-3 h-3" />
            Upload Rate Con
          </button>
        )}
        {!load.invoiceId && (load.status === LoadStatus.Delivered || load.status === LoadStatus.Completed) && (
          <button
            onClick={() => onCreateInvoice(load.id)}
            className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 flex items-center gap-1"
          >
            <FileText className="w-3 h-3" />
            Create Invoice
          </button>
        )}
      </div>
    </div>
  );
};

const DispatchBoard: React.FC = () => {
  const { loads, drivers, updateLoad, addInvoice } = useTMS();
  const { activeTenantId } = useTenant();
  const toast = useToast();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoad, setEditingLoad] = useState<Load | null>(null);
  const [isDocUploadModalOpen, setIsDocUploadModalOpen] = useState(false);
  const [docUploadLoadId, setDocUploadLoadId] = useState<string | null>(null);
  const [docUploadType, setDocUploadType] = useState<DocumentType>('POD');
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [driverAssignLoad, setDriverAssignLoad] = useState<Load | null>(null);

  // Listen for document upload events from LoadCard
  useEffect(() => {
    const handleUploadEvent = (event: CustomEvent<{ loadId: string; documentType: DocumentType }>) => {
      setDocUploadLoadId(event.detail.loadId);
      setDocUploadType(event.detail.documentType);
      setIsDocUploadModalOpen(true);
    };

    window.addEventListener('upload-document', handleUploadEvent as EventListener);
    return () => {
      window.removeEventListener('upload-document', handleUploadEvent as EventListener);
    };
  }, []);

  // Get load for document upload
  const docUploadLoad = useMemo(() => {
    return loads.find(l => l.id === docUploadLoadId);
  }, [loads, docUploadLoadId]);

  // Group loads by status
  const loadsByStatus = useMemo(() => {
    const groups: Record<LoadStatus, Load[]> = {
      [LoadStatus.Available]: [],
      [LoadStatus.Dispatched]: [],
      [LoadStatus.InTransit]: [],
      [LoadStatus.Delivered]: [],
      [LoadStatus.Completed]: [],
      [LoadStatus.Cancelled]: [],
      [LoadStatus.TONU]: [],
    };

    loads.forEach(load => {
      if (groups[load.status]) {
        groups[load.status].push(load);
      }
    });

    return groups;
  }, [loads]);

  const statusColumns = [
    { status: LoadStatus.Available, label: 'Available', color: 'bg-slate-100' },
    { status: LoadStatus.Dispatched, label: 'Dispatched', color: 'bg-blue-100' },
    { status: LoadStatus.InTransit, label: 'In Transit', color: 'bg-yellow-100' },
    { status: LoadStatus.Delivered, label: 'Delivered', color: 'bg-green-100' },
    { status: LoadStatus.Completed, label: 'Completed', color: 'bg-purple-100' },
  ];

  const handleStatusChange = async (loadId: string, newStatus: LoadStatus) => {
    try {
      await updateLoad(loadId, { status: newStatus });
      toast.success('Status Updated', `Load status changed to ${newStatus}`);
    } catch (error: any) {
      toast.error('Update Failed', error.message || 'Cannot update load status.');
      console.error('Load status update error:', error);
    }
  };

  const handleUploadPOD = (loadId: string) => {
    setDocUploadLoadId(loadId);
    setDocUploadType('POD');
    setIsDocUploadModalOpen(true);
  };

  const handleCreateInvoice = async (loadId: string) => {
    const load = loads.find(l => l.id === loadId);
    if (!load) {
      toast.error('Error', 'Load not found');
      return;
    }

    if (load.invoiceId) {
      toast.warning('Already Invoiced', 'This load already has an invoice');
      return;
    }

    try {
      // Generate invoice number
      const invoiceNumber = await generateUniqueInvoiceNumber(activeTenantId || 'default');

      // Create invoice - TMSContext automatically links the invoice to the load
      addInvoice({
        invoiceNumber,
        loadIds: [loadId],
        customerId: load.brokerId || '',
        customerName: load.brokerName || load.customerName || 'Unknown',
        amount: load.rate || 0,
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
      });

      toast.success('Invoice Created', `Invoice ${invoiceNumber} created successfully`);
    } catch (error: any) {
      toast.error('Invoice Failed', error.message || 'Failed to create invoice');
      console.error('Create invoice error:', error);
    }
  };

  const handleAssignDriver = (loadId: string) => {
    const load = loads.find(l => l.id === loadId);
    if (load) {
      setDriverAssignLoad(load);
      setIsDriverModalOpen(true);
    }
  };

  const handleDocumentUploadComplete = (document: TmsDocument) => {
    toast.success('Document Uploaded', `${document.type.replace('_', ' ')} uploaded successfully`);
    setIsDocUploadModalOpen(false);
    setDocUploadLoadId(null);
  };

  const handleDriverAssigned = (driverId: string, driverName: string) => {
    toast.success('Driver Assigned', `${driverName} assigned to load`);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dispatch Board</h1>
          <p className="text-slate-500 mt-1">Manage loads across their lifecycle</p>
        </div>
        <button
          onClick={() => {
            setEditingLoad(null);
            setIsModalOpen(true);
          }}
          className="btn-primary px-4 py-2 rounded-lg font-medium flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Load
        </button>
      </div>

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {statusColumns.map(column => (
          <div
            key={column.status}
            className="flex-shrink-0 w-80"
          >
            {/* Column Header */}
            <div className={`${column.color} rounded-t-lg p-3 mb-2`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">{column.label}</h3>
                <span className="text-sm text-slate-600 bg-white px-2 py-1 rounded">
                  {loadsByStatus[column.status]?.length || 0}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="space-y-3">
              {loadsByStatus[column.status]?.map(load => (
                <LoadCard
                  key={load.id}
                  load={load}
                  onEdit={(load) => {
                    setEditingLoad(load);
                    setIsModalOpen(true);
                  }}
                  onStatusChange={handleStatusChange}
                  onUploadPOD={handleUploadPOD}
                  onCreateInvoice={handleCreateInvoice}
                  onAssignDriver={handleAssignDriver}
                />
              ))}
              {(!loadsByStatus[column.status] || loadsByStatus[column.status].length === 0) && (
                <div className="text-center text-slate-400 py-8 text-sm">
                  No loads in this status
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Load Modal */}
      {isModalOpen && (
        <AddLoadModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingLoad(null);
          }}
          editingLoad={editingLoad}
          onSubmit={async (loadData) => {
            if (editingLoad) {
              try {
                // Extract adjustment reason if provided (from adjustment workflow)
                const adjustmentReason = (loadData as any).adjustmentReason;
                const cleanLoadData = { ...loadData };
                delete (cleanLoadData as any).adjustmentReason;

                await updateLoad(editingLoad.id, cleanLoadData, adjustmentReason);
                toast.success('Load Updated', 'Load details saved successfully');
              } catch (error: any) {
                toast.error('Update Failed', error.message || 'Failed to update load.');
                console.error('Load update error:', error);
              }
            }
            setIsModalOpen(false);
            setEditingLoad(null);
          }}
        />
      )}

      {/* Document Upload Modal */}
      {isDocUploadModalOpen && docUploadLoad && (
        <DocumentUploadModal
          isOpen={isDocUploadModalOpen}
          onClose={() => {
            setIsDocUploadModalOpen(false);
            setDocUploadLoadId(null);
          }}
          entityType="load"
          entityId={docUploadLoad.id}
          documentType={docUploadType}
          existingDocuments={docUploadLoad.documents}
          onUploadComplete={handleDocumentUploadComplete}
        />
      )}

      {/* Driver Assignment Modal */}
      {isDriverModalOpen && driverAssignLoad && (
        <DriverAssignmentModal
          isOpen={isDriverModalOpen}
          onClose={() => {
            setIsDriverModalOpen(false);
            setDriverAssignLoad(null);
          }}
          load={driverAssignLoad}
          onAssign={handleDriverAssigned}
        />
      )}
    </div>
  );
};

export default DispatchBoard;


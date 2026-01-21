/**
 * Document Upload Modal
 *
 * Modal wrapper for document upload with support for different document types.
 */

import React from 'react';
import { X } from 'lucide-react';
import DocumentUpload from './DocumentUpload';
import { DocumentType, TmsDocument } from '../types';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'load' | 'invoice' | 'settlement' | 'truck';
  entityId: string;
  documentType: DocumentType;
  existingDocuments?: TmsDocument[];
  onUploadComplete?: (document: TmsDocument) => void;
  title?: string;
}

const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  documentType,
  existingDocuments = [],
  onUploadComplete,
  title,
}) => {
  if (!isOpen) return null;

  const getDocumentTypeLabel = (type: DocumentType): string => {
    const labels: Partial<Record<DocumentType, string>> = {
      RATE_CON: 'Rate Confirmation',
      ratecon: 'Rate Confirmation',
      BOL: 'Bill of Lading',
      bol: 'Bill of Lading',
      POD: 'Proof of Delivery',
      pod: 'Proof of Delivery',
      INVOICE: 'Invoice',
      invoice: 'Invoice',
      RECEIPT: 'Receipt',
      INSURANCE: 'Insurance Certificate',
      PERMIT: 'Permit',
      LUMPER: 'Lumper Receipt',
      lumper: 'Lumper Receipt',
      SCALE: 'Scale Ticket',
      scale: 'Scale Ticket',
      OTHER: 'Other Document',
      other: 'Other Document',
    };
    return labels[type] || type.replace('_', ' ');
  };

  const handleUploadComplete = (document: TmsDocument) => {
    if (onUploadComplete) {
      onUploadComplete(document);
    }
    // Close modal after successful upload
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {title || `Upload ${getDocumentTypeLabel(documentType)}`}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-130px)]">
          <DocumentUpload
            entityType={entityType}
            entityId={entityId}
            documentType={documentType}
            existingDocuments={existingDocuments}
            onUploadComplete={handleUploadComplete}
            showExpirationDate={documentType === 'INSURANCE' || documentType === 'PERMIT'}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentUploadModal;

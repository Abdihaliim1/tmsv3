/**
 * Document Upload Component
 * 
 * Features:
 * - Drag-and-drop file upload
 * - File type validation
 * - File size limits
 * - Upload progress indicator
 * - Display existing documents with versions
 * - Verify/unverify buttons
 * - Delete document button
 * - Expiration date picker (for insurance/permits)
 */

import React, { useState, useRef } from 'react';
import { 
  Upload, 
  X, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  AlertCircle,
  Calendar,
  Loader2
} from 'lucide-react';
import { DocumentType, TmsDocument } from '../types';
import { uploadEntityDocument, verifyDocument, deleteDocument } from '../services/documentService';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

interface DocumentUploadProps {
  entityType: "load" | "invoice" | "settlement" | "truck";
  entityId: string;
  documentType: DocumentType;
  onUploadComplete?: (document: TmsDocument) => void;
  existingDocuments?: TmsDocument[];
  showExpirationDate?: boolean; // For insurance/permits
  maxFileSize?: number; // In MB, default 10MB
  acceptedFileTypes?: string[]; // e.g., ['application/pdf', 'image/jpeg']
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  entityType,
  entityId,
  documentType,
  onUploadComplete,
  existingDocuments = [],
  showExpirationDate = false,
  maxFileSize = 10,
  acceptedFileTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
}) => {
  const { user } = useAuth();
  const { activeTenantId } = useTenant();
  const tenantId = activeTenantId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState<string>('');

  // Filter existing documents by type
  const existingDocsOfType = existingDocuments.filter(doc => doc.type === documentType);
  const latestDoc = existingDocsOfType.length > 0 
    ? existingDocsOfType.reduce((latest, current) => 
        (current.version || 0) > (latest.version || 0) ? current : latest
      )
    : null;

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!acceptedFileTypes.includes(file.type)) {
      return `File type not allowed. Accepted types: ${acceptedFileTypes.join(', ')}`;
    }

    // Check file size (convert MB to bytes)
    const maxSizeBytes = maxFileSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${maxFileSize}MB limit`;
    }

    return null;
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    await uploadFile(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadFile(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File) => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setIsUploading(false);
      return;
    }

    // Declare progressInterval outside try block so it can be cleared in catch
    let progressInterval: NodeJS.Timeout | null = null;
    
    try {
      // Simulate progress (Firebase doesn't provide progress callbacks in v9)
      progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            if (progressInterval) clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const document = await uploadEntityDocument({
        tenantId: tenantId || 'default',
        entityType,
        entityId,
        type: documentType,
        file,
        actorUid: user?.uid || 'anonymous',
        expiresAt: showExpirationDate && expirationDate ? expirationDate : undefined,
        tags: [],
      });

      if (progressInterval) clearInterval(progressInterval);
      setUploadProgress(100);

      // Reset form
      setExpirationDate('');
      
      // Callback
      if (onUploadComplete) {
        onUploadComplete(document);
      }

      // Small delay to show 100% before resetting
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    } catch (err: any) {
      // Clear progress interval if it still exists
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setUploadProgress(0);
      setIsUploading(false);
      
      // Provide more helpful error messages
      let errorMessage = 'Failed to upload document';
      const errorStr = err?.message || err?.toString() || '';
      const errorCode = err?.code || '';
      
      if (errorCode === 'storage/unauthorized') {
        errorMessage = 'You do not have permission to upload files. Please check Firebase Storage rules.';
      } else if (errorCode === 'storage/canceled') {
        errorMessage = 'Upload was canceled.';
      } else if (errorCode === 'storage/unknown' || errorCode === 'storage/object-not-found') {
        errorMessage = 'Firebase Storage bucket not found. Please check your storage bucket configuration in Firebase Console.';
      } else if (errorStr.includes('not found') || errorStr.includes('404')) {
        errorMessage = 'Firebase Storage is not configured correctly. The storage bucket may not exist. Please check your Firebase Console → Storage settings.';
      } else if (errorStr.includes('CORS') || errorStr.includes('access control')) {
        errorMessage = 'CORS error: Firebase Storage is not allowing uploads from this origin. Please check your storage bucket CORS settings.';
      } else if (errorStr.includes('network') || errorStr.includes('Failed to fetch')) {
        errorMessage = 'Network error: Could not connect to Firebase Storage. Please check your internet connection and Firebase configuration.';
      } else if (errorStr) {
        errorMessage = errorStr;
      }
      
      setError(errorMessage);
      console.error('Document upload error:', {
        error: err,
        message: err?.message,
        code: err?.code,
        stack: err?.stack,
      });
    }
  };

  const handleVerify = async (documentId: string) => {
    if (!user?.uid) return;

    try {
      await verifyDocument({
        tenantId: tenantId || 'default',
        entityType,
        entityId,
        documentId,
        actorUid: user.uid,
      });
      
      // Refresh would be handled by parent component
      if (onUploadComplete) {
        // Trigger refresh
        window.location.reload();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify document');
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!user?.uid) return;
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      await deleteDocument({
        tenantId: tenantId || 'default',
        entityType,
        entityId,
        documentId,
        actorUid: user.uid,
      });
      
      // Refresh would be handled by parent component
      if (onUploadComplete) {
        // Trigger refresh
        window.location.reload();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-slate-300 bg-slate-50 hover:border-slate-400'
          }
          ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        `}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFileTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="space-y-2">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-600">Uploading... {uploadProgress}%</p>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-medium text-slate-700">
              Drop file here or click to upload
            </p>
            <p className="text-xs text-slate-500">
              {acceptedFileTypes.map(t => t.split('/')[1]).join(', ').toUpperCase()} up to {maxFileSize}MB
            </p>
          </div>
        )}
      </div>

      {/* Expiration Date Picker (for insurance/permits) */}
      {showExpirationDate && !isUploading && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Expiration Date (Optional)
          </label>
          <input
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Existing Documents */}
      {existingDocsOfType.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">
            Existing {documentType.replace('_', ' ')} Documents
          </h4>
          <div className="space-y-2">
            {existingDocsOfType
              .sort((a, b) => (b.version || 0) - (a.version || 0))
              .map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {doc.fileName}
                        </span>
                        {doc.version && (
                          <span className="text-xs text-slate-500">v{doc.version}</span>
                        )}
                        {doc === latestDoc && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-slate-500">
                          {formatFileSize(doc.fileSize)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDate(doc.uploadedAt)}
                        </span>
                        {doc.expiresAt && (
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Expires: {formatDate(doc.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.verified ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs">Verified</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleVerify(doc.id)}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        title="Verify document"
                      >
                        <XCircle className="w-4 h-4" />
                        Verify
                      </button>
                    )}
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      View
                    </a>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-xs text-red-600 hover:text-red-700"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;


/**
 * Document Management Service
 * 
 * Handles document uploads, versioning, verification, and expiration tracking.
 * 
 * Features:
 * - Upload documents to Firebase Storage
 * - Version control (multiple uploads per doc type)
 * - Document verification
 * - Expiration tracking for insurance/permits
 * - Missing documents checklist
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { storage, db } from "../lib/firebase";
import { TmsDocument, DocumentType, Load } from "../types";
import { auditCreate } from "../data/audit";
// Tenant ID should be passed as parameter, not derived from subdomain

/**
 * Get storage key for localStorage (tenant-aware)
 */
function getStorageKey(tenantId: string | null, key: string): string {
  const prefix = tenantId ? `tms_${tenantId}_` : 'tms_';
  return `${prefix}${key}`;
}

/**
 * Get load from localStorage (fallback if not in Firestore)
 */
function getLoadFromLocalStorage(tenantId: string | null, loadId: string): Load | null {
  try {
    const storageKey = getStorageKey(tenantId, 'loads');
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const loads: Load[] = JSON.parse(stored);
      return loads.find(l => l.id === loadId) || null;
    }
  } catch (error) {
    console.error('Error reading load from localStorage:', error);
  }
  return null;
}

/**
 * Sync load from localStorage to Firestore
 */
async function syncLoadToFirestore(tenantId: string, load: Load): Promise<void> {
  const loadRef = doc(db, `tenants/${tenantId}/loads/${load.id}`);
  try {
    // Convert Load to Firestore-compatible format
    const firestoreData = {
      ...load,
      documents: load.documents || [],
      updatedAt: serverTimestamp(),
      updatedBy: load.changedBy || 'system',
    };
    await setDoc(loadRef, firestoreData, { merge: true });
  } catch (error) {
    console.error('Error syncing load to Firestore:', error);
    throw new Error('Failed to sync load to Firestore');
  }
}

/**
 * Upload a document for an entity (load, invoice, settlement, truck)
 * 
 * Automatically handles versioning - increments version for each upload of same type.
 * If entity is not in Firestore, checks localStorage and syncs it first.
 * 
 * @param params - Upload parameters
 * @returns Document metadata
 */
export async function uploadEntityDocument(params: {
  tenantId: string;
  entityType: "load" | "invoice" | "settlement" | "truck";
  entityId: string;
  type: DocumentType;
  file: File;
  actorUid: string;
  expiresAt?: string; // Optional expiration date for insurance/permits
  tags?: string[];
}): Promise<TmsDocument> {
  const entityRef = doc(db, `tenants/${params.tenantId}/${params.entityType}s/${params.entityId}`);
  let snap = await getDoc(entityRef);
  
  // If not in Firestore, check localStorage (for loads only)
  if (!snap.exists() && params.entityType === 'load') {
    const loadFromStorage = getLoadFromLocalStorage(params.tenantId, params.entityId);
    if (loadFromStorage) {
      // Sync load to Firestore first
      await syncLoadToFirestore(params.tenantId, loadFromStorage);
      // Re-fetch from Firestore
      snap = await getDoc(entityRef);
    }
  }
  
  if (!snap.exists()) {
    throw new Error(`${params.entityType} not found`);
  }

  // Get existing documents to determine next version
  const existing = (snap.data().documents || []) as TmsDocument[];
  const sameTypeDocs = existing.filter(d => d.type === params.type);
  const currentMaxVersion = Math.max(
    0,
    ...sameTypeDocs.map(d => d.version || 1)
  );
  const nextVersion = currentMaxVersion + 1;

  // Upload to Firebase Storage
  // Sanitize filename to remove special characters that might cause issues
  const sanitizedFileName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `tenants/${params.tenantId}/${params.entityType}s/${params.entityId}/${params.type}/v${nextVersion}_${Date.now()}_${sanitizedFileName}`;
  const storageRef = ref(storage, storagePath);

  try {
    // Upload file to Firebase Storage
    await uploadBytes(storageRef, params.file);
    // Get download URL
    const url = await getDownloadURL(storageRef);

    // Create document metadata
    const docMeta: TmsDocument = {
      id: crypto.randomUUID(),
      type: params.type,
      entityType: params.entityType,
      entityId: params.entityId,
      fileName: params.file.name,
      fileType: params.file.type,
      fileSize: params.file.size,
      storagePath,
      url,
      version: nextVersion,
      verified: false,
      uploadedBy: params.actorUid,
      uploadedAt: new Date().toISOString(),
      expiresAt: params.expiresAt,
      tags: params.tags || [],
    };

    // Update entity with new document in Firestore
    await updateDoc(entityRef, {
      documents: arrayUnion(docMeta),
      updatedAt: serverTimestamp(),
      updatedBy: params.actorUid,
    });

    // Also update localStorage if this is a load (to keep them in sync)
    if (params.entityType === 'load') {
      try {
        const storageKey = getStorageKey(params.tenantId, 'loads');
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const loads: Load[] = JSON.parse(stored);
          const loadIndex = loads.findIndex(l => l.id === params.entityId);
          if (loadIndex !== -1) {
            loads[loadIndex] = {
              ...loads[loadIndex],
              documents: [...(loads[loadIndex].documents || []), docMeta],
            };
            localStorage.setItem(storageKey, JSON.stringify(loads));
          }
        }
      } catch (error) {
        console.error('Error updating localStorage:', error);
        // Don't fail the upload if localStorage update fails
      }
    }

    // Audit log
    try {
      await auditCreate(
        params.tenantId,
        params.actorUid,
        'system', // Role will be fetched from context
        'document',
        docMeta.id,
        docMeta,
        `Uploaded ${params.type} document for ${params.entityType} ${params.entityId}`
      );
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }

    return docMeta;
  } catch (error) {
    console.error('Error uploading document:', error);
    throw new Error(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify a document
 * 
 * Marks a document as verified with who verified it and when.
 * 
 * @param params - Verification parameters
 */
export async function verifyDocument(params: {
  tenantId: string;
  entityType: "load" | "invoice" | "settlement" | "truck";
  entityId: string;
  documentId: string;
  actorUid: string;
}): Promise<void> {
  const entityRef = doc(db, `tenants/${params.tenantId}/${params.entityType}s/${params.entityId}`);
  let snap = await getDoc(entityRef);
  
  // If not in Firestore, check localStorage (for loads only)
  if (!snap.exists() && params.entityType === 'load') {
    const loadFromStorage = getLoadFromLocalStorage(params.tenantId, params.entityId);
    if (loadFromStorage) {
      // Sync load to Firestore first
      await syncLoadToFirestore(params.tenantId, loadFromStorage);
      // Re-fetch from Firestore
      snap = await getDoc(entityRef);
    }
  }
  
  if (!snap.exists()) {
    throw new Error(`${params.entityType} not found`);
  }

  const documents = (snap.data().documents || []) as TmsDocument[];
  const documentIndex = documents.findIndex(d => d.id === params.documentId);
  
  if (documentIndex === -1) {
    throw new Error('Document not found');
  }

  // Update document verification status
  const updated = documents.map((d, idx) =>
    idx === documentIndex
      ? {
          ...d,
          verified: true,
          verifiedBy: params.actorUid,
          verifiedAt: new Date().toISOString(),
        }
      : d
  );

  await updateDoc(entityRef, {
    documents: updated,
    updatedAt: serverTimestamp(),
    updatedBy: params.actorUid,
  });

  // Also update localStorage if this is a load (to keep them in sync)
  if (params.entityType === 'load') {
    try {
      const storageKey = getStorageKey(params.tenantId, 'loads');
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const loads: Load[] = JSON.parse(stored);
        const loadIndex = loads.findIndex(l => l.id === params.entityId);
        if (loadIndex !== -1) {
          loads[loadIndex] = {
            ...loads[loadIndex],
            documents: updated,
          };
          localStorage.setItem(storageKey, JSON.stringify(loads));
        }
      }
    } catch (error) {
      console.error('Error updating localStorage:', error);
      // Don't fail the operation if localStorage update fails
    }
  }
}

/**
 * Delete a document
 * 
 * Removes document from Firestore and deletes file from Storage.
 * 
 * @param params - Delete parameters
 */
export async function deleteDocument(params: {
  tenantId: string;
  entityType: "load" | "invoice" | "settlement" | "truck";
  entityId: string;
  documentId: string;
  actorUid: string;
}): Promise<void> {
  const entityRef = doc(db, `tenants/${params.tenantId}/${params.entityType}s/${params.entityId}`);
  let snap = await getDoc(entityRef);
  
  // If not in Firestore, check localStorage (for loads only)
  if (!snap.exists() && params.entityType === 'load') {
    const loadFromStorage = getLoadFromLocalStorage(params.tenantId, params.entityId);
    if (loadFromStorage) {
      // Sync load to Firestore first
      await syncLoadToFirestore(params.tenantId, loadFromStorage);
      // Re-fetch from Firestore
      snap = await getDoc(entityRef);
    }
  }
  
  if (!snap.exists()) {
    throw new Error(`${params.entityType} not found`);
  }

  const documents = (snap.data().documents || []) as TmsDocument[];
  const document = documents.find(d => d.id === params.documentId);
  
  if (!document) {
    throw new Error('Document not found');
  }

  // Delete from Storage
  try {
    const storageRef = ref(storage, document.storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file from storage:', error);
    // Continue even if storage delete fails (orphaned file)
  }

  // Remove from Firestore
  const updated = documents.filter(d => d.id !== params.documentId);
  await updateDoc(entityRef, {
    documents: updated,
    updatedAt: serverTimestamp(),
    updatedBy: params.actorUid,
  });

  // Also update localStorage if this is a load (to keep them in sync)
  if (params.entityType === 'load') {
    try {
      const storageKey = getStorageKey(params.tenantId, 'loads');
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const loads: Load[] = JSON.parse(stored);
        const loadIndex = loads.findIndex(l => l.id === params.entityId);
        if (loadIndex !== -1) {
          loads[loadIndex] = {
            ...loads[loadIndex],
            documents: updated,
          };
          localStorage.setItem(storageKey, JSON.stringify(loads));
        }
      }
    } catch (error) {
      console.error('Error updating localStorage:', error);
      // Don't fail the operation if localStorage update fails
    }
  }
}

/**
 * Get required documents for an entity type
 * 
 * Returns list of document types that should exist for the entity.
 * 
 * @param entityType - Type of entity
 * @returns Array of required document types
 */
export function getRequiredDocuments(entityType: "load" | "invoice" | "settlement" | "truck"): DocumentType[] {
  switch (entityType) {
    case "load":
      return ["RATE_CON", "BOL", "POD"];
    case "invoice":
      return ["RECEIPT"];
    case "settlement":
      return ["RECEIPT"];
    case "truck":
      return ["INSURANCE", "PERMIT"];
    default:
      return [];
  }
}

/**
 * Check for missing documents
 * 
 * Returns list of required document types that are missing.
 * 
 * @param entityType - Type of entity
 * @param existingDocuments - Array of existing documents
 * @returns Array of missing document types
 */
export function getMissingDocuments(
  entityType: "load" | "invoice" | "settlement" | "truck",
  existingDocuments: TmsDocument[] = []
): DocumentType[] {
  const required = getRequiredDocuments(entityType);
  const existingTypes = existingDocuments.map(d => d.type);
  return required.filter(type => !existingTypes.includes(type));
}

/**
 * Check for expired documents
 * 
 * Returns documents that have passed their expiration date.
 * 
 * @param documents - Array of documents to check
 * @returns Array of expired documents
 */
export function getExpiredDocuments(documents: TmsDocument[]): TmsDocument[] {
  const now = new Date();
  return documents.filter(doc => {
    if (!doc.expiresAt) return false;
    const expiryDate = new Date(doc.expiresAt);
    return expiryDate < now;
  });
}

/**
 * Get documents expiring soon
 * 
 * Returns documents that will expire within the specified number of days.
 * 
 * @param documents - Array of documents to check
 * @param daysAhead - Number of days to look ahead (default: 30)
 * @returns Array of documents expiring soon
 */
export function getDocumentsExpiringSoon(
  documents: TmsDocument[],
  daysAhead: number = 30
): TmsDocument[] {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return documents.filter(doc => {
    if (!doc.expiresAt) return false;
    const expiryDate = new Date(doc.expiresAt);
    return expiryDate >= now && expiryDate <= futureDate;
  });
}

/**
 * Get latest version of a document type
 * 
 * Returns the most recent (highest version) document of the specified type.
 * 
 * @param documents - Array of documents
 * @param type - Document type
 * @returns Latest document or null
 */
export function getLatestDocument(
  documents: TmsDocument[],
  type: DocumentType
): TmsDocument | null {
  const matching = documents.filter(d => d.type === type);
  if (matching.length === 0) return null;

  return matching.reduce((latest, current) =>
    (current.version || 0) > (latest.version || 0) ? current : latest
  );
}

/**
 * Check if a load can be invoiced
 *
 * A load can be invoiced if:
 * - It has a valid status (delivered or completed)
 * - It has not already been invoiced
 * - It has the required documents (POD is typically required)
 *
 * @param load - The load to check
 * @returns Object with canInvoice boolean and reason if not
 */
export function canInvoiceLoad(load: Load): { canInvoice: boolean; reason?: string } {
  // Check if load exists
  if (!load) {
    return { canInvoice: false, reason: 'Load not found' };
  }

  // Check if already invoiced
  if (load.invoiceId) {
    return { canInvoice: false, reason: 'Load already invoiced' };
  }

  // Check status - must be delivered or completed
  const invoiceableStatuses = ['delivered', 'completed'];
  if (!invoiceableStatuses.includes(load.status)) {
    return { canInvoice: false, reason: `Load status must be delivered or completed (current: ${load.status})` };
  }

  // Check for required documents (POD is typically required for invoicing)
  const documents = load.documents || [];
  const hasPOD = documents.some(d => d.type === 'pod' || d.type === 'POD');

  if (!hasPOD) {
    return { canInvoice: false, reason: 'POD document required for invoicing' };
  }

  return { canInvoice: true };
}

/**
 * Check if a load can be dispatched
 *
 * A load can be dispatched if:
 * - It has a valid status (available)
 * - It has a driver assigned
 * - It has a truck assigned
 *
 * @param load - The load to check
 * @returns Object with canDispatch boolean and reason if not
 */
export function canDispatchLoad(load: Load): { canDispatch: boolean; reason?: string } {
  // Check if load exists
  if (!load) {
    return { canDispatch: false, reason: 'Load not found' };
  }

  // Check status - must be available
  if (load.status !== 'available') {
    return { canDispatch: false, reason: `Load status must be available (current: ${load.status})` };
  }

  // Check for driver
  if (!load.driverId) {
    return { canDispatch: false, reason: 'Driver not assigned' };
  }

  // Check for truck
  if (!load.truckId) {
    return { canDispatch: false, reason: 'Truck not assigned' };
  }

  return { canDispatch: true };
}

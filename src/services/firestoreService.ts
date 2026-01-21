/**
 * Firestore Service - Cloud Data Persistence
 *
 * Handles all CRUD operations with Firestore for tenant-scoped data.
 * Data is stored at: tenants/{tenantId}/{collection}/{docId}
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Load, Invoice, Settlement, Employee, Truck, Trailer, Expense, FactoringCompany, Broker, Dispatcher, CustomerEntity, PlannedLoad, Trip } from '../types';
import { logger } from './logger';
import { errorHandler, ErrorSeverity } from './errorHandler';

// Collection names
const COLLECTIONS = {
  loads: 'loads',
  invoices: 'invoices',
  settlements: 'settlements',
  employees: 'employees',
  trucks: 'trucks',
  trailers: 'trailers',
  expenses: 'expenses',
  factoringCompanies: 'factoringCompanies',
  brokers: 'brokers',
  dispatchers: 'dispatchers',
  customers: 'customers',
  plannedLoads: 'plannedLoads',
  trips: 'trips',
} as const;

type CollectionName = keyof typeof COLLECTIONS;

/**
 * Get collection reference for a tenant
 */
function getCollectionRef(tenantId: string, collectionName: CollectionName) {
  return collection(db, `tenants/${tenantId}/${collectionName}`);
}

/**
 * Get document reference for a tenant
 */
function getDocRef(tenantId: string, collectionName: CollectionName, docId: string) {
  return doc(db, `tenants/${tenantId}/${collectionName}/${docId}`);
}

/**
 * Load all documents from a collection
 */
export async function loadCollection<T>(tenantId: string, collectionName: CollectionName): Promise<T[]> {
  try {
    const collRef = getCollectionRef(tenantId, collectionName);
    const q = query(collRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const items: T[] = [];
    snapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() } as T);
    });

    logger.debug(`Loaded ${items.length} ${collectionName}`, { tenantId, collectionName });
    return items;
  } catch (error) {
    errorHandler.handle(
      error,
      {
        operation: `load ${collectionName}`,
        tenantId,
        metadata: { collectionName },
      },
      { severity: ErrorSeverity.HIGH, notifyUser: false }
    );
    return [];
  }
}

/**
 * Remove undefined values from an object (Firestore doesn't accept undefined)
 */
function removeUndefinedValues<T extends Record<string, unknown>>(obj: T): T {
  const cleaned = { ...obj };
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  return cleaned;
}

/**
 * Save a document to a collection
 */
export async function saveDocument<T extends { id: string }>(
  tenantId: string,
  collectionName: CollectionName,
  data: T
): Promise<void> {
  try {
    const docRef = getDocRef(tenantId, collectionName, data.id);
    const dataToSave = removeUndefinedValues({
      ...data,
      updatedAt: new Date().toISOString(),
    });

    await setDoc(docRef, dataToSave, { merge: true });
    logger.debug(`Saved ${collectionName}/${data.id}`, { tenantId, collectionName, docId: data.id });
  } catch (error) {
    errorHandler.handle(
      error,
      {
        operation: `save ${collectionName}`,
        tenantId,
        metadata: { collectionName, docId: data.id },
      },
      { severity: ErrorSeverity.HIGH, rethrow: true }
    );
  }
}

/**
 * Update a document in a collection
 */
export async function updateDocument(
  tenantId: string,
  collectionName: CollectionName,
  docId: string,
  updates: Record<string, unknown>
): Promise<void> {
  try {
    const docRef = getDocRef(tenantId, collectionName, docId);

    const cleanUpdates = removeUndefinedValues({
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    await updateDoc(docRef, cleanUpdates);
    logger.debug(`Updated ${collectionName}/${docId}`, { tenantId, collectionName, docId });
  } catch (error) {
    errorHandler.handle(
      error,
      {
        operation: `update ${collectionName}`,
        tenantId,
        metadata: { collectionName, docId },
      },
      { severity: ErrorSeverity.HIGH, rethrow: true }
    );
  }
}

/**
 * Delete a document from a collection
 */
export async function deleteDocument(
  tenantId: string,
  collectionName: CollectionName,
  docId: string
): Promise<void> {
  try {
    const docRef = getDocRef(tenantId, collectionName, docId);
    await deleteDoc(docRef);
    logger.debug(`Deleted ${collectionName}/${docId}`, { tenantId, collectionName, docId });
  } catch (error) {
    errorHandler.handle(
      error,
      {
        operation: `delete ${collectionName}`,
        tenantId,
        metadata: { collectionName, docId },
      },
      { severity: ErrorSeverity.HIGH, rethrow: true }
    );
  }
}

/**
 * Subscribe to real-time updates for a collection
 */
export function subscribeToCollection<T>(
  tenantId: string,
  collectionName: CollectionName,
  callback: (items: T[]) => void,
  onError?: (error: Error) => void
): () => void {
  const collRef = getCollectionRef(tenantId, collectionName);
  const q = query(collRef, orderBy('createdAt', 'desc'));

  logger.debug(`Subscribing to ${collectionName}`, { tenantId, collectionName });

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as T);
      });
      callback(items);
    },
    (error) => {
      errorHandler.handle(
        error,
        {
          operation: `subscribe to ${collectionName}`,
          tenantId,
          metadata: { collectionName },
        },
        { severity: ErrorSeverity.MEDIUM, notifyUser: false }
      );
      if (onError) {
        onError(error as Error);
      }
    }
  );

  return unsubscribe;
}

/**
 * Batch save multiple documents
 */
export async function batchSave<T extends { id: string }>(
  tenantId: string,
  collectionName: CollectionName,
  items: T[]
): Promise<void> {
  if (items.length === 0) return;

  try {
    const batch = writeBatch(db);

    items.forEach((item) => {
      const docRef = getDocRef(tenantId, collectionName, item.id);
      const dataToSave = removeUndefinedValues({
        ...item,
        updatedAt: new Date().toISOString(),
      });

      batch.set(docRef, dataToSave, { merge: true });
    });

    await batch.commit();
    logger.debug(`Batch saved ${items.length} ${collectionName}`, {
      tenantId,
      collectionName,
      count: items.length,
    });
  } catch (error) {
    errorHandler.handle(
      error,
      {
        operation: `batch save ${collectionName}`,
        tenantId,
        metadata: { collectionName, count: items.length },
      },
      { severity: ErrorSeverity.HIGH, rethrow: true }
    );
  }
}

// =============================================
// Type-specific loaders
// =============================================

export const loadLoads = (tenantId: string) => loadCollection<Load>(tenantId, 'loads');
export const loadInvoices = (tenantId: string) => loadCollection<Invoice>(tenantId, 'invoices');
export const loadSettlements = (tenantId: string) => loadCollection<Settlement>(tenantId, 'settlements');
export const loadEmployees = (tenantId: string) => loadCollection<Employee>(tenantId, 'employees');
export const loadTrucks = (tenantId: string) => loadCollection<Truck>(tenantId, 'trucks');
export const loadTrailers = (tenantId: string) => loadCollection<Trailer>(tenantId, 'trailers');
export const loadExpenses = (tenantId: string) => loadCollection<Expense>(tenantId, 'expenses');
export const loadFactoringCompanies = (tenantId: string) => loadCollection<FactoringCompany>(tenantId, 'factoringCompanies');
export const loadBrokers = (tenantId: string) => loadCollection<Broker>(tenantId, 'brokers');
export const loadDispatchers = (tenantId: string) => loadCollection<Dispatcher>(tenantId, 'dispatchers');
export const loadCustomers = (tenantId: string) => loadCollection<CustomerEntity>(tenantId, 'customers');
export const loadPlannedLoads = (tenantId: string) => loadCollection<PlannedLoad>(tenantId, 'plannedLoads');
export const loadTrips = (tenantId: string) => loadCollection<Trip>(tenantId, 'trips');

// =============================================
// Type-specific savers
// =============================================

export const saveLoad = (tenantId: string, load: Load) => saveDocument(tenantId, 'loads', load);
export const saveInvoice = (tenantId: string, invoice: Invoice) => saveDocument(tenantId, 'invoices', invoice);
export const saveSettlement = (tenantId: string, settlement: Settlement) => saveDocument(tenantId, 'settlements', settlement);
export const saveEmployee = (tenantId: string, employee: Employee) => saveDocument(tenantId, 'employees', employee);
export const saveTruck = (tenantId: string, truck: Truck) => saveDocument(tenantId, 'trucks', truck);
export const saveTrailer = (tenantId: string, trailer: Trailer) => saveDocument(tenantId, 'trailers', trailer);
export const saveExpense = (tenantId: string, expense: Expense) => saveDocument(tenantId, 'expenses', expense);
export const saveFactoringCompany = (tenantId: string, fc: FactoringCompany) => saveDocument(tenantId, 'factoringCompanies', fc);
export const saveBroker = (tenantId: string, broker: Broker) => saveDocument(tenantId, 'brokers', broker);
export const saveDispatcher = (tenantId: string, dispatcher: Dispatcher) => saveDocument(tenantId, 'dispatchers', dispatcher);
export const saveCustomer = (tenantId: string, customer: CustomerEntity) => saveDocument(tenantId, 'customers', customer);
export const savePlannedLoad = (tenantId: string, plannedLoad: PlannedLoad) => saveDocument(tenantId, 'plannedLoads', plannedLoad);
export const saveTrip = (tenantId: string, trip: Trip) => saveDocument(tenantId, 'trips', trip);

// =============================================
// Type-specific deleters
// =============================================

export const deleteLoad = (tenantId: string, id: string) => deleteDocument(tenantId, 'loads', id);
export const deleteInvoice = (tenantId: string, id: string) => deleteDocument(tenantId, 'invoices', id);
export const deleteSettlement = (tenantId: string, id: string) => deleteDocument(tenantId, 'settlements', id);
export const deleteEmployee = (tenantId: string, id: string) => deleteDocument(tenantId, 'employees', id);
export const deleteTruck = (tenantId: string, id: string) => deleteDocument(tenantId, 'trucks', id);
export const deleteTrailer = (tenantId: string, id: string) => deleteDocument(tenantId, 'trailers', id);
export const deleteExpense = (tenantId: string, id: string) => deleteDocument(tenantId, 'expenses', id);
export const deleteFactoringCompany = (tenantId: string, id: string) => deleteDocument(tenantId, 'factoringCompanies', id);
export const deleteBroker = (tenantId: string, id: string) => deleteDocument(tenantId, 'brokers', id);
export const deleteDispatcher = (tenantId: string, id: string) => deleteDocument(tenantId, 'dispatchers', id);
export const deleteCustomer = (tenantId: string, id: string) => deleteDocument(tenantId, 'customers', id);
export const deletePlannedLoad = (tenantId: string, id: string) => deleteDocument(tenantId, 'plannedLoads', id);
export const deleteTrip = (tenantId: string, id: string) => deleteDocument(tenantId, 'trips', id);



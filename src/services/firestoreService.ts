/**
 * Firestore Service - Cloud Data Persistence
 *
 * Handles all CRUD operations with Firestore for tenant-scoped data.
 * Data is stored at: tenants/{tenantId}/{collection}/{docId}
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  orderBy,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Load, Invoice, Settlement, Employee, Truck, Trailer, Expense, FactoringCompany, FactoringTransaction, Broker, Dispatcher, CustomerEntity, PlannedLoad, Trip, Task } from '../types';
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
  factoringTransactions: 'factoringTransactions',
  brokers: 'brokers',
  dispatchers: 'dispatchers',
  customers: 'customers',
  plannedLoads: 'plannedLoads',
  trips: 'trips',
  tasks: 'tasks',
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
      // Doc id must win over any embedded `id` field in the document data
      items.push({ ...doc.data(), id: doc.id } as T);
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
 * Recursively remove undefined values (Firestore rejects undefined at any depth).
 * Leaves Date / class instances (FieldValue, Timestamp, DocumentReference) intact.
 */
export function removeUndefinedValues<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedValues(item)) as T;
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  const ctor = (value as object).constructor;
  if (ctor && ctor !== Object) {
    return value;
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (nested === undefined) continue;
    cleaned[key] = removeUndefinedValues(nested);
  }
  return cleaned as T;
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
        // Doc id must win over any embedded `id` field in the document data
        items.push({ ...doc.data(), id: doc.id } as T);
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

/**
 * Atomically patch multiple load documents (funding fields only).
 * Avoids parallel full-doc updateLoad races that left sibling loads unfunded.
 */
export async function batchPatchLoads(
  tenantId: string,
  patches: Array<{ id: string; updates: Record<string, unknown> }>
): Promise<void> {
  if (patches.length === 0) return;

  try {
    // Firestore batches are limited to 500 ops
    for (let i = 0; i < patches.length; i += 450) {
      const chunk = patches.slice(i, i + 450);
      const batch = writeBatch(db);
      chunk.forEach(({ id, updates }) => {
        const docRef = getDocRef(tenantId, 'loads', id);
        batch.update(
          docRef,
          removeUndefinedValues({
            ...updates,
            updatedAt: new Date().toISOString(),
          }) as Record<string, unknown>
        );
      });
      await batch.commit();
    }
    logger.debug(`Batch patched ${patches.length} loads`, { tenantId, count: patches.length });
  } catch (error) {
    errorHandler.handle(
      error,
      {
        operation: 'batch patch loads',
        tenantId,
        metadata: { count: patches.length },
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
export const loadFactoringTransactions = (tenantId: string) => loadCollection<FactoringTransaction>(tenantId, 'factoringTransactions');
export const loadBrokers = (tenantId: string) => loadCollection<Broker>(tenantId, 'brokers');
export const loadDispatchers = (tenantId: string) => loadCollection<Dispatcher>(tenantId, 'dispatchers');
export const loadCustomers = (tenantId: string) => loadCollection<CustomerEntity>(tenantId, 'customers');
export const loadPlannedLoads = (tenantId: string) => loadCollection<PlannedLoad>(tenantId, 'plannedLoads');
export const loadTrips = (tenantId: string) => loadCollection<Trip>(tenantId, 'trips');

// =============================================
// Type-specific savers
// =============================================

export const saveLoad = (tenantId: string, load: Load) => saveDocument(tenantId, 'loads', load);

/** Persist FieldValue.delete() for load settlement links (merge:true cannot clear with undefined). */
export async function clearLoadSettlementLinks(
  tenantId: string,
  loadId: string,
  fields: Array<'settlementId' | 'settlementNumber' | 'dispatcherSettlementId' | 'dispatcherSettlementNumber'>
): Promise<void> {
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  fields.forEach(f => {
    updates[f] = deleteField();
  });
  await updateDocument(tenantId, 'loads', loadId, updates);
}

/** Unlock a load after invoice deletion and clear invoice/payment link fields. */
export async function clearLoadInvoiceLinks(
  tenantId: string,
  loadId: string,
  restoredStatus?: string
): Promise<void> {
  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    invoiceId: deleteField(),
    invoiceNumber: deleteField(),
    invoicedAt: deleteField(),
    lockedAt: deleteField(),
    paymentReceivedDate: deleteField(),
    paymentAmount: deleteField(),
    isLocked: false,
    paymentReceived: false,
  };
  if (restoredStatus) updates.status = restoredStatus;
  const docRef = getDocRef(tenantId, 'loads', loadId);
  await updateDoc(docRef, updates);
}
export const saveInvoice = (tenantId: string, invoice: Invoice) => saveDocument(tenantId, 'invoices', invoice);
export const saveSettlement = (tenantId: string, settlement: Settlement) => saveDocument(tenantId, 'settlements', settlement);
export const saveEmployee = (tenantId: string, employee: Employee) => saveDocument(tenantId, 'employees', employee);
export const saveTruck = (tenantId: string, truck: Truck) => saveDocument(tenantId, 'trucks', truck);
export const saveTrailer = (tenantId: string, trailer: Trailer) => saveDocument(tenantId, 'trailers', trailer);
export const saveExpense = (tenantId: string, expense: Expense) => saveDocument(tenantId, 'expenses', expense);

/** Clear optional expense assignment fields (merge cannot remove with undefined). */
export async function clearExpenseFields(
  tenantId: string,
  expenseId: string,
  fields: Array<'driverId' | 'driverName' | 'truckId' | 'truckNumber'>
): Promise<void> {
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  fields.forEach(f => {
    updates[f] = deleteField();
  });
  await updateDocument(tenantId, 'expenses', expenseId, updates);
}
export const saveFactoringCompany = (tenantId: string, fc: FactoringCompany) => saveDocument(tenantId, 'factoringCompanies', fc);
export const saveFactoringTransaction = (tenantId: string, tx: FactoringTransaction) => saveDocument(tenantId, 'factoringTransactions', tx);
export const saveBroker = (tenantId: string, broker: Broker) => saveDocument(tenantId, 'brokers', broker);
export const saveDispatcher = (tenantId: string, dispatcher: Dispatcher) => saveDocument(tenantId, 'dispatchers', dispatcher);
export const saveCustomer = (tenantId: string, customer: CustomerEntity) => saveDocument(tenantId, 'customers', customer);
export const savePlannedLoad = (tenantId: string, plannedLoad: PlannedLoad) => saveDocument(tenantId, 'plannedLoads', plannedLoad);
export const saveTrip = (tenantId: string, trip: Trip) => saveDocument(tenantId, 'trips', trip);
export const saveTask = (tenantId: string, task: Task) => saveDocument(tenantId, 'tasks', task);

// =============================================
// Type-specific deleters
// =============================================

export const deleteLoad = (tenantId: string, id: string) => deleteDocument(tenantId, 'loads', id);

/**
 * Atomically unlink a load from invoices/settlements and delete the load document.
 */
export async function deleteLoadWithUnlink(params: {
  tenantId: string;
  loadId: string;
  invoices: Invoice[];
  settlements: Settlement[];
}): Promise<void> {
  const { tenantId, loadId, invoices, settlements } = params;
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  for (const inv of invoices) {
    const updates: Record<string, unknown> = { updatedAt: now };
    if (inv.loadId === loadId) updates.loadId = deleteField();
    if (inv.loadIds?.includes(loadId)) {
      const filtered = inv.loadIds.filter(lid => lid !== loadId);
      updates.loadIds = filtered.length > 0 ? filtered : deleteField();
    }
    batch.update(getDocRef(tenantId, 'invoices', inv.id), updates);
  }
  for (const sett of settlements) {
    const updates: Record<string, unknown> = { updatedAt: now };
    if (sett.loadId === loadId) updates.loadId = deleteField();
    if (sett.loadIds?.includes(loadId)) {
      const filtered = sett.loadIds.filter(lid => lid !== loadId);
      updates.loadIds = filtered.length > 0 ? filtered : deleteField();
    }
    if (sett.loads?.some(snapshot => snapshot.loadId === loadId)) {
      const filtered = sett.loads.filter(snapshot => snapshot.loadId !== loadId);
      updates.loads = filtered.length > 0 ? filtered : deleteField();
    }
    batch.update(getDocRef(tenantId, 'settlements', sett.id), updates);
  }
  batch.delete(getDocRef(tenantId, 'loads', loadId));
  await batch.commit();
}
export const deleteInvoice = (tenantId: string, id: string) => deleteDocument(tenantId, 'invoices', id);
export const deleteSettlement = (tenantId: string, id: string) => deleteDocument(tenantId, 'settlements', id);
export const deleteEmployee = (tenantId: string, id: string) => deleteDocument(tenantId, 'employees', id);
export const deleteTruck = (tenantId: string, id: string) => deleteDocument(tenantId, 'trucks', id);
export const deleteTrailer = (tenantId: string, id: string) => deleteDocument(tenantId, 'trailers', id);
export const deleteExpense = (tenantId: string, id: string) => deleteDocument(tenantId, 'expenses', id);
export const deleteFactoringCompany = (tenantId: string, id: string) => deleteDocument(tenantId, 'factoringCompanies', id);
export const deleteFactoringTransaction = (tenantId: string, id: string) => deleteDocument(tenantId, 'factoringTransactions', id);
export const deleteBroker = (tenantId: string, id: string) => deleteDocument(tenantId, 'brokers', id);
export const deleteDispatcher = (tenantId: string, id: string) => deleteDocument(tenantId, 'dispatchers', id);
export const deleteCustomer = (tenantId: string, id: string) => deleteDocument(tenantId, 'customers', id);
export const deletePlannedLoad = (tenantId: string, id: string) => deleteDocument(tenantId, 'plannedLoads', id);

/** Fetch a single planned load (avoids list/orderBy races during Rate Con attach → dispatch). */
export async function getPlannedLoad(
  tenantId: string,
  id: string
): Promise<PlannedLoad | null> {
  try {
    const snap = await getDoc(getDocRef(tenantId, 'plannedLoads', id));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as PlannedLoad;
  } catch (error) {
    errorHandler.handle(
      error,
      { operation: 'get plannedLoad', tenantId, metadata: { docId: id } },
      { severity: ErrorSeverity.MEDIUM, rethrow: false }
    );
    return null;
  }
}

/** Partial update helper used by factoring Mark All Funded (avoids full-doc overwrite races). */
export async function patchLoadFields(
  tenantId: string,
  loadId: string,
  updates: Record<string, unknown>
): Promise<void> {
  await updateDocument(tenantId, 'loads', loadId, updates);
}
export const deleteTrip = (tenantId: string, id: string) => deleteDocument(tenantId, 'trips', id);
export const deleteTaskDoc = (tenantId: string, id: string) => deleteDocument(tenantId, 'tasks', id);
export const loadTasksCollection = (tenantId: string) => loadCollection<Task>(tenantId, 'tasks');

/**
 * Atomically save a parent document (invoice/settlement) with linked load updates.
 * All-or-nothing — avoids orphan invoice/settlement without load links.
 */
export async function commitParentWithLinkedLoads(params: {
  tenantId: string;
  parentCollection: 'invoices' | 'settlements';
  parent: { id: string } & Record<string, unknown>;
  linkedLoads: Array<{ id: string } & Record<string, unknown>>;
}): Promise<void> {
  const { tenantId, parentCollection, parent, linkedLoads } = params;
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  batch.set(
    getDocRef(tenantId, parentCollection, parent.id),
    removeUndefinedValues({ ...parent, updatedAt: now }),
    { merge: true }
  );

  for (const load of linkedLoads) {
    batch.set(
      getDocRef(tenantId, 'loads', load.id),
      removeUndefinedValues({ ...load, updatedAt: now }),
      { merge: true }
    );
  }

  await batch.commit();
  logger.debug(`Committed ${parentCollection}/${parent.id} with ${linkedLoads.length} load links`, {
    tenantId,
    parentCollection,
    parentId: parent.id,
  });
}

/**
 * Atomically delete a settlement and clear settlement link fields on loads.
 */
export async function deleteSettlementWithUnlink(params: {
  tenantId: string;
  settlementId: string;
  loadClears: Array<{
    loadId: string;
    fields: Array<'settlementId' | 'settlementNumber' | 'dispatcherSettlementId' | 'dispatcherSettlementNumber'>;
  }>;
}): Promise<void> {
  const { tenantId, settlementId, loadClears } = params;
  const batch = writeBatch(db);
  batch.delete(getDocRef(tenantId, 'settlements', settlementId));
  for (const clear of loadClears) {
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    clear.fields.forEach(f => {
      updates[f] = deleteField();
    });
    batch.update(getDocRef(tenantId, 'loads', clear.loadId), updates);
  }
  await batch.commit();
}

/**
 * Atomically delete an invoice and clear invoice links on loads.
 */
export async function deleteInvoiceWithUnlink(params: {
  tenantId: string;
  invoiceId: string;
  loadIds: string[];
  restoredStatusByLoadId?: Record<string, string>;
  factoringTransactionIds?: string[];
}): Promise<void> {
  const { tenantId, invoiceId, loadIds, restoredStatusByLoadId = {}, factoringTransactionIds = [] } = params;
  const batch = writeBatch(db);
  batch.delete(getDocRef(tenantId, 'invoices', invoiceId));
  for (const txId of factoringTransactionIds) {
    batch.delete(getDocRef(tenantId, 'factoringTransactions', txId));
  }
  for (const loadId of loadIds) {
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      invoiceId: deleteField(),
      invoiceNumber: deleteField(),
      invoicedAt: deleteField(),
      lockedAt: deleteField(),
      paymentReceivedDate: deleteField(),
      paymentAmount: deleteField(),
      isLocked: false,
      paymentReceived: false,
    };
    if (restoredStatusByLoadId[loadId]) {
      updates.status = restoredStatusByLoadId[loadId];
    }
    batch.update(getDocRef(tenantId, 'loads', loadId), updates);
  }
  await batch.commit();
}



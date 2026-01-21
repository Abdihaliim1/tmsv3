/**
 * Firestore Pagination Service
 *
 * Provides cursor-based pagination for Firestore queries.
 * Uses startAfter() for efficient pagination without offset.
 */

import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  QueryDocumentSnapshot,
  DocumentData,
  QueryConstraint,
  Unsubscribe,
  Query,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// ============================================================================
// Types
// ============================================================================

export interface PaginationState<T> {
  items: T[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  isLoading: boolean;
  error: Error | null;
  totalLoaded: number;
}

export interface PaginatedResult<T> {
  items: T[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export interface PaginationOptions {
  pageSize?: number;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  constraints?: QueryConstraint[];
}

// Default page size
const DEFAULT_PAGE_SIZE = 25;

// ============================================================================
// Initial State Factory
// ============================================================================

/**
 * Creates initial pagination state
 */
export function createPaginationState<T>(): PaginationState<T> {
  return {
    items: [],
    lastDoc: null,
    hasMore: true,
    isLoading: false,
    error: null,
    totalLoaded: 0
  };
}

// ============================================================================
// One-time Fetch Functions
// ============================================================================

/**
 * Load the first page of results
 */
export async function loadFirstPage<T>(
  tenantId: string,
  collectionName: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<T>> {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    orderByField = 'createdAt',
    orderDirection = 'desc',
    constraints = []
  } = options;

  const collRef = collection(db, 'tenants', tenantId, collectionName);

  const q = query(
    collRef,
    orderBy(orderByField, orderDirection),
    ...constraints,
    limit(pageSize + 1) // Fetch one extra to check if there are more
  );

  const snapshot = await getDocs(q);
  const docs = snapshot.docs;

  // Check if there are more results
  const hasMore = docs.length > pageSize;
  const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;

  const items = resultDocs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as T[];

  return {
    items,
    lastDoc: resultDocs.length > 0 ? resultDocs[resultDocs.length - 1] : null,
    hasMore
  };
}

/**
 * Load the next page of results using cursor
 */
export async function loadNextPage<T>(
  tenantId: string,
  collectionName: string,
  lastDoc: QueryDocumentSnapshot<DocumentData>,
  options: PaginationOptions = {}
): Promise<PaginatedResult<T>> {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    orderByField = 'createdAt',
    orderDirection = 'desc',
    constraints = []
  } = options;

  const collRef = collection(db, 'tenants', tenantId, collectionName);

  const q = query(
    collRef,
    orderBy(orderByField, orderDirection),
    ...constraints,
    startAfter(lastDoc),
    limit(pageSize + 1)
  );

  const snapshot = await getDocs(q);
  const docs = snapshot.docs;

  const hasMore = docs.length > pageSize;
  const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;

  const items = resultDocs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as T[];

  return {
    items,
    lastDoc: resultDocs.length > 0 ? resultDocs[resultDocs.length - 1] : null,
    hasMore
  };
}

// ============================================================================
// Real-time Subscription with Pagination
// ============================================================================

export interface SubscriptionCallbacks<T> {
  onData: (result: PaginatedResult<T>) => void;
  onError: (error: Error) => void;
}

/**
 * Subscribe to paginated collection with real-time updates
 * Note: Real-time pagination has limitations - new items may shift pages
 */
export function subscribeToFirstPage<T>(
  tenantId: string,
  collectionName: string,
  callbacks: SubscriptionCallbacks<T>,
  options: PaginationOptions = {}
): Unsubscribe {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    orderByField = 'createdAt',
    orderDirection = 'desc',
    constraints = []
  } = options;

  const collRef = collection(db, 'tenants', tenantId, collectionName);

  const q = query(
    collRef,
    orderBy(orderByField, orderDirection),
    ...constraints,
    limit(pageSize)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];

      callbacks.onData({
        items,
        lastDoc: snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1]
          : null,
        hasMore: snapshot.docs.length === pageSize
      });
    },
    (error) => {
      callbacks.onError(error);
    }
  );
}

// ============================================================================
// Paginated Query Builder
// ============================================================================

/**
 * Build a paginated query with optional cursor
 */
export function buildPaginatedQuery(
  tenantId: string,
  collectionName: string,
  options: PaginationOptions & { cursor?: QueryDocumentSnapshot<DocumentData> }
): Query<DocumentData> {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    orderByField = 'createdAt',
    orderDirection = 'desc',
    constraints = [],
    cursor
  } = options;

  const collRef = collection(db, 'tenants', tenantId, collectionName);

  const queryConstraints: QueryConstraint[] = [
    orderBy(orderByField, orderDirection),
    ...constraints
  ];

  if (cursor) {
    queryConstraints.push(startAfter(cursor));
  }

  queryConstraints.push(limit(pageSize));

  return query(collRef, ...queryConstraints);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Merge new items with existing items, avoiding duplicates
 */
export function mergeItems<T extends { id: string }>(
  existing: T[],
  newItems: T[]
): T[] {
  const existingIds = new Set(existing.map(item => item.id));
  const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
  return [...existing, ...uniqueNewItems];
}

/**
 * Check if we should load more based on scroll position
 */
export function shouldLoadMore(
  containerElement: HTMLElement,
  threshold: number = 100
): boolean {
  const { scrollTop, scrollHeight, clientHeight } = containerElement;
  return scrollHeight - scrollTop - clientHeight < threshold;
}

/**
 * Get page info for display
 */
export function getPageInfo(
  totalLoaded: number,
  pageSize: number
): { currentPage: number; itemsPerPage: number } {
  return {
    currentPage: Math.ceil(totalLoaded / pageSize),
    itemsPerPage: pageSize
  };
}

// ============================================================================
// Timestamp Helpers
// ============================================================================

/**
 * Convert Firestore Timestamp to Date for cursor comparison
 */
export function timestampToDate(timestamp: Timestamp | Date | null): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  return timestamp.toDate();
}

/**
 * Get a safe cursor value from a document
 */
export function getCursorValue(
  doc: QueryDocumentSnapshot<DocumentData>,
  field: string
): unknown {
  const data = doc.data();
  return data[field] ?? null;
}

// ============================================================================
// Infinite Scroll Hook Helper
// ============================================================================

export interface InfiniteScrollState<T> {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Create state management functions for infinite scroll
 */
export function createInfiniteScrollManager<T extends { id: string }>(
  tenantId: string,
  collectionName: string,
  options: PaginationOptions = {}
) {
  let state: PaginationState<T> = createPaginationState<T>();
  let listeners: Array<(state: PaginationState<T>) => void> = [];

  const notifyListeners = () => {
    listeners.forEach(listener => listener(state));
  };

  const setState = (updates: Partial<PaginationState<T>>) => {
    state = { ...state, ...updates };
    notifyListeners();
  };

  const loadInitial = async () => {
    setState({ isLoading: true, error: null });
    try {
      const result = await loadFirstPage<T>(tenantId, collectionName, options);
      setState({
        items: result.items,
        lastDoc: result.lastDoc,
        hasMore: result.hasMore,
        isLoading: false,
        totalLoaded: result.items.length
      });
    } catch (error) {
      setState({
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to load')
      });
    }
  };

  const loadMore = async () => {
    if (state.isLoading || !state.hasMore || !state.lastDoc) return;

    setState({ isLoading: true });
    try {
      const result = await loadNextPage<T>(
        tenantId,
        collectionName,
        state.lastDoc,
        options
      );
      setState({
        items: mergeItems(state.items, result.items),
        lastDoc: result.lastDoc,
        hasMore: result.hasMore,
        isLoading: false,
        totalLoaded: state.totalLoaded + result.items.length
      });
    } catch (error) {
      setState({
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to load more')
      });
    }
  };

  const refresh = async () => {
    state = createPaginationState<T>();
    await loadInitial();
  };

  const reset = () => {
    state = createPaginationState<T>();
    notifyListeners();
  };

  return {
    getState: () => state,
    subscribe: (listener: (state: PaginationState<T>) => void) => {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter(l => l !== listener);
      };
    },
    loadInitial,
    loadMore,
    refresh,
    reset
  };
}

// ============================================================================
// Export Default Page Size
// ============================================================================

export { DEFAULT_PAGE_SIZE };

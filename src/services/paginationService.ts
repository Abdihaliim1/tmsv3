/**
 * Pagination Service for Firestore
 *
 * Provides efficient pagination for Firestore collections to handle
 * large datasets without loading all documents at once.
 */

import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  Query,
  QueryConstraint,
  where,
  WhereFilterOp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from './logger';
import { errorHandler, ErrorSeverity } from './errorHandler';

export interface PaginationOptions {
  pageSize?: number;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  items: T[];
  hasMore: boolean;
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  totalFetched: number;
}

export interface FilterCondition {
  field: string;
  operator: WhereFilterOp;
  value: unknown;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

class PaginationService {
  /**
   * Loads a paginated collection from Firestore
   *
   * @param tenantId - Tenant identifier for data isolation
   * @param collectionName - Name of the collection to query
   * @param options - Pagination configuration options
   * @param lastDoc - Last document from previous page (for pagination)
   * @param filters - Optional filter conditions
   * @returns Paginated result with items and pagination metadata
   */
  async loadPage<T>(
    tenantId: string,
    collectionName: string,
    options: PaginationOptions = {},
    lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
    filters: FilterCondition[] = []
  ): Promise<PaginationResult<T>> {
    const {
      pageSize = DEFAULT_PAGE_SIZE,
      orderByField = 'createdAt',
      orderDirection = 'desc',
    } = options;

    // Validate page size
    const validatedPageSize = Math.min(pageSize, MAX_PAGE_SIZE);

    try {
      const collectionRef = collection(db, `tenants/${tenantId}/${collectionName}`);

      // Build query constraints
      const constraints: QueryConstraint[] = [];

      // Add filters
      filters.forEach((filter) => {
        constraints.push(where(filter.field, filter.operator, filter.value));
      });

      // Add ordering
      constraints.push(orderBy(orderByField, orderDirection));

      // Add pagination
      constraints.push(limit(validatedPageSize + 1)); // Fetch one extra to check if there are more

      // Add cursor for pagination
      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(collectionRef, ...constraints);

      const snapshot = await getDocs(q);

      // Check if there are more results
      const hasMore = snapshot.docs.length > validatedPageSize;

      // Get items (excluding the extra one if it exists)
      const items = snapshot.docs
        .slice(0, validatedPageSize)
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as T));

      // Get last document for next page
      const newLastDoc =
        snapshot.docs.length > 0
          ? snapshot.docs[Math.min(validatedPageSize - 1, snapshot.docs.length - 1)]
          : null;

      logger.debug('Loaded paginated collection', {
        tenantId,
        collectionName,
        itemsCount: items.length,
        hasMore,
      });

      return {
        items,
        hasMore,
        lastDoc: newLastDoc,
        totalFetched: items.length,
      };
    } catch (error) {
      errorHandler.handle(
        error,
        {
          operation: 'load paginated collection',
          tenantId,
          metadata: { collectionName, pageSize: validatedPageSize },
        },
        { severity: ErrorSeverity.HIGH, rethrow: true }
      );
      throw error; // TypeScript doesn't know errorHandler throws
    }
  }

  /**
   * Loads all pages from a collection (use with caution for large datasets)
   *
   * @param tenantId - Tenant identifier
   * @param collectionName - Collection name
   * @param options - Pagination options
   * @param filters - Optional filter conditions
   * @param maxPages - Maximum number of pages to load (safety limit)
   * @returns All items from all pages
   */
  async loadAllPages<T>(
    tenantId: string,
    collectionName: string,
    options: PaginationOptions = {},
    filters: FilterCondition[] = [],
    maxPages: number = 10
  ): Promise<T[]> {
    const allItems: T[] = [];
    let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
    let pageCount = 0;

    logger.debug('Loading all pages', {
      tenantId,
      collectionName,
      maxPages,
    });

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (pageCount >= maxPages) {
          logger.warn('Reached maximum page limit', {
            tenantId,
            collectionName,
            maxPages,
            itemsLoaded: allItems.length,
          });
          break;
        }

        const result = await this.loadPage<T>(
          tenantId,
          collectionName,
          options,
          lastDoc,
          filters
        );

        allItems.push(...result.items);
        pageCount++;

        if (!result.hasMore) {
          break;
        }

        lastDoc = result.lastDoc;
      }

      logger.debug('Loaded all pages', {
        tenantId,
        collectionName,
        totalItems: allItems.length,
        pagesLoaded: pageCount,
      });

      return allItems;
    } catch (error) {
      errorHandler.handle(
        error,
        {
          operation: 'load all pages',
          tenantId,
          metadata: { collectionName, pagesLoaded: pageCount },
        },
        { severity: ErrorSeverity.HIGH, rethrow: true }
      );
      throw error;
    }
  }

  /**
   * Creates a cursor-based pagination helper
   *
   * @param tenantId - Tenant identifier
   * @param collectionName - Collection name
   * @param options - Pagination options
   * @param filters - Optional filter conditions
   * @returns Pagination helper with next/previous methods
   */
  createPaginator<T>(
    tenantId: string,
    collectionName: string,
    options: PaginationOptions = {},
    filters: FilterCondition[] = []
  ): Paginator<T> {
    return new Paginator<T>(this, tenantId, collectionName, options, filters);
  }
}

/**
 * Paginator class for managing pagination state
 */
class Paginator<T> {
  private currentPage: PaginationResult<T> | null = null;
  private pageHistory: QueryDocumentSnapshot<DocumentData>[] = [];

  constructor(
    private paginationService: PaginationService,
    private tenantId: string,
    private collectionName: string,
    private options: PaginationOptions,
    private filters: FilterCondition[]
  ) {}

  /**
   * Loads the first page
   */
  async first(): Promise<PaginationResult<T>> {
    this.pageHistory = [];
    this.currentPage = await this.paginationService.loadPage<T>(
      this.tenantId,
      this.collectionName,
      this.options,
      null,
      this.filters
    );
    return this.currentPage;
  }

  /**
   * Loads the next page
   */
  async next(): Promise<PaginationResult<T> | null> {
    if (!this.currentPage || !this.currentPage.hasMore) {
      return null;
    }

    if (this.currentPage.lastDoc) {
      this.pageHistory.push(this.currentPage.lastDoc);
    }

    this.currentPage = await this.paginationService.loadPage<T>(
      this.tenantId,
      this.collectionName,
      this.options,
      this.currentPage.lastDoc,
      this.filters
    );

    return this.currentPage;
  }

  /**
   * Loads the previous page (requires page history)
   */
  async previous(): Promise<PaginationResult<T> | null> {
    if (this.pageHistory.length === 0) {
      return null;
    }

    // Remove the current page's starting point
    this.pageHistory.pop();

    const lastDoc = this.pageHistory.length > 0 ? this.pageHistory[this.pageHistory.length - 1] : null;

    this.currentPage = await this.paginationService.loadPage<T>(
      this.tenantId,
      this.collectionName,
      this.options,
      lastDoc,
      this.filters
    );

    return this.currentPage;
  }

  /**
   * Gets the current page
   */
  getCurrentPage(): PaginationResult<T> | null {
    return this.currentPage;
  }

  /**
   * Checks if there's a next page
   */
  hasNext(): boolean {
    return this.currentPage?.hasMore ?? false;
  }

  /**
   * Checks if there's a previous page
   */
  hasPrevious(): boolean {
    return this.pageHistory.length > 0;
  }

  /**
   * Resets the paginator to initial state
   */
  reset(): void {
    this.currentPage = null;
    this.pageHistory = [];
  }
}

// Export singleton instance
export const paginationService = new PaginationService();

// Export convenience functions
export const loadPage = paginationService.loadPage.bind(paginationService);
export const loadAllPages = paginationService.loadAllPages.bind(paginationService);
export const createPaginator = paginationService.createPaginator.bind(paginationService);

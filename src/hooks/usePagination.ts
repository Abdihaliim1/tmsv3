/**
 * usePagination Hook
 *
 * React hook for paginated Firestore queries with infinite scroll support.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import {
  loadFirstPage,
  loadNextPage,
  mergeItems,
  PaginationOptions,
  DEFAULT_PAGE_SIZE
} from '../services/paginationService';

export interface UsePaginationOptions extends PaginationOptions {
  enabled?: boolean;
}

export interface UsePaginationResult<T> {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  totalLoaded: number;
}

/**
 * Hook for paginated data fetching with infinite scroll
 */
export function usePagination<T extends { id: string }>(
  tenantId: string | null,
  collectionName: string,
  options: UsePaginationOptions = {}
): UsePaginationResult<T> {
  const { enabled = true, ...paginationOptions } = options;

  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const isMountedRef = useRef(true);

  // Load initial data
  const loadInitial = useCallback(async () => {
    if (!tenantId || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await loadFirstPage<T>(tenantId, collectionName, paginationOptions);

      if (isMountedRef.current) {
        setItems(result.items);
        lastDocRef.current = result.lastDoc;
        setHasMore(result.hasMore);
        setIsLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to load data'));
        setIsLoading(false);
      }
    }
  }, [tenantId, collectionName, enabled, JSON.stringify(paginationOptions)]);

  // Load more data
  const loadMore = useCallback(async () => {
    if (!tenantId || !enabled || isLoadingMore || !hasMore || !lastDocRef.current) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const result = await loadNextPage<T>(
        tenantId,
        collectionName,
        lastDocRef.current,
        paginationOptions
      );

      if (isMountedRef.current) {
        setItems(prev => mergeItems(prev, result.items));
        lastDocRef.current = result.lastDoc;
        setHasMore(result.hasMore);
        setIsLoadingMore(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to load more'));
        setIsLoadingMore(false);
      }
    }
  }, [tenantId, collectionName, enabled, isLoadingMore, hasMore, JSON.stringify(paginationOptions)]);

  // Refresh data (reload from beginning)
  const refresh = useCallback(async () => {
    setItems([]);
    lastDocRef.current = null;
    setHasMore(true);
    await loadInitial();
  }, [loadInitial]);

  // Initial load
  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    totalLoaded: items.length
  };
}

/**
 * Hook for infinite scroll trigger
 * Automatically calls loadMore when user scrolls near bottom
 */
export function useInfiniteScroll(
  loadMore: () => Promise<void>,
  hasMore: boolean,
  isLoading: boolean,
  threshold: number = 200
) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef(loadMore);

  // Keep loadMore ref up to date
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoading) return;

      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (!hasMore || !node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !isLoading) {
            loadMoreRef.current();
          }
        },
        {
          rootMargin: `${threshold}px`
        }
      );

      observerRef.current.observe(node);
    },
    [hasMore, isLoading, threshold]
  );

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return sentinelRef;
}

export { DEFAULT_PAGE_SIZE };

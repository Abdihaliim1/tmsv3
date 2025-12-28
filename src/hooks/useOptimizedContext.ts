/**
 * Performance Optimization Hooks
 *
 * Provides memoized selectors for context values to prevent unnecessary re-renders
 */

import { useCallback, useRef, useMemo } from 'react';
import { useDeepCompareMemoize } from './useDeepCompareMemoize';

/**
 * Creates a memoized selector for context values
 *
 * @param selector - Function to select specific data from context
 * @param dependencies - Dependencies to track for memoization
 * @returns Memoized result of selector
 *
 * @example
 * ```typescript
 * const activeLo ads = useContextSelector(
 *   () => loads.filter(l => l.status === LoadStatus.InTransit),
 *   [loads]
 * );
 * ```
 */
export function useContextSelector<T>(
  selector: () => T,
  dependencies: unknown[]
): T {
  const memoizedDeps = useDeepCompareMemoize(dependencies);
  return useMemo(selector, memoizedDeps);
}

/**
 * Creates a stable callback that won't cause re-renders
 *
 * @param callback - Function to stabilize
 * @param dependencies - Dependencies to track
 * @returns Stable callback reference
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  dependencies: unknown[]
): T {
  const memoizedDeps = useDeepCompareMemoize(dependencies);
  return useCallback(callback, memoizedDeps) as T;
}

/**
 * Provides memoized derived state with equality check
 *
 * @param compute - Function to compute derived state
 * @param dependencies - Dependencies for computation
 * @param isEqual - Custom equality function (default: shallow equality)
 * @returns Memoized computed value
 */
export function useDerivedState<T>(
  compute: () => T,
  dependencies: unknown[],
  isEqual: (prev: T, next: T) => boolean = shallowEqual
): T {
  const prevRef = useRef<T>();
  const memoizedDeps = useDeepCompareMemoize(dependencies);

  return useMemo(() => {
    const computed = compute();
    if (prevRef.current !== undefined && isEqual(prevRef.current, computed)) {
      return prevRef.current;
    }
    prevRef.current = computed;
    return computed;
  }, memoizedDeps);
}

/**
 * Shallow equality comparison for objects and arrays
 */
function shallowEqual<T>(prev: T, next: T): boolean {
  if (prev === next) return true;
  if (!prev || !next) return false;

  if (Array.isArray(prev) && Array.isArray(next)) {
    if (prev.length !== next.length) return false;
    return prev.every((item, index) => item === next[index]);
  }

  if (typeof prev === 'object' && typeof next === 'object') {
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);

    if (prevKeys.length !== nextKeys.length) return false;

    return prevKeys.every(
      (key) =>
        prev[key as keyof T] === next[key as keyof T] &&
        nextKeys.includes(key)
    );
  }

  return false;
}

/**
 * Debounced value hook for expensive operations
 *
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useMemo(() => {
    const state = { current: value };
    return [state.current, (newValue: T) => (state.current = newValue)] as const;
  }, []);

  useMemo(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay, setDebouncedValue]);

  return debouncedValue;
}

/**
 * Hook for paginated data with infinite scroll support
 *
 * @param items - All items to paginate
 * @param pageSize - Items per page
 * @returns Paginated items and control functions
 */
export function usePaginatedItems<T>(items: T[], pageSize: number = 25) {
  const [currentPage, setCurrentPage] = useMemo(() => {
    const state = { current: 1 };
    return [state.current, (page: number) => (state.current = page)] as const;
  }, []);

  const paginatedItems = useMemo(() => {
    const startIndex = 0;
    const endIndex = currentPage * pageSize;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, pageSize]);

  const hasMore = currentPage * pageSize < items.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, hasMore, setCurrentPage]);

  const reset = useCallback(() => {
    setCurrentPage(1);
  }, [setCurrentPage]);

  return {
    items: paginatedItems,
    hasMore,
    loadMore,
    reset,
    currentPage,
    totalPages: Math.ceil(items.length / pageSize),
  };
}

/**
 * Memoizes expensive computations with cache
 *
 * @param compute - Expensive computation function
 * @param key - Cache key
 * @returns Memoized result
 */
export function useMemoizedComputation<T>(
  compute: () => T,
  key: string
): T {
  const cacheRef = useRef<Map<string, T>>(new Map());

  return useMemo(() => {
    if (cacheRef.current.has(key)) {
      return cacheRef.current.get(key)!;
    }

    const result = compute();
    cacheRef.current.set(key, result);

    // Limit cache size to prevent memory leaks
    if (cacheRef.current.size > 100) {
      const firstKey = cacheRef.current.keys().next().value;
      cacheRef.current.delete(firstKey);
    }

    return result;
  }, [key]);
}

/**
 * Deep comparison memoization hook
 *
 * Prevents unnecessary re-renders by doing deep equality checks on dependencies
 */

import { useRef } from 'react';

/**
 * Deep equality comparison
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => deepEqual(item, b[index]));
    }

    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every((key) =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }

  return false;
}

/**
 * Memoizes dependencies with deep equality check
 *
 * @param dependencies - Array of dependencies to memoize
 * @returns Stable reference if dependencies are deeply equal
 */
export function useDeepCompareMemoize<T extends unknown[]>(
  dependencies: T
): T {
  const ref = useRef<T>(dependencies);

  if (!deepEqual(ref.current, dependencies)) {
    ref.current = dependencies;
  }

  return ref.current;
}

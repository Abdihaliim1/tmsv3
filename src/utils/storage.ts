/**
 * Safe localStorage Wrapper
 *
 * Provides safe access to localStorage with:
 * - Try-catch error handling
 * - JSON parse/stringify error handling
 * - Quota exceeded handling
 * - Type-safe generic methods
 */

/**
 * Safely get an item from localStorage
 * Returns null if the key doesn't exist or if there's an error
 */
export function getStorageItem<T>(key: string, defaultValue: T | null = null): T | null {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item) as T;
  } catch (error) {
    // Log error in development only
    if (import.meta.env.DEV) {
      console.warn(`[Storage] Error reading key "${key}":`, error);
    }
    return defaultValue;
  }
}

/**
 * Safely get a string item from localStorage (no JSON parsing)
 */
export function getStorageString(key: string, defaultValue: string = ''): string {
  try {
    return localStorage.getItem(key) ?? defaultValue;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`[Storage] Error reading string key "${key}":`, error);
    }
    return defaultValue;
  }
}

/**
 * Safely set an item in localStorage
 * Returns true if successful, false otherwise
 */
export function setStorageItem<T>(key: string, value: T): boolean {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    // Handle quota exceeded error
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error(`[Storage] Quota exceeded when setting key "${key}"`);
      // Try to clear old data and retry once
      try {
        clearOldStorageData();
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }
    if (import.meta.env.DEV) {
      console.warn(`[Storage] Error setting key "${key}":`, error);
    }
    return false;
  }
}

/**
 * Safely set a string item in localStorage (no JSON stringifying)
 */
export function setStorageString(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`[Storage] Error setting string key "${key}":`, error);
    }
    return false;
  }
}

/**
 * Safely remove an item from localStorage
 */
export function removeStorageItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`[Storage] Error removing key "${key}":`, error);
    }
    return false;
  }
}

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all keys matching a prefix
 */
export function getStorageKeys(prefix: string = ''): string[] {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    return keys;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`[Storage] Error getting keys with prefix "${prefix}":`, error);
    }
    return [];
  }
}

/**
 * Clear all items matching a prefix
 */
export function clearStorageByPrefix(prefix: string): boolean {
  try {
    const keys = getStorageKeys(prefix);
    keys.forEach(key => localStorage.removeItem(key));
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`[Storage] Error clearing keys with prefix "${prefix}":`, error);
    }
    return false;
  }
}

/**
 * Clear old storage data (called when quota is exceeded)
 * Removes error logs and old cached data
 */
function clearOldStorageData(): void {
  try {
    // Remove error logs (they can accumulate)
    removeStorageItem('tms_error_logs');

    // Remove any items older than 7 days if they have timestamps
    const keys = getStorageKeys('tms_');
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    keys.forEach(key => {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          // Check for timestamp or createdAt fields
          if (parsed?.timestamp && parsed.timestamp < oneWeekAgo) {
            localStorage.removeItem(key);
          } else if (parsed?.createdAt && new Date(parsed.createdAt).getTime() < oneWeekAgo) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        // Skip items that can't be parsed
      }
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Storage] Error clearing old data:', error);
    }
  }
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Safe JSON stringify
 */
export function safeJsonStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Get storage usage info
 */
export function getStorageUsage(): { used: number; available: boolean } {
  try {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const item = localStorage.getItem(key);
        if (item) {
          totalSize += key.length + item.length;
        }
      }
    }
    return {
      used: totalSize * 2, // UTF-16 uses 2 bytes per character
      available: true
    };
  } catch {
    return { used: 0, available: false };
  }
}

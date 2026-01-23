/**
 * Simple localStorage caching utility with expiry.
 */

interface CacheItem<T> {
  data: T;
  expiry: number; // Timestamp when the cache expires
}

const CACHE_PREFIX = 'gatecode_cache_';

/**
 * Sets an item in the cache with an expiry duration.
 * @param key The cache key.
 * @param data The data to store.
 * @param ttlSeconds Time to live in seconds. Default: 1 hour (3600 seconds).
 */
export function setCache<T>(key: string, data: T, ttlSeconds: number = 3600): void {
  const expiry = Date.now() + ttlSeconds * 1000;
  const item: CacheItem<T> = { data, expiry };
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    console.log(`[Cache] Set: ${key}, TTL: ${ttlSeconds}s`);
  } catch (error) {
    console.error(`[Cache] Error setting item ${key}:`, error);
    // Handle potential storage full errors if necessary
  }
}

/**
 * Gets an item from the cache if it exists and hasn't expired.
 * @param key The cache key.
 * @returns The cached data or null if not found or expired.
 */
export function getCache<T>(key: string): T | null {
  try {
    const itemStr = localStorage.getItem(CACHE_PREFIX + key);
    if (!itemStr) {
      console.log(`[Cache] Miss: ${key}`);
      return null;
    }

    const item: CacheItem<T> = JSON.parse(itemStr);

    if (Date.now() > item.expiry) {
      console.log(`[Cache] Expired: ${key}`);
      localStorage.removeItem(CACHE_PREFIX + key); // Clean up expired item
      return null;
    }

    console.log(`[Cache] Hit: ${key}`);
    return item.data;
  } catch (error) {
    console.error(`[Cache] Error getting item ${key}:`, error);
    // Clear potentially corrupted item
    localStorage.removeItem(CACHE_PREFIX + key);
    return null;
  }
}

/**
 * Clears a specific item from the cache.
 * @param key The cache key.
 */
export function clearCache(key: string): void {
    try {
        localStorage.removeItem(CACHE_PREFIX + key);
        console.log(`[Cache] Cleared: ${key}`);
    } catch (error) {
        console.error(`[Cache] Error clearing item ${key}:`, error);
    }
}

/**
 * Clears all items managed by this cache utility.
 */
export function clearAllCache(): void {
    try {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(CACHE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
        console.log('[Cache] Cleared all.');
    } catch (error) {
        console.error('[Cache] Error clearing all items:', error);
    }
}

/**
 * Session Metadata Cache
 *
 * In-memory cache keyed by `${userId}_${orgId}` for storing per-user
 * Salesforce metadata (role hierarchy, field permissions, object permissions).
 * Entries expire after 30 minutes with periodic cleanup.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

class SessionMetadataCache {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanup();
  }

  /**
   * Build a cache key from userId and orgId
   */
  private makeKey(userId: string, orgId: string, namespace: string): string {
    return `${namespace}_${userId}_${orgId}`;
  }

  /**
   * Get a cached value, or null if expired/missing
   */
  get<T>(userId: string, orgId: string, namespace: string): T | null {
    const key = this.makeKey(userId, orgId, namespace);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Set a cached value with optional custom TTL
   */
  set<T>(userId: string, orgId: string, namespace: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
    const key = this.makeKey(userId, orgId, namespace);
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Invalidate a specific cached entry
   */
  invalidate(userId: string, orgId: string, namespace: string): void {
    const key = this.makeKey(userId, orgId, namespace);
    this.cache.delete(key);
  }

  /**
   * Invalidate all entries for a user/org combination
   */
  invalidateAll(userId: string, orgId: string): void {
    const prefix = `_${userId}_${orgId}`;
    for (const key of this.cache.keys()) {
      if (key.endsWith(prefix) || key.includes(`_${userId}_${orgId}`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    // Don't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop periodic cleanup (for graceful shutdown)
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// Singleton instance
export const metadataCache = new SessionMetadataCache();

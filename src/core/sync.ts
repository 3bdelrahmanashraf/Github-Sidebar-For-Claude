/**
 * Repository synchronization manager
 */

import type { CachedRepository, SyncResult, GitHubRepository } from '../types';
import { getConfig, updateAccount } from '../core/config';
import { createAuthenticatedClient } from '../auth/manager';
import type * as DatabaseModule from '../storage/database';

let dbModule: typeof DatabaseModule | null = null;

async function loadDbModule(): Promise<void> {
  if (dbModule) return;
  const dbPath = '../storage/database';
  dbModule = await import(dbPath);
}

// In-memory cache with TTL
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  etag?: string;
}

class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTtl: number;

  constructor(defaultTtlMs = 5 * 60 * 1000) { // 5 minutes default
    this.defaultTtl = defaultTtlMs;
  }

  set(key: string, data: T, ttlMs?: number, etag?: string): void {
    const expiresAt = Date.now() + (ttlMs || this.defaultTtl);
    this.cache.set(key, { data, expiresAt, etag });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  getWithEtag(key: string): { data: T | null; etag?: string } {
    const entry = this.cache.get(key);
    if (!entry) return { data: null };
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return { data: null };
    }
    return { data: entry.data, etag: entry.etag };
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Cleanup expired entries
  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }
}

// Repository cache with ETag support
const repositoryCache = new MemoryCache<CachedRepository[]>(5 * 60 * 1000); // 5 min TTL
const statsCache = new MemoryCache<Record<string, number>>(10 * 60 * 1000); // 10 min TTL

let syncInProgress = new Set<string>();
const syncCallbacks = new Map<string, (result: SyncResult) => void>();

export function isSyncInProgress(accountId: string): boolean {
  return syncInProgress.has(accountId);
}

export function onSyncComplete(
  accountId: string,
  callback: (result: SyncResult) => void
): () => void {
  syncCallbacks.set(accountId, callback);
  return () => syncCallbacks.delete(accountId);
}

export async function syncAccount(accountId: string, options: { full?: boolean; incremental?: boolean } = {}): Promise<SyncResult> {
  if (syncInProgress.has(accountId)) {
    throw new Error(`Sync already in progress for account: ${accountId}`);
  }

  const config = getConfig();
  const account = config.accounts.find(a => a.id === accountId);
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  if (!account.settings.syncEnabled && !options.full) {
    throw new Error(`Sync disabled for account: ${accountId}`);
  }

  syncInProgress.add(accountId);

  try {
    const client = await createAuthenticatedClient(accountId);
    if (!client) {
      throw new Error(`Failed to create client for account: ${accountId}`);
    }

    // Check cache first for incremental sync
    let repositories: CachedRepository[] = [];
    let fromCache = false;

    if (!options.full && options.incremental !== false) {
      const cached = repositoryCache.get(accountId);
      if (cached) {
        repositories = cached;
        fromCache = true;
      }
    }

    // If not from cache or full sync requested, fetch from API
    let syncResult: SyncResult;
    if (!fromCache || options.full) {
      syncResult = await client.syncAllRepositories();
      // Convert GitHubRepository[] to CachedRepository[]
      repositories = syncResult.repositories.map(r => ({
        ...r,
        accountId,
        stats: r.stats,
        cachedAt: new Date().toISOString(),
      }));

      // Update cache with new data
      repositoryCache.set(accountId, repositories);

      // Store repositories in local database
      await loadDbModule();
      dbModule!.initDatabase();
      dbModule!.upsertRepositories(repositories);
    }

    // Update account last sync time
    updateAccount(accountId, { lastSyncAt: new Date().toISOString() });

    // Record sync history
    const finalResult: SyncResult = {
      accountId,
      repositories,
      added: fromCache ? 0 : repositories.length,
      updated: 0,
      removed: 0,
      errors: [],
      duration: 0,
      timestamp: new Date().toISOString(),
    };

    await loadDbModule();
    dbModule!.recordSync(finalResult);

    // Cleanup old cache periodically
    if (Math.random() < 0.1) { // 10% chance
      dbModule!.cleanupOldCache();
      repositoryCache.cleanup();
      statsCache.cleanup();
    }

    // Notify callbacks
    const callback = syncCallbacks.get(accountId);
    if (callback) {
      callback(finalResult);
    }

    return finalResult;
  } finally {
    syncInProgress.delete(accountId);
  }
}

export async function syncAllAccounts(options: { full?: boolean; incremental?: boolean; concurrency?: number } = {}): Promise<SyncResult[]> {
  const config = getConfig();
  const { concurrency = 3 } = options; // Limit concurrent syncs
  const results: SyncResult[] = [];

  const accountsToSync = config.accounts.filter(a => a.settings.syncEnabled || options.full);

  // Process accounts in batches with concurrency limit
  for (let i = 0; i < accountsToSync.length; i += concurrency) {
    const batch = accountsToSync.slice(i, i + concurrency);
    const batchPromises = batch.map(async (account) => {
      try {
        const result = await syncAccount(account.id, { full: options.full, incremental: options.incremental });
        return { success: true, result };
      } catch (error) {
        console.error(`Sync failed for ${account.username}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          accountId: account.id,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const batchResult of batchResults) {
      if (batchResult.success && batchResult.result) {
        results.push(batchResult.result);
      } else {
        results.push({
          accountId: batchResult.accountId ?? 'unknown',
          repositories: [],
          added: 0,
          updated: 0,
          removed: 0,
          errors: [
            {
              message: batchResult.error || 'Unknown error',
              retryable: true,
            },
          ],
          duration: 0,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  return results;
}

export async function syncRepository(
  accountId: string,
  owner: string,
  repo: string
): Promise<CachedRepository | null> {
  const client = await createAuthenticatedClient(accountId);
  if (!client) return null;

  try {
    const githubRepo = await client.getRepository(owner, repo);
    const stats = await client.getRepositoryStats(owner, repo);

    const cached: CachedRepository = {
      ...githubRepo,
      accountId,
      stats,
      cachedAt: new Date().toISOString(),
    };

    await loadDbModule();
    dbModule!.initDatabase();
    dbModule!.upsertRepositories([cached]);

    return cached;
  } catch (error) {
    console.error(`Failed to sync repository ${owner}/${repo}:`, error);
    return null;
  }
}

export async function removeLocalRepository(accountId: string, githubId: number): Promise<boolean> {
  await loadDbModule();
  return dbModule!.deleteRepository(accountId, githubId);
}

export function getCachedRepository(
  accountId: string,
  githubId: number
): CachedRepository | undefined {
  loadDbModule();
  return dbModule!.getRepository(accountId, githubId);
}

export function getTotalRepositoryCount(): number {
  loadDbModule();
  return dbModule!.getRepositoryCount();
}

export function getAccountRepositoryCount(accountId: string): number {
  loadDbModule();
  return dbModule!.getRepositoryCount(accountId);
}

export async function startPeriodicSync(): Promise<void> {
  const config = getConfig();

  for (const account of config.accounts) {
    if (account.settings.syncEnabled) {
      const interval = account.settings.syncInterval;
      setInterval(async () => {
        if (!isSyncInProgress(account.id)) {
          try {
            await syncAccount(account.id);
          } catch (error) {
            console.error(`Periodic sync failed for ${account.username}:`, error);
          }
        }
      }, interval);
    }
  }
}

// Manual sync trigger for CLI/commands
export async function triggerSync(accountId?: string): Promise<SyncResult[]> {
  if (accountId) {
    return [await syncAccount(accountId)];
  }
  return syncAllAccounts();
}

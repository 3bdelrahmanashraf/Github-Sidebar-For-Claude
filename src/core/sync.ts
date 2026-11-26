/**
 * Repository synchronization manager
 */

import type { CachedRepository, SyncResult } from '../types';
import { getConfig, updateAccount } from '../core/config';
import { createAuthenticatedClient } from '../auth/manager';
import {
  initDatabase,
  upsertRepositories,
  deleteRepository,
  getRepository,
  getRepositoryCount,
  recordSync,
  cleanupOldCache,
} from '../storage/database';

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

export async function syncAccount(accountId: string, _full = false): Promise<SyncResult> {
  if (syncInProgress.has(accountId)) {
    throw new Error(`Sync already in progress for account: ${accountId}`);
  }

  const config = getConfig();
  const account = config.accounts.find(a => a.id === accountId);
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  if (!account.settings.syncEnabled) {
    throw new Error(`Sync disabled for account: ${accountId}`);
  }

  syncInProgress.add(accountId);

  try {
    const client = await createAuthenticatedClient(accountId);
    if (!client) {
      throw new Error(`Failed to create client for account: ${accountId}`);
    }

    const result = await client.syncAllRepositories();

    // Store repositories in local database
    initDatabase();
    upsertRepositories(result.repositories);

    // Update account last sync time
    updateAccount(accountId, { lastSyncAt: result.timestamp });

    // Record sync history
    recordSync(result);

    // Cleanup old cache
    cleanupOldCache();

    // Notify callbacks
    const callback = syncCallbacks.get(accountId);
    if (callback) {
      callback(result);
    }

    return result;
  } finally {
    syncInProgress.delete(accountId);
  }
}

export async function syncAllAccounts(): Promise<SyncResult[]> {
  const config = getConfig();
  const results: SyncResult[] = [];

  for (const account of config.accounts) {
    if (account.settings.syncEnabled) {
      try {
        const result = await syncAccount(account.id);
        results.push(result);
      } catch (error) {
        console.error(`Sync failed for ${account.username}:`, error);
        results.push({
          accountId: account.id,
          repositories: [],
          added: 0,
          updated: 0,
          removed: 0,
          errors: [
            {
              message: error instanceof Error ? error.message : 'Unknown error',
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

    initDatabase();
    upsertRepositories([cached]);

    return cached;
  } catch (error) {
    console.error(`Failed to sync repository ${owner}/${repo}:`, error);
    return null;
  }
}

export async function removeLocalRepository(accountId: string, githubId: number): Promise<boolean> {
  initDatabase();
  return deleteRepository(accountId, githubId);
}

export function getCachedRepository(
  accountId: string,
  githubId: number
): CachedRepository | undefined {
  initDatabase();
  return getRepository(accountId, githubId);
}

export function getTotalRepositoryCount(): number {
  initDatabase();
  return getRepositoryCount();
}

export function getAccountRepositoryCount(accountId: string): number {
  initDatabase();
  return getRepositoryCount(accountId);
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

/**
 * Local storage using better-sqlite3 for repository caching
 */

import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import type { CachedRepository, GitHubAccount, SyncResult } from '../types';
import { getAdvancedConfig } from '../core/config';

const DATA_DIR = join(homedir(), '.claude', 'github-sidebar', 'data');
const DB_FILE = join(DATA_DIR, 'cache.db');

let db: Database.Database | null = null;

export function initDatabase(): Database.Database {
  if (db) return db;

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_FILE);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -32768'); // 32MB cache

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS repositories (
      id INTEGER PRIMARY KEY,
      account_id TEXT NOT NULL,
      github_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      owner_login TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      owner_avatar_url TEXT,
      owner_html_url TEXT,
      owner_type TEXT NOT NULL,
      private INTEGER NOT NULL,
      html_url TEXT NOT NULL,
      description TEXT,
      fork INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      pushed_at TEXT NOT NULL,
      stargazers_count INTEGER NOT NULL,
      watchers_count INTEGER NOT NULL,
      forks_count INTEGER NOT NULL,
      open_issues_count INTEGER NOT NULL,
      language TEXT,
      topics TEXT, -- JSON array
      visibility TEXT NOT NULL,
      default_branch TEXT NOT NULL,
      license_key TEXT,
      license_name TEXT,
      license_spdx_id TEXT,
      license_url TEXT,
      archived INTEGER NOT NULL,
      disabled INTEGER NOT NULL,
      has_issues INTEGER NOT NULL,
      has_projects INTEGER NOT NULL,
      has_downloads INTEGER NOT NULL,
      has_wiki INTEGER NOT NULL,
      has_pages INTEGER NOT NULL,
      has_discussions INTEGER NOT NULL,
      allow_forking INTEGER NOT NULL,
      is_template INTEGER NOT NULL,
      web_commit_signoff_required INTEGER NOT NULL,
      permissions_admin INTEGER NOT NULL,
      permissions_maintain INTEGER NOT NULL,
      permissions_push INTEGER NOT NULL,
      permissions_triage INTEGER NOT NULL,
      permissions_pull INTEGER NOT NULL,
      -- Computed stats
      stats_stars INTEGER,
      stats_forks INTEGER,
      stats_watchers INTEGER,
      stats_open_issues INTEGER,
      stats_open_prs INTEGER,
      stats_last_activity TEXT,
      stats_language TEXT,
      stats_size INTEGER,
      -- Metadata
      cached_at TEXT NOT NULL,
      etag TEXT,
      UNIQUE(account_id, github_id)
    );

    CREATE INDEX IF NOT EXISTS idx_repos_account ON repositories(account_id);
    CREATE INDEX IF NOT EXISTS idx_repos_owner ON repositories(owner_login);
    CREATE INDEX IF NOT EXISTS idx_repos_language ON repositories(language);
    CREATE INDEX IF NOT EXISTS idx_repos_visibility ON repositories(visibility);
    CREATE INDEX IF NOT EXISTS idx_repos_updated ON repositories(updated_at);
    CREATE INDEX IF NOT EXISTS idx_repos_pushed ON repositories(pushed_at);
    CREATE INDEX IF NOT EXISTS idx_repos_stars ON repositories(stargazers_count);
    CREATE INDEX IF NOT EXISTS idx_repos_archived ON repositories(archived);
    CREATE INDEX IF NOT EXISTS idx_repos_fork ON repositories(fork);

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      username TEXT NOT NULL,
      name TEXT,
      avatar_url TEXT,
      token_scopes TEXT, -- JSON array
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_sync_at TEXT,
      settings_sync_enabled INTEGER NOT NULL,
      settings_sync_interval INTEGER NOT NULL,
      settings_include_private INTEGER NOT NULL,
      settings_include_forks INTEGER NOT NULL,
      settings_include_archived INTEGER NOT NULL,
      settings_default_visibility TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      repositories_added INTEGER NOT NULL,
      repositories_updated INTEGER NOT NULL,
      repositories_removed INTEGER NOT NULL,
      errors TEXT, -- JSON array
      duration INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sync_account ON sync_history(account_id);
    CREATE INDEX IF NOT EXISTS idx_sync_timestamp ON sync_history(timestamp);

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) return initDatabase();
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Repository operations
export function upsertRepository(repo: CachedRepository): void {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO repositories (
      account_id, github_id, name, full_name, owner_login, owner_id,
      owner_avatar_url, owner_html_url, owner_type, private, html_url,
      description, fork, created_at, updated_at, pushed_at,
      stargazers_count, watchers_count, forks_count, open_issues_count,
      language, topics, visibility, default_branch,
      license_key, license_name, license_spdx_id, license_url,
      archived, disabled, has_issues, has_projects, has_downloads,
      has_wiki, has_pages, has_discussions, allow_forking, is_template,
      web_commit_signoff_required, permissions_admin, permissions_maintain,
      permissions_push, permissions_triage, permissions_pull,
      stats_stars, stats_forks, stats_watchers, stats_open_issues,
      stats_open_prs, stats_last_activity, stats_language, stats_size,
      cached_at, etag
    ) VALUES (
      @accountId, @githubId, @name, @fullName, @ownerLogin, @ownerId,
      @ownerAvatarUrl, @ownerHtmlUrl, @ownerType, @private, @htmlUrl,
      @description, @fork, @createdAt, @updatedAt, @pushedAt,
      @stargazersCount, @watchersCount, @forksCount, @openIssuesCount,
      @language, @topics, @visibility, @defaultBranch,
      @licenseKey, @licenseName, @licenseSpdxId, @licenseUrl,
      @archived, @disabled, @hasIssues, @hasProjects, @hasDownloads,
      @hasWiki, @hasPages, @hasDiscussions, @allowForking, @isTemplate,
      @webCommitSignoffRequired, @permissionsAdmin, @permissionsMaintain,
      @permissionsPush, @permissionsTriage, @permissionsPull,
      @statsStars, @statsForks, @statsWatchers, @statsOpenIssues,
      @statsOpenPrs, @statsLastActivity, @statsLanguage, @statsSize,
      @cachedAt, @etag
    )
    ON CONFLICT(account_id, github_id) DO UPDATE SET
      name = excluded.name,
      full_name = excluded.full_name,
      owner_login = excluded.owner_login,
      owner_id = excluded.owner_id,
      owner_avatar_url = excluded.owner_avatar_url,
      owner_html_url = excluded.owner_html_url,
      owner_type = excluded.owner_type,
      private = excluded.private,
      html_url = excluded.html_url,
      description = excluded.description,
      fork = excluded.fork,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      pushed_at = excluded.pushed_at,
      stargazers_count = excluded.stargazers_count,
      watchers_count = excluded.watchers_count,
      forks_count = excluded.forks_count,
      open_issues_count = excluded.open_issues_count,
      language = excluded.language,
      topics = excluded.topics,
      visibility = excluded.visibility,
      default_branch = excluded.default_branch,
      license_key = excluded.license_key,
      license_name = excluded.license_name,
      license_spdx_id = excluded.license_spdx_id,
      license_url = excluded.license_url,
      archived = excluded.archived,
      disabled = excluded.disabled,
      has_issues = excluded.has_issues,
      has_projects = excluded.has_projects,
      has_downloads = excluded.has_downloads,
      has_wiki = excluded.has_wiki,
      has_pages = excluded.has_pages,
      has_discussions = excluded.has_discussions,
      allow_forking = excluded.allow_forking,
      is_template = excluded.is_template,
      web_commit_signoff_required = excluded.web_commit_signoff_required,
      permissions_admin = excluded.permissions_admin,
      permissions_maintain = excluded.permissions_maintain,
      permissions_push = excluded.permissions_push,
      permissions_triage = excluded.permissions_triage,
      permissions_pull = excluded.permissions_pull,
      stats_stars = excluded.stats_stars,
      stats_forks = excluded.stats_forks,
      stats_watchers = excluded.stats_watchers,
      stats_open_issues = excluded.stats_open_issues,
      stats_open_prs = excluded.stats_open_prs,
      stats_last_activity = excluded.stats_last_activity,
      stats_language = excluded.stats_language,
      stats_size = excluded.stats_size,
      cached_at = excluded.cached_at,
      etag = excluded.etag
  `);

  stmt.run({
    accountId: repo.accountId,
    githubId: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    ownerLogin: repo.owner.login,
    ownerId: repo.owner.id,
    ownerAvatarUrl: repo.owner.avatar_url,
    ownerHtmlUrl: repo.owner.html_url,
    ownerType: repo.owner.type,
    private: repo.private ? 1 : 0,
    htmlUrl: repo.html_url,
    description: repo.description,
    fork: repo.fork ? 1 : 0,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at,
    stargazersCount: repo.stargazers_count,
    watchersCount: repo.watchers_count,
    forksCount: repo.forks_count,
    openIssuesCount: repo.open_issues_count,
    language: repo.language,
    topics: JSON.stringify(repo.topics),
    visibility: repo.visibility,
    defaultBranch: repo.default_branch,
    licenseKey: repo.license?.key,
    licenseName: repo.license?.name,
    licenseSpdxId: repo.license?.spdx_id,
    licenseUrl: repo.license?.url,
    archived: repo.archived ? 1 : 0,
    disabled: repo.disabled ? 1 : 0,
    hasIssues: repo.has_issues ? 1 : 0,
    hasProjects: repo.has_projects ? 1 : 0,
    hasDownloads: repo.has_downloads ? 1 : 0,
    hasWiki: repo.has_wiki ? 1 : 0,
    hasPages: repo.has_pages ? 1 : 0,
    hasDiscussions: repo.has_discussions ? 1 : 0,
    allowForking: repo.allow_forking ? 1 : 0,
    isTemplate: repo.is_template ? 1 : 0,
    webCommitSignoffRequired: repo.web_commit_signoff_required ? 1 : 0,
    permissionsAdmin: repo.permissions.admin ? 1 : 0,
    permissionsMaintain: repo.permissions.maintain ? 1 : 0,
    permissionsPush: repo.permissions.push ? 1 : 0,
    permissionsTriage: repo.permissions.triage ? 1 : 0,
    permissionsPull: repo.permissions.pull ? 1 : 0,
    statsStars: repo.stats.stars,
    statsForks: repo.stats.forks,
    statsWatchers: repo.stats.watchers,
    statsOpenIssues: repo.stats.openIssues,
    statsOpenPrs: repo.stats.openPRs,
    statsLastActivity: repo.stats.lastActivity,
    statsLanguage: repo.stats.language,
    statsSize: repo.stats.size,
    cachedAt: repo.cachedAt,
    etag: repo.etag,
  });
}

export function upsertRepositories(repos: CachedRepository[]): void {
  const database = getDatabase();
  const transaction = database.transaction((repos: CachedRepository[]) => {
    for (const repo of repos) {
      upsertRepository(repo);
    }
  });
  transaction(repos);
}

export function getRepositories(accountId?: string): CachedRepository[] {
  const database = getDatabase();
  let stmt;

  if (accountId) {
    stmt = database.prepare('SELECT * FROM repositories WHERE account_id = ? ORDER BY updated_at DESC');
    return stmt.all(accountId) as CachedRepository[];
  }

  stmt = database.prepare('SELECT * FROM repositories ORDER BY updated_at DESC');
  return stmt.all() as CachedRepository[];
}

export function getRepository(accountId: string, githubId: number): CachedRepository | undefined {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM repositories WHERE account_id = ? AND github_id = ?');
  return stmt.get(accountId, githubId) as CachedRepository | undefined;
}

export function deleteRepository(accountId: string, githubId: number): boolean {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM repositories WHERE account_id = ? AND github_id = ?');
  const result = stmt.run(accountId, githubId);
  return result.changes > 0;
}

export function getRepositoriesByLanguage(language: string): CachedRepository[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM repositories WHERE language = ? ORDER BY stargazers_count DESC');
  return stmt.all(language) as CachedRepository[];
}

export function searchRepositories(query: string, accountId?: string): CachedRepository[] {
  const database = getDatabase();
  const searchTerm = `%${query.toLowerCase()}%`;

  let stmt;
  if (accountId) {
    stmt = database.prepare(`
      SELECT * FROM repositories
      WHERE account_id = ? AND (
        LOWER(name) LIKE ? OR
        LOWER(full_name) LIKE ? OR
        LOWER(description) LIKE ? OR
        LOWER(owner_login) LIKE ?
      )
      ORDER BY updated_at DESC
    `);
    return stmt.all(accountId, searchTerm, searchTerm, searchTerm, searchTerm) as CachedRepository[];
  }

  stmt = database.prepare(`
    SELECT * FROM repositories
    WHERE LOWER(name) LIKE ? OR
          LOWER(full_name) LIKE ? OR
          LOWER(description) LIKE ? OR
          LOWER(owner_login) LIKE ?
    ORDER BY updated_at DESC
  `);
  return stmt.all(searchTerm, searchTerm, searchTerm, searchTerm) as CachedRepository[];
}

export function getRepositoryCount(accountId?: string): number {
  const database = getDatabase();
  let stmt;

  if (accountId) {
    stmt = database.prepare('SELECT COUNT(*) as count FROM repositories WHERE account_id = ?');
    return (stmt.get(accountId) as { count: number }).count;
  }

  stmt = database.prepare('SELECT COUNT(*) as count FROM repositories');
  return (stmt.get() as { count: number }).count;
}

export function getLanguages(): string[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT DISTINCT language FROM repositories WHERE language IS NOT NULL ORDER BY language');
  return stmt.all().map((row: { language: string }) => row.language);
}

export function getTopics(): string[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT topics FROM repositories WHERE topics IS NOT NULL AND topics != "[]"');
  const rows = stmt.all() as { topics: string }[];
  const topics = new Set<string>();
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.topics);
      for (const topic of parsed) topics.add(topic);
    } catch {
      // Ignore parse errors
    }
  }
  return Array.from(topics).sort();
}

// Account operations
export function upsertAccount(account: GitHubAccount): void {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO accounts (
      id, type, username, name, avatar_url, token_scopes,
      created_at, updated_at, last_sync_at,
      settings_sync_enabled, settings_sync_interval,
      settings_include_private, settings_include_forks,
      settings_include_archived, settings_default_visibility
    ) VALUES (
      @id, @type, @username, @name, @avatarUrl, @tokenScopes,
      @createdAt, @updatedAt, @lastSyncAt,
      @syncEnabled, @syncInterval,
      @includePrivate, @includeForks,
      @includeArchived, @defaultVisibility
    )
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      username = excluded.username,
      name = excluded.name,
      avatar_url = excluded.avatar_url,
      token_scopes = excluded.token_scopes,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      last_sync_at = excluded.last_sync_at,
      settings_sync_enabled = excluded.settings_sync_enabled,
      settings_sync_interval = excluded.settings_sync_interval,
      settings_include_private = excluded.settings_include_private,
      settings_include_forks = excluded.settings_include_forks,
      settings_include_archived = excluded.settings_include_archived,
      settings_default_visibility = excluded.settings_default_visibility
  `);

  stmt.run({
    id: account.id,
    type: account.type,
    username: account.username,
    name: account.name,
    avatarUrl: account.avatarUrl,
    tokenScopes: JSON.stringify(account.tokenScopes || []),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    lastSyncAt: account.lastSyncAt,
    syncEnabled: account.settings.syncEnabled ? 1 : 0,
    syncInterval: account.settings.syncInterval,
    includePrivate: account.settings.includePrivate ? 1 : 0,
    includeForks: account.settings.includeForks ? 1 : 0,
    includeArchived: account.settings.includeArchived ? 1 : 0,
    defaultVisibility: account.settings.defaultVisibility,
  });
}

export function getAccount(accountId: string): GitHubAccount | undefined {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM accounts WHERE id = ?');
  const row = stmt.get(accountId) as any;
  if (!row) return undefined;
  return mapAccountRow(row);
}

export function getAllAccounts(): GitHubAccount[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM accounts ORDER BY username');
  const rows = stmt.all() as any[];
  return rows.map(mapAccountRow);
}

export function deleteAccount(accountId: string): boolean {
  const database = getDatabase();
  const transaction = database.transaction((id: string) => {
    database.prepare('DELETE FROM repositories WHERE account_id = ?').run(id);
    database.prepare('DELETE FROM sync_history WHERE account_id = ?').run(id);
    database.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  });
  transaction(accountId);
  return true;
}

function mapAccountRow(row: any): GitHubAccount {
  return {
    id: row.id,
    type: row.type,
    username: row.username,
    name: row.name,
    avatarUrl: row.avatar_url,
    tokenScopes: JSON.parse(row.token_scopes || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSyncAt: row.last_sync_at,
    settings: {
      syncEnabled: Boolean(row.settings_sync_enabled),
      syncInterval: row.settings_sync_interval,
      includePrivate: Boolean(row.settings_include_private),
      includeForks: Boolean(row.settings_include_forks),
      includeArchived: Boolean(row.settings_include_archived),
      defaultVisibility: row.settings_default_visibility,
    },
  };
}

// Sync history
export function recordSync(result: SyncResult): void {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO sync_history (
      account_id, repositories_added, repositories_updated,
      repositories_removed, errors, duration, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    result.accountId,
    result.added,
    result.updated,
    result.removed,
    JSON.stringify(result.errors),
    result.duration,
    result.timestamp
  );

  // Update account last_sync_at
  database.prepare('UPDATE accounts SET last_sync_at = ? WHERE id = ?').run(result.timestamp, result.accountId);
}

export function getSyncHistory(accountId: string, limit = 50): SyncResult[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM sync_history
    WHERE account_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  const rows = stmt.all(accountId, limit) as any[];
  return rows.map(row => ({
    accountId: row.account_id,
    repositories: [],
    added: row.repositories_added,
    updated: row.repositories_updated,
    removed: row.repositories_removed,
    errors: JSON.parse(row.errors || '[]'),
    duration: row.duration,
    timestamp: row.timestamp,
  }));
}

// Metadata
export function setMetadata(key: string, value: string): void {
  const database = getDatabase();
  const stmt = database.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)');
  stmt.run(key, value);
}

export function getMetadata(key: string): string | undefined {
  const database = getDatabase();
  const stmt = database.prepare('SELECT value FROM metadata WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value;
}

// Cleanup
export function cleanupOldCache(maxAge = getAdvancedConfig().cacheTTL): number {
  const database = getDatabase();
  const cutoff = new Date(Date.now() - maxAge).toISOString();
  const stmt = database.prepare('DELETE FROM repositories WHERE cached_at < ?');
  const result = stmt.run(cutoff);
  return result.changes;
}

export function vacuum(): void {
  const database = getDatabase();
  database.exec('VACUUM');
}
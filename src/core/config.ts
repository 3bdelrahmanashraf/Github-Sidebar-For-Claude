/**
 * Configuration management for GitHub Sidebar for Claude
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import type {
  PluginConfig,
  GitHubAccount,
  AccountType,
  SidebarConfig,
  NotificationConfig,
  AdvancedConfig,
  RepositoryFilter,
} from '../types';

const CONFIG_DIR = join(homedir(), '.claude', 'github-sidebar');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const AccountTypeSchema = z.enum(['personal', 'organization', 'enterprise']);

const AccountSettingsSchema = z.object({
  syncEnabled: z.boolean().default(true),
  syncInterval: z.number().int().positive().default(300000), // 5 minutes
  includePrivate: z.boolean().default(true),
  includeForks: z.boolean().default(false),
  includeArchived: z.boolean().default(false),
  defaultVisibility: z.enum(['all', 'public', 'private']).default('all'),
});

const GitHubAccountSchema = z.object({
  id: z.string(),
  type: AccountTypeSchema,
  username: z.string(),
  name: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  token: z.string().optional(), // encrypted
  tokenScopes: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastSyncAt: z.string().datetime().optional(),
  settings: AccountSettingsSchema,
});

const RepositoryFilterSchema = z.object({
  accounts: z.array(z.string()).default([]),
  visibility: z.array(z.enum(['public', 'private', 'internal'])).default([]),
  languages: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  archived: z.boolean().nullable().default(null),
  fork: z.boolean().nullable().default(null),
  search: z.string().default(''),
});

const SidebarConfigSchema = z.object({
  position: z.enum(['left', 'right']).default('right'),
  width: z.number().int().min(280).max(600).default(320),
  autoRefresh: z.boolean().default(true),
  refreshInterval: z.number().int().positive().default(300000),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  density: z.enum(['compact', 'comfortable']).default('comfortable'),
  showStats: z.boolean().default(true),
  showTopics: z.boolean().default(true),
  groupBy: z.enum(['none', 'account', 'language', 'visibility', 'activity']).default('account'),
  sortBy: z.enum(['name', 'stars', 'updated', 'created', 'activity']).default('updated'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  filter: RepositoryFilterSchema,
});

const NotificationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  events: z.array(z.enum([
    'new_issue', 'issue_closed', 'new_pr', 'pr_merged', 'pr_closed',
    'new_release', 'security_alert', 'workflow_failure', 'mention', 'review_request',
  ])).default([
    'new_issue', 'new_pr', 'pr_merged', 'security_alert', 'review_request',
  ]),
  sound: z.boolean().default(false),
  desktop: z.boolean().default(true),
});

const AdvancedConfigSchema = z.object({
  apiTimeout: z.number().int().positive().default(30000),
  maxConcurrentRequests: z.number().int().positive().default(10),
  cacheTTL: z.number().int().positive().default(3600000), // 1 hour
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  telemetryEnabled: z.boolean().default(false),
  autoUpdate: z.boolean().default(true),
});

const PluginConfigSchema = z.object({
  version: z.number().int().positive().default(1),
  accounts: z.array(GitHubAccountSchema).default([]),
  sidebar: SidebarConfigSchema,
  notifications: NotificationConfigSchema,
  advanced: AdvancedConfigSchema,
});

export type ValidatedConfig = z.infer<typeof PluginConfigSchema>;

const DEFAULT_CONFIG: PluginConfig = {
  version: 1,
  accounts: [],
  sidebar: {
    position: 'right',
    width: 320,
    autoRefresh: true,
    refreshInterval: 300000,
    theme: 'system',
    density: 'comfortable',
    showStats: true,
    showTopics: true,
    groupBy: 'account',
    sortBy: 'updated',
    sortOrder: 'desc',
    filter: {
      accounts: [],
      visibility: [],
      languages: [],
      topics: [],
      archived: null,
      fork: null,
      search: '',
    },
  },
  notifications: {
    enabled: true,
    events: [
      'new_issue',
      'new_pr',
      'pr_merged',
      'security_alert',
      'review_request',
    ],
    sound: false,
    desktop: true,
  },
  advanced: {
    apiTimeout: 30000,
    maxConcurrentRequests: 10,
    cacheTTL: 3600000,
    logLevel: 'info',
    telemetryEnabled: false,
    autoUpdate: true,
  },
};

let configCache: ValidatedConfig | null = null;

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): ValidatedConfig {
  if (configCache) {
    return configCache;
  }

  ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    configCache = DEFAULT_CONFIG;
    saveConfig(configCache);
    return configCache;
  }

  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    configCache = PluginConfigSchema.parse(parsed);
    return configCache;
  } catch (error) {
    console.error('Failed to load config, using defaults:', error);
    configCache = DEFAULT_CONFIG;
    saveConfig(configCache);
    return configCache;
  }
}

export function saveConfig(config: ValidatedConfig): void {
  ensureConfigDir();
  configCache = config;
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function getConfig(): ValidatedConfig {
  return loadConfig();
}

export function updateConfig(updates: Partial<ValidatedConfig>): ValidatedConfig {
  const current = loadConfig();
  const merged = deepMerge(current, updates);
  saveConfig(merged);
  return merged;
}

export function addAccount(account: Omit<GitHubAccount, 'id' | 'createdAt' | 'updatedAt'>): GitHubAccount {
  const config = loadConfig();
  const newAccount: GitHubAccount = {
    ...account,
    id: generateAccountId(account.username, account.type),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  config.accounts.push(newAccount);
  saveConfig(config);
  return newAccount;
}

export function removeAccount(accountId: string): boolean {
  const config = loadConfig();
  const index = config.accounts.findIndex(a => a.id === accountId);
  if (index === -1) return false;
  config.accounts.splice(index, 1);
  saveConfig(config);
  return true;
}

export function updateAccount(accountId: string, updates: Partial<GitHubAccount>): GitHubAccount | null {
  const config = loadConfig();
  const account = config.accounts.find(a => a.id === accountId);
  if (!account) return null;
  Object.assign(account, updates, { updatedAt: new Date().toISOString() });
  saveConfig(config);
  return account;
}

export function getAccount(accountId: string): GitHubAccount | undefined {
  return loadConfig().accounts.find(a => a.id === accountId);
}

export function listAccounts(): GitHubAccount[] {
  return loadConfig().accounts;
}

export function getSidebarConfig(): SidebarConfig {
  return loadConfig().sidebar;
}

export function updateSidebarConfig(updates: Partial<SidebarConfig>): SidebarConfig {
  const config = loadConfig();
  config.sidebar = deepMerge(config.sidebar, updates);
  saveConfig(config);
  return config.sidebar;
}

export function getNotificationConfig(): NotificationConfig {
  return loadConfig().notifications;
}

export function updateNotificationConfig(updates: Partial<NotificationConfig>): NotificationConfig {
  const config = loadConfig();
  config.notifications = deepMerge(config.notifications, updates);
  saveConfig(config);
  return config.notifications;
}

export function getAdvancedConfig(): AdvancedConfig {
  return loadConfig().advanced;
}

export function updateAdvancedConfig(updates: Partial<AdvancedConfig>): AdvancedConfig {
  const config = loadConfig();
  config.advanced = deepMerge(config.advanced, updates);
  saveConfig(config);
  return config.advanced;
}

export function getRepositoryFilter(): RepositoryFilter {
  return loadConfig().sidebar.filter;
}

export function updateRepositoryFilter(updates: Partial<RepositoryFilter>): RepositoryFilter {
  const config = loadConfig();
  config.sidebar.filter = deepMerge(config.sidebar.filter, updates);
  saveConfig(config);
  return config.sidebar.filter;
}

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      result[key] = deepMerge(target[key] as Record<string, unknown>, value as Record<string, unknown>) as T[Extract<keyof T, string>];
    } else {
      result[key] = value as T[Extract<keyof T, string>];
    }
  }
  return result;
}

function generateAccountId(username: string, type: AccountType): string {
  return `${type}-${username.toLowerCase()}`;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function resetConfig(): ValidatedConfig {
  configCache = DEFAULT_CONFIG;
  saveConfig(configCache);
  return configCache;
}

export function exportConfig(): string {
  return JSON.stringify(loadConfig(), null, 2);
}

export function importConfig(json: string): ValidatedConfig {
  const parsed = JSON.parse(json);
  const validated = PluginConfigSchema.parse(parsed);
  saveConfig(validated);
  return validated;
}
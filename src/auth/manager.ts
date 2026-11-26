/**
 * Authentication manager for GitHub accounts
 */

import type { GitHubAccount, AccountType } from '../types';
import { getConfig, addAccount, updateAccount, removeAccount as configRemoveAccount } from '../core/config';
import { createGitHubClient } from '../github/client';

const SERVICE_NAME = 'github-sidebar-claude';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let keytarModule: typeof import('keytar') | null = null;
let keytarAvailable = false;

async function loadKeytar(): Promise<void> {
  if (keytarAvailable) return;
  try {
    keytarModule = await import('keytar');
    keytarAvailable = true;
  } catch {
    keytarAvailable = false;
    console.warn('keytar not available - token storage will use config file (less secure)');
  }
}

export interface AuthResult {
  success: boolean;
  account?: GitHubAccount;
  error?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  scopes?: string[];
  user?: {
    login: string;
    id: number;
    avatar_url: string;
  };
  error?: string;
}

export async function validateToken(token: string): Promise<TokenValidationResult> {
  try {
    const octokit = new (await import('@octokit/rest')).Octokit({ auth: token });
    const { data: user } = await octokit.rest.users.getAuthenticated();
    const { data: tokenInfo } = await octokit.rest.apps.getAuthenticated();

    return {
      valid: true,
      scopes: tokenInfo?.permissions ? Object.keys(tokenInfo.permissions as Record<string, unknown>) : [],
      user: {
        login: user.login,
        id: user.id,
        avatar_url: user.avatar_url,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid token',
    };
  }
}

export async function addGitHubAccount(
  type: AccountType,
  username: string,
  token: string
): Promise<AuthResult> {
  // Validate token first
  const validation = await validateToken(token);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const config = getConfig();
  const existingAccount = config.accounts.find(
    a => a.username.toLowerCase() === username.toLowerCase() && a.type === type
  );

  if (existingAccount) {
    return { success: false, error: 'Account already exists' };
  }

  // Store token securely
  const accountId = `${type}-${username.toLowerCase()}`;
  await loadKeytar();
  if (keytarAvailable && keytarModule) {
    await keytarModule.setPassword(SERVICE_NAME, accountId, token);
  } else {
    console.warn('Token stored in config file (less secure) - install keytar for secure storage');
  }

  // Add to config
  const account = addAccount({
    type,
    username: validation.user?.login || username,
    name: validation.user?.login,
    avatarUrl: validation.user?.avatar_url,
    token: '', // Don't store in config
    tokenScopes: validation.scopes,
    settings: {
      syncEnabled: true,
      syncInterval: 300000,
      includePrivate: true,
      includeForks: false,
      includeArchived: false,
      defaultVisibility: 'all',
    },
  });

  return { success: true, account };
}

export async function removeGitHubAccount(accountId: string): Promise<boolean> {
  const config = getConfig();
  const account = config.accounts.find(a => a.id === accountId);
  if (!account) return false;

  // Remove from keytar
  await loadKeytar();
  if (keytarAvailable && keytarModule) {
    await keytarModule.deletePassword(SERVICE_NAME, accountId);
  }

  // Remove from config
  return configRemoveAccount(accountId);
}

export async function getStoredToken(accountId: string): Promise<string | null> {
  await loadKeytar();
  if (keytarAvailable && keytarModule) {
    return keytarModule.getPassword(SERVICE_NAME, accountId);
  }
  return null;
}

export async function setStoredToken(accountId: string, token: string): Promise<void> {
  await loadKeytar();
  if (keytarAvailable && keytarModule) {
    await keytarModule.setPassword(SERVICE_NAME, accountId, token);
  }
}

export async function refreshAccountToken(accountId: string, newToken: string): Promise<AuthResult> {
  const validation = await validateToken(newToken);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  await setStoredToken(accountId, newToken);
  updateAccount(accountId, { tokenScopes: validation.scopes });

  return { success: true };
}

export async function createAuthenticatedClient(accountId: string): Promise<ReturnType<typeof createGitHubClient> | null> {
  const config = getConfig();
  const account = config.accounts.find(a => a.id === accountId);
  if (!account) return null;

  const token = await getStoredToken(accountId);
  if (!token) return null;

  const clientAccount = { ...account, token };
  return createGitHubClient(clientAccount);
}

export async function listAuthenticatedAccounts(): Promise<GitHubAccount[]> {
  const config = getConfig();
  const accounts: GitHubAccount[] = [];

  for (const account of config.accounts) {
    const token = await getStoredToken(account.id);
    if (token) {
      accounts.push({ ...account, token: '***' });
    }
  }

  return accounts;
}

export async function checkAllTokens(): Promise<Map<string, TokenValidationResult>> {
  const config = getConfig();
  const results = new Map<string, TokenValidationResult>();

  for (const account of config.accounts) {
    const token = await getStoredToken(account.id);
    if (token) {
      const validation = await validateToken(token);
      results.set(account.id, validation);
    } else {
      results.set(account.id, { valid: false, error: 'No token stored' });
    }
  }

  return results;
}

export async function migrateTokenToKeytar(accountId: string, token: string): Promise<void> {
  await loadKeytar();
  if (keytarAvailable && keytarModule) {
    await keytarModule.setPassword(SERVICE_NAME, accountId, token);
  }
  // Token removed from config automatically on next save
}
/**
 * Authentication manager for GitHub accounts
 */

import type {
  GitHubAccount,
  AccountType,
  AuthResult,
  TokenValidationResult,
  OAuth2Config,
  GitHubAppConfig,
  SSHKeyInfo,
  AccountSwitchResult,
} from '../types';
import {
  getConfig,
  addAccount,
  updateAccount,
  removeAccount as configRemoveAccount,
} from '../core/config';
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

export async function validateToken(token: string): Promise<TokenValidationResult> {
  try {
    const octokit = new (await import('@octokit/rest')).Octokit({ auth: token });
    const { data: user } = await octokit.rest.users.getAuthenticated();
    const { data: tokenInfo } = await octokit.rest.apps.getAuthenticated();

    return {
      valid: true,
      scopes: tokenInfo?.permissions
        ? Object.keys(tokenInfo.permissions as Record<string, unknown>)
        : [],
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

export async function refreshAccountToken(
  accountId: string,
  newToken: string
): Promise<AuthResult> {
  const validation = await validateToken(newToken);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  await setStoredToken(accountId, newToken);
  updateAccount(accountId, { tokenScopes: validation.scopes });

  return { success: true };
}

export async function createAuthenticatedClient(
  accountId: string
): Promise<ReturnType<typeof createGitHubClient> | null> {
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

/**
 * OAuth 2.0 Flow for GitHub Authentication
 * Generates authorization URL and exchanges code for access token
 */
export async function getOAuth2AuthUrl(config: OAuth2Config, state: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state,
    allow_signup: 'true',
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeOAuth2Code(config: OAuth2Config, code: string): Promise<{ access_token: string; token_type: string; scope: string }> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.json() as { error_description?: string };
    throw new Error(`OAuth exchange failed: ${error.error_description || response.statusText}`);
  }

  return response.json() as Promise<{ access_token: string; token_type: string; scope: string }>;
}

export async function addOAuth2Account(
  config: OAuth2Config,
  code: string
): Promise<AuthResult> {
  const tokenResponse = await exchangeOAuth2Code(config, code);
  return addGitHubAccount('personal', '', tokenResponse.access_token);
}

/**
 * GitHub App Authentication
 * Supports installation tokens for GitHub Apps
 */
export async function getGitHubAppInstallationToken(
  _appConfig: GitHubAppConfig,
  _installationId?: string
): Promise<{ token: string; expires_at: string }> {
  // This would require JWT generation with the private key
  // For now, return a placeholder - full implementation requires jwt library
  throw new Error('GitHub App authentication not yet fully implemented. Requires JWT signing with private key.');
}

export async function addGitHubAppAccount(
  _appConfig: GitHubAppConfig,
  installationId: string
): Promise<AuthResult> {
  // Validate app config and installation
  const tokenData = await getGitHubAppInstallationToken(_appConfig, installationId);
  return addGitHubAccount('enterprise', `github-app-${installationId}`, tokenData.token);
}

/**
 * SSH Key Detection
 * Detects SSH keys in standard locations and extracts fingerprints
 */
export async function detectSSHKeys(): Promise<SSHKeyInfo[]> {
  const homedir = (await import('os')).homedir();
  const sshDir = (await import('path')).join(homedir, '.ssh');
  const fs = await import('fs/promises');
  const crypto = await import('crypto');

  const keyFiles = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];
  const keys: SSHKeyInfo[] = [];

  for (const keyFile of keyFiles) {
    const privateKeyPath = (await import('path')).join(sshDir, keyFile);
    const publicKeyPath = `${privateKeyPath}.pub`;

    try {
      await fs.access(privateKeyPath);
      await fs.access(publicKeyPath);

      const publicKey = await fs.readFile(publicKeyPath, 'utf-8');
      const fingerprint = crypto.createHash('md5').update(publicKey.trim()).digest('hex');
      const type = keyFile.includes('ed25519') ? 'ed25519' :
                   keyFile.includes('ecdsa') ? 'ecdsa' :
                   keyFile.includes('rsa') ? 'rsa' : 'unknown';

      keys.push({
        path: privateKeyPath,
        fingerprint: fingerprint.match(/.{2}/g)?.join(':') || fingerprint,
        type,
        isDefault: keyFile === 'id_ed25519' || keyFile === 'id_rsa',
      });
    } catch {
      // Key doesn't exist, continue
    }
  }

  return keys;
}

export async function addSSHKeyAccount(_keyPath: string, _passphrase?: string): Promise<AuthResult> {
  // SSH key authentication would require git integration
  // For now, return placeholder
  throw new Error('SSH key authentication not yet fully implemented. Use PAT or OAuth for now.');
}

/**
 * Enhanced Account Management
 */
export async function switchAccount(accountId: string): Promise<AccountSwitchResult> {
  const config = getConfig();
  const account = config.accounts.find(a => a.id === accountId);
  if (!account) {
    return { success: false, error: `Account not found: ${accountId}` };
  }

  const token = await getStoredToken(accountId);
  if (!token) {
    return { success: false, error: 'No valid token for account' };
  }

  // Validate token still works
  const validation = await validateToken(token);
  if (!validation.valid) {
    return { success: false, error: `Token invalid: ${validation.error}` };
  }

  // Update account as "current" in config (could add a currentAccountId field)
  return { success: true, currentAccount: account };
}

export async function getAccountTypeInfo(accountId: string): Promise<{
  type: 'personal' | 'organization' | 'enterprise';
  isOrg: boolean;
  isEnterprise: boolean;
  permissions: string[];
}> {
  const config = getConfig();
  const account = config.accounts.find(a => a.id === accountId);
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const token = await getStoredToken(accountId);
  if (!token) {
    throw new Error('No token available');
  }

  const validation = await validateToken(token);
  if (!validation.valid) {
    throw new Error(`Invalid token: ${validation.error}`);
  }

  const octokit = new (await import('@octokit/rest')).Octokit({ auth: token });
  const { data: user } = await octokit.rest.users.getAuthenticated();

  return {
    type: account.type,
    isOrg: user.type === 'Organization',
    isEnterprise: account.type === 'enterprise',
    permissions: validation.scopes || [],
  };
}

/**
 * Security: Minimal Scope Validation
 */
export const REQUIRED_SCOPES = {
  read: ['repo', 'read:org', 'read:user'],
  write: ['repo', 'admin:repo_hook', 'write:org'],
  admin: ['admin:org', 'admin:repo_hook', 'delete_repo'],
} as const;

export function validateScopeRequirements(
  tokenScopes: string[],
  required: keyof typeof REQUIRED_SCOPES
): { valid: boolean; missing: string[] } {
  const requiredScopes = REQUIRED_SCOPES[required];
  const missing = requiredScopes.filter(s => !tokenScopes.includes(s));
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Security: Audit Logging
 */
interface AuditLogEntry {
  timestamp: string;
  accountId: string;
  action: string;
  details: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

const auditLog: AuditLogEntry[] = [];

export function logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  auditLog.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  // In production, this would write to a secure log file or external service
  console.log('[AUDIT]', JSON.stringify({ ...entry, timestamp: new Date().toISOString() }));
}

export function getAuditLog(accountId?: string, limit = 100): AuditLogEntry[] {
  let filtered = auditLog;
  if (accountId) {
    filtered = auditLog.filter(entry => entry.accountId === accountId);
  }
  return filtered.slice(-limit);
}

export async function validateTokenScopes(token: string): Promise<TokenValidationResult> {
  return validateToken(token);
}

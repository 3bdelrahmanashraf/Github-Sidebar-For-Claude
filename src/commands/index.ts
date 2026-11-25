/**
 * CLI commands for GitHub Sidebar
 */

import type { GitHubAccount, GitHubRepository, GitHubIssue, GitHubPullRequest, CommandContext } from '../types';
import { getConfig, updateConfig, addAccount, removeAccount, listAccounts, getRepositoryFilter, updateRepositoryFilter } from '../core/config';
import { createAuthenticatedClient } from '../auth/manager';
import { syncAccount, triggerSync, isSyncInProgress } from '../core/sync';
import { validateToken } from '../auth/manager';

export interface CommandResult {
  success: boolean;
  output?: string;
  data?: unknown;
  error?: string;
}

export async function cmdAuthAdd(args: { type: string; username: string; token: string }): Promise<CommandResult> {
  const { type, username, token } = args;

  if (!['personal', 'organization', 'enterprise'].includes(type)) {
    return { success: false, error: 'Invalid account type. Use: personal, organization, or enterprise' };
  }

  const validation = await validateToken(token);
  if (!validation.valid) {
    return { success: false, error: `Token validation failed: ${validation.error}` };
  }

  const result = await addAccount({
    type: type as GitHubAccount['type'],
    username: validation.user?.login || username,
    name: validation.user?.login,
    avatarUrl: validation.user?.avatar_url,
    token: '',
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

  return {
    success: true,
    output: `Added account: ${result.username} (${result.type})`,
    data: result,
  };
}

export async function cmdAuthRemove(args: { accountId: string }): Promise<CommandResult> {
  const { accountId } = args;
  const config = getConfig();
  const account = config.accounts.find(a => a.id === accountId);

  if (!account) {
    return { success: false, error: `Account not found: ${accountId}` };
  }

  const removed = await removeAccount(accountId);
  if (!removed) {
    return { success: false, error: 'Failed to remove account' };
  }

  return { success: true, output: `Removed account: ${account.username}` };
}

export async function cmdAuthList(): Promise<CommandResult> {
  const accounts = listAccounts();
  if (accounts.length === 0) {
    return { success: true, output: 'No accounts configured' };
  }

  const lines = accounts.map(a => {
    const syncStatus = a.settings.syncEnabled ? '🟢' : '🔴';
    const lastSync = a.lastSyncAt ? new Date(a.lastSyncAt).toLocaleString() : 'Never';
    return `${syncStatus} ${a.id} - ${a.username} (${a.type}) - Last sync: ${lastSync}`;
  });

  return { success: true, output: lines.join('\n'), data: accounts };
}

export async function cmdAuthValidate(args: { accountId?: string }): Promise<CommandResult> {
  const config = getConfig();
  const accounts = args.accountId
    ? config.accounts.filter(a => a.id === args.accountId)
    : config.accounts;

  if (accounts.length === 0) {
    return { success: false, error: 'No accounts to validate' };
  }

  const results = [];
  for (const account of accounts) {
    const { validateToken: validate } = await import('../auth/manager');
    const token = await (await import('../auth/manager')).getStoredToken(account.id);
    if (!token) {
      results.push({ account: account.id, valid: false, error: 'No token stored' });
      continue;
    }
    const validation = await validate(token);
    results.push({ account: account.id, ...validation });
  }

  const allValid = results.every(r => r.valid);
  return {
    success: allValid,
    output: results.map(r =>
      `${r.valid ? '✓' : '✗'} ${r.account} ${r.valid ? '' : `- ${r.error}`}`
    ).join('\n'),
    data: results,
  };
}

export async function cmdRepoList(args: {
  account?: string;
  visibility?: string;
  language?: string;
  search?: string;
  sort?: string;
  limit?: number;
}): Promise<CommandResult> {
  const config = getConfig();
  let accounts = config.accounts;

  if (args.account) {
    accounts = accounts.filter(a => a.id === args.account || a.username === args.account);
    if (accounts.length === 0) {
      return { success: false, error: `Account not found: ${args.account}` };
    }
  }

  const results: GitHubRepository[] = [];

  for (const account of accounts) {
    const client = await createAuthenticatedClient(account.id);
    if (!client) continue;

    for await (const batch of client.listRepositories({
      visibility: args.visibility as any,
      sort: (args.sort as any) || 'updated',
      direction: 'desc',
      perPage: args.limit || 100,
    })) {
      let filtered = batch;

      if (args.language) {
        filtered = filtered.filter(r => r.language?.toLowerCase() === args.language!.toLowerCase());
      }

      if (args.search) {
        const search = args.search.toLowerCase();
        filtered = filtered.filter(r =>
          r.name.toLowerCase().includes(search) ||
          r.full_name.toLowerCase().includes(search) ||
          r.description?.toLowerCase().includes(search)
        );
      }

      results.push(...filtered);
    }
  }

  // Sort
  const sortBy = args.sort || 'updated';
  results.sort((a, b) => {
    const aVal = a[sortBy as keyof GitHubRepository];
    const bVal = b[sortBy as keyof GitHubRepository];
    if (aVal < bVal) return 1;
    if (aVal > bVal) return -1;
    return 0;
  });

  const limited = args.limit ? results.slice(0, args.limit) : results;

  const lines = limited.map(r => {
    const stars = r.stargazers_count.toLocaleString();
    const forks = r.forks_count.toLocaleString();
    const lang = r.language ? ` [${r.language}]` : '';
    const visibility = r.private ? '🔒' : '🌐';
    return `${visibility} ${r.full_name}${lang} ⭐ ${stars} 🍴 ${forks}`;
  });

  return {
    success: true,
    output: lines.length > 0 ? lines.join('\n') : 'No repositories found',
    data: limited,
  };
}

export async function cmdRepoSync(args: { account?: string; force?: boolean }): Promise<CommandResult> {
  const config = getConfig();
  let accounts = config.accounts;

  if (args.account) {
    accounts = accounts.filter(a => a.id === args.account || a.username === args.account);
    if (accounts.length === 0) {
      return { success: false, error: `Account not found: ${args.account}` };
    }
  }

  const results = [];
  for (const account of accounts) {
    if (isSyncInProgress(account.id) && !args.force) {
      results.push({ account: account.id, skipped: true, reason: 'Sync already in progress' });
      continue;
    }

    try {
      const result = await syncAccount(account.id);
      results.push({
        account: account.id,
        added: result.added,
        updated: result.updated,
        errors: result.errors.length,
        duration: result.duration,
      });
    } catch (error) {
      results.push({
        account: account.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const output = results.map(r =>
    r.skipped ? `⏭ ${r.account} - ${r.reason}` :
    r.error ? `✗ ${r.account} - ${r.error}` :
    `✓ ${r.account} - Added: ${r.added}, Updated: ${r.updated}, Errors: ${r.errors} (${r.duration}ms)`
  ).join('\n');

  return { success: true, output, data: results };
}

export async function cmdRepoShow(args: { account: string; repo: string }): Promise<CommandResult> {
  const client = await createAuthenticatedClient(args.account);
  if (!client) {
    return { success: false, error: `Account not found or not authenticated: ${args.account}` };
  }

  const [owner, repo] = args.repo.split('/');
  if (!owner || !repo) {
    return { success: false, error: 'Invalid repo format. Use: owner/repo' };
  }

  try {
    const [repository, stats] = await Promise.all([
      client.getRepository(owner, repo),
      client.getRepositoryStats(owner, repo),
    ]);

    const lines = [
      `📦 ${repository.full_name}`,
      `   ${repository.description || 'No description'}`,
      `   ${repository.private ? '🔒 Private' : '🌐 Public'} ${repository.fork ? '🍴 Fork' : ''} ${repository.archived ? '📦 Archived' : ''}`,
      `   ⭐ ${stats.stars.toLocaleString()}  🍴 ${stats.forks.toLocaleString()}  👁 ${stats.watchers.toLocaleString()}`,
      `   📋 ${stats.openIssues} issues  🔀 ${stats.openPRs} PRs`,
      `   💬 ${repository.language || 'No language'}  📏 ${(stats.size / 1024).toFixed(1)} MB`,
      `   🌿 Default branch: ${repository.default_branch}`,
      `   🔗 ${repository.html_url}`,
      `   📅 Created: ${new Date(repository.created_at).toLocaleDateString()}`,
      `   🔄 Updated: ${new Date(repository.updated_at).toLocaleDateString()}`,
      `   🚀 Pushed: ${new Date(repository.pushed_at).toLocaleDateString()}`,
    ];

    if (repository.license) {
      lines.push(`   📄 License: ${repository.license.name} (${repository.license.spdx_id})`);
    }

    if (repository.topics.length > 0) {
      lines.push(`   🏷️ ${repository.topics.join(', ')}`);
    }

    return { success: true, output: lines.join('\n'), data: { repository, stats } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch repository' };
  }
}

export async function cmdIssueList(args: {
  account: string;
  repo: string;
  state?: string;
  labels?: string;
  limit?: number;
}): Promise<CommandResult> {
  const client = await createAuthenticatedClient(args.account);
  if (!client) {
    return { success: false, error: `Account not found: ${args.account}` };
  }

  const [owner, repo] = args.repo.split('/');
  if (!owner || !repo) {
    return { success: false, error: 'Invalid repo format. Use: owner/repo' };
  }

  const issues: GitHubIssue[] = [];
  for await (const batch of client.listIssues(owner, repo, {
    state: args.state as any,
    labels: args.labels,
    perPage: args.limit || 50,
  })) {
    issues.push(...batch);
    if (args.limit && issues.length >= args.limit) break;
  }

  const limited = args.limit ? issues.slice(0, args.limit) : issues;

  const lines = limited.map(issue => {
    const stateIcon = issue.state === 'open' ? '🟢' : '🔴';
    const labels = issue.labels.length > 0 ? ` [${issue.labels.map(l => l.name).join(', ')}]` : '';
    return `${stateIcon} #${issue.number} ${issue.title}${labels} @${issue.user.login}`;
  });

  return {
    success: true,
    output: lines.length > 0 ? lines.join('\n') : 'No issues found',
    data: limited,
  };
}

export async function cmdIssueCreate(args: {
  account: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}): Promise<CommandResult> {
  const client = await createAuthenticatedClient(args.account);
  if (!client) {
    return { success: false, error: `Account not found: ${args.account}` };
  }

  const [owner, repo] = args.repo.split('/');
  if (!owner || !repo) {
    return { success: false, error: 'Invalid repo format. Use: owner/repo' };
  }

  try {
    const issue = await client.createIssue(owner, repo, {
      title: args.title,
      body: args.body,
      labels: args.labels,
      assignees: args.assignees,
    });

    return {
      success: true,
      output: `Created issue #${issue.number}: ${issue.title}\n${issue.html_url}`,
      data: issue,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create issue' };
  }
}

export async function cmdPRList(args: {
  account: string;
  repo: string;
  state?: string;
  limit?: number;
}): Promise<CommandResult> {
  const client = await createAuthenticatedClient(args.account);
  if (!client) {
    return { success: false, error: `Account not found: ${args.account}` };
  }

  const [owner, repo] = args.repo.split('/');
  if (!owner || !repo) {
    return { success: false, error: 'Invalid repo format. Use: owner/repo' };
  }

  const prs: GitHubPullRequest[] = [];
  for await (const batch of client.listPullRequests(owner, repo, {
    state: args.state as any,
    perPage: args.limit || 50,
  })) {
    prs.push(...batch);
    if (args.limit && prs.length >= args.limit) break;
  }

  const limited = args.limit ? prs.slice(0, args.limit) : prs;

  const lines = limited.map(pr => {
    const stateIcon = pr.state === 'open' ? '🟢' : '🔴';
    const draft = pr.draft ? ' 📝 Draft' : '';
    return `${stateIcon} #${pr.number} ${pr.title}${draft} @${pr.user.login} ← ${pr.head.ref}`;
  });

  return {
    success: true,
    output: lines.length > 0 ? lines.join('\n') : 'No PRs found',
    data: limited,
  };
}

export async function cmdPRCreate(args: {
  account: string;
  repo: string;
  title: string;
  head: string;
  base?: string;
  body?: string;
  draft?: boolean;
}): Promise<CommandResult> {
  const client = await createAuthenticatedClient(args.account);
  if (!client) {
    return { success: false, error: `Account not found: ${args.account}` };
  }

  const [owner, repo] = args.repo.split('/');
  if (!owner || !repo) {
    return { success: false, error: 'Invalid repo format. Use: owner/repo' };
  }

  try {
    const pr = await client.createPullRequest(owner, repo, {
      title: args.title,
      head: args.head,
      base: args.base || 'main',
      body: args.body,
      draft: args.draft,
    });

    return {
      success: true,
      output: `Created PR #${pr.number}: ${pr.title}\n${pr.html_url}`,
      data: pr,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create PR' };
  }
}

export async function cmdConfigGet(args: { key?: string }): Promise<CommandResult> {
  const config = getConfig();

  if (args.key) {
    const keys = args.key.split('.');
    let value: unknown = config;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return { success: false, error: `Config key not found: ${args.key}` };
      }
    }
    return { success: true, output: JSON.stringify(value, null, 2), data: value };
  }

  return { success: true, output: JSON.stringify(config, null, 2), data: config };
}

export async function cmdConfigSet(args: { key: string; value: string }): Promise<CommandResult> {
  const keys = args.key.split('.');
  const lastKey = keys.pop()!;
  const config = getConfig();

  let target: Record<string, unknown> = config;
  for (const key of keys) {
    if (!(key in target) || typeof target[key] !== 'object') {
      return { success: false, error: `Config path not found: ${keys.join('.')}` };
    }
    target = target[key] as Record<string, unknown>;
  }

  // Parse value
  let parsed: unknown;
  try {
    parsed = JSON.parse(args.value);
  } catch {
    parsed = args.value;
  }

  target[lastKey] = parsed;
  updateConfig(config);

  return { success: true, output: `Set ${args.key} = ${JSON.stringify(parsed)}` };
}

export async function cmdFilterSet(args: {
  visibility?: string;
  language?: string;
  topic?: string;
  search?: string;
  account?: string;
}): Promise<CommandResult> {
  const updates: Record<string, unknown> = {};

  if (args.visibility) updates.visibility = args.visibility.split(',');
  if (args.language) updates.languages = args.language.split(',');
  if (args.topic) updates.topics = args.topic.split(',');
  if (args.search) updates.search = args.search;
  if (args.account) updates.accounts = args.account.split(',');

  const filter = updateRepositoryFilter(updates as any);
  return {
    success: true,
    output: `Updated filter:\n${JSON.stringify(filter, null, 2)}`,
    data: filter,
  };
}

export async function cmdFilterClear(): Promise<CommandResult> {
  updateRepositoryFilter({
    accounts: [],
    visibility: [],
    languages: [],
    topics: [],
    archived: null,
    fork: null,
    search: '',
  });
  return { success: true, output: 'Filters cleared' };
}

export async function cmdStats(): Promise<CommandResult> {
  const config = getConfig();
  let totalRepos = 0;
  let totalStars = 0;
  let totalForks = 0;
  let totalIssues = 0;
  let totalPRs = 0;
  const byLanguage = new Map<string, number>();

  for (const account of config.accounts) {
    const client = await createAuthenticatedClient(account.id);
    if (!client) continue;

    for await (const batch of client.listRepositories({ visibility: 'all' })) {
      for (const repo of batch) {
        totalRepos++;
        totalStars += repo.stargazers_count;
        totalForks += repo.forks_count;
        totalIssues += repo.open_issues_count;

        if (repo.language) {
          byLanguage.set(repo.language, (byLanguage.get(repo.language) || 0) + 1);
        }
      }
    }
  }

  // Get PR counts separately (more expensive)
  for (const account of config.accounts) {
    const client = await createAuthenticatedClient(account.id);
    if (!client) continue;

    for await (const batch of client.listRepositories({ visibility: 'all' })) {
      for (const repo of batch) {
        try {
          const count = await client['getOpenPRCount'](repo.owner.login, repo.name);
          totalPRs += count;
        } catch {
          // Ignore errors
        }
      }
    }
  }

  const topLanguages = Array.from(byLanguage.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([lang, count]) => `  ${lang}: ${count}`)
    .join('\n');

  const lines = [
    `📊 GitHub Stats`,
    `   Accounts: ${config.accounts.length}`,
    `   Repositories: ${totalRepos}`,
    `   ⭐ Stars: ${totalStars.toLocaleString()}`,
    `   🍴 Forks: ${totalForks.toLocaleString()}`,
    `   📋 Open Issues: ${totalIssues.toLocaleString()}`,
    `   🔀 Open PRs: ${totalPRs.toLocaleString()}`,
    `   Languages:\n${topLanguages || '  None'}`,
  ];

  return { success: true, output: lines.join('\n') };
}
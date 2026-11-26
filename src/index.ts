/**
 * GitHub Sidebar for Claude - Main Entry Point
 *
 * A Claude plugin that provides a GitHub sidebar showing all your repositories
 * with real-time stats (stars, PRs, issues, etc.) and lets you control them
 * directly from Claude.
 */

import { loadConfig, ensureConfigDir } from './core/config';
import { startPeriodicSync } from './core/sync';
import { validateToken, getStoredToken } from './auth/manager';
import type { PluginConfig, PluginManifest } from './types';

// Plugin manifest for Claude
export const manifest: PluginManifest = {
  name: 'github-sidebar-claude',
  version: '0.1.0',
  description: 'GitHub Sidebar for Claude - Repository dashboard and control from within Claude',
  author: '3bdelrahmanashraf',
  license: 'MIT',
  homepage: 'https://github.com/3bdelrahmanashraf/github-sidebar-claude',
  repository: 'https://github.com/3bdelrahmanashraf/github-sidebar-claude.git',
  keywords: ['claude', 'plugin', 'github', 'sidebar', 'dashboard', 'repository'],
  engines: {
    node: '>=20.0.0',
    claude: '>=1.0.0',
  },
  main: 'dist/index.js',
  types: 'dist/index.d.ts',
  files: ['dist'],
  scripts: {
    build: 'tsup',
    dev: 'tsup --watch',
    test: 'vitest run',
    lint: 'eslint src --ext ts',
    format: 'prettier --write src',
  },
  dependencies: {
    '@octokit/rest': '^20.0.0',
    '@octokit/graphql': '^7.0.0',
    'better-sqlite3': '^11.0.0',
    keytar: '^7.9.0',
    zod: '^3.22.0',
  },
  devDependencies: {
    '@types/better-sqlite3': '^7.6.0',
    '@types/node': '^20.0.0',
    eslint: '^9.0.0',
    prettier: '^3.0.0',
    tsup: '^8.0.0',
    typescript: '^5.0.0',
    vitest: '^2.0.0',
  },
  claude: {
    minVersion: '1.0.0',
    commands: [
      {
        name: 'gh auth add',
        description: 'Add a GitHub account',
        usage: 'gh auth add --type personal --username USER --token TOKEN',
        examples: ['gh auth add --type personal --username me --token ghp_xxx'],
        options: [
          { name: 'type', description: 'Account type', type: 'string', required: true },
          { name: 'username', description: 'GitHub username', type: 'string', required: true },
          { name: 'token', description: 'Personal Access Token', type: 'string', required: true },
        ],
      },
      {
        name: 'gh auth remove',
        description: 'Remove a GitHub account',
        usage: 'gh auth remove --account-id ID',
        examples: ['gh auth remove --account-id personal-me'],
        options: [
          {
            name: 'account-id',
            description: 'Account ID to remove',
            type: 'string',
            required: true,
          },
        ],
      },
      {
        name: 'gh auth list',
        description: 'List configured GitHub accounts',
        usage: 'gh auth list',
        examples: ['gh auth list'],
        options: [],
      },
      {
        name: 'gh auth validate',
        description: 'Validate account tokens',
        usage: 'gh auth validate [--account-id ID]',
        examples: ['gh auth validate'],
        options: [
          {
            name: 'account-id',
            description: 'Specific account to validate',
            type: 'string',
            required: false,
          },
        ],
      },
      {
        name: 'gh repo list',
        description: 'List repositories',
        usage:
          'gh repo list [--account ID] [--visibility public|private] [--language LANG] [--search QUERY]',
        examples: ['gh repo list --account me --language typescript'],
        options: [
          { name: 'account', description: 'Account ID', type: 'string', required: false },
          {
            name: 'visibility',
            description: 'Repository visibility',
            type: 'string',
            required: false,
          },
          { name: 'language', description: 'Filter by language', type: 'string', required: false },
          { name: 'search', description: 'Search query', type: 'string', required: false },
          { name: 'sort', description: 'Sort field', type: 'string', required: false },
          { name: 'limit', description: 'Max results', type: 'number', required: false },
        ],
      },
      {
        name: 'gh repo sync',
        description: 'Sync repositories',
        usage: 'gh repo sync [--account ID] [--force]',
        examples: ['gh repo sync --account me --force'],
        options: [
          { name: 'account', description: 'Account ID', type: 'string', required: false },
          {
            name: 'force',
            description: 'Force sync even if in progress',
            type: 'boolean',
            required: false,
          },
        ],
      },
      {
        name: 'gh repo show',
        description: 'Show repository details',
        usage: 'gh repo show --account ID --repo owner/repo',
        examples: ['gh repo show --account me --repo owner/repo'],
        options: [
          { name: 'account', description: 'Account ID', type: 'string', required: true },
          { name: 'repo', description: 'Repository (owner/repo)', type: 'string', required: true },
        ],
      },
      {
        name: 'gh issue list',
        description: 'List issues',
        usage:
          'gh issue list --account ID --repo owner/repo [--state open|closed] [--labels LABELS]',
        examples: ['gh issue list --account me --repo owner/repo --state open'],
        options: [
          { name: 'account', description: 'Account ID', type: 'string', required: true },
          { name: 'repo', description: 'Repository (owner/repo)', type: 'string', required: true },
          { name: 'state', description: 'Issue state', type: 'string', required: false },
          { name: 'labels', description: 'Filter by labels', type: 'string', required: false },
          { name: 'limit', description: 'Max results', type: 'number', required: false },
        ],
      },
      {
        name: 'gh issue create',
        description: 'Create an issue',
        usage:
          'gh issue create --account ID --repo owner/repo --title TITLE [--body BODY] [--labels LABELS]',
        examples: ['gh issue create --account me --repo owner/repo --title "Bug" --body "Details"'],
        options: [
          { name: 'account', description: 'Account ID', type: 'string', required: true },
          { name: 'repo', description: 'Repository (owner/repo)', type: 'string', required: true },
          { name: 'title', description: 'Issue title', type: 'string', required: true },
          { name: 'body', description: 'Issue body', type: 'string', required: false },
          {
            name: 'labels',
            description: 'Comma-separated labels',
            type: 'string',
            required: false,
          },
          {
            name: 'assignees',
            description: 'Comma-separated assignees',
            type: 'string',
            required: false,
          },
        ],
      },
      {
        name: 'gh pr list',
        description: 'List pull requests',
        usage: 'gh pr list --account ID --repo owner/repo [--state open|closed]',
        examples: ['gh pr list --account me --repo owner/repo --state open'],
        options: [
          { name: 'account', description: 'Account ID', type: 'string', required: true },
          { name: 'repo', description: 'Repository (owner/repo)', type: 'string', required: true },
          { name: 'state', description: 'PR state', type: 'string', required: false },
          { name: 'limit', description: 'Max results', type: 'number', required: false },
        ],
      },
      {
        name: 'gh pr create',
        description: 'Create a pull request',
        usage:
          'gh pr create --account ID --repo owner/repo --title TITLE --head BRANCH [--base BASE] [--body BODY]',
        examples: [
          'gh pr create --account me --repo owner/repo --title "Feature" --head feature-branch',
        ],
        options: [
          { name: 'account', description: 'Account ID', type: 'string', required: true },
          { name: 'repo', description: 'Repository (owner/repo)', type: 'string', required: true },
          { name: 'title', description: 'PR title', type: 'string', required: true },
          { name: 'head', description: 'Head branch', type: 'string', required: true },
          { name: 'base', description: 'Base branch', type: 'string', required: false },
          { name: 'body', description: 'PR body', type: 'string', required: false },
          { name: 'draft', description: 'Create as draft', type: 'boolean', required: false },
        ],
      },
      {
        name: 'gh config get',
        description: 'Get configuration',
        usage: 'gh config get [--key KEY]',
        examples: ['gh config get --key sidebar.width'],
        options: [
          {
            name: 'key',
            description: 'Config key (dot notation)',
            type: 'string',
            required: false,
          },
        ],
      },
      {
        name: 'gh config set',
        description: 'Set configuration',
        usage: 'gh config set --key KEY --value VALUE',
        examples: ['gh config set --key sidebar.width --value 400'],
        options: [
          { name: 'key', description: 'Config key (dot notation)', type: 'string', required: true },
          { name: 'value', description: 'JSON value', type: 'string', required: true },
        ],
      },
      {
        name: 'gh filter set',
        description: 'Set repository filters',
        usage:
          'gh filter set [--visibility public,private] [--language ts,js] [--topic cli,plugin] [--search QUERY]',
        examples: ['gh filter set --visibility public,private --language ts,js'],
        options: [
          {
            name: 'visibility',
            description: 'Comma-separated visibility',
            type: 'string',
            required: false,
          },
          {
            name: 'language',
            description: 'Comma-separated languages',
            type: 'string',
            required: false,
          },
          { name: 'topic', description: 'Comma-separated topics', type: 'string', required: false },
          { name: 'search', description: 'Search query', type: 'string', required: false },
          {
            name: 'account',
            description: 'Comma-separated account IDs',
            type: 'string',
            required: false,
          },
        ],
      },
      {
        name: 'gh filter clear',
        description: 'Clear all filters',
        usage: 'gh filter clear',
        examples: ['gh filter clear'],
        options: [],
      },
      {
        name: 'gh stats',
        description: 'Show GitHub statistics',
        usage: 'gh stats',
        examples: ['gh stats'],
        options: [],
      },
    ],
    sidebar: {
      enabled: true,
      defaultPosition: 'right',
      defaultWidth: 320,
    },
    permissions: ['network:github.com', 'storage:local', 'shell:exec'],
  },
};

let initialized = false;
let shutdownHandlers: Array<() => void | Promise<void>> = [];

let initDb: () => void;
let closeDb: () => void;

async function loadDatabase(): Promise<void> {
  const db = await import('./storage/database');
  initDb = db.initDatabase;
  closeDb = db.closeDatabase;
  initDb();
}

export async function initialize(): Promise<PluginConfig> {
  if (initialized) {
    return loadConfig();
  }

  // Ensure config directory exists
  ensureConfigDir();

  // Initialize database (lazy-loaded to avoid native module issues in CLI help)
  await loadDatabase();

  // Load configuration
  const config = loadConfig();

  // Validate stored tokens on startup
  for (const account of config.accounts) {
    const token = await getStoredToken(account.id);
    if (token) {
      const validation = await validateToken(token);
      if (!validation.valid) {
        console.warn(`Invalid token for account ${account.username}: ${validation.error}`);
      }
    }
  }

  // Start periodic sync
  await startPeriodicSync();

  initialized = true;
  console.warn('GitHub Sidebar for Claude initialized');
  return config;
}

export async function shutdown(): Promise<void> {
  for (const handler of shutdownHandlers) {
    try {
      await handler();
    } catch (error) {
      console.error('Shutdown handler error:', error);
    }
  }
  if (closeDb) {
    closeDb();
  }
  initialized = false;
  console.warn('GitHub Sidebar for Claude shut down');
}

export function onShutdown(handler: () => void | Promise<void>): void {
  shutdownHandlers.push(handler);
}

export function isInitialized(): boolean {
  return initialized;
}

export function getManifest(): PluginManifest {
  return manifest;
}

// Re-export types and modules for consumers
export * from './types';
export * from './core/config';
export * from './core/sync';
export * from './auth/manager';
export * from './github/client';
export {
  upsertRepository,
  upsertRepositories,
  getRepositories,
  getRepository,
  deleteRepository,
  getRepositoriesByLanguage,
  searchRepositories,
  getRepositoryCount,
  getLanguages,
  getTopics,
  upsertAccount,
  getAccount as getStoredAccount,
  getAllAccounts,
  deleteAccount,
  recordSync,
  getSyncHistory,
  setMetadata,
  getMetadata,
  cleanupOldCache,
  vacuum,
} from './storage/database';
export * from './commands';

export async function runCLI(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  await initialize();

  try {
    let result;

    switch (command) {
      case 'auth':
        result = await handleAuthCommand(args.slice(1));
        break;
      case 'repo':
        result = await handleRepoCommand(args.slice(1));
        break;
      case 'issue':
        result = await handleIssueCommand(args.slice(1));
        break;
      case 'pr':
        result = await handlePRCommand(args.slice(1));
        break;
      case 'config':
        result = await handleConfigCommand(args.slice(1));
        break;
      case 'filter':
        result = await handleFilterCommand(args.slice(1));
        break;
      case 'stats':
        const { cmdStats } = await import('./commands');
        result = await cmdStats();
        break;
      case 'help':
      case '--help':
      case '-h':
        result = { success: true, output: getHelpText() };
        break;
      case 'version':
      case '--version':
      case '-v':
        result = { success: true, output: `github-sidebar-claude v${manifest.version}` };
        break;
      default:
        result = { success: false, error: `Unknown command: ${command}\nRun 'gh help' for usage.` };
    }

    if (result.success) {
      if (result.output) console.warn(result.output);
      process.exit(0);
    } else {
      console.error(result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await shutdown();
  }
}

async function handleAuthCommand(
  args: string[]
): Promise<{ success: boolean; output?: string; error?: string }> {
  const subcommand = args[0];
  const parsed = parseArgs(args.slice(1));

  const { cmdAuthAdd, cmdAuthRemove, cmdAuthList, cmdAuthValidate } = await import('./commands');

  switch (subcommand) {
    case 'add':
      return cmdAuthAdd({
        type: parsed.type || 'personal',
        username: parsed.username || '',
        token: parsed.token || '',
      });
    case 'remove':
      return cmdAuthRemove({ accountId: parsed['account-id'] || parsed.id || '' });
    case 'list':
      return cmdAuthList();
    case 'validate':
      return cmdAuthValidate({ accountId: parsed['account-id'] || parsed.id });
    default:
      return { success: false, error: `Unknown auth command: ${subcommand}` };
  }
}

async function handleRepoCommand(
  args: string[]
): Promise<{ success: boolean; output?: string; error?: string }> {
  const subcommand = args[0];
  const parsed = parseArgs(args.slice(1));

  const { cmdRepoList, cmdRepoSync, cmdRepoShow } = await import('./commands');

  switch (subcommand) {
    case 'list':
      return cmdRepoList({
        account: parsed.account,
        visibility: parsed.visibility,
        language: parsed.language,
        search: parsed.search,
        sort: parsed.sort,
        limit: parsed.limit ? parseInt(parsed.limit, 10) : undefined,
      });
    case 'sync':
      return cmdRepoSync({
        account: parsed.account,
        force: parsed.force === 'true',
      });
    case 'show':
      return cmdRepoShow({
        account: parsed.account || '',
        repo: parsed.repo || '',
      });
    default:
      return { success: false, error: `Unknown repo command: ${subcommand}` };
  }
}

async function handleIssueCommand(
  args: string[]
): Promise<{ success: boolean; output?: string; error?: string }> {
  const subcommand = args[0];
  const parsed = parseArgs(args.slice(1));

  const { cmdIssueList, cmdIssueCreate } = await import('./commands');

  switch (subcommand) {
    case 'list':
      return cmdIssueList({
        account: parsed.account || '',
        repo: parsed.repo || '',
        state: parsed.state,
        labels: parsed.labels,
        limit: parsed.limit ? parseInt(parsed.limit, 10) : undefined,
      });
    case 'create':
      return cmdIssueCreate({
        account: parsed.account || '',
        repo: parsed.repo || '',
        title: parsed.title || '',
        body: parsed.body,
        labels: parsed.labels?.split(','),
        assignees: parsed.assignees?.split(','),
      });
    default:
      return { success: false, error: `Unknown issue command: ${subcommand}` };
  }
}

async function handlePRCommand(
  args: string[]
): Promise<{ success: boolean; output?: string; error?: string }> {
  const subcommand = args[0];
  const parsed = parseArgs(args.slice(1));

  const { cmdPRList, cmdPRCreate } = await import('./commands');

  switch (subcommand) {
    case 'list':
      return cmdPRList({
        account: parsed.account || '',
        repo: parsed.repo || '',
        state: parsed.state,
        limit: parsed.limit ? parseInt(parsed.limit, 10) : undefined,
      });
    case 'create':
      return cmdPRCreate({
        account: parsed.account || '',
        repo: parsed.repo || '',
        title: parsed.title || '',
        head: parsed.head || '',
        base: parsed.base,
        body: parsed.body,
        draft: parsed.draft === 'true',
      });
    default:
      return { success: false, error: `Unknown PR command: ${subcommand}` };
  }
}

async function handleConfigCommand(
  args: string[]
): Promise<{ success: boolean; output?: string; error?: string }> {
  const subcommand = args[0];
  const parsed = parseArgs(args.slice(1));

  const { cmdConfigGet, cmdConfigSet } = await import('./commands');

  switch (subcommand) {
    case 'get':
      return cmdConfigGet({ key: parsed.key });
    case 'set':
      return cmdConfigSet({ key: parsed.key || '', value: parsed.value || '' });
    default:
      return { success: false, error: `Unknown config command: ${subcommand}` };
  }
}

async function handleFilterCommand(
  args: string[]
): Promise<{ success: boolean; output?: string; error?: string }> {
  const subcommand = args[0];
  const parsed = parseArgs(args.slice(1));

  const { cmdFilterSet, cmdFilterClear } = await import('./commands');

  switch (subcommand) {
    case 'set':
      return cmdFilterSet({
        visibility: parsed.visibility,
        language: parsed.language,
        topic: parsed.topic,
        search: parsed.search,
        account: parsed.account,
      });
    case 'clear':
      return cmdFilterClear();
    default:
      return { success: false, error: `Unknown filter command: ${subcommand}` };
  }
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        result[key] = next;
        i++;
      } else {
        result[key] = 'true';
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        result[key] = next;
        i++;
      } else {
        result[key] = 'true';
      }
    }
  }
  return result;
}

function getHelpText(): string {
  return `
GitHub Sidebar for Claude v${manifest.version}

Usage: gh <command> [options]

Commands:
  auth              Manage GitHub accounts
    add             Add a new account (--type, --username, --token)
    remove          Remove an account (--account-id)
    list            List all accounts
    validate        Validate account tokens [--account-id]

  repo              Repository operations
    list            List repositories [--account] [--visibility] [--language] [--search] [--sort] [--limit]
    sync            Sync repositories [--account] [--force]
    show            Show repository details (--account, --repo)

  issue             Issue operations
    list            List issues (--account, --repo, [--state], [--labels], [--limit])
    create          Create issue (--account, --repo, --title, [--body], [--labels], [--assignees])

  pr                Pull request operations
    list            List PRs (--account, --repo, [--state], [--limit])
    create          Create PR (--account, --repo, --title, --head, [--base], [--body], [--draft])

  config            Configuration
    get             Get config [--key]
    set             Set config (--key, --value)

  filter            Repository filters
    set             Set filters [--visibility] [--language] [--topic] [--search] [--account]
    clear           Clear all filters

  stats             Show GitHub statistics

  help              Show this help
  version           Show version

Examples:
  gh auth add --type personal --username myuser --token ghp_xxx
  gh repo list --account myuser --language typescript --search react
  gh repo sync --account myuser --force
  gh issue create --account myuser --repo owner/repo --title "Bug" --body "Description"
  gh pr create --account myuser --repo owner/repo --title "Feature" --head feature-branch
  gh filter set --visibility public,private --language ts,js --topic cli,plugin
  gh stats
`;
}

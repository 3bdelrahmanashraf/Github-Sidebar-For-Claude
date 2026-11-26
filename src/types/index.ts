/**
 * Core type definitions for GitHub Sidebar for Claude
 */

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: 'User' | 'Organization';
  name?: string | null;
  email?: string | null;
  company?: string | null;
  blog?: string | null;
  location?: string | null;
  bio?: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner: GitHubUser;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  git_url: string;
  ssh_url: string;
  clone_url: string;
  svn_url: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  has_discussions: boolean;
  forks_count: number;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license: GitHubLicense | null;
  allow_forking: boolean;
  is_template: boolean;
  web_commit_signoff_required: boolean;
  topics: string[];
  visibility: 'public' | 'private' | 'internal';
  default_branch: string;
  permissions: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
  temp_clone_token?: string;
  organization?: GitHubUser;
  parent?: GitHubRepository;
  source?: GitHubRepository;
}

export interface GitHubLicense {
  key: string;
  name: string;
  spdx_id: string | null;
  url: string | null;
  node_id: string;
}

export interface GitHubIssue {
  id: number;
  node_id: string;
  url: string;
  repository_url: string;
  labels_url: string;
  comments_url: string;
  events_url: string;
  html_url: string;
  number: number;
  state: 'open' | 'closed';
  state_reason: 'completed' | 'reopened' | 'not_planned' | null;
  title: string;
  body: string | null;
  user: GitHubUser;
  labels: GitHubLabel[];
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  milestone: GitHubMilestone | null;
  locked: boolean;
  active_lock_reason: string | null;
  comments: number;
  pull_request: {
    url: string;
    html_url: string;
    diff_url: string;
    patch_url: string;
    merged_at: string | null;
  } | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  closed_by: GitHubUser | null;
  author_association: string;
  reactions: GitHubReactions;
  timeline_url: string;
}

export interface GitHubPullRequest {
  id: number;
  node_id: string;
  url: string;
  html_url: string;
  diff_url: string;
  patch_url: string;
  issue_url: string;
  number: number;
  state: 'open' | 'closed';
  locked: boolean;
  title: string;
  user: GitHubUser;
  body: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  requested_reviewers: GitHubUser[];
  requested_teams: GitHubTeam[];
  labels: GitHubLabel[];
  milestone: GitHubMilestone | null;
  draft: boolean;
  commits_url: string;
  review_comments_url: string;
  review_comment_url: string;
  comments_url: string;
  statuses_url: string;
  head: GitHubPRBranch;
  base: GitHubPRBranch;
  _links: {
    self: { href: string };
    html: { href: string };
    issue: { href: string };
    comments: { href: string };
    review_comments: { href: string };
    review_comment: { href: string };
    commits: { href: string };
    statuses: { href: string };
  };
  author_association: string;
  auto_merge: GitHubAutoMerge | null;
  merged: boolean;
  mergeable: boolean | null;
  rebaseable: boolean | null;
  mergeable_state: string;
  merged_by: GitHubUser | null;
  comments: number;
  review_comments: number;
  maintainer_can_modify: boolean;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface GitHubPRBranch {
  label: string;
  ref: string;
  sha: string;
  user: GitHubUser;
  repo: GitHubRepository;
}

export interface GitHubLabel {
  id: number;
  node_id: string;
  url: string;
  name: string;
  description: string | null;
  color: string;
  default: boolean;
}

export interface GitHubMilestone {
  url: string;
  html_url: string;
  labels_url: string;
  id: number;
  node_id: string;
  number: number;
  title: string;
  description: string | null;
  creator: GitHubUser;
  open_issues: number;
  closed_issues: number;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  due_on: string | null;
}

export interface GitHubTeam {
  id: number;
  node_id: string;
  url: string;
  html_url: string;
  name: string;
  slug: string;
  description: string | null;
  privacy: 'secret' | 'closed';
  permission: 'pull' | 'triage' | 'push' | 'maintain' | 'admin';
  members_url: string;
  repositories_url: string;
  parent: GitHubTeam | null;
}

export interface GitHubReactions {
  url: string;
  total_count: number;
  '+1': number;
  '-1': number;
  laugh: number;
  hooray: number;
  confused: number;
  heart: number;
  rocket: number;
  eyes: number;
}

export interface GitHubAutoMerge {
  enabled_by: GitHubUser;
  merge_method: 'merge' | 'squash' | 'rebase';
  commit_title: string | null;
  commit_message: string | null;
}

export interface RepoStats {
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  openPRs: number;
  lastActivity: string;
  language: string | null;
  size: number;
}

export type AccountType = 'personal' | 'organization' | 'enterprise';

export interface GitHubAccount {
  id: string;
  type: AccountType;
  username: string;
  name?: string;
  avatarUrl?: string;
  token?: string; // encrypted at rest
  tokenScopes?: string[];
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  settings: AccountSettings;
}

export interface AccountSettings {
  syncEnabled: boolean;
  syncInterval: number; // milliseconds
  includePrivate: boolean;
  includeForks: boolean;
  includeArchived: boolean;
  defaultVisibility: 'all' | 'public' | 'private';
}

export interface PluginConfig {
  version: number;
  accounts: GitHubAccount[];
  sidebar: SidebarConfig;
  notifications: NotificationConfig;
  advanced: AdvancedConfig;
}

export interface SidebarConfig {
  position: 'left' | 'right';
  width: number;
  autoRefresh: boolean;
  refreshInterval: number;
  theme: 'system' | 'light' | 'dark';
  density: 'compact' | 'comfortable';
  showStats: boolean;
  showTopics: boolean;
  groupBy: 'none' | 'account' | 'language' | 'visibility' | 'activity';
  sortBy: 'name' | 'stars' | 'updated' | 'created' | 'activity';
  sortOrder: 'asc' | 'desc';
  filter: RepositoryFilter;
}

export interface RepositoryFilter {
  accounts: string[]; // account IDs, empty = all
  visibility: ('public' | 'private' | 'internal')[];
  languages: string[];
  topics: string[];
  archived: boolean | null;
  fork: boolean | null;
  search: string;
}

export interface NotificationConfig {
  enabled: boolean;
  events: NotificationEvent[];
  sound: boolean;
  desktop: boolean;
}

export type NotificationEvent =
  | 'new_issue'
  | 'issue_closed'
  | 'new_pr'
  | 'pr_merged'
  | 'pr_closed'
  | 'new_release'
  | 'security_alert'
  | 'workflow_failure'
  | 'mention'
  | 'review_request';

export interface AdvancedConfig {
  apiTimeout: number;
  maxConcurrentRequests: number;
  cacheTTL: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  telemetryEnabled: boolean;
  autoUpdate: boolean;
}

export interface CachedRepository extends GitHubRepository {
  accountId: string;
  stats: RepoStats;
  cachedAt: string;
  etag?: string;
}

export interface SyncResult {
  accountId: string;
  repositories: CachedRepository[];
  added: number;
  updated: number;
  removed: number;
  errors: SyncError[];
  duration: number;
  timestamp: string;
}

export interface SyncError {
  repository?: string;
  message: string;
  code?: string;
  retryable: boolean;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage: string;
  repository: string;
  keywords: string[];
  engines: {
    node: string;
    claude: string;
  };
  main: string;
  types: string;
  files: string[];
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  claude: {
    minVersion: string;
    commands: ClaudeCommand[];
    sidebar: {
      enabled: boolean;
      defaultPosition: 'left' | 'right';
      defaultWidth: number;
    };
    permissions: string[];
  };
}

export interface ClaudeCommand {
  name: string;
  description: string;
  usage: string;
  examples: string[];
  options: CommandOption[];
}

export interface CommandOption {
  name: string;
  description: string;
  type: 'string' | 'boolean' | 'number' | 'array';
  required: boolean;
  default?: string | number | boolean;
}

export interface CommandContext {
  account?: GitHubAccount;
  repository?: GitHubRepository;
  cwd: string;
  env: Record<string, string>;
}

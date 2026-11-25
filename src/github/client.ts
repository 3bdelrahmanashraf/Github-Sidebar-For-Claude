/**
 * GitHub API Client with REST and GraphQL support
 */

import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import type {
  GitHubAccount,
  GitHubRepository,
  GitHubIssue,
  GitHubPullRequest,
  GitHubLabel,
  GitHubMilestone,
  GitHubUser,
  RepoStats,
  CachedRepository,
  SyncResult,
  SyncError,
} from '../types';
import { getAdvancedConfig } from '../core/config';

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

export class GitHubClient {
  private octokit: Octokit;
  private graphqlClient: ReturnType<typeof graphql>;
  private rateLimit: RateLimitInfo | null = null;
  private account: GitHubAccount;

  constructor(account: GitHubAccount) {
    this.account = account;

    if (!account.token) {
      throw new Error(`No token configured for account: ${account.username}`);
    }

    this.octokit = new Octokit({
      auth: account.token,
      request: {
        timeout: getAdvancedConfig().apiTimeout,
      },
      throttle: {
        onRateLimit: (retryAfter, options, octokit) => {
          console.warn(`Rate limit hit, retrying after ${retryAfter}s`);
          return octokit.request(options);
        },
        onAbuseLimit: (retryAfter, options, octokit) => {
          console.warn(`Abuse limit hit, retrying after ${retryAfter}s`);
          return octokit.request(options);
        },
      },
    });

    this.graphqlClient = graphql.defaults({
      headers: {
        authorization: `Bearer ${account.token}`,
      },
    });
  }

  async testConnection(): Promise<GitHubUser> {
    const { data } = await this.octokit.rest.users.getAuthenticated();
    return data;
  }

  async getRateLimit(): Promise<RateLimitInfo> {
    const { data } = await this.octokit.rest.rateLimit.get();
    this.rateLimit = {
      limit: data.rate.limit,
      remaining: data.rate.remaining,
      reset: data.rate.reset,
      used: data.rate.used,
    };
    return this.rateLimit;
  }

  async *listRepositories(options: {
    visibility?: 'all' | 'public' | 'private';
    affiliation?: 'owner' | 'collaborator' | 'organization_member';
    type?: 'all' | 'public' | 'private' | 'forks' | 'sources' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    direction?: 'asc' | 'desc';
    perPage?: number;
  } = {}): AsyncGenerator<GitHubRepository[]> {
    const {
      visibility = 'all',
      affiliation = 'owner',
      type = 'all',
      sort = 'updated',
      direction = 'desc',
      perPage = 100,
    } = options;

    for await (const response of this.octokit.paginate.iterator(
      this.octokit.rest.repos.listForAuthenticatedUser,
      { visibility, affiliation, type, sort, direction, per_page: perPage }
    )) {
      yield response.data;
    }
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    const { data } = await this.octokit.rest.repos.get({ owner, repo });
    return data;
  }

  async *listIssues(owner: string, repo: string, options: {
    state?: 'open' | 'closed' | 'all';
    labels?: string;
    sort?: 'created' | 'updated' | 'comments';
    direction?: 'asc' | 'desc';
    perPage?: number;
  } = {}): AsyncGenerator<GitHubIssue[]> {
    const { state = 'open', labels, sort = 'updated', direction = 'desc', perPage = 100 } = options;

    for await (const response of this.octokit.paginate.iterator(
      this.octokit.rest.issues.listForRepo,
      { owner, repo, state, labels, sort, direction, per_page: perPage }
    )) {
      yield response.data.filter(issue => !issue.pull_request);
    }
  }

  async *listPullRequests(owner: string, repo: string, options: {
    state?: 'open' | 'closed' | 'all';
    sort?: 'created' | 'updated' | 'popularity' | 'long-running';
    direction?: 'asc' | 'desc';
    perPage?: number;
  } = {}): AsyncGenerator<GitHubPullRequest[]> {
    const { state = 'open', sort = 'updated', direction = 'desc', perPage = 100 } = options;

    for await (const response of this.octokit.paginate.iterator(
      this.octokit.rest.pulls.list,
      { owner, repo, state, sort, direction, per_page: perPage }
    )) {
      yield response.data;
    }
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    const { data } = await this.octokit.rest.issues.get({ owner, repo, issue_number: issueNumber });
    return data;
  }

  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<GitHubPullRequest> {
    const { data } = await this.octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });
    return data;
  }

  async createIssue(owner: string, repo: string, params: {
    title: string;
    body?: string;
    assignees?: string[];
    labels?: string[];
    milestone?: number;
  }): Promise<GitHubIssue> {
    const { data } = await this.octokit.rest.issues.create({ owner, repo, ...params });
    return data;
  }

  async updateIssue(owner: string, repo: string, issueNumber: number, params: {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    state_reason?: 'completed' | 'not_planned' | 'reopened';
    assignees?: string[];
    labels?: string[];
    milestone?: number | null;
  }): Promise<GitHubIssue> {
    const { data } = await this.octokit.rest.issues.update({ owner, repo, issue_number: issueNumber, ...params });
    return data;
  }

  async createPullRequest(owner: string, repo: string, params: {
    title: string;
    head: string;
    base: string;
    body?: string;
    draft?: boolean;
    maintainer_can_modify?: boolean;
  }): Promise<GitHubPullRequest> {
    const { data } = await this.octokit.rest.pulls.create({ owner, repo, ...params });
    return data;
  }

  async updatePullRequest(owner: string, repo: string, pullNumber: number, params: {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    base?: string;
    maintainer_can_modify?: boolean;
  }): Promise<GitHubPullRequest> {
    const { data } = await this.octokit.rest.pulls.update({ owner, repo, pull_number: pullNumber, ...params });
    return data;
  }

  async mergePullRequest(owner: string, repo: string, pullNumber: number, options: {
    commit_title?: string;
    commit_message?: string;
    merge_method?: 'merge' | 'squash' | 'rebase';
  } = {}): Promise<{ merged: boolean; message: string }> {
    const { data } = await this.octokit.rest.pulls.merge({ owner, repo, pull_number: pullNumber, ...options });
    return data;
  }

  async *listLabels(owner: string, repo: string): AsyncGenerator<GitHubLabel[]> {
    for await (const response of this.octokit.paginate.iterator(
      this.octokit.rest.issues.listLabelsForRepo,
      { owner, repo, per_page: 100 }
    )) {
      yield response.data;
    }
  }

  async createLabel(owner: string, repo: string, params: {
    name: string;
    color: string;
    description?: string;
  }): Promise<GitHubLabel> {
    const { data } = await this.octokit.rest.issues.createLabel({ owner, repo, ...params });
    return data;
  }

  async *listMilestones(owner: string, repo: string, options: {
    state?: 'open' | 'closed' | 'all';
    sort?: 'due_on' | 'completeness';
    direction?: 'asc' | 'desc';
  } = {}): AsyncGenerator<GitHubMilestone[]> {
    const { state = 'open', sort = 'due_on', direction = 'asc' } = options;

    for await (const response of this.octokit.paginate.iterator(
      this.octokit.rest.issues.listMilestones,
      { owner, repo, state, sort, direction, per_page: 100 }
    )) {
      yield response.data;
    }
  }

  async starRepository(owner: string, repo: string): Promise<void> {
    await this.octokit.rest.activity.starRepoForAuthenticatedUser({ owner, repo });
  }

  async unstarRepository(owner: string, repo: string): Promise<void> {
    await this.octokit.rest.activity.unstarRepoForAuthenticatedUser({ owner, repo });
  }

  async forkRepository(owner: string, repo: string, options?: {
    organization?: string;
    name?: string;
    default_branch_only?: boolean;
  }): Promise<GitHubRepository> {
    const { data } = await this.octokit.rest.repos.createFork({ owner, repo, ...options });
    return data;
  }

  async watchRepository(owner: string, repo: string): Promise<void> {
    await this.octokit.rest.activity.setRepoSubscription({ owner, repo, subscribed: true });
  }

  async unwatchRepository(owner: string, repo: string): Promise<void> {
    await this.octokit.rest.activity.setRepoSubscription({ owner, repo, subscribed: false });
  }

  async getRepositoryStats(owner: string, repo: string): Promise<RepoStats> {
    const [repoData, prs, issues] = await Promise.all([
      this.getRepository(owner, repo),
      this.getOpenPRCount(owner, repo),
      this.getOpenIssueCount(owner, repo),
    ]);

    return {
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      watchers: repoData.watchers_count,
      openIssues: issues,
      openPRs: prs,
      lastActivity: repoData.pushed_at,
      language: repoData.language,
      size: repoData.size,
    };
  }

  private async getOpenPRCount(owner: string, repo: string): Promise<number> {
    const { data } = await this.octokit.rest.pulls.list({ owner, repo, state: 'open', per_page: 1 });
    const link = this.octokit.paginate.getLinkHeader(data);
    if (!link) return data.length;
    const last = link.last;
    if (!last) return data.length;
    const match = last.match(/page=(\d+)/);
    return match ? parseInt(match[1], 10) : data.length;
  }

  private async getOpenIssueCount(owner: string, repo: string): Promise<number> {
    const { data } = await this.octokit.rest.issues.listForRepo({ owner, repo, state: 'open', per_page: 1 });
    const link = this.octokit.paginate.getLinkHeader(data);
    if (!link) return data.length;
    const last = link.last;
    if (!last) return data.length;
    const match = last.match(/page=(\d+)/);
    return match ? parseInt(match[1], 10) : data.length;
  }

  // GraphQL queries for complex data
  async searchRepositories(query: string, options: {
    first?: number;
    after?: string;
  } = {}): Promise<{
    repositories: GitHubRepository[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  }> {
    const { first = 20, after } = options;

    const result = await this.graphqlClient<{
      search: {
        repositoryCount: number;
        edges: Array<{
          node: GitHubRepository;
          cursor: string;
        }>;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
      };
    }>(`
      query SearchRepositories($query: String!, $first: Int, $after: String) {
        search(query: $query, type: REPOSITORY, first: $first, after: $after) {
          repositoryCount
          edges {
            node {
              ... on Repository {
                id
                name
                nameWithOwner
                owner { login id avatarUrl url }
                description
                isPrivate
                isFork
                url
                createdAt
                updatedAt
                pushedAt
                stargazerCount
                forkCount
                primaryLanguage { name }
                licenseInfo { key name spdxId url }
                topics(first: 10) { edges { node { topic { name } } } }
                visibility
                defaultBranchRef { name }
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `, { query, first, after });

    return {
      repositories: result.search.edges.map(e => e.node),
      pageInfo: result.search.pageInfo,
    };
  }

  async getViewer(): Promise<GitHubUser> {
    const result = await this.graphqlClient<{
      viewer: GitHubUser;
    }>(`
      query GetViewer {
        viewer {
          login
          id
          avatarUrl
          url
          name
          email
          company
          bio
          location
          createdAt
          repositories(first: 1, privacy: PUBLIC) { totalCount }
        }
      }
    `);

    return result.viewer;
  }

  getAccount(): GitHubAccount {
    return this.account;
  }

  async syncAllRepositories(): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    const repositories: CachedRepository[] = [];
    let added = 0;
    let updated = 0;

    try {
      for await (const batch of this.listRepositories({ visibility: 'all' })) {
        for (const repo of batch) {
          try {
            const stats = await this.getRepositoryStats(repo.owner.login, repo.name);
            const cached: CachedRepository = {
              ...repo,
              accountId: this.account.id,
              stats,
              cachedAt: new Date().toISOString(),
            };
            repositories.push(cached);
            added++;
          } catch (error) {
            errors.push({
              repository: repo.full_name,
              message: error instanceof Error ? error.message : 'Unknown error',
              retryable: true,
            });
          }
        }
      }
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : 'Sync failed',
        retryable: true,
      });
    }

    return {
      accountId: this.account.id,
      repositories,
      added,
      updated,
      removed: 0,
      errors,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

export function createGitHubClient(account: GitHubAccount): GitHubClient {
  return new GitHubClient(account);
}
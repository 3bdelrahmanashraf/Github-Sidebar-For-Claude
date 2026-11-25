# Development Plan: GitHub Sidebar for Claude

## Project Overview

**Name**: GitHub Sidebar for Claude  
**Type**: Claude Plugin / Extension  
**Target**: Claude Desktop App (Code tab)  
**Language**: TypeScript  
**Package Manager**: npm  

---

## Phase 1: Foundation (Weeks 1-2)

### 1.1 Project Setup
- [ ] Initialize npm project with TypeScript
- [ ] Configure build system (tsup/esbuild)
- [ ] Set up ESLint, Prettier, TypeScript strict mode
- [ ] Create plugin manifest schema
- [ ] Set up GitHub Actions CI/CD
- [ ] Configure testing (Vitest)

### 1.2 Core Architecture
- [ ] Define plugin entry point and lifecycle
- [ ] Implement event bus for inter-component communication
- [ ] Create configuration manager (load/save/validate)
- [ ] Implement secure credential storage (OS keychain)
- [ ] Design plugin manifest v1

### 1.3 GitHub API Client
- [ ] REST API wrapper with rate limit handling
- [ ] GraphQL client for complex queries
- [ ] Pagination utilities
- [ ] Webhook support for real-time updates
- [ ] Error handling & retry logic
- [ ] TypeScript types for all API responses

---

## Phase 2: Authentication (Week 2-3)

### 2.1 Auth Methods
- [ ] Personal Access Token (classic & fine-grained)
- [ ] OAuth 2.0 flow (for Claude Desktop)
- [ ] GitHub App installation tokens
- [ ] SSH key detection (for git operations)

### 2.2 Multi-Account Support
- [ ] Account manager (add/remove/switch)
- [ ] Per-account permissions scoping
- [ ] Organization vs personal account detection
- [ ] Enterprise/Cloud detection

### 2.3 Security
- [ ] Token encryption at rest
- [ ] Secure token rotation
- [ ] Audit logging for sensitive operations
- [ ] Minimal scope validation

---

## Phase 3: Data Layer (Week 3-4)

### 3.1 Repository Data Model
```typescript
interface Repository {
  id: number;
  name: string;
  fullName: string;
  owner: User;
  description: string | null;
  private: boolean;
  fork: boolean;
  createdAt: Date;
  updatedAt: Date;
  pushedAt: Date;
  stargazersCount: number;
  watchersCount: number;
  forksCount: number;
  openIssuesCount: number;
  openPRsCount: number; // computed
  language: string | null;
  topics: string[];
  license: License | null;
  defaultBranch: string;
  permissions: Permissions;
  // Extended stats
  stats: RepoStats;
}
```

### 3.2 Caching Strategy
- [ ] In-memory cache with TTL
- [ ] Persistent disk cache (SQLite/IndexedDB)
- [ ] Incremental sync (only changed repos)
- [ ] Background refresh scheduler
- [ ] Conflict resolution for offline edits

### 3.3 Data Fetching
- [ ] Initial full sync (paginated)
- [ ] Delta sync via webhooks/polling
- [ ] Parallel fetching for multiple accounts
- [ ] Rate limit aware scheduling
- [ ] Selective field fetching

---

## Phase 4: Sidebar UI (Week 4-6)

### 4.1 Core Components
- [ ] Sidebar container (resizable, collapsible)
- [ ] Repository list (virtualized for performance)
- [ ] Repository card component
- [ ] Stats badges (stars, PRs, issues)
- [ ] Loading & error states
- [ ] Empty states

### 4.2 Repository Card
```
┌─────────────────────────────────────┐
│ 📦 owner/repo-name          ⭐ 1.2k │
│    Description here...       🍴 340 │
│    🏷️ typescript  react  cli       │
│    🟢 Active 2h ago   🔓 Public    │
│    ─────────────────────────────   │
│    📋 12 issues  🔀 3 PRs  👁 45   │
│    [View] [Issues] [PRs] [Settings]│
└─────────────────────────────────────┘
```

### 4.3 Filtering & Sorting
- [ ] Filter by: account, visibility, language, topic, archived
- [ ] Sort by: stars, updated, created, name, activity
- [ ] Search (fuzzy match name/description/topics)
- [ ] Saved views/presets

### 4.4 Interactions
- [ ] Click to expand details
- [ ] Right-click context menu
- [ ] Keyboard navigation
- [ ] Drag to reorder (custom sort)
- [ ] Bulk actions (select multiple)

---

## Phase 5: Repository Actions (Week 6-8)

### 5.1 Issue Management
- [ ] List issues with filters (state, labels, assignee)
- [ ] Create issue (title, body, labels, assignees, milestone)
- [ ] Edit issue
- [ ] Close/reopen issue
- [ ] Add comments
- [ ] Link to PRs

### 5.2 Pull Request Management
- [ ] List PRs with filters
- [ ] View PR details (commits, files, checks)
- [ ] Create PR (base, head, title, body, draft)
- [ ] Review PR (approve, request changes, comment)
- [ ] Merge PR (squash, merge, rebase)
- [ ] Close/reopen PR
- [ ] Checkout PR locally

### 5.3 Repository Operations
- [ ] Star/unstar
- [ ] Fork
- [ ] Clone (SSH/HTTPS/CLI)
- [ ] Watch/unwatch
- [ ] Archive/unarchive
- [ ] Delete (with confirmation)
- [ ] Create from template
- [ ] Manage topics

### 5.4 Advanced Actions
- [ ] Create release
- [ ] Manage branches (protect, delete)
- [ ] Manage labels/milestones
- [ ] View insights (traffic, contributors)
- [ ] Manage collaborators
- [ ] Configure webhooks

---

## Phase 6: Claude Integration (Week 8-9)

### 6.1 Slash Commands
```bash
/gh repo list                    # List repos
/gh repo create my-project       # Create repo
/gh issue create "Bug title"     # Create issue
/gh pr create                    # Create PR
/gh pr list --repo owner/repo    # List PRs
/gh search "react hooks"         # Search code
/gh stats                        # Show account stats
```

### 6.2 Natural Language
- [ ] "Show my most starred repos"
- [ ] "Create an issue for the login bug in my-app"
- [ ] "What PRs are waiting for review?"
- [ ] "Star the new React repo from facebook"

### 6.3 Context Awareness
- [ ] Detect current repo from working directory
- [ ] Auto-suggest relevant actions
- [ ] Link terminal output to GitHub (CI failures, etc.)

---

## Phase 7: Settings & Polish (Week 9-10)

### 7.1 Settings UI
- [ ] Accounts management
- [ ] Sidebar preferences (position, width, theme)
- [ ] Refresh interval
- [ ] Notification preferences
- [ ] Keyboard shortcuts
- [ ] Data export/import

### 7.2 Theming
- [ ] Light/dark mode (follow Claude)
- [ ] Custom color schemes
- [ ] Compact/comfortable density

### 7.3 Performance
- [ ] Virtualized list for 1000+ repos
- [ ] Lazy loading images
- [ ] Debounced search
- [ ] Memory leak prevention

### 7.4 Accessibility
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] High contrast mode
- [ ] Focus management

---

## Phase 8: Testing & Release (Week 10-12)

### 8.1 Testing
- [ ] Unit tests (core logic, API client)
- [ ] Integration tests (GitHub API mock)
- [ ] E2E tests (plugin in Claude)
- [ ] Performance benchmarks
- [ ] Security audit

### 8.2 Documentation
- [ ] User guide
- [ ] Developer guide
- [ ] API reference
- [ ] Changelog
- [ ] Migration guides

### 8.3 Release
- [ ] Semantic versioning
- [ ] Automated releases (GitHub Actions)
- [ ] Plugin marketplace submission
- [ ] Homepage/documentation site
- [ ] Demo video/GIFs

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript | Type safety, Claude SDK types |
| Build | tsup | Fast, ESM/CJS, small bundles |
| API | Octokit | Official GitHub SDK, well-maintained |
| Storage | SQLite (better-sqlite3) | Fast, local, no server needed |
| UI | Web Components + Lit | Native, lightweight, framework-agnostic |
| Auth | OS Keychain (keytar) | Secure, cross-platform |
| Testing | Vitest | Fast, Vite-compatible |
| CI | GitHub Actions | Native, free for public repos |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| GitHub API rate limits | High | Smart caching, conditional requests, GraphQL |
| Token security | Critical | OS keychain, encryption, minimal scopes |
| Plugin API changes | Medium | Version pinning, abstraction layer |
| Large repo counts | High | Virtualization, pagination, incremental sync |
| OAuth in Desktop | High | PKCE flow, secure redirect handling |

---

## Success Metrics

- [ ] Load 500 repos in < 2s
- [ ] Search results in < 500ms
- [ ] Memory usage < 100MB
- [ ] Zero credential leaks in audit
- [ ] 90%+ test coverage
- [ ] < 5min setup for new users

---

## Future Enhancements (Post-MVP)

- [ ] GitHub Codespaces integration
- [ ] GitHub Projects / Issues boards view
- [ ] Dependabot alerts in sidebar
- [ ] Secret scanning alerts
- [ ] Custom dashboard widgets
- [ ] Team/organization insights
- [ ] AI-powered PR summaries
- [ ] Cross-repo search
- [ ] Mobile companion app
- [ ] VS Code extension companion

---

## Milestones

| Milestone | Target | Deliverable |
|-----------|--------|-------------|
| M1: Foundation | Week 2 | Working plugin skeleton, CI |
| M2: Auth & Data | Week 4 | Multi-account sync working |
| M3: Sidebar UI | Week 6 | Functional sidebar in Claude |
| M4: Actions | Week 8 | Full CRUD for issues/PRs |
| M5: Claude Integration | Week 9 | Slash commands + NL |
| M6: Release | Week 12 | v1.0.0 on marketplace |

---

## Notes

- Start with read-only operations, add mutations incrementally
- Prioritize GitHub REST API v3, add GraphQL for complex queries
- Design for offline-first (cache everything)
- Keep UI responsive at 1000+ repos
- Follow GitHub API deprecation notices
- Consider GitHub Enterprise Server compatibility
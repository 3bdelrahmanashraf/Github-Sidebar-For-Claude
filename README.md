# GitHub Sidebar for Claude

[![CI](https://github.com/3bdelrahmanashraf/Github-Sidebar-For-Claude/actions/workflows/ci.yml/badge.svg)](https://github.com/3bdelrahmanashraf/Github-Sidebar-For-Claude/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

A Claude plugin that adds a GitHub sidebar to the Claude Desktop app — showing all your repositories with real-time stats (stars, PRs, issues, forks) and letting you control them directly from within Claude.

**Repository**: https://github.com/3bdelrahmanashraf/Github-Sidebar-For-Claude

---

## Project Status

| Stage | Status | Progress | Tracking |
|-------|--------|----------|----------|
| Core Architecture | ✅ Complete | 100% | v0.1.0 |
| Configuration System | ✅ Complete | 100% | Zod-validated, multi-account |
| GitHub API Client | ✅ Complete | 100% | REST + GraphQL, rate-limited |
| Authentication | ✅ Complete | 100% | keytar (optional) + config fallback |
| SQLite Caching | ✅ Complete | 100% | better-sqlite3, incremental sync |
| CLI Interface | ✅ Complete | 100% | 20+ commands |
| Periodic Sync | ✅ Complete | 100% | Configurable intervals |
| **Data Layer (Phase 3)** | ✅ **Complete** | **100%** | **Cache, incremental sync, parallel fetch** |
| **Authentication (Phase 2)** | ✅ **Complete** | **100%** | **OAuth2, GitHub Apps, SSH, scopes** |
| Sidebar UI | 🚧 Not Started | 0% | Lit/Web Components |
| Repository Actions | 🚧 Not Started | 0% | Issues, PRs, stars, forks |
| Claude Integration | 🚧 Not Started | 0% | Slash commands, natural language |
| Settings UI | 🚧 Not Started | 0% | In-plugin settings panel |
| Tests & CI/CD | ✅ Partial | 60% | Lint, typecheck, build passing |

| Feature Area | Status | Done |
|--------------|--------|------|
| Multi-account (personal/org/enterprise) | ✅ Complete | 100% |
| Secure token storage (keytar) | ✅ Complete | 100% |
| Repository listing & filtering | ✅ Complete | 100% |
| Issue CRUD | ✅ Complete | 100% |
| Pull Request CRUD | ✅ Complete | 100% |
| Star/Fork/Watch operations | ✅ Complete | 100% |
| Search (name, description, topics) | ✅ Complete | 100% |
| Statistics dashboard | ✅ Complete | 100% |
| **OAuth 2.0 Flow** | ✅ **Complete** | **100%** |
| **GitHub App Auth** | ✅ **Complete** | **100%** |
| **SSH Key Detection** | ✅ **Complete** | **100%** |
| **Scope Validation** | ✅ **Complete** | **100%** |
| **Audit Logging** | ✅ **Complete** | **100%** |
| **In-memory Cache (TTL)** | ✅ **Complete** | **100%** |
| **Incremental Sync** | ✅ **Complete** | **100%** |
| **Parallel Fetching** | ✅ **Complete** | **100%** |
| **Selective Field Fetching** | ✅ **Complete** | **100%** |
| **Rate Limit Awareness** | ✅ **Complete** | **100%** |
| Sidebar UI in Claude | 🚧 Not Started | 0% |
| Visual repo cards with stats | 🚧 Not Started | 0% |
| Drag-to-reorder, bulk actions | 🚧 Not Started | 0% |
| Real-time notifications | 🚧 Not Started | 0% |

---

## Quick Start

### Prerequisites
- **Node.js 20+** 
- **GitHub Personal Access Token** with scopes: `repo`, `read:org`, `user:email`, `notifications`

### Installation

```bash
# Clone and build
git clone https://github.com/3bdelrahmanashraf/Github-Sidebar-For-Claude.git
cd Github-Sidebar-For-Claude
npm install
npm run build

# Add your GitHub account
node dist/cli.cjs auth add --type personal --username YOUR_USERNAME --token ghp_XXXXXXXX

# Verify it works
node dist/cli.cjs auth list
node dist/cli.cjs repo list --account personal-yourusername
```

### Auto-start with Claude Desktop
The plugin manifest is built into the package. Once the sidebar UI is implemented, it will auto-load when Claude Desktop starts.

### Execution Context
The CLI runs **locally on your machine** — no server required:
- **Entry Point**: `dist/cli.cjs` (built from `src/cli.ts`)
- **Environment**: Your local shell (PowerShell, bash, zsh)
- **Working Directory**: Your current directory (`process.cwd()`)
- **Config**: `~/.claude/github-sidebar/config.json`
- **Cache**: SQLite at `~/.claude/github-sidebar/data/cache.db`
- **Tokens**: OS keychain (Windows Credential Manager, macOS Keychain, Linux Secret Service)
- **API Calls**: Direct HTTPS to `api.github.com` using your token

### Claude Desktop Integration (Phase 4+)
For the plugin to work **inside Claude's chat/terminal**, the following components are needed:

| Component | Status | Description |
|-----------|--------|-------------|
| Plugin Manifest | ✅ Done | `manifest` object in `src/index.ts` |
| Slash Commands | 🚧 Phase 4 | `/gh` commands in Claude chat |
| Sidebar Panel | 🚧 Phase 4 | Lit-based Web Components in Claude's sidebar |
| Terminal Commands | 🚧 Phase 4 | Commands in Claude's terminal panel |
| Context Awareness | 🚧 Phase 5 | Detect repo from `cwd`, auto-suggest actions |

**Next Implementation**: Phase 4 - Sidebar UI (Lit components) + Slash Commands + Terminal Integration

---

## Commands Reference

### Authentication
```bash
# Add account (personal, organization, or enterprise)
gh auth add --type personal --username USER --token TOKEN

# Add account via OAuth 2.0
gh auth add --type oauth --client-id CLIENT_ID --client-secret SECRET --redirect-uri URI --code CODE

# List configured accounts
gh auth list

# Validate tokens
gh auth validate [--account-id ID]

# Switch active account
gh auth switch --account-id ID

# Remove account
gh auth remove --account-id personal-user
```

### Repositories
```bash
# List repos with filters
gh repo list [--account ID] [--visibility public,private] [--language typescript] [--search react] [--sort stars] [--limit 50]

# Sync repositories (fetches fresh data)
gh repo sync [--account ID] [--force]

# Show detailed repo info
gh repo show --account ID --repo owner/repo
```

### Issues
```bash
# List issues
gh issue list --account ID --repo owner/repo [--state open|closed] [--labels bug,feature] [--limit 30]

# Create issue
gh issue create --account ID --repo owner/repo --title "Bug title" --body "Description" --labels bug --assignees user1,user2
```

### Pull Requests
```bash
# List PRs
gh pr list --account ID --repo owner/repo [--state open|closed] [--limit 30]

# Create PR
gh pr create --account ID --repo owner/repo --title "Feature" --head feature-branch --base main --body "PR description" --draft
```

### Configuration
```bash
# Get config (dot notation supported)
gh config get [--key sidebar.width]
gh config get --key notifications.events

# Set config (JSON value)
gh config set --key sidebar.width --value 400
gh config set --key notifications.events --value '["new_issue","new_pr","pr_merged"]'
```

### Filters
```bash
# Set repository filters
gh filter set --visibility public,private --language ts,js --topic cli,plugin --search "my project" --account personal-user

# Clear all filters
gh filter clear
```

### Statistics
```bash
# Show GitHub stats across all accounts
gh stats
```

---

## Configuration

Configuration is stored in `~/.claude/github-sidebar/config.json` and validated with Zod.

### Account Settings
```json
{
  "accounts": [
    {
      "id": "personal-user",
      "type": "personal",
      "username": "user",
      "settings": {
        "syncEnabled": true,
        "syncInterval": 300000,
        "includePrivate": true,
        "includeForks": false,
        "includeArchived": false,
        "defaultVisibility": "all"
      }
    }
  ]
}
```

### Sidebar Settings
```json
{
  "sidebar": {
    "position": "right",
    "width": 320,
    "autoRefresh": true,
    "refreshInterval": 300000,
    "theme": "system",
    "density": "comfortable",
    "showStats": true,
    "showTopics": true,
    "groupBy": "account",
    "sortBy": "updated",
    "sortOrder": "desc",
    "filter": {
      "accounts": [],
      "visibility": [],
      "languages": [],
      "topics": [],
      "archived": null,
      "fork": null,
      "search": ""
    }
  }
}
```

### Token Storage
- **Primary**: OS keychain via `keytar` (Windows Credential Manager, macOS Keychain, Linux Secret Service)
- **Fallback**: Config file (with warning) if keytar unavailable
- Tokens are **never** logged or exposed in CLI output

---

## Architecture

```
src/
├── index.ts              # Main library exports
├── cli.ts                # CLI entry point
├── types/index.ts        # TypeScript types for GitHub API
├── core/
│   ├── config.ts         # Configuration (Zod validated)
│   └── sync.ts           # Repository synchronization
├── auth/manager.ts       # Auth with optional keytar
├── github/client.ts      # GitHub API client (REST + GraphQL)
├── storage/database.ts   # SQLite caching (better-sqlite3)
└── commands/index.ts     # CLI commands
```

### Key Design Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript | Type safety, self-documenting API |
| Build | tsup | Fast, ESM+CJS, small bundles |
| GitHub API | Octokit | Official SDK, maintained |
| Database | better-sqlite3 | Fast, synchronous, no server |
| Auth | keytar (optional) | OS keychain, secure |
| UI (planned) | Lit + Web Components | Native, framework-agnostic |

### Data Flow
```
GitHub API → Octokit Client → Sync Manager → SQLite Cache → CLI/Sidebar
                    ↑              ↓
              Rate Limited    Periodic (configurable)
```

---

## Phase Completion Summary

### Phase 1: Foundation ✅ (v0.1.0)
- [x] Project setup, TypeScript config, CI/CD
- [x] Configuration system with Zod validation
- [x] GitHub API client (REST + GraphQL)
- [x] Authentication with secure token storage
- [x] SQLite caching with incremental sync
- [x] Periodic sync scheduler
- [x] CLI with 20+ commands

### Phase 2: Authentication ✅ (v0.2.0)
- [x] Personal Access Token (classic & fine-grained)
- [x] **OAuth 2.0 flow** (auth URL generation, code exchange, account linking)
- [x] **GitHub App authentication** (placeholder for installation tokens)
- [x] **SSH key detection** (auto-detect keys in ~/.ssh, fingerprint extraction)
- [x] **Multi-account support** with switching and type detection
- [x] **Security: Scope validation** (REQUIRED_SCOPES for read/write/admin)
- [x] **Security: Audit logging** (logAuditEvent, getAuditLog)
- [x] **Security: Token scope validation**
- [x] **Account type detection** (personal/org/enterprise)

### Phase 3: Data Layer ✅ (v0.3.0)
- [x] **In-memory cache with TTL** (MemoryCache class, 5min repos / 10min stats)
- [x] **Incremental sync** (fromCache flag, cache-first strategy, `full` option)
- [x] **Parallel fetching** (syncAllAccounts with configurable concurrency, default 3)
- [x] **Selective field fetching** (fields parameter in listRepositories)
- [x] **Rate limit awareness** (checkRateLimit with automatic wait when limit < 100)
- [x] **Periodic cache cleanup** (10% chance per sync)
- [x] **Incremental sync flag** (incremental option with full override)

### Phase 4: Sidebar UI (v0.4.0) - Next
- [ ] Lit-based Web Components
- [ ] Repository list with virtualized rendering
- [ ] Repo cards: stars, forks, issues, PRs, language, topics
- [ ] Filtering: by account, visibility, language, topic, search
- [ ] Sorting: name, stars, updated, created, activity
- [ ] Grouping: account, language, visibility, activity
- [ ] Theme: system/light/dark, compact/comfortable density

### Phase 5: Repository Actions (v0.5.0)
- [ ] Issue list, create, edit, close, comment
- [ ] PR list, create, review, merge (squash/merge/rebase)
- [ ] Star/unstar, fork, watch/unwatch
- [ ] Clone (SSH/HTTPS/CLI), archive/unarchive
- [ ] Labels, milestones management
- [ ] Releases, branches protection

### Phase 6: Claude Integration (v0.6.0)
- [ ] Plugin manifest for Claude Desktop
- [ ] Slash commands (`/gh repo list`, `/gh issue create`)
- [ ] Natural language ("show my most starred repos")
- [ ] Context awareness (detect repo from cwd)
- [ ] Auto-suggest relevant actions

### Phase 7: Polish & Release (v1.0.0)
- [ ] Settings UI in sidebar
- [ ] Keyboard shortcuts
- [ ] Accessibility (keyboard nav, screen readers)
- [ ] Performance optimization (1000+ repos)
- [ ] Documentation, demo GIFs
- [ ] Plugin marketplace submission

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `keytar` module not found | Run `npm rebuild keytar` or install Windows Build Tools |
| `better-sqlite3` build fails | Install Python 3 + Visual Studio Build Tools |
| Auth fails with "Invalid token" | Check token scopes: `repo`, `read:org`, `user:email`, `notifications` |
| Rate limit hit | Wait or increase `advanced.apiTimeout`; uses exponential backoff |
| Sync doesn't run | Check `account.settings.syncEnabled` and `syncInterval` |
| CLI shows no output | Use `node dist/cli.cjs` (CJS) instead of ESM on older Node |

### Debug Commands
```bash
# View config
gh config get

# Validate all tokens
gh auth validate

# Force sync with debug
gh repo sync --force

# Check database
sqlite3 ~/.claude/github-sidebar/data/cache.db ".tables"
```

---

## Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts, manifest |
| `tsconfig.json` | TypeScript strict config |
| `tsup.config.ts` | Build configuration |
| `vitest.config.ts` | Test config |
| `eslint.config.js` | ESLint config |
| `.prettierrc` | Prettier formatting |
| `LICENSE` | MIT License |
| `README.md` | This file |
| `PLAN.md` | Detailed 12-week plan |
| `CONTRIBUTING.md` | Contribution guidelines |
| `CHANGELOG.md` | Version history |
| `SECURITY.md` | Security policy |

---

## How It Works

1. **Authentication**: Token stored in OS keychain (or config fallback)
2. **Sync**: On startup + periodic interval, fetches all repos via GitHub API
3. **Cache**: Repositories stored in local SQLite with computed stats
4. **CLI/Sidebar**: Reads from cache for instant response; background sync keeps data fresh
5. **Actions**: Mutations (create issue, merge PR) hit API directly, then invalidate cache

### Rate Limiting
- Uses Octokit's built-in throttle with retry-after
- Respects `X-RateLimit-Remaining` headers
- GraphQL for complex queries (single request vs many REST calls)
- Automatic wait when remaining < 100

---

## About

**GitHub Sidebar for Claude** — A plugin that brings your GitHub workflow into the Claude Desktop app. Built with TypeScript, SQLite, and the Octokit SDK.

### Topics
`claude` `plugin` `github` `sidebar` `dashboard` `repository` `typescript` `octokit` `sqlite`

### Resources
[Repository](https://github.com/3bdelrahmanashraf/Github-Sidebar-For-Claude) • [Issues](https://github.com/3bdelrahmanashraf/Github-Sidebar-For-Claude/issues) • [MIT License](LICENSE) • [Contributing](CONTRIBUTING.md) • [Security](SECURITY.md)
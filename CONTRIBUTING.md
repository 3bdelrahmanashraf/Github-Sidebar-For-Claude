# Contributing to GitHub Sidebar for Claude

Thank you for your interest in contributing! This document outlines the process for contributing to this project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- GitHub Personal Access Token (for testing)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/3bdelrahmanashraf/github-sidebar-claude.git
cd github-sidebar-claude

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run in development mode
npm run dev
```

### Configuration for Development

Create a test GitHub token with the following scopes:
- `repo` (full control of private repositories)
- `read:org` (read organization data)
- `user:email` (access user email)
- `notifications` (access notifications)

Add it using the CLI:
```bash
node dist/index.js auth add --type personal --username YOUR_USERNAME --token YOUR_TOKEN
```

## Development Workflow

### Branch Strategy

- `main` - Stable releases
- `develop` - Integration branch
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Commit Messages

Follow conventional commits format:
```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

Examples:
```
feat(auth): add OAuth 2.0 support
fix(sync): handle rate limit errors correctly
docs(readme): update installation instructions
```

### Pull Request Process

1. Fork the repository
2. Create a feature branch from `develop`
3. Make your changes
4. Run tests and linting: `npm test && npm run lint`
5. Update documentation if needed
6. Submit a PR to `develop`
7. Ensure CI passes
8. Request review

### Code Style

- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- Run `npm run format` before committing
- Follow existing patterns in the codebase

## Testing

### Unit Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Integration Tests

Integration tests require a GitHub token. Set `GITHUB_TEST_TOKEN` environment variable.

### Manual Testing

```bash
# Build and test CLI
npm run build
node dist/index.js help
node dist/index.js auth list
node dist/index.js repo list --account YOUR_ACCOUNT
```

## Project Structure

```
src/
├── index.ts              # Main entry point & CLI
├── types/                # TypeScript type definitions
├── core/
│   ├── config.ts         # Configuration management
│   └── sync.ts           # Synchronization logic
├── auth/
│   └── manager.ts        # Authentication & token management
├── github/
│   └── client.ts         # GitHub API client (REST + GraphQL)
├── storage/
│   └── database.ts       # SQLite database for caching
└── commands/
    └── index.ts          # CLI command implementations
```

## Adding New Features

### New CLI Command

1. Add command function in `src/commands/index.ts`
2. Register in `src/index.ts` CLI handler
3. Add to manifest in `src/index.ts`
4. Add tests
5. Update documentation

### New GitHub API Endpoint

1. Add method to `GitHubClient` in `src/github/client.ts`
2. Add types to `src/types/index.ts` if needed
3. Add command in `src/commands/index.ts`
4. Update manifest

### New Configuration Option

1. Add to schema in `src/core/config.ts`
2. Add default in `DEFAULT_CONFIG`
3. Add getter/setter functions
4. Update documentation

## Reporting Issues

### Bug Reports

Include:
- Version number
- Node.js version
- OS
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs
- Configuration (sanitized)

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternatives considered
- Implementation complexity estimate

## Security

### Reporting Vulnerabilities

Do NOT open public issues for security vulnerabilities. Email security@[domain] instead.

### Token Handling

- Tokens are encrypted at rest using OS keychain (keytar)
- Never log tokens
- Tokens are not stored in config files
- Minimal scopes requested

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release PR to `main`
4. After merge, tag release: `git tag vX.Y.Z`
5. GitHub Actions builds and publishes
6. Update documentation

## Questions?

- Open a discussion on GitHub
- Check existing issues/PRs
- Review the documentation

Thank you for contributing!
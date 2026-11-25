# GitHub Sidebar for Claude

A Claude plugin that provides a GitHub sidebar showing all your repositories with real-time stats (stars, PRs, issues, etc.) and lets you control them directly from Claude.

## Features

- **Repository Dashboard**: View all your GitHub repos in one place
- **Real-time Stats**: Stars, forks, open PRs, open issues, watchers
- **Repository Control**: Create issues, manage PRs, star/unstar, fork, clone
- **Multi-account Support**: Personal, organization, and enterprise accounts
- **Smart Filtering**: Filter by language, visibility, activity, topics
- **Claude Integration**: Natural language commands for repo operations

## Current Status

🚧 **Early Development** - Core architecture being designed

- [ ] Project setup & configuration
- [ ] GitHub API integration (REST + GraphQL)
- [ ] Sidebar UI component
- [ ] Authentication flow (OAuth + PAT)
- [ ] Real-time data sync
- [ ] Repository actions (issues, PRs, stars)
- [ ] Multi-account support
- [ ] Settings & preferences
- [ ] Tests & CI/CD
- [ ] Documentation

## Architecture

```
github-sidebar-claude/
├── src/
│   ├── core/           # Core plugin logic
│   ├── github/         # GitHub API client
│   ├── ui/             # Sidebar UI components
│   ├── auth/           # Authentication handling
│   ├── storage/        # Local caching & sync
│   └── commands/       # Claude slash commands
├── tests/
├── dist/               # Built plugin
└── manifest.json       # Plugin manifest
```

## Installation

```bash
# Once published to npm
npm install -g github-sidebar-claude

# Or install as Claude plugin
claude plugin install github-sidebar-claude
```

## Development

```bash
# Install dependencies
npm install

# Build plugin
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
```

## Configuration

The plugin stores config in `~/.claude/github-sidebar/config.json`:

```json
{
  "accounts": [
    {
      "type": "personal",
      "token": "ghp_...",
      "username": "your-username"
    }
  ],
  "refreshInterval": 300000,
  "sidebar": {
    "position": "right",
    "width": 320,
    "autoRefresh": true
  }
}
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Roadmap

See [PLAN.md](PLAN.md) for detailed development plan.
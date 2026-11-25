# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

Please report security vulnerabilities privately via email to **security@3bdelrahmanashraf.com** (or GitHub Security Advisories).

**Do not open public issues for security vulnerabilities.**

Include the following information:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Security Measures

### Token Storage
- GitHub Personal Access Tokens are stored encrypted using the OS keychain (via `keytar`)
- Tokens are **never** written to configuration files or logs
- Tokens are only kept in memory during active sessions

### API Communication
- All GitHub API requests use HTTPS
- Tokens are sent via Authorization headers only
- No tokens in URLs or query parameters

### Data Handling
- Local SQLite database stores only public repository metadata
- No sensitive data (tokens, private repo contents) cached locally
- Configuration files exclude tokens

### Dependencies
- Regular dependency updates via Dependabot
- `npm audit` run in CI pipeline
- Minimal dependency footprint

## Best Practices for Users

1. **Use fine-grained PATs** with minimal required scopes:
   - `repo` (for private repos)
   - `read:org` (for organization repos)
   - `user:email` (for user identification)
   - `notifications` (for notification features)

2. **Rotate tokens regularly** (recommended: every 90 days)

3. **Monitor token usage** in GitHub Settings > Developer settings > Personal access tokens

4. **Revoke unused tokens** immediately

## Threat Model

| Threat | Mitigation |
|--------|------------|
| Token theft from config | Tokens never in config files |
| Token theft from memory | Short-lived CLI processes |
| Database exposure | Only public metadata cached |
| MITM attacks | HTTPS enforced |
| Supply chain attacks | Dependency scanning in CI |

## Compliance

This project follows:
- GitHub API Terms of Service
- OAuth 2.0 Security Best Practices (where applicable)
- OWASP Application Security Verification Standard (ASVS) Level 1
# 🚀 FuncDock — Security Guide

## Index
- [Security Features](#security-features)
- [Best Practices](#best-practices)
- [Responsible Disclosure](#responsible-disclosure)
- [Reporting Vulnerabilities](#reporting-vulnerabilities)
- [Security FAQ](#security-faq)

---

## Security Features
- Route conflict prevention
- CORS and security headers
- Webhook signature validation (GitHub, Stripe)
- Rate limiting (via Caddy)
- Function isolation by directory

## Best Practices
- Use environment variables for secrets
- Keep dependencies up to date
- Limit network and file system access
- Use host-based deploy for private repos

## Responsible Disclosure
- If you find a vulnerability, please report it privately.

## Reporting Vulnerabilities
- Email security@funcdock.dev or open a private GitHub issue.

## Security FAQ
- See [TROUBLESHOOTING_README.md](TROUBLESHOOTING_README.md) for security-related issues. 
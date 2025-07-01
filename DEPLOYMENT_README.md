# 🚀 FuncDock — Deployment Guide

## Index
- [Overview](#overview)
- [Deployment Methods](#deployment-methods)
- [Updating & Removing Functions](#updating--removing-functions)
- [Hot Reload](#hot-reload)
- [Function Requirements](#function-requirements)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [API Endpoints](#api-endpoints)
- [Security](#security)

---

## Overview
FuncDock supports host-based, container-based, and local deployments for maximum flexibility.

## Deployment Methods
- **Host-based**: Uses your local Git credentials.
- **Container-based**: Runs Git inside the container.
- **Local directory**: Deploy from a local folder.
- See CLI and Makefile for commands.

## Updating & Removing Functions
- Use `make update-function NAME=...` or `npm run deploy -- --update ...`.
- Remove with `make remove-function NAME=...` or `npm run deploy -- --remove ...`.

## Hot Reload
- Functions reload automatically on file or dependency changes.
- Manual reload: `make reload` or API call.

## Function Requirements
- Each function: `handler.js`, `route.config.json`, `package.json`.
- Optional: `cron.json`, `.env`, `.deployment.json`.

## Best Practices
- Use host-based for private repos.
- Test PRs before merging.
- Use commit hashes for reproducible deploys.
- Clean up unused functions.

## Troubleshooting
- See [TROUBLESHOOTING_README.md](TROUBLESHOOTING_README.md) for common issues and fixes.

## API Endpoints
- `/api/status` — Platform and function status
- `/api/reload` — Reload functions
- `/health` — Health check

## Security
- Functions are isolated by directory.
- Host-based deploy uses your Git credentials.
- See [SECURITY_README.md](SECURITY_README.md) for more. 
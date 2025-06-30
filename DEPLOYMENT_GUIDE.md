# FuncDock Deployment Guide

This guide covers all deployment and update scenarios for FuncDock functions, including Git-based deployments, pull request deployments, and local deployments.

## Overview

FuncDock supports multiple deployment methods:

1. **Host-based deployment** (`npm run deploy-host`) - Uses your host Git credentials
2. **Container-based deployment** (`npm run deploy`) - Runs inside the container
3. **Automatic hot-reload** - Functions are automatically reloaded when files change

## Deployment Methods

### 1. Git Repository Deployment

Deploy functions directly from Git repositories:

```bash
# Host-based (recommended for private repos)
npm run deploy-host -- --git https://github.com/user/my-function.git --name my-function

# Container-based
npm run deploy -- --git https://github.com/user/my-function.git --name my-function
```

**Options:**
- `--branch <name>` - Specify branch (default: main)
- `--commit <hash>` - Deploy from specific commit

**Examples:**
```bash
# Deploy from specific branch
npm run deploy-host -- --git https://github.com/user/my-function.git --name my-function --branch feature/new-feature

# Deploy from specific commit
npm run deploy-host -- --git https://github.com/user/my-function.git --name my-function --commit abc123def
```

### 2. Pull Request Deployment

Deploy functions from specific pull requests:

```bash
# Host-based
npm run deploy-host -- --pr https://github.com/user/my-function.git --name my-function --pr-number 123

# Container-based
npm run deploy -- --pr https://github.com/user/my-function.git --name my-function --pr-number 123
```

This is useful for:
- Testing PR changes before merging
- Staging deployments
- Code review workflows

### 3. Local Directory Deployment

Deploy functions from local directories:

```bash
# Container-based only
npm run deploy -- --local ./local-function --name local-func
```

## Update Operations

### Basic Updates

Update existing functions to their latest version:

```bash
# Host-based
npm run deploy-host -- --update my-function

# Container-based
npm run deploy -- --update my-function
```

### Branch Switching

Switch a function to a different branch:

```bash
# Host-based
npm run deploy-host -- --update my-function --branch feature/new-feature

# Container-based
npm run deploy -- --update my-function --branch feature/new-feature
```

### Commit-Specific Updates

Update a function to a specific commit:

```bash
# Host-based
npm run deploy-host -- --update my-function --commit abc123def

# Container-based
npm run deploy -- --update my-function --commit abc123def
```

## Management Operations

### List Deployed Functions

View all deployed functions with their metadata:

```bash
# Host-based
npm run deploy-host -- --list

# Container-based
npm run deploy -- --list
```

Example output:
```
📋 Deployed Functions:

📦 hello-world
   Source: git
   Deployed: 6/30/2025, 11:56:12 PM
   Routes: 14
   Git URL: https://github.com/user/hello-world.git
   Branch: main
   Commit: abc12345

📦 webhook-handler
   Source: pull-request
   Deployed: 6/30/2025, 11:45:30 PM
   Routes: 6
   Git URL: https://github.com/user/webhook-handler.git
   PR #123: Add new webhook endpoint
   Commit: def67890
```

### Remove Functions

Remove deployed functions:

```bash
# Host-based
npm run deploy-host -- --remove my-function

# Container-based
npm run deploy -- --remove my-function
```

## Deployment Metadata

Each deployed function includes metadata stored in `.deployment.json`:

```json
{
  "source": "git",
  "gitUrl": "https://github.com/user/my-function.git",
  "branch": "main",
  "commit": "abc123def456789",
  "deployedAt": "2025-06-30T22:56:12.364Z",
  "deployedBy": "rick",
  "deploymentMethod": "host-based"
}
```

For pull request deployments:
```json
{
  "source": "pull-request",
  "gitUrl": "https://github.com/user/my-function.git",
  "prNumber": 123,
  "prTitle": "Add new feature",
  "commit": "def456ghi789012",
  "deployedAt": "2025-06-30T22:45:30.123Z",
  "deployedBy": "rick",
  "deploymentMethod": "host-based"
}
```

## Hot Reload

Functions are automatically reloaded when:
- Files are changed in the function directory
- Dependencies are updated
- The function is redeployed

You can also manually trigger reloads:

```bash
# Reload specific function
curl -X POST http://localhost:3000/api/reload \
  -H "Content-Type: application/json" \
  -d '{"functionName": "my-function"}'

# Reload all functions
curl -X POST http://localhost:3000/api/reload \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Function Requirements

All functions must include:
- `handler.js` - Main function handler
- `route.config.json` - Route configuration
- `package.json` - Dependencies and metadata

Optional files:
- `cron.json` - Cron job configuration
- `.deployment.json` - Deployment metadata (auto-generated)

## Best Practices

### 1. Use Host-Based Deployment for Private Repos

Host-based deployment uses your local Git credentials, making it ideal for private repositories:

```bash
npm run deploy-host -- --git git@github.com:user/private-function.git --name private-func
```

### 2. Test Pull Requests Before Merging

Deploy pull requests to test changes:

```bash
npm run deploy-host -- --pr https://github.com/user/my-function.git --name my-function --pr-number 123
```

### 3. Use Specific Commits for Reproducible Deployments

For production deployments, use specific commit hashes:

```bash
npm run deploy-host -- --update my-function --commit abc123def
```

### 4. Monitor Function Status

Regularly check function status:

```bash
npm run deploy-host -- --list
```

### 5. Clean Up Unused Functions

Remove functions that are no longer needed:

```bash
npm run deploy-host -- --remove old-function
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Use host-based deployment for private repos
   - Ensure Git credentials are configured

2. **Missing Files**
   - Verify function has required files (handler.js, route.config.json, package.json)
   - Check file permissions

3. **Dependency Issues**
   - Functions are automatically installed
   - Check package.json for correct dependencies

4. **Port Conflicts**
   - Ensure port 3000 is available
   - Check for other running instances

### Debug Commands

```bash
# Check server status
curl http://localhost:3000/health

# View server logs
docker logs funcdock-server

# Check function logs
tail -f logs/funcdock.log
```

## API Endpoints

### Management API

- `GET /api/status` - Server and function status
- `POST /api/reload` - Reload functions
- `GET /health` - Health check

### Example API Usage

```bash
# Get server status
curl http://localhost:3000/api/status

# Reload specific function
curl -X POST http://localhost:3000/api/reload \
  -H "Content-Type: application/json" \
  -d '{"functionName": "my-function"}'
```

## Security Considerations

1. **Git Credentials** - Host-based deployment uses your local Git credentials
2. **Function Isolation** - Functions run in the same container but are isolated by directory
3. **Network Access** - Functions can make outbound requests
4. **File System** - Functions have read/write access to their directory

## Next Steps

- [Function Development Guide](./FUNCTION_DEVELOPMENT.md)
- [Testing Guide](./TESTING_GUIDE.md)
- [API Reference](./API_REFERENCE.md) 
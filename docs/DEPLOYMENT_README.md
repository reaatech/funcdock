# 🚀 FuncDock — Deployment Guide

## Index

- [Quick Start](#quick-start)
- [Deployment Methods](#deployment-methods)
- [Step-by-Step Deployment](#step-by-step-deployment)
- [GitHub Credentials](#github-credentials)
- [Function Management](#function-management)
- [Hot Reload](#hot-reload)
- [Function Requirements](#function-requirements)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [API Endpoints](#api-endpoints)
- [Security](#security)

---

## Quick Start

### First Time Setup

```bash
# 1. Clone and setup FuncDock
git clone <your-repo>
cd funcdock
make quickstart

# 2. Deploy your first function (using host Git credentials - recommended)
funcdock deploy --git https://github.com/your-username/your-function.git --name my-function

# 3. Test your function
curl http://localhost:3000/my-function/
# Note: Use the port your server is running on (port 3000)
```

### Prerequisites

- Node.js 22+
- Git configured with your credentials
- Docker (optional, for containerized deployment)
- `jq` for JSON processing: `brew install jq` (macOS) or `apt-get install jq` (Ubuntu)

---

## Deployment Methods

FuncDock supports three deployment methods, each with different use cases:

### 1. Host-based Deployment (Recommended) ⭐

**Best for**: Private repositories, when you want to use your existing Git credentials

- Uses your host machine's Git configuration and credentials
- No need to configure Git inside containers
- Supports SSH keys, personal access tokens, and other authentication methods
- Automatically handles authentication for private repositories

```bash
# Deploy from Git repository
funcdock deploy --git https://github.com/user/my-function.git --name my-function

# Deploy from specific branch
funcdock deploy --git https://github.com/user/my-function.git --name my-functionfeature/new-feature

# Deploy from specific commit
npm run deploy-host -- --git https://github.com/user/my-function.git --name my-function --commit abc123def
```

### 2. Container-based Deployment

**Best for**: Public repositories, CI/CD pipelines

- Runs Git operations inside the Docker container
- Requires Git credentials to be configured inside the container
- May prompt for credentials if not configured

```bash
# Deploy from Git repository (may prompt for credentials)
funcdock deploy --git https://github.com/user/my-function.git --name my-function

# Using npm script
npm run deploy -- --git https://github.com/user/my-function.git --name my-function
```

### 3. Local Directory Deployment

**Best for**: Development, testing, local functions

- Deploy from a local directory on your machine
- No Git operations involved
- Perfect for rapid development and testing

```bash
# Deploy from local directory
funcdock deploy --local ./my-local-function --name my-function

# Using npm script
npm run deploy -- --local ./my-local-function --name my-function
```

### 4. Dashboard-Based Deployment (OAuth)

**Best for**: Users who want a no-CLI, browser-based experience

- Deploy directly from your GitHub or Bitbucket account using OAuth
- Select a repo and deploy with a few clicks
- No Git credentials needed - authenticate via OAuth
- See [Dashboard Deployment Methods](./DASHBOARDS_README.md#deploying-functions-via-github--bitbucket-oauth) for detailed setup and usage

**Quick Setup:**

1. Register OAuth app with GitHub/Bitbucket
2. Configure environment variables (see [DASHBOARDS_README.md](./DASHBOARDS_README.md#setting-up-github-oauth))
3. Connect your account in the dashboard
4. Deploy from repository browser

---

## Step-by-Step Deployment

### Step 1: Prepare Your Function

Your function must have these required files:

```
my-function/
├── handler.js          # Main function logic
├── route.config.json   # Route configuration
└── package.json        # Dependencies
```

**Example `handler.js`:**

```javascript
export default function handler(req, res) {
  res.json({ message: 'Hello from my function!' });
}
```

**Example `route.config.json`:**

```json
{
  "routes": [
    {
      "path": "/",
      "methods": ["GET"],
      "handler": "handler.js"
    }
  ]
}
```

**Example `package.json`:**

```json
{
  "name": "my-function",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

### Step 2: Deploy Your Function

#### Option A: Deploy from GitHub (Recommended)

```bash
# For private repositories - uses your host Git credentials
funcdock deploy --git https://github.com/your-username/your-function.git --name my-function

# For public repositories - may prompt for credentials
funcdock deploy --git https://github.com/your-username/your-function.git --name my-function
```

#### Option B: Deploy from Local Directory

```bash
# Deploy from a local folder
funcdock deploy --local ./my-local-function --name my-function
```

### Step 3: Verify Deployment

```bash
# Check if function was deployed
funcdock list

# Test your function
curl http://localhost:3000/my-function/
# Note: Use the port your server is running on (port 3000)

# Check platform status
make status
```

### Step 4: View Logs

```bash
# View all logs
make logs

# View error logs only
make error-logs
```

---

## GitHub Credentials

### Why Does It Ask for Credentials?

FuncDock may prompt for GitHub credentials in these scenarios:

1. **Container-based deployment** (`funcdock deploy --git ...`)
   - Git operations run inside the Docker container
   - Container doesn't have access to your host Git credentials
   - You'll be prompted for username/password or token

2. **Private repositories**
   - Even with host-based deployment, private repos require authentication
   - FuncDock uses your host Git configuration

### Solutions

#### Option 1: Use Host-based Deployment (Recommended)

```bash
# This uses your existing Git credentials automatically
funcdock deploy --git https://github.com/user/private-repo.git --name my-function
```

#### Option 2: Configure Git Credentials

```bash
# Set up Git credentials globally
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# For HTTPS with personal access token
git config --global credential.helper store

# For SSH keys (recommended for private repos)
ssh-keygen -t ed25519 -C "your.email@example.com"
# Add the public key to your GitHub account
```

#### Option 3: Use SSH URLs

```bash
# Use SSH instead of HTTPS
funcdock deploy --git git@github.com:user/private-repo.git --name my-function
```

### Checking Your Git Configuration

```bash
# Use the built-in Git configuration checker
make check-git
# or
npm run check-git

# Manual checks
git config --list | grep user
git config --list | grep credential

# Test Git access
git ls-remote https://github.com/your-username/your-repo.git
```

---

## Function Management

### List All Functions

```bash
funcdock list
# or
npm run deploy -- --list
```

### Update a Function

```bash
# Update from original source
funcdock update my-function

# Update from specific branch
npm run deploy -- --update my-function --branch feature/new-feature

# Update from specific commit
npm run deploy -- --update my-function --commit abc123def
```

### Remove a Function

```bash
funcdock remove my-function
# or
npm run deploy -- --remove my-function
```

### Create a New Function Template

```bash
funcdock create my-new-function
```

---

## Hot Reload

FuncDock automatically reloads functions when:

- Function files are modified
- Dependencies are updated
- New files are added

### Manual Reload

```bash
# Reload all functions
make reload

# Reload specific function via API
curl -X POST http://localhost:3000/api/reload \
  -H "Content-Type: application/json" \
  -d '{"functionName": "my-function"}'
# Note: Replace 3000 with your actual port (port 3000)
```

---

## Function Requirements

### Required Files

- `handler.js` - Main function logic
- `route.config.json` - Route configuration
- `package.json` - Dependencies and metadata

### Optional Files

- `cron.json` - Scheduled tasks
- `.env` - Environment variables
- `.deployment.json` - Deployment metadata (auto-generated)

### Route Configuration

```json
{
  "routes": [
    {
      "path": "/",
      "methods": ["GET"],
      "handler": "handler.js"
    },
    {
      "path": "/api/data",
      "methods": ["POST"],
      "handler": "api-handler.js"
    },
    {
      "path": "/users/:id",
      "methods": ["GET", "PUT"],
      "handler": "user-handler.js"
    }
  ]
}
```

---

## Best Practices

### Deployment

- ✅ Use host-based deployment for private repositories
- ✅ Use SSH keys for authentication when possible
- ✅ Test functions locally before deployment
- ✅ Use specific commit hashes for reproducible deployments
- ✅ Keep functions small and focused

### Security

- ✅ Use environment variables for sensitive data
- ✅ Validate all inputs in your functions
- ✅ Use HTTPS for external API calls
- ✅ Implement proper error handling

### Development

- ✅ Use the dashboard for monitoring: http://localhost:3000/dashboard/ (or your configured port)
- ✅ Check logs regularly during development
- ✅ Use the test runner for validation
- ✅ Keep dependencies up to date

---

## Troubleshooting

### Common Issues

#### "Git credentials not found"

```bash
# Check your Git configuration first
make check-git

# Solution: Use host-based deployment
funcdock deploy --git https://github.com/user/repo.git --name my-function

# Or configure Git credentials
git config --global credential.helper store
```

#### "Function not found after deployment"

```bash
# Check if function was deployed
funcdock list

# Check logs for errors
make logs

# Reload functions
make reload
```

#### "Port 3000 already in use"

```bash
# Stop existing process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

#### "Dependencies not installed"

```bash
# Check function directory
ls -la functions/my-function/

# Manually install dependencies
cd functions/my-function && npm install
```

### Getting Help

- Check [TROUBLESHOOTING_README.md](TROUBLESHOOTING_README.md) for detailed solutions
- View application logs: `make logs`
- Check platform status: `make status`
- Test function health: `curl http://localhost:3000/my-function/` (use your actual port)

---

## API Endpoints

### Platform Management

- `GET /api/status` - Platform and function status
- `POST /api/reload` - Reload all functions
- `GET /health` - Health check

### Function Endpoints

- `GET /{function-name}/` - Access your function
- `POST /{function-name}/` - POST to your function
- All HTTP methods supported based on route configuration

### Dashboard

- `GET /dashboard/` - Web-based management interface

---

## Security

### Function Isolation

- Functions run in isolated directories
- No cross-function file access
- Environment variables are function-specific

### Authentication

- Host-based deployment uses your existing Git credentials
- No credentials stored in containers
- SSH keys provide the most secure authentication

### Network Security

- Functions can only access external APIs
- No direct database connections (use environment variables)
- Rate limiting enabled by default

For detailed security information, see [SECURITY_README.md](SECURITY_README.md).

---

## Next Steps

1. **Explore the Dashboard**: Visit http://localhost:3000/dashboard/ (or your configured port)
2. **Read the CLI Guide**: See [CLI_README.md](CLI_README.md) for advanced usage
3. **Check Examples**: Look at the `functions/` directory for example functions
4. **Join the Community**: Check the main [README.md](../README.md) for community links

Happy deploying! 🚀

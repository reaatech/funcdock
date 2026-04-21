# 🎛️ FuncDock — Real-Time Dashboard Guide

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Dashboard Access](#dashboard-access)
- [Main Dashboard](#main-dashboard)
- [Function Management](#function-management)
- [Real-Time Logging](#real-time-logging)
- [Function Deployment](#function-deployment)
- [Settings & Configuration](#settings--configuration)
- [Advanced Features](#advanced-features)
- [Troubleshooting](#troubleshooting)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Best Practices](#best-practices)
- [Deploying Functions via GitHub & Bitbucket (OAuth)](#deploying-functions-via-github--bitbucket-oauth)

---

## 🚀 Overview

The FuncDock dashboard is your **command center** for managing, monitoring, and debugging serverless functions in real-time. It provides complete visibility into your entire serverless platform with instant hot reload capabilities, live metrics, and comprehensive management tools.

### ✨ Key Features

- **📊 Real-Time Monitoring** — Live function status, metrics, and performance data
- **🔍 Advanced Logging** — Filterable, searchable logs with export capabilities
- **🚀 Instant Deployment** — Deploy functions via file upload or Git integration
- **🧪 Function Testing** — Built-in testing interface for route validation
- **⏰ Cron Job Management** — Visual cron job configuration and monitoring
- **📁 File Explorer** — Browse and edit function files directly in the browser
- **⚡ Hot Reload** — See changes go live instantly without container restarts
- **🔒 Security Management** — Route conflicts, webhook validation, and access controls

---

## 🏁 Quick Start

1. **Start FuncDock**: `npm run dev` or `make quickstart`
2. **Open Dashboard**: Navigate to `http://localhost:3000/dashboard/`
3. **Explore Functions**: View all deployed functions and their status
4. **Monitor Logs**: Watch real-time logs from all functions
5. **Deploy New Function**: Use the Deploy tab to add new functions

---

## 🌐 Dashboard Access

### Local Development

```
http://localhost:3000/dashboard/
```

**Note:** The server defaults to port 3000 if the `PORT` environment variable is not set. Set `PORT=3000` to use port 3000.

### Production

```
https://your-domain.com/dashboard/
```

### Authentication

FuncDock uses JWT-based authentication for dashboard and API access.

**Default Credentials (Development):**

- **Username:** `admin`
- **Password:** `admin`

**⚠️ Important:** Change these credentials in production by setting environment variables:

```bash
ADMIN_USERNAME=your-secure-username
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=your-super-secret-jwt-key
```

**Login Flow:**

1. Navigate to dashboard login page
2. Enter username and password
3. Receive JWT token (stored in browser localStorage)
4. Token used for all API requests
5. Token expires after 24 hours (re-login required)

**API Authentication:**
For programmatic access, login via API:

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Response includes token
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": { "username": "admin", "role": "admin" }
# }

# Use token in subsequent requests
curl http://localhost:3000/api/status \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Token Management:**

- Tokens are stored in browser localStorage (dashboard)
- Tokens expire after 24 hours
- Logout clears token from localStorage
- Verify token: `GET /api/auth/verify`
- Logout: `POST /api/auth/logout`

---

## 📊 Main Dashboard

The main dashboard provides an **overview** of your entire FuncDock platform.

### Dashboard Stats

| Metric                | Description                  | Icon |
| --------------------- | ---------------------------- | ---- |
| **Total Functions**   | Number of deployed functions | 📦   |
| **Running Functions** | Functions currently active   | ✅   |
| **Errors**            | Functions with issues        | ❌   |
| **Uptime**            | System uptime in hours       | ⏰   |

### Real-Time Updates

The dashboard updates **automatically** via WebSocket connections:

- Function status changes
- New log entries
- Performance metrics
- System health updates

### Function Overview Table

| Column           | Description                                  |
| ---------------- | -------------------------------------------- |
| **Name**         | Function identifier and link to details      |
| **Status**       | Running, Error, or Stopped with color coding |
| **Routes**       | Number of registered routes                  |
| **Cron Jobs**    | Number of scheduled tasks                    |
| **Last Updated** | Timestamp of last modification               |
| **Actions**      | Quick access to test, edit, or delete        |

---

## 🔧 Function Management

### Function Detail View

Access detailed function information by clicking on any function name.

#### Overview Tab

- **Function Status**: Real-time status with visual indicators
- **Base URL**: Copyable endpoint URL
- **Route Configuration**: All registered routes and methods
- **Dependencies**: Installed npm packages
- **File Structure**: Complete file tree with file sizes

#### Testing Tab

Test your functions directly from the dashboard:

```javascript
// Example test configuration
// Note: This is for dashboard testing interface, not route.config.json
{
  "method": "POST",
  "path": "/api/users",
  "data": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "headers": {
    "Content-Type": "application/json"
  }
}
// For route.config.json, use "methods": ["POST"] (plural array)
```

**Test Features:**

- Multiple HTTP methods (GET, POST, PUT, DELETE, OPTIONS)
- Request body with JSON validation
- Custom headers
- Response inspection with timing
- Error handling and debugging

#### Logs Tab

Function-specific logs with advanced filtering:

- **Log Levels**: ERROR, WARN, INFO, DEBUG
- **Time Range**: Last hour, day, week, or custom
- **Search**: Full-text search across log messages
- **Export**: Download logs as CSV or JSON

#### Cron Jobs Tab

Manage scheduled tasks for the function:

**Cron Job Configuration:**

```json
{
  "name": "daily-backup",
  "schedule": "0 2 * * *",
  "handler": "cron-handler.js",
  "timezone": "UTC",
  "description": "Daily backup at 2 AM UTC"
}
```

**Features:**

- Visual cron expression builder
- Timezone selection
- Handler file specification
- Execution history and status
- Enable/disable individual jobs

#### Files Tab

Browse and manage function files:

**File Operations:**

- **View**: Read file contents with syntax highlighting
- **Edit**: In-browser code editing with auto-save
- **Download**: Export individual files
- **Upload**: Replace files with new versions
- **Delete**: Remove files (with confirmation)

**Supported File Types:**

- JavaScript (.js)
- JSON (.json)
- Markdown (.md)
- YAML (.yml, .yaml)
- Text files (.txt)

---

## 📝 Real-Time Logging

### Global Logs View

Access comprehensive logging at `http://localhost:3000/dashboard/logs` (or your configured port)

#### Log Filters

| Filter         | Options                            | Description                |
| -------------- | ---------------------------------- | -------------------------- |
| **Function**   | All functions or specific function | Filter by function name    |
| **Log Level**  | ERROR, WARN, INFO, DEBUG, ALL      | Filter by severity         |
| **Search**     | Free text                          | Search within log messages |
| **Time Range** | Last 100, 500, 1000 logs           | Limit log entries          |

#### Log Display

Each log entry shows:

- **Timestamp**: ISO format with timezone
- **Level**: Color-coded severity indicator
- **Function**: Source function name
- **Message**: Log content with syntax highlighting
- **Metadata**: Additional context (if available)

#### Log Actions

- **Live Mode**: Toggle real-time log streaming
- **Refresh**: Manually fetch latest logs
- **Export**: Download filtered logs as CSV
- **Clear**: Reset all filters

#### Log Levels

| Level      | Color     | Description       | Use Case                       |
| ---------- | --------- | ----------------- | ------------------------------ |
| ERROR      | 🔴 Red    | Critical errors   | Function failures, crashes     |
| WARN       | 🟡 Yellow | Warning messages  | Deprecated features, issues    |
| INFO       | 🔵 Blue   | Information       | Function calls, status updates |
| DEBUG      | ⚪ Gray   | Debug information | Development debugging          |
| ACCESS     | 🟢 Green  | HTTP access logs  | HTTP requests to functions     |
| CRON       | 🟢 Green  | Cron job events   | Cron job started/completed     |
| CRON_ERROR | 🔴 Red    | Cron job errors   | Cron job failures or warnings  |

> **Note:** Filtering by "CRON" in the dashboard will show both CRON and CRON_ERROR logs.

---

## 🚀 Function Deployment

### Deploy New Function

Access deployment at `http://localhost:3000/dashboard/deploy` (or your configured port)

#### Method 1: File Upload

**Step 1: Select Files**

- Upload `handler.js` (main function file)
- Upload `route.config.json` (routing configuration)
- Upload `package.json` (dependencies)
- Upload `cron.json` (scheduled tasks, optional)

**Step 2: Configure Function**

```json
{
  "name": "my-function",
  "base": "/my-function",
  "handler": "handler.js"
}
```

**Step 3: Deploy**

- Automatic dependency installation
- Route registration
- Cron job setup
- Instant hot reload activation

#### Method 2: Git Integration

**Step 1: Repository Configuration**

- **Repository URL**: HTTPS or SSH Git URL
- **Branch**: Default branch (main/master)
- **Commit**: Specific commit hash (optional)

**Step 2: Function Detection**

- Automatic function name detection
- File structure validation
- Configuration file parsing

**Step 3: Deployment**

- Git clone and checkout
- Dependency installation
- Function registration
- Hot reload activation

### Deployment Status

**Real-time deployment feedback:**

- File upload progress
- Dependency installation status
- Route registration confirmation
- Error reporting and resolution

---

## ⚙️ Settings & Configuration

### System Settings

Access settings at `http://localhost:3000/dashboard/settings` (or your configured port)

#### General Configuration

- **Platform Name**: Customize dashboard title
- **Timezone**: Default timezone for logs and cron jobs

#### Security Settings

- **CORS**: Configure cross-origin resource sharing
- **Rate Limiting**: Set request rate limits

#### Performance Settings

- **Log Retention**: Configure log storage duration
- **Cache TTL**: Function response cache time-to-live
- **Compression**: Enable/disable response compression
- **Request Timeout**: Maximum request duration

#### Integration Settings

- **Git Providers**: Configure GitHub and Bitbucket OAuth
- **Alerts**: Slack webhook for alert notifications

---

## 🔥 Advanced Features

### Hot Reload Management

**Automatic Hot Reload:**

- File changes trigger instant reloads
- No container restarts required
- Zero downtime deployments
- Route updates in milliseconds

**Manual Hot Reload:**

- Force reload specific functions
- Reload all functions
- Reload with dependency updates

### Route Conflict Detection

**Automatic Detection:**

- Identifies conflicting route patterns
- Prevents deployment of conflicting routes
- Suggests alternative route paths
- Visual conflict highlighting

### Performance Monitoring

**Real-time Metrics:**

- Request count and response times
- Memory usage and CPU utilization
- Error rates and success percentages
- Function execution duration

**Historical Data:**

- Performance trends over time
- Peak usage identification
- Bottleneck detection
- Capacity planning insights

### Webhook Management

**Webhook Configuration:**

- GitHub webhook validation
- Slack integration setup
- Stripe webhook handling
- Custom webhook endpoints

**Webhook Testing:**

- Send test payloads
- Validate webhook signatures
- Monitor webhook delivery
- Debug webhook failures

---

## 🔧 Troubleshooting

### Common Issues

#### Dashboard Not Loading

```bash
# Check if FuncDock is running
curl http://localhost:3000/api/status
# Note: Replace 3000 with your actual port (port 3000)

# Restart the server
npm run dev
```

#### Functions Not Appearing

1. Check function deployment status
2. Verify route configuration
3. Review function logs for errors
4. Ensure dependencies are installed

#### Logs Not Updating

1. Verify WebSocket connection
2. Check browser console for errors
3. Refresh the dashboard
4. Restart the FuncDock server

#### Deployment Failures

1. Check file permissions
2. Verify Git repository access
3. Review dependency conflicts
4. Check function syntax errors

### Debug Mode

Enable debug mode for detailed troubleshooting:

```bash
# Set debug environment variable
DEBUG=funcdock:* npm run dev

# Check debug logs in dashboard
# Navigate to Settings > Debug Mode
```

---

## Deploying Functions via GitHub & Bitbucket (OAuth)

FuncDock supports OAuth-based deployment from GitHub and Bitbucket, allowing you to deploy functions directly from your repositories without managing Git credentials.

### Overview

OAuth deployment provides:

- **No Git credentials needed** - Authenticate via OAuth
- **Repository selection** - Browse and select repos from your account
- **Secure token management** - Tokens stored securely per user
- **Easy deployment** - Deploy with a few clicks

### Prerequisites

1. **GitHub/Bitbucket Account** - You need an account with repositories
2. **OAuth App Registration** - Register OAuth apps with GitHub/Bitbucket
3. **Environment Variables** - Configure OAuth credentials

### Setting Up GitHub OAuth

#### Step 1: Create GitHub OAuth App

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name:** FuncDock (or your choice)
   - **Homepage URL:** `http://localhost:3000` (or your domain)
   - **Authorization callback URL:** `http://localhost:3000/api/oauth/github/callback`
     - For production: `https://yourdomain.com/api/oauth/github/callback`
4. Click "Register application"
5. **Copy the Client ID and generate a Client Secret**

#### Step 2: Configure Environment Variables

Add to your `.env` file or environment:

```bash
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GITHUB_REDIRECT_URI=http://localhost:3000/api/oauth/github/callback
# For production:
# GITHUB_REDIRECT_URI=https://yourdomain.com/api/oauth/github/callback
```

#### Step 3: Restart Server

```bash
# Restart to load new environment variables
npm run dev
```

### Setting Up Bitbucket OAuth

#### Step 1: Create Bitbucket OAuth Consumer

1. Go to Bitbucket → Personal settings → Access management → OAuth
2. Click "Add consumer"
3. Fill in the details:
   - **Name:** FuncDock (or your choice)
   - **Callback URL:** `http://localhost:3000/api/oauth/bitbucket/callback`
     - For production: `https://yourdomain.com/api/oauth/bitbucket/callback`
   - **Permissions:** Select "Repositories: Read" (and "Write" if needed)
4. Click "Save"
5. **Copy the Key (Client ID) and Secret (Client Secret)**

#### Step 2: Configure Environment Variables

Add to your `.env` file or environment:

```bash
BITBUCKET_CLIENT_ID=your_bitbucket_client_id_here
BITBUCKET_CLIENT_SECRET=your_bitbucket_client_secret_here
BITBUCKET_REDIRECT_URI=http://localhost:3000/api/oauth/bitbucket/callback
# For production:
# BITBUCKET_REDIRECT_URI=https://yourdomain.com/api/oauth/bitbucket/callback
```

#### Step 3: Restart Server

```bash
# Restart to load new environment variables
npm run dev
```

### Using OAuth Deployment

#### Step 1: Login to Dashboard

1. Open the dashboard: `http://localhost:3000/dashboard/`
2. Login with your admin credentials
3. Navigate to the **Deploy** section

#### Step 2: Connect GitHub/Bitbucket

1. Click "Connect GitHub" or "Connect Bitbucket"
2. You'll be redirected to GitHub/Bitbucket for authorization
3. Authorize FuncDock to access your repositories
4. You'll be redirected back to the dashboard

#### Step 3: Deploy from Repository

1. Select your provider (GitHub or Bitbucket)
2. Browse your repositories
3. Select the repository you want to deploy
4. Choose branch (default: main/master)
5. Enter function name
6. Click "Deploy"

### OAuth Callback URLs

**Important:** The callback URL must match exactly what you configured in your OAuth app.

**Development:**

```
http://localhost:3000/api/oauth/github/callback
http://localhost:3000/api/oauth/bitbucket/callback
```

**Production:**

```
https://yourdomain.com/api/oauth/github/callback
https://yourdomain.com/api/oauth/bitbucket/callback
```

### Troubleshooting OAuth

#### "Invalid redirect_uri"

**Problem:** Callback URL doesn't match OAuth app configuration

**Solution:**

1. Verify callback URL in OAuth app matches environment variable
2. Check for trailing slashes
3. Ensure protocol matches (http vs https)
4. Verify port number is correct

#### "OAuth app not found"

**Problem:** Client ID is incorrect or app was deleted

**Solution:**

1. Verify `GITHUB_CLIENT_ID` or `BITBUCKET_CLIENT_ID` is correct
2. Check OAuth app still exists in GitHub/Bitbucket
3. Regenerate client secret if needed

#### "Access denied"

**Problem:** User didn't authorize or revoked access

**Solution:**

1. User must authorize FuncDock in GitHub/Bitbucket
2. Check OAuth app permissions
3. Re-authorize if access was revoked

#### "Cannot list repositories"

**Problem:** OAuth token doesn't have required permissions

**Solution:**

1. Check OAuth app permissions in GitHub/Bitbucket
2. Ensure "Repositories: Read" permission is granted
3. Re-authorize with correct permissions

### Security Best Practices

**✅ DO:**

- Use HTTPS in production
- Keep client secrets secure (never commit to Git)
- Use environment variables for credentials
- Regularly rotate client secrets
- Limit OAuth app permissions to minimum required
- Use separate OAuth apps for dev/staging/production

**❌ DON'T:**

- Commit OAuth credentials to Git
- Share client secrets
- Use overly permissive OAuth scopes
- Use the same OAuth app for multiple environments

### Production Deployment

For production, ensure:

1. **HTTPS Enabled** - OAuth requires HTTPS in production
2. **Correct Callback URLs** - Match your production domain
3. **Environment Variables** - Set in production environment
4. **Secret Management** - Use secure secret management (AWS Secrets Manager, etc.)
5. **Monitoring** - Monitor OAuth authentication failures

### Example Production Configuration

```bash
# .env.production
GITHUB_CLIENT_ID=prod_github_client_id
GITHUB_CLIENT_SECRET=prod_github_client_secret
GITHUB_REDIRECT_URI=https://funcdock.yourdomain.com/api/oauth/github/callback

BITBUCKET_CLIENT_ID=prod_bitbucket_client_id
BITBUCKET_CLIENT_SECRET=prod_bitbucket_client_secret
BITBUCKET_REDIRECT_URI=https://funcdock.yourdomain.com/api/oauth/bitbucket/callback
```

---

For more deployment options, see [DEPLOYMENT_README.md](DEPLOYMENT_README.md).

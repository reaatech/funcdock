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

### Production
```
https://your-domain.com/dashboard/
```

### Authentication
- **Local**: No authentication required
- **Production**: Configure authentication in Settings

---

## 📊 Main Dashboard

The main dashboard provides an **overview** of your entire FuncDock platform.

### Dashboard Stats

| Metric | Description | Icon |
|--------|-------------|------|
| **Total Functions** | Number of deployed functions | 📦 |
| **Running Functions** | Functions currently active | ✅ |
| **Errors** | Functions with issues | ❌ |
| **Uptime** | System uptime in hours | ⏰ |

### Real-Time Updates

The dashboard updates **automatically** via WebSocket connections:
- Function status changes
- New log entries
- Performance metrics
- System health updates

### Function Overview Table

| Column | Description |
|--------|-------------|
| **Name** | Function identifier and link to details |
| **Status** | Running, Error, or Stopped with color coding |
| **Routes** | Number of registered routes |
| **Cron Jobs** | Number of scheduled tasks |
| **Last Updated** | Timestamp of last modification |
| **Actions** | Quick access to test, edit, or delete |

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

Access comprehensive logging at `http://localhost:3000/dashboard/logs`

#### Log Filters

| Filter | Options | Description |
|--------|---------|-------------|
| **Function** | All functions or specific function | Filter by function name |
| **Log Level** | ERROR, WARN, INFO, DEBUG, ALL | Filter by severity |
| **Search** | Free text | Search within log messages |
| **Time Range** | Last 100, 500, 1000 logs | Limit log entries |

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

| Level        | Color | Description                | Use Case                        |
|--------------|-------|----------------------------|---------------------------------|
| ERROR        | 🔴 Red | Critical errors            | Function failures, crashes      |
| WARN         | 🟡 Yellow | Warning messages         | Deprecated features, issues     |
| INFO         | 🔵 Blue | Information               | Function calls, status updates  |
| DEBUG        | ⚪ Gray | Debug information         | Development debugging           |
| ACCESS       | 🟢 Green | HTTP access logs         | HTTP requests to functions      |
| CRON         | 🟢 Green | Cron job events          | Cron job started/completed      |
| CRON_ERROR   | 🔴 Red | Cron job errors           | Cron job failures or warnings   |

> **Note:** Filtering by "CRON" in the dashboard will show both CRON and CRON_ERROR logs.

---

## 🚀 Function Deployment

### Deploy New Function

Access deployment at `http://localhost:3000/dashboard/deploy`

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

Access settings at `http://localhost:3000/dashboard/settings`

#### General Configuration
- **Platform Name**: Customize dashboard title
- **Theme**: Light/Dark mode toggle
- **Language**: Internationalization settings
- **Timezone**: Default timezone for logs and cron jobs

#### Security Settings
- **Authentication**: Enable/disable login requirement
- **CORS**: Configure cross-origin resource sharing
- **Rate Limiting**: Set request rate limits
- **Webhook Validation**: Configure webhook security

#### Performance Settings
- **Log Retention**: Configure log storage duration
- **Metrics Collection**: Enable/disable performance metrics
- **Cache Settings**: Configure function caching
- **Memory Limits**: Set function memory constraints

#### Integration Settings
- **Git Providers**: Configure GitHub, GitLab, Bitbucket
- **CI/CD**: Set up automated deployment pipelines
- **Monitoring**: Configure external monitoring tools
- **Alerts**: Set up notification systems

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
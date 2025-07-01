# 🚀 FuncDock

## 📚 Documentation Index

- [CLI](CLI_README.md) — Command-line tools and automation
- [CRON JOBS](CRONJOBS_README.md) — Scheduled tasks and cron job configuration
- [DASHBOARDS](DASHBOARDS_README.md) — Web dashboard usage and features
- [DEPLOYMENT](DEPLOYMENT_README.md) — Deployment strategies and workflows
- [SETUP](SETUP_README.md) — Installation and environment setup
- [TESTING](TESTING_README.md) — Unit, integration, and Dockerized testing
- [USAGE](#usage) — How to use FuncDock and its main features

---

# 🚀 FuncDock

A lightweight, production-ready serverless platform that runs multiple Node.js functions in a single Docker container with hot-reload capabilities, comprehensive logging, and deployment automation.

## ✨ Features

- 🐳 **Single Container**: All functions run in one Docker container
- 🔄 **Hot Reload**: Automatic reloading with filesystem watching
- ⏰ **Cron Jobs**: Scheduled task execution with timezone support ([see details](CRONJOBS_README.md))
- 📁 **Git Integration**: Deploy functions directly from Git repositories
- 🛣️ **Smart Routing**: Custom routing per function with conflict prevention
- 📊 **Monitoring**: Built-in status monitoring and health checks
- 🚨 **Alerting**: Integrated alert system with Slack support
- 🔒 **Security**: Route conflict prevention and request validation
- 🌐 **Full HTTP**: Complete HTTP method and status code support
- 📦 **Auto Dependencies**: Automatic npm package installation
- 🔧 **DevOps Ready**: GitHub Actions, Docker Compose, and deployment scripts

## 🏃‍♂️ Quick Start

### Prerequisites
- Node.js 22+ 
- Docker (optional, for containerized deployment)
- `jq` (for JSON processing in scripts): `brew install jq` (macOS) or `apt-get install jq` (Ubuntu)

### Option 1: Using Make (Recommended)
```bash
# Complete setup and start
make quickstart

# Or step by step
make setup
make install  
make dev
```

### Option 2: Using npm
```bash
# Setup the platform
npm install
npm run setup

# Start development server
npm run dev
```

### Option 3: Using Docker
```bash
# Development environment
docker-compose up

# Production environment  
docker-compose --profile production up
```

## 📊 Platform Status

Once running, visit these endpoints:

- **Platform Status**: http://localhost:3000/api/status (includes cron job status)
- **Health Check**: http://localhost:3000/health
- **Sample Function**: http://localhost:3000/hello-world/
- **Webhook Handler**: http://localhost:3000/webhook-handler/

### 🎛️ **Web Dashboard**
Access the management dashboard at **http://localhost:3000/dashboard/** for:
- Visual function management and monitoring
- Real-time logs and debugging
- Route testing and configuration
- System metrics and health checks

*For detailed dashboard usage, see [DASHBOARDS_README.md](DASHBOARDS_README.md)*

## 📚 Documentation

FuncDock includes comprehensive documentation for different aspects of the platform:

### 🎛️ **Dashboard & Management UI**
- **[DASHBOARDS_README.md](DASHBOARDS_README.md)** - Complete guide to the web-based management interface
  - Function monitoring and metrics
  - Real-time logs and debugging
  - Route management and testing
  - Cron job configuration
  - System health monitoring

### 🚀 **Deployment & Operations**
- **[DEPLOYMENT_README.md](DEPLOYMENT_README.md)** - Comprehensive deployment strategies
  - Git-based deployment workflows
  - Pull request testing and staging
  - Production deployment best practices
  - Host-based vs container-based deployment
  - CI/CD integration examples

### 📖 **Additional Resources**
- **Function Examples**: See the `functions/` directory for working examples
- **API Reference**: Built-in API endpoints for management and monitoring
- **Configuration**: Environment variables and platform settings
- **Troubleshooting**: Common issues and solutions

## 🏗️ Function Development

### Function Structure

Create functions in the `functions/` directory:

```
functions/
  my-function/
    handler.js           # Main function code (default)
    package.json         # Dependencies
    route.config.json    # Routing configuration
    .env                 # Function-specific environment variables (optional)
```

**Note:** You can specify a custom handler file in `route.config.json` using the `handler` field. If not specified, it defaults to `handler.js`.

### Function-Specific Environment Variables

Each function can have its own `.env` file for environment-specific configuration:

```bash
# functions/my-function/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/myapp
API_KEY=your_api_key_here
REDIS_URL=redis://localhost:6379
DEBUG=true
```

**Accessing Environment Variables in Handlers:**
```javascript
export default async function handler(req, res) {
  const { env } = req; // Get function-specific environment variables
  
  // Access your environment variables
  const dbUrl = env.DATABASE_URL;
  const apiKey = env.API_KEY;
  
  // Your logic here...
}
```

**Accessing Environment Variables in Cron Jobs:**
```javascript
export default async function handler(req) {
  const { env, logger } = req; // Get function-specific environment variables and logger
  
  // Access your environment variables
  const dbUrl = env.DATABASE_URL;
  const apiKey = env.API_KEY;
  
  logger.info('Cron job running with env vars', { hasApiKey: !!env.API_KEY });
  
  // Your cron job logic here...
}
```

**Environment Variable Features:**
- **Function Isolation**: Each function has its own environment variables
- **Security**: Variables are scoped to individual functions
- **Flexibility**: Different functions can use different configurations
- **Hot Reload**: Changes to `.env` files trigger function reload
- **Fallback**: Functions can still access global environment variables via `process.env`

### Per-Route Handler Files

Each route can specify its own handler file, allowing for better code organization:

```json
{
  "base": "/my-api",
  "handler": "handler.js",  // Default handler for routes without specific handler
  "routes": [
    { "path": "/", "methods": ["GET", "POST"] },
    { "path": "/users", "handler": "users.js", "methods": ["GET", "POST", "PUT"] },
    { "path": "/auth", "handler": "auth.js", "methods": ["POST"] },
    { "path": "/webhook", "handler": "webhook.js", "methods": ["POST"] }
  ]
}
```

This allows each route to have its own dedicated handler file, making the code more modular and easier to maintain.

### Dynamic Routing with Path Parameters

FuncDock supports Express.js-style dynamic routing with path parameters:

```json
{
  "base": "/my-api",
  "routes": [
    { "path": "/users/:id", "handler": "users.js", "methods": ["GET", "PUT", "DELETE"] },
    { "path": "/users/:userId/posts/:postId", "handler": "posts.js", "methods": ["GET"] },
    { "path": "/items/:category/:id", "handler": "items.js", "methods": ["GET", "POST"] }
  ]
}
```

**Path Parameters:**
- `:id` - Single parameter (e.g., `/users/123`)
- `:userId/posts/:postId` - Multiple parameters (e.g., `/users/123/posts/456`)
- `:category/:id` - Nested parameters (e.g., `/items/electronics/789`)

**Accessing Parameters in Handlers:**
```javascript
export default async function handler(req, res) {
  const { params } = req;
  const { id, userId, postId, category } = params;
  
  // Access path parameters
  console.log(`User ID: ${id}`);
  console.log(`Post ID: ${postId}`);
  
  // Your logic here...
}
```

### Built-in Logging

Each function automatically receives a logger instance injected into the request object:

```javascript
export default async function handler(req, res) {
  const { logger } = req; // Get the injected logger
  
  // Log at different levels
  logger.info('Processing request', { method: req.method });
  logger.warn('Deprecated feature used');
  logger.error('Something went wrong', { error: err.message });
  logger.debug('Debug information', { data: someData });
}
```

**Available Log Levels:**
- `logger.info()` - General information
- `logger.warn()` - Warnings
- `logger.error()` - Errors
- `logger.debug()` - Debug information (only in debug mode)

**Log Features:**
- Automatic function context in logs
- Structured logging with metadata
- File and console output
- Log rotation and management
- Configurable log levels

### Example Function

**handler.js:**
```javascript
export default async function handler(req, res) {
  const { method, body, query } = req;
  const { logger } = req; // Get the injected logger
  
  // Log the incoming request
  logger.info(`Request received: ${method} ${req.routePath}`, {
    query,
    hasBody: !!body
  });
  
  if (method === 'GET') {
    logger.info(`Processing GET request`, { name: query.name });
    return res.status(200).json({
      message: `Hello, ${query.name || 'World'}!`,
      timestamp: new Date().toISOString()
    });
  }
  
  if (method === 'POST') {
    logger.info(`Processing POST request`, { dataSize: JSON.stringify(body).length });
    return res.status(201).json({
      message: 'Created successfully',
      data: body
    });
  }
  
  logger.warn(`Unsupported method: ${method}`);
  return res.status(405).json({ error: 'Method Not Allowed' });
}
```

**route.config.json:**
```json
{
  "base": "/my-function",
  "handler": "handler.js",
  "routes": [
    { "path": "/", "methods": ["GET", "POST"] },
    { "path": "/status", "handler": "status.js", "methods": ["GET"] },
    { "path": "/api", "handler": "api.js", "methods": ["GET", "POST"] }
  ]
}
```

**package.json:**
```json
{
  "name": "my-function",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {}
}
```

## 🛠️ Function Management

### Create New Function
```bash
# Using Make (recommended)
make create-function NAME=my-api

# Manual creation
./scripts/create-function-template.sh my-api
```

### Deploy Functions

#### From Git Repository (Host-based - Recommended)
```bash
# Using Make (uses your host Git credentials)
make deploy-host-git REPO=https://github.com/user/my-function.git NAME=my-function

# Using deployment script (uses your host Git credentials)
npm run deploy-host -- --git https://github.com/user/my-function.git --name my-function --branch main
```

#### From Git Repository (Container-based)
```bash
# Using Make (requires Git credentials in container)
make deploy-git REPO=https://github.com/user/my-function.git NAME=my-function

# Using deployment script (requires Git credentials in container)
npm run deploy -- --git https://github.com/user/my-function.git --name my-function --branch main
```

#### From Local Directory
```bash
# Using Make  
make deploy-local PATH=./my-local-function NAME=my-function

# Using deployment script
npm run deploy -- --local ./my-local-function --name my-function
```

### Deployment Methods Explained

#### Host-based Deployment (Recommended)
- **Use when**: Deploying from private Git repositories or when you have SSH keys/Git credentials on your host
- **How it works**: 
  1. Clones/pulls from Git on your host machine (using your credentials)
  2. Copies the function to the container's mounted volume
  3. Triggers automatic reload
- **Commands**: `make deploy-host-git` or `npm run deploy-host`
- **Benefits**: Uses your existing Git setup, works with private repos, no credential management needed

#### Container-based Deployment
- **Use when**: Deploying from public repositories or when you want to manage credentials in the container
- **How it works**: 
  1. Executes Git operations inside the container
  2. Requires Git credentials to be configured in the container
- **Commands**: `make deploy-git` or `npm run deploy`
- **Benefits**: Self-contained, works in CI/CD environments

#### Update Existing Function
```bash
# Update from original source
make update-function NAME=my-function
npm run deploy -- --update my-function
```

#### Remove Function
```bash
# Remove deployed function
make remove-function NAME=my-function
npm run deploy -- --remove my-function
```

### List Functions
```bash
# Show all deployed functions
make list-functions
npm run deploy -- --list
```

Each function can have its own `.env` file for environment-specific configuration. See [SETUP_README.md](SETUP_README.md) for more details.

For advanced routing, monitoring, deployment, cron jobs, dashboards, and testing, see the respective documentation files linked above.

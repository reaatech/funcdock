# 🚀 FuncDock

A lightweight, production-ready serverless platform that runs multiple Node.js functions in a single Docker container with hot-reload capabilities, comprehensive logging, and deployment automation.

## ✨ Features

- 🐳 **Single Container**: All functions run in one Docker container
- 🔄 **Hot Reload**: Automatic reloading with filesystem watching
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

- **Platform Status**: http://localhost:3000/api/status
- **Health Check**: http://localhost:3000/health
- **Sample Function**: http://localhost:3000/hello-world/
- **Webhook Handler**: http://localhost:3000/webhook-handler/

## 🏗️ Function Development

### Function Structure

Create functions in the `functions/` directory:

```
functions/
  my-function/
    handler.js           # Main function code (default)
    package.json         # Dependencies
    route.config.json    # Routing configuration
```

**Note:** You can specify a custom handler file in `route.config.json` using the `handler` field. If not specified, it defaults to `handler.js`.

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

### Example Function

**handler.js:**
```javascript
export default async function handler(req, res) {
  const { method, body, query } = req;
  
  if (method === 'GET') {
    return res.status(200).json({
      message: `Hello, ${query.name || 'World'}!`,
      timestamp: new Date().toISOString()
    });
  }
  
  if (method === 'POST') {
    return res.status(201).json({
      message: 'Created successfully',
      data: body
    });
  }
  
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

#### From Git Repository
```bash
# Using Make
make deploy-git REPO=https://github.com/user/my-function.git NAME=my-function

# Using deployment script
npm run deploy -- --git https://github.com/user/my-function.git --name my-function --branch main
```

#### From Local Directory
```bash
# Using Make  
make deploy-local PATH=./my-local-function NAME=my-function

# Using deployment script
npm run deploy -- --local ./my-local-function --name my-function
```

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

## 🧪 Testing

### Test All Functions
```bash
# Run comprehensive test suite
make test-functions

# With verbose output
VERBOSE=true ./scripts/test-functions.sh

# Test specific URL
./scripts/test-functions.sh --url http://production.com --verbose
```

### Manual Testing
```bash
# Test example functions
make example-test

# Individual function tests
curl http://localhost:3000/hello-world/
curl -X POST http://localhost:3000/webhook-handler/github
```

## 📊 Monitoring & Management

### Platform Status
```bash
# Check status via Make
make status

# Direct API calls
curl http://localhost:3000/api/status | jq
curl http://localhost:3000/health
```

### View Logs
```bash
# Application logs
make logs
npm run logs

# Error logs only  
make error-logs
npm run error-logs

# Docker logs
make docker-logs
```

### Reload Functions
```bash
# Reload all functions
make reload
npm run reload

# Reload specific function
curl -X POST http://localhost:3000/api/reload \
  -H "Content-Type: application/json" \
  -d '{"functionName": "my-function"}'
```

## 🐳 Docker & Production

### Development with Docker
```bash
# Quick start
make docker-dev
docker-compose up

# Build and run manually
make build
make run
```

### Production Deployment
```bash
# With Caddy reverse proxy (recommended)
make production
docker-compose --profile production up -d

# Check health
make health
make ping
```

### Docker Commands
```bash
# Build image
make build
docker build -t funcdock .

# Run container
docker run -p 3000:3000 -v $(pwd)/functions:/app/functions funcdock

# View logs
docker logs funcdock
```

## 🌐 Reverse Proxy (Caddy)

FuncDock includes Caddy configuration for production:

### Basic Setup
```bash
# Edit Caddyfile for your domain
# Replace 'localhost' with 'your-domain.com'

# Start with Caddy
docker-compose --profile production up
```

### Caddy Features
- ✨ **Automatic HTTPS** with Let's Encrypt
- 🔒 **Security headers** built-in
- 📊 **JSON logging**
- ⚡ **Rate limiting** and compression
- 🚀 **Simple configuration**

### Custom Domain Setup
```caddyfile
your-domain.com {
    reverse_proxy funcdock:3000
    tls your-email@domain.com
}
```

## ⚙️ Environment Variables

Configure via `.env` file:

```bash
# Server
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Webhooks  
GITHUB_WEBHOOK_SECRET=your_secret
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Database (for your functions)
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://localhost:6379

# External APIs
OPENAI_API_KEY=sk-your_key
SENDGRID_API_KEY=SG.your_key
```

## 🔧 Development Workflow

### Quick Start for New Projects
```bash
# Complete setup
make quickstart

# Or step by step  
make setup
make install
make dev
```

### Daily Development
```bash
# Create new function
make create-function NAME=user-service

# Edit function code
# functions/user-service/handler.js (auto-reloads)

# Test function
curl http://localhost:3000/user-service/

# Deploy to production when ready
make deploy-git REPO=https://github.com/me/user-service.git NAME=user-service
```

### Maintenance
```bash
# Clean logs and temp files
make clean

# Deep clean including Docker
make clean-all

# Update all functions
make list-functions
make update-function NAME=each-function
```

## 📋 Make Commands Reference

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make quickstart` | Complete setup and start |
| `make dev` | Start development server |
| `make create-function NAME=x` | Create new function template |
| `make deploy-git REPO=x NAME=y` | Deploy from Git |
| `make deploy-local PATH=x NAME=y` | Deploy from local |
| `make list-functions` | List all functions |
| `make update-function NAME=x` | Update function |
| `make remove-function NAME=x` | Remove function |
| `make test-functions` | Test all functions |
| `make status` | Check platform status |
| `make logs` | View application logs |
| `make build` | Build Docker image |
| `make production` | Start production environment |

## 🚨 Alerting

Configure Slack alerts in `.env`:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

Alerts are sent for:
- Function deployment failures
- Route conflicts
- Platform errors
- Health check failures

## 🔒 Security

- **Route Conflict Prevention**: Functions can't override each other's routes
- **CORS Support**: Built-in CORS headers for browser requests
- **Security Headers**: Caddy adds security headers automatically
- **Rate Limiting**: Configurable via Caddy
- **Webhook Validation**: Built-in signature validation for GitHub/Stripe

## 📚 Function Examples

FuncDock includes sample functions:

- **hello-world**: Basic HTTP methods demo
- **webhook-handler**: GitHub, Stripe, Slack webhook processing

## 🤝 Contributing

1. Fork the repository
2. Create your function: `make create-function NAME=my-feature`
3. Test thoroughly: `make test-functions`
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

# 🚀 FuncDock — Setup Guide

Welcome to FuncDock! This guide will help you get up and running in minutes.

## Index
- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Using Make](#using-make)
  - [Using npm](#using-npm)
  - [Using Docker](#using-docker)
- [Environment Setup](#environment-setup)
- [First Run](#first-run)
- [Troubleshooting](TROUBLESHOOTING_README.md)

---

## Introduction
FuncDock is a serverless platform for Node.js functions, designed for speed, security, and developer happiness.

## Prerequisites
- Node.js 22+
- Docker (optional, for containerized deployment)
- `jq` (for JSON processing in scripts): `brew install jq` (macOS) or `apt-get install jq` (Ubuntu)
- **Redis server** (optional but recommended): Available for functions to use for caching, sessions, and state management

### Redis Setup

Redis is included in Docker containers and available for your functions to use. It's useful for:
- **Caching** - Store frequently accessed data
- **Sessions** - Manage user sessions
- **State Management** - Share state between function invocations
- **Rate Limiting** - Implement custom rate limiting
- **Queues** - Build job queues or task processing

**Redis is NOT required** for basic FuncDock operation, but many functions benefit from it.

#### Installation

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Docker (Included):**
Redis is automatically installed and started in Docker containers. No additional setup needed.

**Windows:**
Download from [redis.io](https://redis.io/download) or use WSL.

#### Configuration

**Default Connection:**
- **Host:** `localhost` (or `redis` in Docker networks)
- **Port:** `6379`
- **No password by default** (configure for production)

**Using Redis in Functions:**

```javascript
// Example: Using Redis in a function
import redis from 'redis';

const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

await client.connect();

export default async function handler(req, res) {
  // Cache data
  const cached = await client.get('cache-key');
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  
  // Fetch and cache
  const data = await fetchData();
  await client.set('cache-key', JSON.stringify(data), { EX: 3600 }); // 1 hour TTL
  res.json(data);
}
```

**Environment Variables:**
```bash
# Optional Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password  # If password-protected
```

**Production Recommendations:**
- Use password authentication
- Configure Redis persistence
- Set up Redis replication for high availability
- Monitor Redis memory usage
- Use Redis Sentinel for failover

**Verifying Redis:**
```bash
# Test Redis connection
redis-cli ping
# Should return: PONG

# Check Redis status (macOS)
brew services list | grep redis

# Check Redis status (Linux)
sudo systemctl status redis-server
```

## Installation

### Quick Start (Recommended for First-Time Users)

**One command to get started:**
```bash
make quickstart
```

This command:
1. Sets up directories and configuration
2. Installs all dependencies
3. Starts the development server

### Step-by-Step Installation

If you prefer manual setup or need more control:

#### Step 1: Install Dependencies
```bash
npm install
```

#### Step 2: Setup Platform
```bash
npm run setup
# or
make setup
```

#### Step 3: Start Server

**For Development:**
```bash
npm run dev
# or
make dev
```
- Includes hot reload
- Watches for file changes
- Best for active development

**For Production:**
```bash
npm start
# or
make start
```
- No file watching
- Optimized for production
- Use with process manager (PM2, systemd, etc.)

### Installation Methods Comparison

| Method | Use Case | Hot Reload | Best For |
|--------|----------|------------|----------|
| `make quickstart` | First-time setup | ✅ Yes | Getting started quickly |
| `npm run dev` | Development | ✅ Yes | Active development |
| `npm start` | Production | ❌ No | Production deployment |
| `make dev` | Development | ✅ Yes | Makefile workflow |
| `docker-compose up` | Containerized dev | ✅ Yes | Docker-based development |
| `make production` | Containerized prod | ❌ No | Docker production |

### Using Docker

**Development Environment:**
```bash
docker-compose up
```
- Includes hot reload
- Matches production environment
- Good for testing Docker setup

**Production Environment:**
```bash
docker-compose --profile production up
```
- Optimized for production
- Includes Caddy reverse proxy
- HTTPS enabled

### Command Reference

**Setup Commands:**
- `make quickstart` - Complete setup and start (recommended first time)
- `make setup` - Setup directories and config only
- `npm run setup` - Same as `make setup`
- `npm install` - Install dependencies only

**Start Commands:**
- `npm run dev` - Start with hot reload (development)
- `make dev` - Same as `npm run dev`
- `npm start` - Start production server
- `make start` - Same as `npm start`

**When to Use Each:**
- **First time:** `make quickstart`
- **Daily development:** `npm run dev`
- **Production:** `npm start` (with process manager)
- **Docker development:** `docker-compose up`
- **Docker production:** `docker-compose --profile production up` 

## Environment Setup

### Environment Variables

FuncDock uses environment variables for configuration. Create a `.env` file in the project root:

```bash
# Copy example (if exists)
cp .env.example .env

# Or create manually
touch .env
```

### Core Environment Variables

#### Required for Production

```bash
# JWT Secret (REQUIRED in production)
# Generate a strong random string
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Admin Credentials (REQUIRED in production)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password-here
```

#### Server Configuration

```bash
# Server Port (default: 3003)
PORT=3000

# Log Level (default: info)
# Options: error, warn, info, debug
LOG_LEVEL=info

# Node Environment
NODE_ENV=development  # or production
```

#### OAuth Configuration (Optional)

**GitHub OAuth:**
```bash
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/oauth/github/callback
# Production: https://yourdomain.com/api/oauth/github/callback
```

**Bitbucket OAuth:**
```bash
BITBUCKET_CLIENT_ID=your_bitbucket_client_id
BITBUCKET_CLIENT_SECRET=your_bitbucket_client_secret
BITBUCKET_REDIRECT_URI=http://localhost:3000/api/oauth/bitbucket/callback
# Production: https://yourdomain.com/api/oauth/bitbucket/callback
```

#### Redis Configuration (Optional)

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password  # If password-protected
```

### Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3003` | Server port number |
| `JWT_SECRET` | **Yes** (prod) | `'your-super-secret...'` | Secret for JWT token signing |
| `ADMIN_USERNAME` | **Yes** (prod) | `'admin'` | Dashboard admin username |
| `ADMIN_PASSWORD` | **Yes** (prod) | `'admin'` | Dashboard admin password |
| `LOG_LEVEL` | No | `'info'` | Logging level (error/warn/info/debug) |
| `NODE_ENV` | No | - | Node environment (development/production) |
| `GITHUB_CLIENT_ID` | No | - | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | No | - | GitHub OAuth client secret |
| `GITHUB_REDIRECT_URI` | No | `'http://localhost:3003/...'` | GitHub OAuth callback URL |
| `BITBUCKET_CLIENT_ID` | No | - | Bitbucket OAuth client ID |
| `BITBUCKET_CLIENT_SECRET` | No | - | Bitbucket OAuth client secret |
| `BITBUCKET_REDIRECT_URI` | No | `'http://localhost:3003/...'` | Bitbucket OAuth callback URL |
| `REDIS_HOST` | No | `'localhost'` | Redis server hostname |
| `REDIS_PORT` | No | `6379` | Redis server port |
| `REDIS_PASSWORD` | No | - | Redis password (if protected) |

### Function-Specific Environment Variables

Each function can have its own `.env` file in `functions/{function-name}/.env`:

```bash
# functions/my-function/.env
DATABASE_URL=postgres://user:pass@localhost:5432/mydb
API_KEY=your-api-key-here
DEBUG=true
```

Functions access these via `req.env`:

```javascript
export default async function handler(req, res) {
  const { env } = req;
  const apiKey = env.API_KEY;
  // Use environment variables...
}
```

### Production Checklist

Before deploying to production:

- [ ] Set strong `JWT_SECRET` (use `openssl rand -hex 32`)
- [ ] Change `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- [ ] Set `NODE_ENV=production`
- [ ] Configure OAuth credentials (if using)
- [ ] Set up Redis password (if using)
- [ ] Review all environment variables
- [ ] Never commit `.env` files to Git
- [ ] Use secure secret management (AWS Secrets Manager, etc.)

### Loading Environment Variables

Environment variables are automatically loaded from:
1. `.env` file in project root (via `dotenv`)
2. System environment variables
3. Function-specific `.env` files

**Priority:** System env vars > `.env` file > defaults

## First Run
- Visit [http://localhost:3000/api/status](http://localhost:3000/api/status) to check platform status.
- Access the dashboard at [http://localhost:3000/dashboard/](http://localhost:3000/dashboard/)

**Note:** The server defaults to port 3003 if the `PORT` environment variable is not set. Set `PORT=3000` in your environment or `.env` file to use port 3000. Docker Compose and npm scripts use port 3000 by default.

For more help, see [TROUBLESHOOTING_README.md](TROUBLESHOOTING_README.md). 
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

# USAGE

> **Note:** A Redis server is available on `localhost:6379` for all functions. See [SETUP_README.md](SETUP_README.md) for details.

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

See [SETUP_README.md](SETUP_README.md) for prerequisites and installation instructions.

### Option 1: Using Make (Recommended)
```bash
make quickstart
# Or step by step
make setup
make install  
make dev
```

### Option 2: Using npm
```bash
npm install
npm run setup
npm run dev
```

### Option 3: Using Docker
```bash
docker-compose up
docker-compose --profile production up
```

## 📊 Platform Status

Once running, visit these endpoints:

- **Platform Status**: http://localhost:3000/api/status (includes cron job status)
- **Health Check**: http://localhost:3000/health
- **Sample Function**: http://localhost:3000/hello-world/
- **Webhook Handler**: http://localhost:3000/webhook-handler/

## 🏗️ Function Development

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

Each function can have its own `.env` file for environment-specific configuration. See [SETUP_README.md](SETUP_README.md) for more details.

For advanced routing, monitoring, deployment, cron jobs, dashboards, and testing, see the respective documentation files linked above.

# 🚀 FuncDock

> **The all-in-one, production-ready serverless platform for Node.js functions.**

---

![FuncDock Logo](public/dashboard/assets/index-BTy2vMIs.css)

## Why FuncDock?

FuncDock lets you run, manage, and deploy multiple Node.js functions in a single Docker container—fast, secure, and with zero hassle. Whether you're building APIs, webhooks, cron jobs, or microservices, FuncDock gives you:

- 🚀 Lightning-fast hot reload
- 🐳 Effortless Dockerized deployment
- 🔄 Git-based and local function management
- ⏰ Built-in cron job scheduling
- 📊 Real-time monitoring and dashboards
- 🔒 Security, alerting, and route conflict prevention
- 🧪 Comprehensive testing and CI/CD support

## ✨ Features

- **Single Container**: All functions run in one Docker container
- **Hot Reload**: Automatic reloading with filesystem watching
- **Cron Jobs**: Scheduled task execution with timezone support
- **Git Integration**: Deploy functions directly from Git repositories
- **Smart Routing**: Custom routing per function with conflict prevention
- **Monitoring**: Built-in status monitoring and health checks
- **Alerting**: Integrated alert system with Slack support
- **Security**: Route conflict prevention and request validation
- **Full HTTP**: Complete HTTP method and status code support
- **Auto Dependencies**: Automatic npm package installation
- **DevOps Ready**: GitHub Actions, Docker Compose, and deployment scripts

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup the platform
npm run setup

# 3. Start development server
npm run dev

# Or use Docker
make quickstart
# or
docker-compose up
```

## How It Works

- Place your functions in the `functions/` directory (each with its own handler, config, and optional cron jobs).
- FuncDock auto-detects, hot-reloads, and manages all functions in a single container.
- Use the web dashboard for real-time monitoring, logs, and management.
- Deploy from Git, local, or CI/CD with a single command.

## 📚 Documentation Index

- [SETUP](SETUP_README.md) — Installation and environment setup
- [USAGE](USAGE_README.md) — Day-to-day usage and function development
- [DEPLOYMENT](DEPLOYMENT_README.md) — Deployment strategies and workflows
- [CLI](CLI_README.md) — Command-line tools and automation
- [CRON JOBS](CRONJOBS_README.md) — Scheduled tasks and cron job configuration
- [DASHBOARDS](DASHBOARDS_README.md) — Web dashboard usage and features
- [TESTING](TESTING_README.md) — Unit, integration, and Dockerized testing
- [TROUBLESHOOTING](TROUBLESHOOTING_README.md) — Common issues and solutions
- [CONTRIBUTING](CONTRIBUTING_README.md) — How to contribute
- [SECURITY](SECURITY_README.md) — Security features and best practices

---

FuncDock is open source and MIT licensed. [Contribute](CONTRIBUTING_README.md) or [get started now!](SETUP_README.md)

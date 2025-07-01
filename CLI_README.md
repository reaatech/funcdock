# 🚀 FuncDock — CLI Guide

## Index
- [Overview](#overview)
- [Makefile Commands](#makefile-commands)
- [npm Scripts](#npm-scripts)
- [CLI Examples](#cli-examples)
- [Automation Tips](#automation-tips)

---

## Overview
FuncDock provides a rich CLI for development, deployment, and management.

## Makefile Commands
- `make quickstart` — Setup and start everything
- `make dev` — Start dev server
- `make create-function NAME=...` — Create a new function
- `make deploy-git REPO=... NAME=...` — Deploy from Git
- `make deploy-local PATH=... NAME=...` — Deploy from local
- `make list-functions` — List all functions
- `make update-function NAME=...` — Update a function
- `make remove-function NAME=...` — Remove a function
- `make logs` — View logs
- `make build` — Build Docker image
- `make production` — Start production

## npm Scripts
- `npm run setup` — Initial setup
- `npm run dev` — Start dev server
- `npm run deploy` — Deploy function
- `npm run test` — Run all tests
- `npm run logs` — View logs
- ...and more

## CLI Examples
```bash
make create-function NAME=api
make deploy-git REPO=https://github.com/user/api.git NAME=api
npm run deploy -- --update api
```

## Automation Tips
- Use Makefile targets in CI/CD pipelines.
- Combine commands for custom workflows.
- See [DEPLOYMENT_README.md](DEPLOYMENT_README.md) for more.

## Makefile & npm Scripts

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

### Update Existing Function
```bash
# Update from original source
make update-function NAME=my-function
npm run deploy -- --update my-function
```

### Remove Function
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

## Make Commands Reference

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

*For detailed deployment strategies and workflows, see the [Deployment Guide](DEPLOYMENT_GUIDE.md)* 
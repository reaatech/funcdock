# FuncDock Architecture

> High-level system design, component interactions, and key architectural decisions.

---

## Overview

FuncDock is a Node.js Function-as-a-Service (FaaS) platform that runs multiple serverless functions inside a single Docker container. It uses a **custom route dispatcher** instead of Express's native router to avoid middleware stack accumulation on hot reloads.

---

## Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                        HTTP Request                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Express App                                                 │
│  ├── helmet, cors, compression                               │
│  ├── express.json() / express.urlencoded()                   │
│  ├── authenticateToken (JWT cookie / Bearer)                 │
│  ├── static files (/dashboard)                               │
│  └── functionDispatcherMiddleware ←── Map-based dispatch     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Function Dispatcher (Map: "METHOD /path" → handler)         │
│  ├── Injects: logger, env, functionName, routePath           │
│  ├── OpenTelemetry span wrapping                             │
│  └── Executes handler.js / per-route handler                 │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

| Component            | File                                         | Responsibility                                                                |
| -------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| **HTTP Server**      | `server.js`                                  | Express setup, auth, API routes, function/layer lifecycle                     |
| **Route Dispatcher** | `server.js` (`functionDispatcherMiddleware`) | Map-based routing avoiding Express router stack bloat                         |
| **Function Loader**  | `server.js` (`loadFunction`)                 | Reads `route.config.json`, installs deps, resolves handlers, registers routes |
| **Layer Loader**     | `utils/layer-loader.js`                      | Discovers layers, manages symlinks, installs layer deps                       |
| **Logger**           | `utils/logger.js`                            | Structured logging with rotation, buffering, Slack alerts                     |
| **Test Runner**      | `utils/test-runner.js`                       | Jest invocation for deployment gating                                         |
| **Tracer**           | `utils/tracer.js`                            | OpenTelemetry SDK wrapper                                                     |
| **Deploy Backup**    | `utils/deployment-backup.js`                 | Pre-deploy backup with automatic rollback                                     |
| **Dashboard**        | `dashboard/src/`                             | React 19 + Vite SPA for management and monitoring                             |
| **MCP Server**       | `mcp-server.js`                              | Exposes functions as MCP tools                                                |

---

## Data Flow

### 1. Request Lifecycle

```
Client Request
    │
    ▼
Express middleware chain (helmet, cors, compression, json parser)
    │
    ▼
functionDispatcherMiddleware
    ├── Look up "METHOD path" in functionDispatcher Map
    ├── If found: build FuncDockRequest (inject logger, env, metadata)
    ├── Wrap execution in OpenTelemetry span
    ├── Execute handler
    └── If not found: 404
    │
    ▼
Handler executes (async/await, calls res.json() / res.send())
    │
    ▼
Response returned to client
```

### 2. Hot Reload Lifecycle

```
File change detected (chokidar)
    │
    ▼
Debounce (5s cooldown)
    │
    ▼
unloadFunction(name)
    ├── Remove routes from functionDispatcher Map
    ├── Stop cron jobs
    └── Clear module cache
    │
    ▼
loadFunction(name)
    ├── Read route.config.json
    ├── Install dependencies (if needed)
    ├── Create layer symlinks (if layers.json present)
    ├── Import handler with ?update=${Date.now()} cache bust
    ├── Validate routes (no conflicts)
    └── Register routes in functionDispatcher Map
    │
    ▼
Emit Socket.IO event → Dashboard updates live
```

### 3. Deployment Lifecycle

```
Deploy triggered (Git / Local / Dashboard / API)
    │
    ▼
Copy/clone function code into functions/<name>/
    │
    ▼
validateFunctionDeployment()
    ├── Run Jest tests
    └── If tests fail → abort
    │
    ▼
safeDeploy() (optional)
    ├── Create backup in .deployment-backups/
    ├── Write .deployment.json metadata
    └── On failure → automatic rollback
    │
    ▼
Trigger reload (API call or file watcher)
    │
    ▼
loadFunction() → hot reload with zero downtime
```

---

## Key Design Decisions

### Why a Custom Dispatcher Instead of Express Router?

Express routers accumulate middleware on every `app.use()`. On hot reload, repeatedly registering/unregistering routes causes memory leaks and stack bloat. FuncDock uses a single `functionDispatcherMiddleware` that looks up handlers in a `Map` keyed by `"METHOD /path"`. This allows instant route swaps with O(1) lookup and zero Express stack pollution.

### Why ESM with Cache Busting?

Node.js ESM modules are cached aggressively. On hot reload, `import()` returns the cached module even if the file changed. FuncDock appends `?update=${Date.now()}` to dynamic import URLs to force V8 to treat each reload as a distinct module.

### Why Lambda-Style Layers?

Functions often share utility code. Instead of duplicating dependencies or using monorepo complexity, FuncDock creates symlinks from `functions/<name>/node_modules/<layer>` → `layers/<layer>/nodejs/`. This gives each function isolated `node_modules` while sharing code. Changing a layer triggers reload of all dependent functions.

### Why JWT via httpOnly Cookie?

Earlier versions stored tokens in `localStorage`, which is vulnerable to XSS. FuncDock now sets `funcdock-token` as an `httpOnly` cookie. The dashboard API client uses `withCredentials: true`. This eliminates XSS token theft while maintaining SPA compatibility.

### Why Single Container?

Traditional serverless platforms spin up a container per function, causing cold starts and complex orchestration. FuncDock loads all functions into one Node.js process, sharing the event loop and memory. This eliminates cold starts entirely and reduces infrastructure overhead by ~80%.

---

## Directory Layout

```
funcdock/
├── server.js                 # Main Express server (~3,500 lines)
├── functions/                # Deployable functions
│   ├── hello-world/
│   │   ├── handler.js
│   │   ├── handler.test.mjs
│   │   ├── route.config.json
│   │   ├── cron.json
│   │   ├── cron-handler.js
│   │   ├── layers.json
│   │   ├── package.json
│   │   └── .env
│   └── ...
├── layers/                   # Shared code layers
│   └── shared-utils/
│       ├── layer.config.json
│       └── nodejs/
├── dashboard/                # React 19 + Vite admin UI
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── utils/                    # Core platform utilities
│   ├── layer-loader.js
│   ├── logger.js
│   ├── test-runner.js
│   ├── tracer.js
│   └── deployment-backup.js
├── scripts/                  # CLI tooling
│   ├── deploy.js
│   ├── deploy-from-host.js
│   ├── test-function-in-docker.js
│   └── create-function-template.sh
├── test/
│   └── setup.mjs             # Jest helpers (testHandler, expectStatus)
├── types/
│   └── funcdock.d.ts         # TypeScript definitions
├── public/dashboard/         # Built dashboard assets
├── docs/                     # Documentation
└── .github/workflows/        # CI/CD pipelines
```

---

## Configuration Files

| File                      | Purpose                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `.env` / `.env.example`   | JWT_SECRET, ADMIN_USERNAME/PASSWORD, PORT, OAuth secrets, MCP config, OTEL endpoint |
| `route.config.json`       | Per-function routing: base path, handler file, route definitions                    |
| `cron.json`               | Per-function scheduled jobs: name, schedule, handler, timezone                      |
| `layers.json`             | Per-function layer references: `"layer-name"` or `{"layer": "layer-name"}`          |
| `layer.config.json`       | Layer metadata: name, version, compatible runtimes                                  |
| `package.json` (root)     | Platform dependencies                                                               |
| `package.json` (function) | Function-specific dependencies                                                      |
| `jest.config.mjs`         | Jest ESM configuration                                                              |
| `eslint.config.mjs`       | Flat ESLint config                                                                  |
| `.prettierrc`             | Prettier formatting rules                                                           |

---

## API Surface

### Public Endpoints (no auth)

- `GET /health` — Health check
- `POST /api/auth/login` — JWT login (sets httpOnly cookie)
- `POST /api/auth/logout` — Invalidate token

### Authenticated API Endpoints

- `GET /api/status` — System status
- `GET /api/functions` — List all functions
- `GET/POST/PUT/DELETE /api/functions/:name` — Function CRUD
- `POST /api/functions/deploy/*` — Deployment endpoints
- `GET/POST /api/layers` — Layer CRUD
- `GET /api/logs` — System logs
- `GET /api/metrics` — Prometheus metrics

### MCP Server

- Starts on `MCP_HTTP_PORT` (default 3001)
- Exposes each function route as a named tool
- Supports stdio and HTTP transports

---

## Scaling Considerations

FuncDock is designed for **medium-scale** serverless workloads:

- **Vertical scaling**: One container runs many functions efficiently
- **Horizontal scaling**: Run multiple FuncDock instances behind a load balancer; each instance manages its own function set
- **Redis**: Used for token blacklisting (logout) and can be extended for distributed state
- **File watcher**: Uses `chokidar` with debouncing; suitable for moderate file change velocity

For very high traffic, consider running FuncDock behind a reverse proxy (Caddy/Nginx) with multiple instances.

# Changelog

All notable changes to FuncDock will be documented in this file.

## [2.0.0] - 2026-04-20

### Added

- **TypeScript Runtime Support**
  - Added `tsx` for on-the-fly TypeScript execution without pre-compilation
  - Added `tsconfig.json` with ESM and Node 22 targets
  - Added TypeScript example function under `functions/ts-example/`
  - Added `types/funcdock.d.ts` for platform type definitions

- **MCP (Model Context Protocol) Server**
  - New `mcp-server.js` exposing every function route as an MCP tool
  - New `mcp-transport.js` supporting stdio and HTTP transports
  - Dashboard MCP management page (`dashboard/src/pages/MCP.jsx`)
  - Configurable via `MCP_ENABLED`, `MCP_HTTP_PORT`, and `MCP_API_KEY`

- **OpenTelemetry Observability**
  - New `utils/tracer.js` wrapping the OpenTelemetry SDK
  - Function execution auto-wrapped in spans
  - Configurable via `OTEL_ENDPOINT`

- **FuncDock CLI**
  - New `bin/funcdock.js` entry point
  - New `cli/` directory with commands: `create`, `deploy`, `update`, `test`, `logs`, `status`
  - Replaces Makefile-driven workflows for day-to-day operations

- **Security Hardening**
  - Required env var validation: `JWT_SECRET` (min 16 chars), `ADMIN_USERNAME`, `ADMIN_PASSWORD` (min 8 chars) or `ADMIN_PASSWORD_HASH`
  - httpOnly `funcdock-token` cookie authentication (replaces localStorage token storage)
  - Token blacklist for logout (in-memory Map, Redis-ready)
  - Strict input validators for Git URLs, branch names, commit SHAs, function/layer names, and file paths
  - `cookie-parser` middleware for secure cookie handling
  - `trust proxy` enabled for secure reverse-proxy deployments

- **Dashboard Rewrite (React 19 + Vite)**
  - Full dashboard rebuild with React 19
  - New pages: MCP, Settings, LayerDetail, FunctionDetail (enhanced)
  - Theme context with dark/light mode support
  - Real-time Socket.IO sync with credentials
  - Updated built assets in `public/dashboard/`

- **Testing & Quality Tooling**
  - Expanded test coverage across all example functions (`hello-world`, `webhook-handler`, `test-deploy`, `example-layer-function`)
  - New `test/__mocks__/` for Jest mocks
  - New `jest.config.mjs` with ESM and coverage settings
  - ESLint flat config (`eslint.config.mjs`) with React plugin
  - Prettier (`.prettierrc`, `.prettierignore`)
  - Husky pre-commit hooks (`.husky/`)
  - `scripts/prepare.js` for repo setup automation

- **CI/CD & Deployment**
  - New `.github/workflows/ci.yml` — lint, format, test, and Docker build on push/PR
  - New `.github/workflows/auto-deploy-function.yml` — automated function deployment
  - Updated `.github/workflows/deploy-function.yml`
  - Deployment backup and rollback via `utils/deployment-backup.js`

- **Agent Skills**
  - New `skills/funcdock-function-dev/SKILL.md`
  - New `skills/funcdock-layer-dev/SKILL.md`
  - New `skills/funcdock-deployment/SKILL.md`

- **Documentation**
  - New `AGENTS.md` — development conventions for AI coding agents
  - New `ARCHITECTURE.md` — system design, data flow, and key decisions
  - New `CONTRIBUTING.md` — contribution guidelines
  - Overhauled all `docs/*.md` files for v2.0 features

- **Docker & Compose**
  - Added `docker-compose.yml` for quick local orchestration
  - Updated `Dockerfile` and `Dockerfile.test`
  - Updated `.dockerignore`

### Changed

- **Core Server (`server.js`)**
  - Replaced Express router with a `Map`-based `functionDispatcher` to eliminate middleware stack bloat on hot reload
  - Refactored authentication to use httpOnly cookies + Bearer header dual support
  - Added mutex-based locking for concurrent operations on shared Maps
  - Unified CORS origin handling with `DASHBOARD_ORIGIN` env var
  - `node-fetch` removed; native `fetch` used throughout

- **Layer Loader (`utils/layer-loader.js`)**
  - Lambda-style layer symlinks (`functions/<name>/node_modules/<layer>` → `layers/<layer>/nodejs/`)
  - Automatic layer dependency installation
  - Cross-platform symlink handling (junction fallback on Windows)

- **Logger (`utils/logger.js`)**
  - Structured logging with rotation, buffering, and Slack webhook alerts
  - Alert-level log routing

- **Example Functions**
  - All examples updated to v2.0 patterns (ESM, `req.env`, single quotes, braced switch cases)
  - New `users.js` and `cron-handler.js` patterns in `hello-world`
  - `webhook-handler` expanded with generic, GitHub, Slack, and Stripe handler tests

- **License**
  - Minor attribution update to REAA Technologies

### Removed

- `.env` from version control (replaced by `.env.example`)
- `ROADMAP.md` (superseded by GitHub issues and docs)
- Old dashboard assets (rebuilt with new hashes)
- `node-fetch` dependency

### Migration Notes

1. **Environment variables**: Copy `.env.example` to `.env` and set `JWT_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`.
2. **Auth tokens**: Dashboard now uses httpOnly cookies. Clear any old `localStorage` tokens.
3. **CLI**: Replace `make deploy-local` / `make deploy-host-git` with `funcdock deploy --local` / `funcdock deploy --git`.
4. **Tests**: Test files now use `.mjs` extension and `test/setup.mjs` utilities.
5. **Dashboard build**: Run `cd dashboard && npm run build` to regenerate `public/dashboard/` after any dashboard changes.

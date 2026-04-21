# Agent Guide for FuncDock

> Instructions for AI coding agents working on the FuncDock codebase.

---

## Project Basics

- **Name**: FuncDock v2.0.0
- **Runtime**: Node.js 22+, ESM (`"type": "module"` in package.json)
- **Language**: JavaScript (ES2022+) with TypeScript definitions
- **Test Framework**: Jest with `--experimental-vm-modules`
- **Package Manager**: npm
- **Default Port**: 3000 (unified across server, Docker, docs)

---

## Build & Test Commands

```bash
# Install dependencies
npm install

# Start development server (node --watch)
npm run dev

# Run tests
npm test                           # All tests
npm run test:functions            # Function tests only
npm run test:coverage             # With coverage report

# Build dashboard
cd dashboard && npm ci && npm run build

# Docker
make quickstart                   # docker-compose up

# Lint / Format
npx eslint .                      # Lint check
npx prettier --check .            # Format check
npx prettier --write .            # Format fix
```

**Important**: Tests require `NODE_OPTIONS="--experimental-vm-modules"`. The `npm test` script already includes this.

---

## Project Structure for Agents

```
server.js              # Main Express server. Keep changes minimal and focused.
functions/             # User functions. Each dir = one deployable unit.
layers/                # Shared code layers. Symlinked into function node_modules.
dashboard/             # React 19 + Vite SPA. Separate package.json.
utils/                 # Platform utilities. Reusable, testable modules.
scripts/               # CLI tools. ESM, use spawn with shell: false.
test/                  # Jest setup helpers.
types/                 # TypeScript type definitions.
docs/                  # Human documentation.
skills/                # Shared agent skills (function-dev, layer-dev, deployment).
```

---

## Agent Skills

The `skills/` directory contains reusable skills for working with FuncDock:

| Skill                    | Path                                    | Use When                                                            |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------- |
| **Function Development** | `skills/funcdock-function-dev/SKILL.md` | Creating or modifying functions, handlers, routes, cron jobs, tests |
| **Layer Development**    | `skills/funcdock-layer-dev/SKILL.md`    | Creating shared layers, managing symlinks, layer dependencies       |
| **Deployment**           | `skills/funcdock-deployment/SKILL.md`   | Deploying functions via Git/local/Docker, CI/CD integration         |

Read the relevant SKILL.md before starting work in that area.

---

## Coding Conventions

### JavaScript / ESM

- Use `import`/`export` only. No `require`/`module.exports`.
- Prefer `async`/`await` over callbacks.
- Use `const`/`let`; avoid `var`.
- String literals: single quotes (`'string'`) per Prettier config.
- Line width: 100 characters.
- Tab width: 2 spaces.

### Error Handling

- Always include `cause` when re-throwing errors: `throw new Error('msg', { cause: err })`.
- Log errors before throwing if they represent operational failures.
- Use `try/catch` with named error variables; don't leave bare `catch { }` unless intentionally swallowing.

### Function Handlers

```js
// Correct pattern
export default async function handler(req, res) {
  const { logger, env, method, query, body } = req;
  // ... handler logic
  res.json({ result });
}
```

### Switch Statements

- Always brace `case` blocks that declare variables:

```js
switch (value) {
  case 'a': {
    const x = 1;
    break;
  }
}
```

### Security

- Never use `localStorage` for tokens. Auth is httpOnly cookie + Bearer header only.
- Never commit `.env`. Use `.env.example` for templates.
- Use `req.env?.SECRET || process.env.SECRET` for function-local env vars.
- Validate all user inputs. Sanitize file paths (no `..` traversal).

---

## Common Tasks

### Adding a New Function

1. Create directory under `functions/<name>/`
2. Add `handler.js`, `route.config.json`, and optional `package.json`
3. Add tests: `handler.test.mjs` using `test/setup.mjs`
4. Run `npm test -- functions/<name>` to verify

### Adding a Layer

1. Create `layers/<name>/nodejs/` structure
2. Add `layer.config.json` with name and version
3. Add `package.json` and code in `nodejs/`
4. Reference from function via `layers.json`

### Modifying the Dispatcher

The dispatcher is in `server.js` as `functionDispatcherMiddleware`. It runs **after** `express.json()` and `express.urlencoded()`. The `functionDispatcher` is a `Map<string, Function>` keyed by `"METHOD /path"`.

### Adding API Endpoints

Add Express routes in `server.js` near the other `app.get/post/put/delete` calls. Use `authenticateToken` middleware for protected endpoints.

### Modifying Dashboard

The dashboard is a separate Vite app in `dashboard/`. It has its own `package.json` and `node_modules`. Run `npm run build` in `dashboard/` to update `public/dashboard/`.

---

## Testing

### Test Utilities

```js
import { testHandler, expectStatus } from '../../test/setup.mjs';

const { res } = await testHandler(handler, {
  method: 'GET',
  query: { name: 'Test' },
  body: { key: 'value' },
});

expectStatus(res, 200);
expect(res.body.message).toBe('Hello, Test!');
```

### Running Tests

```bash
# Single function
NODE_OPTIONS="--experimental-vm-modules" npx jest functions/hello-world

# With coverage
npx jest --coverage

# In Docker (production-like)
funcdock test hello-world --docker
```

---

## Environment Variables

| Variable                         | Required | Description                               |
| -------------------------------- | -------- | ----------------------------------------- |
| `JWT_SECRET`                     | Yes      | Min 16 chars                              |
| `ADMIN_USERNAME`                 | Yes      | Dashboard login                           |
| `ADMIN_PASSWORD`                 | Yes      | Dashboard login                           |
| `PORT`                           | No       | Default 3000                              |
| `NODE_ENV`                       | No       | `development` / `production`              |
| `LOG_LEVEL`                      | No       | `debug`, `info`, `warn`, `error`, `alert` |
| `REDIS_PASSWORD`                 | No       | Default `funcdock_internal`               |
| `MCP_ENABLED`                    | No       | `true` to start MCP server                |
| `MCP_HTTP_PORT`                  | No       | Default 3001                              |
| `MCP_API_KEY`                    | No       | Bearer token for MCP HTTP transport       |
| `OTEL_ENDPOINT`                  | No       | OpenTelemetry collector URL               |
| `SLACK_WEBHOOK_URL`              | No       | Alert notifications                       |
| `GITHUB_CLIENT_ID` / `SECRET`    | No       | GitHub OAuth                              |
| `BITBUCKET_CLIENT_ID` / `SECRET` | No       | Bitbucket OAuth                           |

---

## Git Workflow

- Default branch: `main`
- No `.env` in git (use `.env.example`)
- Run `npm test` before committing
- Run `npx prettier --write .` and `npx eslint .` before PRs
- CI runs on all pushes/PRs to `main`/`master`

---

## MCP Server Notes

The MCP server exposes every loaded function route as a tool. Tool naming: `{functionName}__{route_path}__{method}`. If you add/remove routes or change handler signatures, the MCP tool schema changes automatically on reload.

---

## Known Pitfalls

1. **ESM cache**: Dynamic imports use `?update=${Date.now()}` to bust cache on hot reload. If you modify `loadFunction()`, preserve this pattern.
2. **Layer symlinks**: On Windows, symlinks may require admin. The layer loader falls back to `mklink /J` junctions.
3. **Dispatcher order**: `functionDispatcherMiddleware` must run AFTER body parsers (`express.json()`). If you move middleware, verify this order.
4. **Redis**: The Dockerfile starts Redis daemonized internally. For production, use an external Redis instance.
5. **Dashboard build**: `dashboard/` builds to `public/dashboard/`. Express serves this statically. If dashboard assets are missing, run `cd dashboard && npm run build`.

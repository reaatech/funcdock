# FuncDock Function Development

Develop, test, and deploy serverless functions for the FuncDock FaaS platform.

## When to Use

Use this skill when:

- Creating a new function under `functions/`
- Adding routes, handlers, or cron jobs to an existing function
- Writing tests for function handlers
- Debugging function behavior or route conflicts

## Function Structure

```
functions/<name>/
  handler.js              # Default handler (required)
  handler.test.mjs        # Tests (required for deployment gating)
  route.config.json       # Routing configuration (required)
  package.json            # Function-specific deps (optional)
  cron.json               # Scheduled jobs (optional)
  cron-handler.js         # Cron job handler (optional)
  layers.json             # Layer references (optional)
  .env                    # Function-local env vars (optional)
```

## route.config.json

```json
{
  "base": "/my-function",
  "handler": "handler.js",
  "routes": [
    { "path": "/", "methods": ["GET", "POST"] },
    { "path": "/users/:id", "handler": "users.js", "methods": ["GET", "PUT", "DELETE"] }
  ]
}
```

Rules:

- `base` is the URL prefix (e.g., `/my-function` → `GET /my-function/`)
- `handler` is the default handler file for routes without a specific `handler`
- Each route's `path` is relative to `base`
- `:param` syntax supported for path parameters

## Handler Signature

```js
export default async function handler(req, res, next) {
  // req.logger     — structured logger (info, warn, error, debug, alert)
  // req.env        — merged env vars (function .env + process.env)
  // req.functionName
  // req.functionPath
  // req.routePath
  // req.routeHandler
  // req.bodyRaw    — raw body string (if JSON parsed)

  res.json({ message: 'Hello' });
  // or res.status(404).send('Not found');
  // or next() to pass to additional middleware
}
```

## Cron Handler Signature

```js
export default async function handler(req) {
  const { logger, cronJob, schedule, jobName } = req;
  logger.log('CRON', `Running ${cronJob}`);
  // Return a value or throw on error
}
```

## Testing

```js
import { testHandler, expectStatus } from '../../test/setup.mjs';
import handler from './handler.js';

describe('my-function', () => {
  it('should respond to GET', async () => {
    const { res } = await testHandler(handler, { method: 'GET' });
    expectStatus(res, 200);
    expect(res.body.message).toBeDefined();
  });
});
```

Run tests:

```bash
NODE_OPTIONS="--experimental-vm-modules" npx jest functions/my-function
```

## Deployment Gating

Tests must pass before deployment. The deploy scripts call `utils/test-runner.js` which runs Jest and blocks deploy on failure.

## Common Issues

| Issue             | Cause                                | Fix                                                   |
| ----------------- | ------------------------------------ | ----------------------------------------------------- | --- | ---------------- |
| Route conflict    | Two functions claim same path        | Check `base` + `path` uniqueness across all functions |
| Handler not found | `handler` file missing or wrong name | Verify file exists and matches `route.config.json`    |
| Layer not loading | `layers.json` syntax error           | Use `"layer-name"` or `{"layer": "layer-name"}`       |
| Env vars missing  | Function `.env` not loaded           | Use `req.env?.VAR                                     |     | process.env.VAR` |

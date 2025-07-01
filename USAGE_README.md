# 🚀 FuncDock — Usage Guide

## Index
- [Overview](#overview)
- [Function Development](#function-development)
- [Environment Variables](#environment-variables)
- [Routing](#routing)
- [Logging](#logging)
- [Examples](#examples)
- [Best Practices](#best-practices)

---

## Overview
FuncDock makes it easy to develop, test, and run Node.js functions in a unified platform.

## Function Development
- Place each function in its own directory under `functions/`.
- Each function should have:
  - `handler.js` (main entry point)
  - `package.json` (dependencies)
  - `route.config.json` (routing config)
  - `.env` (optional, function-specific env vars)

## Environment Variables
- Use `.env` in each function for secrets/config.
- Access via `req.env` in handlers and cron jobs.

## Routing
- Define routes in `route.config.json`.
- Supports dynamic parameters and per-route handlers.

## Logging
- Use the injected `logger` in handlers for info, warn, error, debug.

## Examples
- See `functions/hello-world/` for a complete example.
- Example handler:
```javascript
export default async function handler(req, res) {
  const { method, env, logger } = req;
  logger.info(`Received ${method} request`);
  res.json({ message: 'Hello from FuncDock!' });
}
```

## Best Practices
- Keep functions isolated and stateless.
- Use environment variables for secrets.
- Write tests for each handler.
- Use the dashboard for monitoring and debugging. 
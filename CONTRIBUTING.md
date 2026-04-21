# Contributing to FuncDock

Thank you for your interest in contributing to FuncDock! This guide will help you get started.

---

## Development Setup

1. **Fork and clone** the repository
2. **Install dependencies**:
   ```bash
   npm install
   cd dashboard && npm install && cd ..
   ```
3. **Create your `.env`** from `.env.example`:
   ```bash
   cp .env.example .env
   # Edit .env and set JWT_SECRET (min 16 chars), ADMIN_USERNAME, ADMIN_PASSWORD
   ```
4. **Run the test suite** to ensure everything works:
   ```bash
   npm test
   ```

---

## Project Structure

| Directory    | Purpose                                                        |
| ------------ | -------------------------------------------------------------- |
| `server.js`  | Main Express server — platform core                            |
| `functions/` | Example functions and user function storage                    |
| `layers/`    | Shared code layers                                             |
| `dashboard/` | React 19 admin UI (separate Vite app)                          |
| `utils/`     | Platform utilities (logger, layer-loader, test-runner, tracer) |
| `scripts/`   | CLI deployment and testing tools                               |
| `test/`      | Jest setup helpers (`test/setup.mjs`)                          |
| `types/`     | TypeScript definitions                                         |
| `docs/`      | Human documentation                                            |

---

## Coding Standards

### JavaScript / ESM

- **ESM only**: Use `import`/`export`. No CommonJS.
- **Async/await** preferred over callbacks.
- **const/let** only. No `var`.
- Single quotes, 100 char line width, 2-space indent (Prettier handles this).

### Error Handling

- Attach `cause` when re-throwing: `throw new Error('msg', { cause: err })`.
- Use braced `case` blocks when declaring variables inside `switch`.
- Don't access `Object.prototype` methods directly on objects.

### Security

- Never use `localStorage` for auth tokens. Use httpOnly cookies.
- Validate and sanitize all user inputs.
- Use `req.env?.VAR || process.env.VAR` for function-local env vars.

### Testing

- All functions must have tests: `handler.test.mjs`.
- Use `test/setup.mjs` utilities:
  ```js
  import { testHandler, expectStatus } from '../../test/setup.mjs';
  ```
- Run the full suite before PRs: `npm test`.

---

## Making Changes

### Adding a Feature

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes with tests
3. Run lint and format:
   ```bash
   npx eslint .
   npx prettier --check .
   ```
4. Ensure all tests pass: `npm test`
5. Commit with a clear message

### Adding a Function

1. Create `functions/<name>/` with `handler.js`, `route.config.json`, and `handler.test.mjs`
2. Follow the handler signature documented in `docs/USAGE_README.md`
3. Test locally: `npm test -- functions/<name>`

### Modifying the Dashboard

1. Work in `dashboard/src/`
2. Build before committing: `cd dashboard && npm run build`
3. The built assets go to `public/dashboard/` which Express serves

### Modifying Server Core

1. Changes to `server.js` affect all functions — be careful
2. The dispatcher must run AFTER body parsers
3. Preserve ESM cache-busting: `import(\`${path}?update=${Date.now()}\`)`

---

## Pull Request Process

1. **Update documentation** if your change affects user-facing behavior
2. **Add tests** for new functionality
3. **Ensure CI passes** — lint, format, test, and docker-build
4. **Describe your changes** clearly in the PR description
5. Link any related issues

---

## Commit Message Convention

Use clear, descriptive commit messages:

```
feat: add webhook signature verification
fix: resolve layer symlink race condition on Windows
docs: update deployment README with GitHub Actions example
test: add coverage for cron error handling
refactor: simplify dispatcher middleware logic
```

---

## Reporting Issues

When reporting bugs, please include:

- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs (from `logs/app.log` or `logs/error.log`)

For security issues, see `docs/SECURITY_README.md` for responsible disclosure.

---

## Code of Conduct

- Be respectful and constructive
- Focus on the code, not the person
- Help others learn and grow
- Assume good intent

---

## Questions?

- Check `docs/TROUBLESHOOTING_README.md` for common issues
- Read `ARCHITECTURE.md` for system design details
- See `AGENTS.md` for development conventions

Thank you for making FuncDock better! 🚀

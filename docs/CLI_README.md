# FuncDock CLI

> Unified command-line interface for the FuncDock FaaS platform.

---

## Installation

The CLI is included with FuncDock. No separate install needed.

```bash
# Use via npx (recommended)
npx funcdock --help

# Or install globally
npm install -g funcdock
funcdock --help
```

---

## Quick Reference

```bash
funcdock <command> [options]
```

| Command                                        | Description                              |
| ---------------------------------------------- | ---------------------------------------- |
| `funcdock dev`                                 | Start development server with hot reload |
| `funcdock start`                               | Start production server                  |
| `funcdock create <name>`                       | Scaffold a new function                  |
| `funcdock deploy --git <url> --name <name>`    | Deploy from Git                          |
| `funcdock deploy --local <path> --name <name>` | Deploy from local path                   |
| `funcdock update <name>`                       | Update an existing function              |
| `funcdock remove <name>`                       | Remove a function                        |
| `funcdock list`                                | List all deployed functions              |
| `funcdock test [function]`                     | Run Jest tests                           |
| `funcdock test <function> --docker`            | Test in Docker                           |
| `funcdock logs`                                | View application logs                    |
| `funcdock logs --follow`                       | Tail logs in real-time                   |
| `funcdock status`                              | Check platform status                    |
| `funcdock setup`                               | Run initial platform setup               |
| `funcdock reload`                              | Trigger hot reload of all functions      |

Every command supports `--help`:

```bash
funcdock deploy --help
funcdock test --help
```

---

## Commands

### `funcdock dev`

Start the FuncDock platform in development mode with file watching and hot reload.

```bash
funcdock dev
```

### `funcdock start`

Start the platform in production mode.

```bash
funcdock start
```

### `funcdock create <name>`

Scaffold a new function with handler, tests, route config, and package.json.

```bash
funcdock create payment-api
funcdock create user-service
```

Creates:

- `functions/<name>/handler.js`
- `functions/<name>/handler.test.mjs`
- `functions/<name>/route.config.json`
- `functions/<name>/package.json`
- `functions/<name>/README.md`

### `funcdock deploy`

Deploy a function from Git, a local directory, or a pull request.

**From Git:**

```bash
funcdock deploy --git https://github.com/user/repo.git --name my-function
funcdock deploy --git https://github.com/user/repo.git --name my-function --branch develop
```

**From local path:**

```bash
funcdock deploy --local ./my-function --name my-function
```

**From a pull request:**

```bash
funcdock deploy --pr https://github.com/user/repo --name my-function --pr-number 42
```

Deploys run tests before activating. If tests fail, the deployment is aborted.

### `funcdock update <name>`

Update an existing function from its original source.

```bash
funcdock update my-function
funcdock update my-function --branch feature/new-thing
funcdock update my-function --commit abc123
```

### `funcdock remove <name>`

Remove a deployed function.

```bash
funcdock remove old-function
```

### `funcdock list`

List all deployed functions with route counts and deployment metadata.

```bash
funcdock list
```

### `funcdock test [function]`

Run Jest tests. Without a function name, runs all tests.

```bash
funcdock test                          # All tests
funcdock test hello-world              # Single function
funcdock test --coverage               # With coverage report
funcdock test --watch                  # Watch mode
funcdock test hello-world --docker     # Production-identical Docker test
```

### `funcdock logs`

View application logs.

```bash
funcdock logs              # Show current logs
funcdock logs --follow     # Tail logs (Ctrl+C to stop)
funcdock logs --error      # Error logs only
```

### `funcdock status`

Check if the platform is running and healthy.

```bash
funcdock status
```

### `funcdock setup`

Run the initial platform setup. Creates directories, generates `.env`, and prepares the workspace.

```bash
funcdock setup
```

### `funcdock reload`

Trigger a hot reload of all functions without restarting the server.

```bash
funcdock reload
```

---

## Environment

The CLI reads `.env` from the project root for settings like `PORT`. If `.env` is missing, defaults are used (port 3000).

---

## Exit Codes

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| `0`  | Success                                 |
| `1`  | General error (command failed)          |
| `2`  | Bad usage (missing args, invalid flags) |

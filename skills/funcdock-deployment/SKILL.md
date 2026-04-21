# FuncDock Deployment

Deploy functions to FuncDock via Git, local path, dashboard, or CI/CD pipeline.

## When to Use

Use this skill when:

- Deploying a function to a FuncDock instance
- Setting up CI/CD integration
- Debugging deployment failures
- Creating deployment automation

## Deployment Methods

### 1. Git-Based Deployment

```bash
# From host (uses host Git credentials)
funcdock deploy --git https://github.com/user/repo.git --name my-functionmain

# Container-side (uses container's Git)
funcdock deploy --git https://github.com/user/repo.git --name my-functionmain
```

Flow:

1. Clone repo to `functions/<name>/`
2. Run Jest tests (blocks on failure)
3. Create backup
4. Write `.deployment.json` metadata
5. Trigger reload

### 2. Local Path Deployment

```bash
# From host
funcdock deploy --local ./my-local-function --name my-function

# Container-side
funcdock deploy --local ./my-local-function --name my-function
```

### 3. Dashboard Upload

Use the web UI at `/dashboard` → Deploy → Upload. Supports ZIP upload and drag-and-drop.

### 4. GitHub Actions

```yaml
- name: Deploy to FuncDock
  uses: ./.github/workflows/deploy-function.yml
  with:
    function_name: my-function
    git_url: ${{ github.repository }}
    branch: ${{ github.ref_name }}
    server_host: ${{ secrets.FUNCDOCK_HOST }}
```

### 5. Auto-Deploy via Webhook

Trigger `repository_dispatch` event:

```bash
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/owner/repo/dispatches \
  -d '{"event_type": "function-updated", "client_payload": {"function_name": "my-function"}}'
```

## Deployment Validation

All deployment paths run `validateFunctionDeployment()` which:

1. Runs Jest tests for the function
2. Checks for route conflicts
3. Verifies `route.config.json` is valid JSON
4. Ensures handler files exist

If validation fails, the deployment is aborted and the previous version remains active.

## Docker Testing Before Deploy

Test in a production-identical container:

```bash
funcdock test my-function --docker
```

This mounts the function into `Dockerfile.test` and runs the full Jest suite.

## Rollback

If a deployment causes issues, the previous version is backed up in `.deployment-backups/<name>/`. To restore:

```bash
# Manual rollback
cp -r .deployment-backups/my-function/<timestamp>/* functions/my-function/
# Then trigger reload via API or restart
```

## Environment Variables for Deploy Scripts

| Variable                           | Purpose                       |
| ---------------------------------- | ----------------------------- |
| `FUNCDOCK_HOST`                    | Target server hostname        |
| `SSH_USERNAME` / `SSH_PRIVATE_KEY` | For GitHub Actions SSH deploy |
| `SLACK_WEBHOOK_URL`                | Optional deploy notifications |

## CI/CD Best Practices

1. Run tests in CI before deploying (see `.github/workflows/ci.yml`)
2. Use `funcdock test <function> --docker` for prod-parity validation
3. Deploy to staging first, then promote to production
4. Use `repository_dispatch` for webhook-triggered auto-deploys
5. Monitor `/health` and `/api/status` after deploy

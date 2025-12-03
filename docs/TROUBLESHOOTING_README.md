# 🔧 FuncDock — Troubleshooting Guide

This guide helps you diagnose and fix common issues with FuncDock.

## Index
- [Quick Diagnostics](#quick-diagnostics)
- [Common Issues](#common-issues)
- [Deployment Problems](#deployment-problems)
- [Function Errors](#function-errors)
- [Dashboard Issues](#dashboard-issues)
- [Testing Problems](#testing-problems)
- [Performance Issues](#performance-issues)
- [Network Issues](#network-issues)
- [Diagnostic Commands](#diagnostic-commands)
- [Log Analysis](#log-analysis)
- [FAQ](#faq)
- [Getting Help](#getting-help)

---

## Quick Diagnostics

### Health Check

```bash
# Check if server is running
curl http://localhost:3000/api/status

# Check server logs
tail -f logs/app.log

# Check for errors
tail -f logs/error.log

# List all functions
make list-functions

# Check platform status
make status
```

### Common Quick Fixes

1. **Server won't start** → Check port availability, review logs
2. **Function not loading** → Check syntax, verify route.config.json
3. **Dashboard not accessible** → Verify server is running, check port
4. **Deployment fails** → Check Git credentials, verify function structure

---

## Common Issues

### Port Already in Use

**Symptoms:**
- Error: `EADDRINUSE: address already in use :::3000`
- Server fails to start

**Solutions:**

```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process (macOS/Linux)
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev

# Check what's using the port
netstat -an | grep 3000  # Linux
lsof -i :3000            # macOS
```

### Missing Dependencies

**Symptoms:**
- `Cannot find module` errors
- Function fails to load

**Solutions:**

```bash
# Install root dependencies
npm install

# Install function dependencies
cd functions/my-function
npm install

# Or reinstall all
rm -rf node_modules package-lock.json
npm install
```

### Permission Errors

**Symptoms:**
- `EACCES` or `EPERM` errors
- Cannot write to directories

**Solutions:**

```bash
# Fix directory permissions
chmod -R 755 functions/
chmod -R 755 logs/

# Check current permissions
ls -la functions/
ls -la logs/

# Run with appropriate permissions (if needed)
sudo npm run dev  # Not recommended, fix permissions instead
```

### Environment Variable Problems

**Symptoms:**
- Functions can't access environment variables
- `env` is undefined or empty

**Solutions:**

```bash
# Check if .env file exists
ls -la .env

# Verify environment variables are loaded
node -e "require('dotenv').config(); console.log(process.env)"

# Check function-specific .env
ls -la functions/my-function/.env

# Load environment variables explicitly
source .env && npm run dev
```

---

## Deployment Problems

### Git Credentials Not Found

**Symptoms:**
- Authentication prompts during deployment
- `Permission denied` errors
- `Repository not found` errors

**Solutions:**

```bash
# Check Git configuration
make check-git
# or
npm run check-git

# Use host-based deployment (recommended)
make deploy-host-git REPO=https://github.com/user/repo.git NAME=my-function

# Configure Git credentials
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global credential.helper store

# For SSH keys
ssh-keygen -t ed25519 -C "your.email@example.com"
# Add public key to GitHub/Bitbucket
# Use SSH URLs: git@github.com:user/repo.git
```

### Missing Required Files

**Symptoms:**
- `handler.js not found`
- `route.config.json is missing`
- Deployment fails with file errors

**Solutions:**

```bash
# Verify function structure
ls -la functions/my-function/

# Required files:
# - handler.js
# - route.config.json
# - package.json

# Check route.config.json syntax
cat functions/my-function/route.config.json | jq .

# Validate JSON
node -e "JSON.parse(require('fs').readFileSync('functions/my-function/route.config.json'))"
```

### Dependency Install Failures

**Symptoms:**
- `npm install` fails in function directory
- Missing modules after deployment
- Version conflicts

**Solutions:**

```bash
# Check function package.json
cat functions/my-function/package.json

# Manually install dependencies
cd functions/my-function
rm -rf node_modules package-lock.json
npm install

# Check for version conflicts
npm ls

# Update dependencies
npm update

# Check npm version
npm --version  # Should be recent
```

### Route Conflicts

**Symptoms:**
- `Route conflict detected` error
- Function deployment fails
- Routes not working as expected

**Solutions:**

```bash
# List all registered routes
curl http://localhost:3000/api/status | jq '.functions[].routes'

# Check for conflicting patterns
# Example: /users/:id conflicts with /users/all

# Modify route configuration
# Use more specific paths or different base URLs
```

---

## Function Errors

### Handler Not Exporting Default Function

**Symptoms:**
- `Handler does not export a default function`
- Function fails to load

**Solutions:**

```javascript
// ✅ Correct - ES module export
export default async function handler(req, res) {
  // handler code
}

// ❌ Wrong - CommonJS
module.exports = async (req, res) => { ... }

// ❌ Wrong - Named export
export async function handler(req, res) { ... }
```

### Route Configuration Errors

**Symptoms:**
- Routes not registering
- 404 errors for valid routes
- Methods not working

**Solutions:**

```json
// ✅ Correct format
{
  "base": "/my-function",
  "handler": "handler.js",
  "routes": [
    {
      "path": "/",
      "methods": ["GET", "POST"],  // Note: "methods" (plural)
      "handler": "handler.js"
    }
  ]
}

// ❌ Wrong - "method" (singular)
{
  "method": "GET"  // Should be "methods": ["GET"]
}
```

### Cron Job Misconfiguration

**Symptoms:**
- Cron jobs not running
- Invalid schedule errors
- Handler not found

**Solutions:**

```json
// ✅ Correct cron.json
{
  "jobs": [
    {
      "name": "daily-backup",
      "schedule": "0 2 * * *",  // Valid cron expression
      "handler": "cron-handler.js",  // File exists
      "timezone": "UTC",
      "description": "Daily backup"
    }
  ]
}

// Verify cron syntax at: https://crontab.guru/
// Check handler file exists
ls -la functions/my-function/cron-handler.js
```

### Environment Variable Access

**Symptoms:**
- `env` is undefined
- Environment variables not accessible

**Solutions:**

```javascript
// ✅ Correct - Access via req.env
export default async function handler(req, res) {
  const { env } = req;
  const apiKey = env.API_KEY;
}

// Check .env file exists
ls -la functions/my-function/.env

// Verify .env format (no spaces around =)
API_KEY=your-key-here
DATABASE_URL=postgres://...
```

---

## Dashboard Issues

### Dashboard Not Loading

**Symptoms:**
- Blank page
- 404 errors
- Connection refused

**Solutions:**

```bash
# Check if server is running
curl http://localhost:3000/api/status

# Check dashboard files exist
ls -la public/dashboard/

# Rebuild dashboard if needed
cd dashboard
npm run build
cd ..
npm run dev

# Check browser console for errors
# Open DevTools (F12) and check Console tab

# Verify port
# Dashboard should be at: http://localhost:3000/dashboard/
# Replace 3000 with your actual port
```

### Real-Time Logs Not Updating

**Symptoms:**
- Logs not appearing in dashboard
- WebSocket connection errors

**Solutions:**

```bash
# Check WebSocket connection
# Open browser DevTools → Network → WS tab
# Look for WebSocket connection

# Verify Socket.IO is working
# Check server logs for WebSocket errors

# Restart server
npm run dev

# Check authentication token
# Dashboard requires valid JWT token
# Login again if token expired
```

### Functions Not Appearing in Dashboard

**Symptoms:**
- Functions deployed but not visible
- Empty function list

**Solutions:**

```bash
# Verify functions are loaded
curl http://localhost:3000/api/status | jq '.functions'

# Check function status
make list-functions

# Reload functions
make reload

# Check function logs for errors
tail -f logs/functions/my-function.log
```

---

## Testing Problems

### Jest/Nock Not Installed

**Symptoms:**
- `Cannot find module 'jest'`
- Test command fails

**Solutions:**

```bash
# Install dev dependencies
npm install

# Verify Jest is installed
npm list jest

# Run tests
npm test

# If still failing, reinstall
rm -rf node_modules package-lock.json
npm install
```

### Failing Tests

**Symptoms:**
- Tests fail with errors
- Coverage too low

**Solutions:**

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- handler.test.js

# Check test coverage
npm run test:coverage

# Run tests in watch mode for debugging
npm run test:watch

# Check test setup
cat test/setup.js
```

### Docker Test Environment Issues

**Symptoms:**
- Docker tests fail
- Container won't start

**Solutions:**

```bash
# Check Docker is running
docker ps

# Rebuild test image
docker build -f Dockerfile.test -t funcdock-test .

# Run test manually
node scripts/test-function-in-docker.js --function=./functions/hello-world

# Check Docker logs
docker logs <container-id>
```

---

## Performance Issues

### Slow Function Execution

**Symptoms:**
- Functions take too long to respond
- Timeout errors

**Solutions:**

```bash
# Check function logs for bottlenecks
tail -f logs/functions/my-function.log

# Monitor resource usage
top  # or htop

# Check for memory leaks
node --inspect server.js
# Use Chrome DevTools to profile

# Optimize dependencies
# Remove unused packages
# Use lighter alternatives
```

### High Memory Usage

**Symptoms:**
- Server crashes
- Out of memory errors

**Solutions:**

```bash
# Check memory usage
free -h  # Linux
vm_stat # macOS

# Limit Node.js memory
NODE_OPTIONS="--max-old-space-size=2048" npm run dev

# Review function memory usage
# Check for memory leaks in functions
# Reduce function size
# Optimize dependencies
```

---

## Network Issues

### CORS Errors

**Symptoms:**
- `Access-Control-Allow-Origin` errors
- Requests blocked by browser

**Solutions:**

```javascript
// Add CORS headers in function
export default async function handler(req, res) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Your handler code...
}
```

### Connection Timeouts

**Symptoms:**
- Requests timeout
- Functions don't respond

**Solutions:**

```bash
# Check network connectivity
ping your-server

# Verify firewall rules
# Check if port is accessible
telnet localhost 3000

# Increase timeout (if needed)
# Configure in your HTTP client or reverse proxy
```

---

## Diagnostic Commands

### System Information

```bash
# Node.js version
node --version  # Should be 22+

# npm version
npm --version

# Check installed packages
npm list --depth=0

# System resources
df -h          # Disk space
free -h       # Memory (Linux)
vm_stat       # Memory (macOS)
```

### Function Diagnostics

```bash
# List all functions
make list-functions

# Check function status
curl http://localhost:3000/api/status | jq '.functions[]'

# View function logs
tail -f logs/functions/my-function.log

# Test function endpoint
curl http://localhost:3000/my-function/

# Check function files
ls -la functions/my-function/
```

### Platform Diagnostics

```bash
# Platform status
make status

# Check routes
curl http://localhost:3000/api/status | jq '.routes'

# Check cron jobs
curl http://localhost:3000/api/status | jq '.cronJobs'

# View application logs
tail -f logs/app.log

# View error logs
tail -f logs/error.log
```

---

## Log Analysis

### Understanding Log Levels

- **ERROR** - Critical errors requiring attention
- **WARN** - Warnings that may indicate issues
- **INFO** - General information
- **DEBUG** - Detailed debugging information
- **CRON** - Cron job execution
- **CRON_ERROR** - Cron job failures

### Common Log Patterns

```bash
# Find errors
grep "ERROR" logs/app.log

# Find function-specific errors
grep "my-function" logs/app.log | grep "ERROR"

# Find cron job logs
grep "CRON" logs/app.log

# Find deployment issues
grep "deploy" logs/app.log

# Monitor real-time
tail -f logs/app.log | grep --color=always "ERROR\|WARN"
```

### Log File Locations

- `logs/app.log` - Main application log
- `logs/error.log` - Error log
- `logs/functions/{function-name}.log` - Function-specific logs

---

## FAQ

### Q: Why is my function returning 404?

A: Check:
1. Function is deployed: `make list-functions`
2. Route configuration is correct
3. Base URL matches: `curl http://localhost:3000/{base}/`
4. Route path is correct in `route.config.json`

### Q: How do I debug a function?

A:
1. Check function logs: `tail -f logs/functions/my-function.log`
2. Add logging: `logger.info('Debug point', { data })`
3. Test locally: `curl http://localhost:3000/my-function/`
4. Use dashboard testing interface
5. Run tests: `npm test`

### Q: Why are cron jobs not running?

A: Check:
1. Cron syntax is valid (use crontab.guru)
2. Handler file exists and exports default function
3. Timezone is correct
4. Check cron logs: `grep "CRON" logs/app.log`

### Q: How do I reset everything?

A:
```bash
# Stop server
# Remove functions (backup first!)
rm -rf functions/*/node_modules
# Clear logs
rm -rf logs/*.log
# Restart
npm run dev
```

### Q: Can I run multiple instances?

A: Yes, but:
- Use different ports
- Configure load balancer
- Share state via external storage (Redis, DB)
- Consider Docker Compose for orchestration

---

## Getting Help

### Before Asking for Help

1. **Check this guide** - Your issue might be covered
2. **Check logs** - Errors often contain clues
3. **Search issues** - Similar issues might exist
4. **Try diagnostic commands** - Gather information

### When Asking for Help

**Include:**
- Error messages (full text)
- Steps to reproduce
- Environment details (Node version, OS)
- Relevant logs
- What you've tried

**GitHub Issues:**
- Use clear, descriptive titles
- Include code examples if relevant
- Tag appropriately (bug, question, etc.)

**Community:**
- Be respectful and patient
- Provide context
- Help others when you can

---

## Additional Resources

- [SETUP_README.md](SETUP_README.md) - Setup and installation
- [USAGE_README.md](USAGE_README.md) - Usage guide
- [DEPLOYMENT_README.md](DEPLOYMENT_README.md) - Deployment guide
- [SECURITY_README.md](SECURITY_README.md) - Security guide

---

**Still stuck?** Open an issue on GitHub with details about your problem. 
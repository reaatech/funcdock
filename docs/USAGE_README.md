# 🚀 FuncDock — Usage Guide

## 📋 Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Core Concepts](#core-concepts)
- [Function Development](#function-development)
- [Deployment](#deployment)
- [Monitoring & Management](#monitoring--management)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)
- [Next Steps](#next-steps)

---

## 🎯 Overview

FuncDock is a serverless function platform that lets you deploy, run, and manage JavaScript/Node.js functions with ease. This guide shows you how to use FuncDock effectively.

### ✨ What You Can Do

- **Deploy Functions** — Upload and run serverless functions instantly
- **Real-time Monitoring** — Watch function execution and logs in real-time
- **Webhook Integration** — Handle webhooks from external services
- **Scheduled Jobs** — Run functions on cron schedules
- **API Management** — Create RESTful APIs with automatic routing
- **Dashboard Control** — Manage everything through a web interface

---

## 🏁 Getting Started

### 1. Start FuncDock

```bash
# Clone and setup
git clone <your-repo>
cd funcdock
npm install

# Start the platform
npm start
```

### 2. Access the Dashboard

Open your browser to `http://localhost:3000/dashboard` to access the web interface.

**Note:** If you haven't set the `PORT` environment variable, the server defaults to port 3003. Set `PORT=3000` to use port 3000.

### 3. Create Your First Function

Use the dashboard or CLI to create a new function:

```bash
# Using the CLI
npm run create-function my-first-function

# Or use the dashboard's "Deploy" section
```

---

## 🧠 Core Concepts

### Functions
Functions are the core building blocks - JavaScript files that handle HTTP requests, webhooks, or scheduled tasks.

### Routes
Each function can expose multiple HTTP endpoints (GET, POST, PUT, DELETE) automatically.

### Webhooks
Functions can receive webhooks from external services like GitHub, Stripe, or Slack.

### Cron Jobs
Functions can be scheduled to run automatically at specified intervals.

### Dashboard
The web interface for managing functions, viewing logs, and monitoring performance.

---

## 🔧 Function Development

### Function Structure

```
functions/
├── my-function/
│   ├── handler.js          # Main function logic
│   ├── package.json        # Dependencies
│   ├── route.config.json   # Route configuration
│   └── cron.json          # Cron job schedule (optional)
```

### Writing Functions

Functions receive a context object with request data and return responses:

```javascript
// handler.js
export default async function handler(req, res, next) {
  const { method, url, headers, body } = req;
  // You can call next() to pass control to additional middleware
  
  if (method === 'GET') {
    res.json({ message: 'Hello from FuncDock!' });
    return;
  }
  
  if (method === 'POST') {
    res.status(201).json({ received: body });
    return;
  }
}
```

### Adding Dependencies

```bash
cd functions/my-function
npm install express lodash
```

### Testing Functions

```bash
# Test locally
npm run test-function my-function

# Test specific endpoint
curl http://localhost:3000/my-function
# Note: Use the port your server is running on (default 3003, or 3000 if PORT env var is set)
```

**📖 Learn More**: See [SETUP_README.md](SETUP_README.md) for detailed development setup.

### Middleware Support

FuncDock handlers support Express-style middleware. If your handler accepts a third argument (`next`), you can call `next()` to pass control to the next middleware in the chain. This enables advanced patterns such as authentication, logging, or custom error handling.

#### Example: Authentication Middleware

```js
// auth-middleware.js
export default async function authMiddleware(req, res, next) {
  if (!req.headers['authorization']) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // You can add user info to req here
  req.user = { id: 'user-123', name: 'Alice' };
  next(); // Pass control to the next handler
}
```

```js
// handler.js
import authMiddleware from './auth-middleware.js';

export default async function handler(req, res, next) {
  // Run authentication middleware first
  await authMiddleware(req, res, next);
  if (res.headersSent) return; // Stop if middleware already sent a response

  // Main handler logic
  res.json({
    message: `Hello, ${req.user?.name || 'World'}!`,
    time: new Date().toISOString()
  });
}
```

### Writing Cron Handlers

Cron handlers are background jobs, not HTTP endpoints. They receive only a req object (no res), and should use logger for output. To signal errors, throw an Error with a code property and log with logger.log('CRON_ERROR', ...).

```js
// cron-handler.js
export default async function handler(req) {
  const { logger, cronJob, schedule } = req;
  logger.log('CRON', `Cron job started: ${cronJob}`, { cronJob, schedule });
  try {
    if (!cronJob) {
      const err = new Error('Missing cron job name');
      err.code = 'MISSING_CRON_JOB';
      logger.log('CRON_ERROR', err.message, { code: err.code, cronJob, schedule });
      throw err;
    }
    // Simulate work
    await doWork(cronJob);
    logger.log('CRON', `Cron job completed: ${cronJob}`, { cronJob, schedule });
    return { success: true };
  } catch (error) {
    // Already logged above, but you can log here as well if needed
    throw error;
  }
}
```

---

## 🚀 Deployment

### Deploy via Dashboard

1. Go to the **Deploy** section in the dashboard
2. Upload your function files or use the web editor
3. Click **Deploy** to make it live

### Deploy via CLI

```bash
# Deploy a function
npm run deploy functions/my-function

# Deploy all functions
npm run deploy-all
```

### Deploy from Git

```bash
# Deploy from a Git repository
npm run deploy-from-git https://github.com/user/repo
```

**📖 Learn More**: See [DEPLOYMENT_README.md](DEPLOYMENT_README.md) for advanced deployment options.

---

## 📊 Monitoring & Management

### Dashboard Features

- **Function Overview** — See all deployed functions and their status
- **Real-time Logs** — Watch function execution logs live
- **Performance Metrics** — Monitor response times and error rates
- **Function Details** — View routes, dependencies, and configuration

### Logs & Debugging

```bash
# View function logs
npm run logs my-function

# Follow logs in real-time
npm run logs my-function --follow

# View only cron job logs (CRON and CRON_ERROR)
cat logs/functions/my-function.log | jq 'select(.level=="CRON" or .level=="CRON_ERROR")'
```

### Health Checks

```bash
# Check function health
curl http://localhost:3000/my-function/health

# Check platform status
curl http://localhost:3000/api/status
# Note: Replace 3000 with your actual port (default 3003 if PORT env var is not set)
```

**📖 Learn More**: See [DASHBOARDS_README.md](DASHBOARDS_README.md) for dashboard features.

---

## ⚡ Advanced Features

### Webhook Integration

Configure functions to receive webhooks:

```javascript
// webhook-handler.js
export default async function handler(req, res) {
  const { headers, body } = req;
  
  // Handle GitHub webhooks
  if (headers['x-github-event']) {
    const result = await handleGitHubWebhook(body);
    res.json(result);
    return;
  }
  
  // Handle Stripe webhooks
  if (headers['stripe-signature']) {
    const result = await handleStripeWebhook(body);
    res.json(result);
    return;
  }
  
  res.status(400).json({ error: 'Unknown webhook type' });
}
```

### Cron Jobs

Schedule functions to run automatically:

```javascript
// cron-handler.js
// Cron handlers only receive req (no res parameter)
export default async function handler(req) {
  const { logger, cronJob, schedule } = req;
  logger.log('CRON', `Cron job started: ${cronJob}`);
  try {
    // ...cron logic...
    logger.log('CRON', `Cron job completed: ${cronJob}`);
    return { success: true };
  } catch (error) {
    logger.log('CRON_ERROR', `Cron job failed: ${cronJob}`, { error: error.message });
    throw error; // Re-throw to let the platform handle it
  }
}
```

### Environment Variables

Environment variables allow you to configure functions without hardcoding secrets.

#### Function-Level Environment Variables

Create a `.env` file in your function directory:

```bash
# functions/my-function/.env
DATABASE_URL=postgres://user:password@localhost:5432/mydb
API_KEY=your-secret-api-key
STRIPE_SECRET_KEY=sk_test_...
DEBUG=true
LOG_LEVEL=debug
```

#### Accessing Environment Variables

Functions access environment variables via `req.env`:

```javascript
export default async function handler(req, res) {
  const { env } = req;
  
  // Access environment variables
  const dbUrl = env.DATABASE_URL;
  const apiKey = env.API_KEY;
  
  // Use in your function logic
  const response = await fetch('https://api.example.com', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  
  res.json({ data: await response.json() });
}
```

#### Environment Variable Best Practices

**✅ DO:**
- Store secrets in `.env` files
- Use descriptive variable names
- Document required variables in function README
- Use different values for dev/staging/production
- Keep `.env` files out of Git (add to `.gitignore`)

**❌ DON'T:**
- Hardcode secrets in function code
- Commit `.env` files to version control
- Share `.env` files via insecure channels
- Use production secrets in development

#### Platform-Level Environment Variables

See [SETUP_README.md](SETUP_README.md#environment-setup) for platform configuration variables like `JWT_SECRET`, `ADMIN_USERNAME`, `PORT`, etc.

#### Environment Variable Examples

**Database Connection:**
```bash
# .env
DATABASE_URL=postgres://user:pass@localhost:5432/mydb
DB_POOL_SIZE=10
DB_TIMEOUT=5000
```

**API Keys:**
```bash
# .env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
SENDGRID_API_KEY=SG....
```

**Feature Flags:**
```bash
# .env
ENABLE_CACHE=true
CACHE_TTL=3600
DEBUG_MODE=false
```

**Service URLs:**
```bash
# .env
EXTERNAL_API_URL=https://api.example.com
WEBHOOK_URL=https://yourdomain.com/webhook
```

### Lambda Layers

Share common code across functions using Lambda Layers:

```javascript
// Create a layer in layers/shared-utils/nodejs/index.js
export function logger(message) {
  console.log(`[LOG] ${new Date().toISOString()}: ${message}`);
}

// Use in function: functions/my-function/layers.json
"shared-utils"

// Import in handler: functions/my-function/handler.js
import { logger } from 'shared-utils';

export default async function handler(req, res) {
  logger('Request received');
  res.json({ message: 'Hello' });
}
```

**📖 Learn More**: See [LAYERS_README.md](LAYERS_README.md) for detailed layer usage.

### Custom Domains

```bash
# Configure custom domain
npm run set-domain my-function api.myapp.com
```

**📖 Learn More**: See [CRONJOBS_README.md](CRONJOBS_README.md) for cron job configuration.

---

## 🎯 Best Practices

### Function Design

1. **Keep Functions Focused** — Each function should do one thing well
2. **Handle Errors Gracefully** — Always return proper error responses
3. **Use Environment Variables** — Don't hardcode secrets
4. **Add Logging** — Include useful debug information

### Performance

1. **Optimize Dependencies** — Only include what you need
2. **Use Connection Pooling** — Reuse database connections
3. **Implement Caching** — Cache frequently accessed data
4. **Monitor Memory Usage** — Keep functions lightweight

### Security

1. **Validate Input** — Always sanitize user input
2. **Use HTTPS** — Enable SSL in production
3. **Implement Authentication** — Protect sensitive endpoints
4. **Rate Limiting** — Prevent abuse

### Development Workflow

1. **Test Locally** — Use the test runner before deploying
2. **Version Control** — Keep functions in Git
3. **Use Branches** — Develop new features in separate branches
4. **Monitor Deployments** — Watch logs after deployment

---

## 🔧 Troubleshooting

### Common Issues

- **Function Not Loading** — Check syntax errors and dependencies
- **Routes Not Working** — Verify route configuration
- **Webhooks Failing** — Check signature validation
- **Cron Jobs Not Running** — Verify cron syntax

### Getting Help

- **Check Logs** — Use the dashboard or CLI to view detailed logs
- **Test Locally** — Use the test runner to debug issues
- **Community Support** — See main [README.md](../README.md) for community links

**📖 Learn More**: See [TROUBLESHOOTING_README.md](TROUBLESHOOTING_README.md) for detailed solutions.

---

## 🎯 Next Steps

### Explore Examples

- **Hello World** — Basic function examples
- **Webhook Handler** — Webhook integration patterns
- **API Functions** — RESTful API examples

### Advanced Topics

- **Custom Middleware** — Add authentication, logging, etc.
- **Database Integration** — Connect to databases
- **External APIs** — Call third-party services
- **File Processing** — Handle file uploads and processing

### Production Deployment

- **Docker Setup** — Containerized deployment
- **Load Balancing** — Scale across multiple instances
- **Monitoring** — Set up alerts and metrics
- **Backup Strategy** — Protect your functions and data

---

## 📚 Additional Resources

- **[Setup Guide](SETUP_README.md)** — Detailed installation and configuration
- **[Deployment Guide](DEPLOYMENT_README.md)** — Advanced deployment options
- **[CLI Reference](CLI_README.md)** — Command-line interface usage
- **[Dashboard Guide](DASHBOARDS_README.md)** — Web interface features
- **[Layers Guide](LAYERS_README.md)** — Using Lambda Layers for shared code
- **[Security Guide](SECURITY_README.md)** — Security best practices
- **[Testing Guide](TESTING_README.md)** — Function testing strategies
- **[Contributing Guide](CONTRIBUTING_README.md)** — How to contribute to FuncDock

---

**Ready to get started?** Check out the [Setup Guide](SETUP_README.md) to begin building with FuncDock! 
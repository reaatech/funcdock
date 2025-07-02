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
module.exports = async (req, res) => {
  const { method, url, headers, body } = req;
  
  if (method === 'GET') {
    return {
      status: 200,
      body: { message: 'Hello from FuncDock!' }
    };
  }
  
  if (method === 'POST') {
    return {
      status: 201,
      body: { received: body }
    };
  }
};
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
```

**📖 Learn More**: See [SETUP_README.md](SETUP_README.md) for detailed development setup.

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
```

### Health Checks

```bash
# Check function health
curl http://localhost:3000/my-function/health

# Check platform status
curl http://localhost:3000/api/status
```

**📖 Learn More**: See [DASHBOARDS_README.md](DASHBOARDS_README.md) for dashboard features.

---

## ⚡ Advanced Features

### Webhook Integration

Configure functions to receive webhooks:

```javascript
// webhook-handler.js
module.exports = async (req, res) => {
  const { headers, body } = req;
  
  // Handle GitHub webhooks
  if (headers['x-github-event']) {
    return handleGitHubWebhook(body);
  }
  
  // Handle Stripe webhooks
  if (headers['stripe-signature']) {
    return handleStripeWebhook(body);
  }
};
```

### Cron Jobs

Schedule functions to run automatically:

```json
// cron.json
{
  "daily-backup": "0 2 * * *",
  "hourly-cleanup": "0 * * * *",
  "weekly-report": "0 9 * * 1"
}
```

### Environment Variables

```bash
# Set environment variables
npm run set-env my-function DATABASE_URL=postgres://...
npm run set-env my-function API_KEY=your-secret-key
```

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
- **[Security Guide](SECURITY_README.md)** — Security best practices
- **[Testing Guide](TESTING_README.md)** — Function testing strategies
- **[Contributing Guide](CONTRIBUTING_README.md)** — How to contribute to FuncDock

---

**Ready to get started?** Check out the [Setup Guide](SETUP_README.md) to begin building with FuncDock! 
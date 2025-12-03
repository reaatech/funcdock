# 🚀 FuncDock — Cron Jobs Guide

## Index
- [Overview](#overview)
- [Configuration](#configuration)
- [Handlers](#handlers)
- [Schedule Format](#schedule-format)
- [Features](#features)
- [Monitoring](#monitoring)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## Overview
FuncDock supports per-function cron jobs with hot reload and timezone support.

## Configuration
- Add a `cron.json` to your function directory.
- Define jobs with `name`, `schedule`, `handler`, `timezone`, `description`.

## Handlers
- Each job points to a handler file (e.g., `cron-handler.js`).
- Handler receives `req` with `env`, `logger`, etc.

## Schedule Format
- Standard cron syntax (`* * * * *`).
- See [crontab.guru](https://crontab.guru/) for help.

## Features
- Automatic loading and hot reload
- Timezone support
- Error handling and logging
- Status monitoring via API

## Monitoring
- Check status: `curl http://localhost:3000/api/status | jq '.cronJobs'` (use your actual port)
- View logs: `tail -f logs/app.log | grep "Cron job"`

## Examples
- See `functions/hello-world/cron.json` and `cron-handler.js` for real jobs.

## Troubleshooting
- See [TROUBLESHOOTING_README.md](TROUBLESHOOTING_README.md) for common issues.

# CRON JOBS

FuncDock supports scheduled cron jobs for each function. Add a `cron.json` file to your function directory to define scheduled tasks.

## Cron Job Configuration

**cron.json:**
```json
{
  "jobs": [
    {
      "name": "daily-backup",
      "schedule": "0 2 * * *",
      "handler": "cron-handler.js",
      "timezone": "UTC",
      "description": "Daily backup at 2 AM UTC"
    },
    {
      "name": "hourly-cleanup",
      "schedule": "0 * * * *",
      "handler": "cleanup.js",
      "timezone": "America/New_York",
      "description": "Hourly cleanup task"
    }
  ]
}
```

## Cron Handler

**cron-handler.js:**
```javascript
// Cron handlers only receive req (no res parameter)
// Use logger for output and throw errors with a code property
export default async function handler(req) {
  const { logger, cronJob, schedule } = req;
  
  logger.log('CRON', `Cron job started: ${cronJob}`, {
    schedule,
    functionName: req.functionName
  });

  try {
    // Implement your scheduled task logic here
    const result = await performScheduledWork(cronJob);
    
    logger.log('CRON', `Cron job completed: ${cronJob}`, result);
    
    // Return a result object (optional)
    return {
      success: true,
      job: cronJob,
      result
    };
    
  } catch (error) {
    // Log errors with CRON_ERROR level
    logger.log('CRON_ERROR', `Cron job failed: ${cronJob}`, { 
      error: error.message,
      code: error.code 
    });
    
    // Re-throw the error to let the platform handle it
    throw error;
  }
}
```

## Cron Schedule Format

Use standard cron syntax: `* * * * *`

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of the month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of the week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

**Common Examples:**
- `0 * * * *` - Every hour
- `0 9 * * *` - Every day at 9 AM
- `0 0 * * 0` - Every Sunday at midnight
- `*/15 * * * *` - Every 15 minutes
- `0 2 * * 1-5` - Weekdays at 2 AM

## Cron Job Features

- ✅ **Automatic Loading**: Cron jobs are loaded when functions are loaded
- ✅ **Hot Reload**: Changes to `cron.json` trigger automatic reload
- ✅ **Timezone Support**: Specify timezone for each job
- ✅ **Error Handling**: Failed jobs are logged with full error details
- ✅ **Logging**: Each job gets its own logger instance
- ✅ **Status Monitoring**: View cron job status via `/api/status`

## Monitoring Cron Jobs

```bash
# Check cron job status
curl http://localhost:3000/api/status | jq '.cronJobs'
# Note: Replace 3000 with your actual port (default 3003 if PORT env var is not set)

# View cron job logs (CRON and CRON_ERROR levels)
tail -f logs/app.log | grep '"level":"CRON"' | jq .
tail -f logs/app.log | grep '"level":"CRON_ERROR"' | jq .
```

## Example Cron Jobs

**Data Cleanup:**
```javascript
// cleanup.js
export default async function handler(req) {
  const { logger } = req;
  
  try {
    // Clean up old data
    const deletedCount = await cleanupOldRecords();
    
    logger.log('CRON', `Cleanup completed`, { deletedCount });
    return { success: true, deletedCount };
  } catch (error) {
    logger.log('CRON_ERROR', `Cleanup failed`, { error: error.message });
    throw error;
  }
}
```

**Health Check:**
```javascript
// health-check.js
export default async function handler(req) {
  const { logger } = req;
  
  try {
    const health = await checkSystemHealth();
    
    if (health.status === 'healthy') {
      logger.log('CRON', `Health check passed`, health);
      return { success: true, health };
    } else {
      const err = new Error('Health check failed');
      err.code = 'HEALTH_CHECK_FAILED';
      logger.log('CRON_ERROR', `Health check failed`, { 
        error: err.message, 
        code: err.code,
        health 
      });
      throw err;
    }
  } catch (error) {
    logger.log('CRON_ERROR', `Health check error`, { error: error.message });
    throw error;
  }
}
```

## Log Levels for Cron Jobs

| Level        | Description                        | Use Case                        |
|--------------|------------------------------------|---------------------------------|
| CRON         | Cron job started/completed         | Normal cron job events          |
| CRON_ERROR   | Cron job error/failure             | Cron job failures or warnings   |

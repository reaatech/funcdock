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
- Check status: `curl http://localhost:3000/api/status | jq '.cronJobs'`
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
export default async (req, res) => {
  const { logger, cronJob, schedule, timestamp } = req;
  
  logger.info(`Cron job started: ${cronJob}`, {
    schedule,
    timestamp,
    functionName: req.functionName
  });

  try {
    // Implement your scheduled task logic here
    const result = await performScheduledWork(cronJob);
    
    logger.info(`Cron job completed: ${cronJob}`, result);
    
    res.json({
      success: true,
      job: cronJob,
      result
    });
    
  } catch (error) {
    logger.error(`Cron job failed: ${cronJob}`, { error: error.message });
    
    res.status(500).json({
      success: false,
      job: cronJob,
      error: error.message
    });
  }
};
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

# View cron job logs
tail -f logs/app.log | grep "Cron job"
```

## Example Cron Jobs

**Data Cleanup:**
```javascript
// cleanup.js
export default async (req, res) => {
  const { logger } = req;
  
  try {
    // Clean up old data
    const deletedCount = await cleanupOldRecords();
    
    logger.info(`Cleanup completed`, { deletedCount });
    res.json({ success: true, deletedCount });
  } catch (error) {
    logger.error(`Cleanup failed`, { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};
```

**Health Check:**
```javascript
// health-check.js
export default async (req, res) => {
  const { logger } = req;
  
  try {
    const health = await checkSystemHealth();
    
    if (health.status === 'healthy') {
      logger.info(`Health check passed`, health);
      res.json({ success: true, health });
    } else {
      logger.warn(`Health check failed`, health);
      res.status(500).json({ success: false, health });
    }
  } catch (error) {
    logger.error(`Health check error`, { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};
``` 
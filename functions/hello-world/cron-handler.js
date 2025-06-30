/**
 * Cron job handler for hello-world function
 * This handler is called by scheduled cron jobs
 */

export default async (req, res) => {
  const { logger, cronJob, schedule, timestamp } = req;
  
  logger.info(`Cron job started: ${cronJob}`, {
    schedule,
    timestamp,
    functionName: req.functionName
  });

  try {
    // Simulate some work
    const workResult = await performScheduledWork(cronJob);
    
    // Log the result
    logger.info(`Cron job completed: ${cronJob}`, workResult);
    
    // Send response
    res.json({
      success: true,
      job: cronJob,
      schedule,
      timestamp,
      result: workResult
    });
    
  } catch (error) {
    logger.error(`Cron job failed: ${cronJob}`, { error: error.message });
    
    res.status(500).json({
      success: false,
      job: cronJob,
      error: error.message,
      timestamp
    });
  }
};

async function performScheduledWork(jobName) {
  // Simulate different work based on job name
  switch (jobName) {
    case 'daily-greeting':
      return {
        message: 'Good morning! This is your daily greeting from FuncDock.',
        type: 'greeting',
        priority: 'low'
      };
      
    case 'hourly-check':
      return {
        message: 'System health check completed',
        type: 'health-check',
        priority: 'medium',
        metrics: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }
      };
      
    default:
      return {
        message: 'Generic scheduled task completed',
        type: 'generic',
        priority: 'low'
      };
  }
} 
/**
 * Cron job handler for hello-world function
 * This handler is called by scheduled cron jobs
 */

export default async (req) => {
  const { logger, body } = req;
  const { cronJob, schedule, timestamp } = body || {};
  
  logger.log('CRON', `Cron job executed: ${cronJob}`, {
    cronJob,
    schedule,
    functionName: req.functionName
  });

  try {
    // Validate required fields
    if (!cronJob) {
      const err = new Error('Cron job data is required');
      err.code = 'MISSING_CRON_JOB';
      logger.log('CRON_ERROR', err.message, { code: err.code, cronJob, schedule });
      throw err;
    }

    if (!schedule || schedule === 'invalid-schedule') {
      const err = new Error('Invalid cron job data');
      err.code = 'INVALID_SCHEDULE';
      logger.log('CRON_ERROR', err.message, { code: err.code, cronJob, schedule });
      throw err;
    }

    // Handle error-prone jobs
    if (cronJob === 'error-prone-job') {
      const err = new Error('Simulated cron job error');
      err.code = 'SIMULATED_ERROR';
      logger.log('CRON_ERROR', err.message, { code: err.code, cronJob, schedule });
      throw err;
    }

    // Simulate some work
    const workResult = await performScheduledWork(cronJob);
    
    // Log the result
    logger.log('CRON', `Tasks completed for ${cronJob}`, {
      cronJob,
      schedule,
      tasksCompleted: workResult.tasksCompleted
    });
    
    // Optionally return a result for testing
    return {
      message: getResponseMessage(cronJob),
      function: req.functionName || 'test-function',
      data: {
        cronJob,
        schedule,
        ...workResult
      }
    };
    
  } catch (error) {
    // Already logged above, but you can log here as well if needed
    throw error; // Let the platform catch and log as CRON_ERROR
  }
};

function getResponseMessage(cronJob) {
  switch (cronJob) {
    case 'daily-morning':
      return 'Daily morning tasks completed';
    case 'hourly-tasks':
      return 'Hourly tasks completed';
    case 'custom-backup':
      return 'Custom cron job completed';
    case 'unknown-job':
      return 'Unknown cron job type handled';
    default:
      return 'Cron job completed successfully';
  }
}

async function performScheduledWork(jobName) {
  // Simulate different work based on job name
  switch (jobName) {
    case 'daily-morning':
      return {
        tasksCompleted: ['Database backup', 'Email notifications', 'System cleanup']
      };
      
    case 'hourly-tasks':
      return {
        tasksCompleted: ['System health check', 'Cache cleanup', 'Log rotation']
      };
      
    case 'custom-backup':
      return {
        tasksCompleted: ['Weekly backup', 'Data validation', 'Archive cleanup']
      };
      
    case 'unknown-job':
      return {
        tasksCompleted: ['Default task']
      };
      
    case 'long-running-job':
      // Simulate long-running task
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        duration: 100,
        tasksCompleted: ['Long running task completed']
      };
      
    case 'test-logging':
      return {
        tasksCompleted: ['Test logging task']
      };
      
    default:
      return {
        tasksCompleted: ['Generic scheduled task completed']
      };
  }
} 
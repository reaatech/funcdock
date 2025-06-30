/**
 * Cron job handler for hello-world function
 * This handler is called by scheduled cron jobs
 */

export default async (req, res) => {
  const { logger, body } = req;
  const { cronJob, schedule, timestamp } = body || {};
  
  logger.info(`Cron job executed: ${cronJob}`, {
    cronJob,
    schedule,
    functionName: req.functionName
  });

  try {
    // Validate required fields
    if (!cronJob) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cron job data is required'
      });
    }

    if (!schedule || schedule === 'invalid-schedule') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid cron job data'
      });
    }

    // Handle error-prone jobs
    if (cronJob === 'error-prone-job') {
      throw new Error('Simulated cron job error');
    }

    // Simulate some work
    const workResult = await performScheduledWork(cronJob);
    
    // Log the result
    logger.info(`Tasks completed for ${cronJob}`, {
      cronJob,
      schedule,
      tasksCompleted: workResult.tasksCompleted
    });
    
    // Send response based on job type
    const response = {
      message: getResponseMessage(cronJob),
      function: req.functionName || 'test-function',
      data: {
        cronJob,
        schedule,
        ...workResult
      }
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error(`Cron job failed: ${cronJob}`, { error: error.message });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Cron job failed',
      data: {
        cronJob,
        schedule,
        error: error.message
      }
    });
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
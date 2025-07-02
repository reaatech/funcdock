/**
 * Test Environment Variables in Cron Jobs
 * Demonstrates function-specific environment variable access in cron jobs
 */

export default async function handler(req) {
  const { logger, env } = req;

  logger.log('CRON', 'Cron job testing environment variables', {
    hasEnv: !!env,
    envKeys: env ? Object.keys(env) : [],
    functionName: req.functionName
  });

  // Test accessing environment variables
  if (env) {
    logger.log('CRON', 'Environment variables available in cron job', {
      hasApiKey: !!env.API_KEY,
      hasDatabaseUrl: !!env.DATABASE_URL,
      debugMode: env.DEBUG,
      logLevel: env.LOG_LEVEL,
      timestamp: new Date().toISOString()
    });

    // You can use the environment variables for your cron job logic
    if (env.DEBUG === 'true') {
      logger.log('CRON', 'Debug mode is enabled for this function');
    }

    if (env.API_KEY) {
      logger.log('CRON', 'API key is available for external API calls');
      // Example: Make API call using the key
      // const response = await fetch('https://api.example.com', {
      //   headers: { 'Authorization': `Bearer ${env.API_KEY}` }
      // });
    }
  } else {
    logger.log('CRON_ERROR', 'No environment variables available in cron job');
  }

  // Your cron job logic here...
  logger.log('CRON', 'Cron job completed successfully');
} 
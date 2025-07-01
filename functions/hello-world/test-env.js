/**
 * Test Environment Variables Handler
 * Demonstrates function-specific environment variable access
 */

export default async function handler(req, res) {
  const { logger, env } = req;

  logger.info('Testing environment variables access', {
    hasEnv: !!env,
    envKeys: env ? Object.keys(env) : []
  });

  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      message: 'Environment variables test',
      hasEnvironmentVariables: !!env,
      environmentVariables: env ? Object.keys(env) : [],
      sampleValues: env ? {
        hasApiKey: !!env.API_KEY,
        hasDatabaseUrl: !!env.DATABASE_URL,
        debugMode: env.DEBUG,
        logLevel: env.LOG_LEVEL
      } : null,
      timestamp: new Date().toISOString()
    });
  }

  return res.status(405).json({
    error: 'Method Not Allowed',
    method: req.method,
    supportedMethods: ['GET'],
    timestamp: new Date().toISOString()
  });
} 
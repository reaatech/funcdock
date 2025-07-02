/**
 * Test Handler - Specific handler for /hello-world/test route
 */

export default async function handler(req, res, next) {
  const { method, query } = req;

  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (method === 'GET') {
    return res.status(200).json({
      message: 'Test endpoint working!',
      handler: 'test.js',
      method: 'GET',
      query,
      timestamp: new Date().toISOString(),
      status: 'healthy'
    });
  }

  return res.status(405).json({
    error: 'Method Not Allowed',
    handler: 'test.js',
    method,
    supportedMethods: ['GET'],
    timestamp: new Date().toISOString()
  });
} 
/**
 * Greet Handler - Specific handler for /hello-world/greet route
 */

export default async function handler(req, res) {
  const { method, query, body } = req;

  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  switch (method) {
    case 'GET':
      const name = query.name || 'World';
      return res.status(200).json({
        message: `Hello, ${name}!`,
        handler: 'greet.js',
        method: 'GET',
        timestamp: new Date().toISOString()
      });

    case 'POST':
      const { name: postName, message } = body || {};
      return res.status(201).json({
        message: `Greeting sent to ${postName || 'someone'}!`,
        customMessage: message,
        handler: 'greet.js',
        method: 'POST',
        timestamp: new Date().toISOString()
      });

    default:
      return res.status(405).json({
        error: 'Method Not Allowed',
        handler: 'greet.js',
        method,
        supportedMethods: ['GET', 'POST'],
        timestamp: new Date().toISOString()
      });
  }
} 
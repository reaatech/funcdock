/**
 * Hello World Sample Function
 * Demonstrates basic HTTP methods and response patterns
 */

export default async function handler(req, res, next) {
  const { method, query, body, headers } = req;
  const { logger, env } = req; // Get the injected logger and environment variables

  // Log the incoming request
  logger.info(`Request received: ${method} ${req.routePath}`, {
    query,
    hasBody: !!body,
    userAgent: headers['user-agent']
  });

  // Log environment variable usage (if available)
  if (env) {
    logger.info('Function environment variables available', {
      hasApiKey: !!env.API_KEY,
      hasDatabaseUrl: !!env.DATABASE_URL,
      debugMode: env.DEBUG === 'true',
      logLevel: env.LOG_LEVEL
    });
  }

  // Add CORS headers for browser requests
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  switch (method) {
    case 'GET':
      return await handleGet(req, res, next);

    case 'POST':
      return await handlePost(req, res, next);

    case 'PUT':
      return await handlePut(req, res, next);

    case 'DELETE':
      return await handleDelete(req, res, next);

    default:
      logger.warn(`Unsupported method: ${method}`, { supportedMethods: ['GET', 'POST', 'PUT', 'DELETE'] });
      return res.status(405).json({
        error: 'Method Not Allowed',
        method,
        supportedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        timestamp: new Date().toISOString()
      });
  }
}

async function handleGet(req, res, next) {
  const { name = 'World', format = 'json' } = req.query;
  const { logger } = req;

  logger.info(`Processing GET request`, { name, format });

  const responseData = {
    message: `Hello, ${name}!`,
    timestamp: new Date().toISOString(),
    method: 'GET',
    function: 'hello-world',
    version: '1.0.0',
    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  // Support different response formats
  if (format === 'text') {
    return res.status(200).text(responseData.message);
  }

  if (format === 'html') {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Hello World Function</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .response { background: #f5f5f5; padding: 20px; border-radius: 8px; }
            .timestamp { color: #666; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <h1>🚀 Serverless Function Response</h1>
          <div class="response">
            <h2>${responseData.message}</h2>
            <p class="timestamp">Generated at: ${responseData.timestamp}</p>
            <p>Request ID: <code>${responseData.requestId}</code></p>
          </div>
        </body>
      </html>
    `;
    return res.status(200).send(html);
  }

  return res.status(200).json(responseData);
}

async function handlePost(req, res, next) {
  const { name, message } = req.body || {};
  const { logger } = req;

  logger.info(`Processing POST request`, { hasName: !!name, hasMessage: !!message });

  // Validate required fields
  if (!name) {
    logger.warn(`POST request missing required field: name`, { body: req.body });
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Name is required in request body',
      timestamp: new Date().toISOString()
    });
  }

  const responseData = {
    message: `Hello, ${name}! Your message has been received.`,
    receivedMessage: message || null,
    timestamp: new Date().toISOString(),
    method: 'POST',
    function: 'hello-world',
    status: 'created'
  };

  return res.status(201).json(responseData);
}

async function handlePut(req, res, next) {
  const { id } = req.query;
  const updateData = req.body;

  if (!id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'ID parameter is required for updates',
      timestamp: new Date().toISOString()
    });
  }

  const responseData = {
    message: `Resource ${id} has been updated`,
    updatedData: updateData,
    timestamp: new Date().toISOString(),
    method: 'PUT',
    function: 'hello-world',
    resourceId: id
  };

  return res.status(200).json(responseData);
}

async function handleDelete(req, res, next) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'ID parameter is required for deletion',
      timestamp: new Date().toISOString()
    });
  }

  const responseData = {
    message: `Resource ${id} has been deleted`,
    timestamp: new Date().toISOString(),
    method: 'DELETE',
    function: 'hello-world',
    resourceId: id
  };

  return res.status(200).json(responseData);
}

/**
 * Hello World Sample Function
 * Demonstrates basic HTTP methods and response patterns
 */

export default async function handler(req, res) {
  const { method, query, body, headers } = req;

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
      return handleGet(req, res);

    case 'POST':
      return handlePost(req, res);

    case 'PUT':
      return handlePut(req, res);

    case 'DELETE':
      return handleDelete(req, res);

    default:
      return res.status(405).json({
        error: 'Method Not Allowed',
        method,
        supportedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        timestamp: new Date().toISOString()
      });
  }
}

async function handleGet(req, res) {
  const { name = 'World', format = 'json' } = req.query;

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

async function handlePost(req, res) {
  const { name, message } = req.body || {};

  // Validate required fields
  if (!name) {
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

async function handlePut(req, res) {
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

async function handleDelete(req, res) {
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

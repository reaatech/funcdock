/**
 * Example handler demonstrating dynamic routing with path parameters
 * 
 * This handler shows how to access path parameters like :id, :userId, etc.
 * Routes: /hello-world/users/:id, /hello-world/users/:id/posts/:postId
 */

export default async function handler(req, res, next) {
  const { logger } = req;
  const { method, params, query, body } = req;

  // Log the request with path parameters
  logger.info(`Users handler called: ${method} ${req.routePath}`, {
    params,
    query,
    hasBody: !!body
  });

  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
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
        return res.status(405).json({
          error: 'Method Not Allowed',
          method,
          supportedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
          function: req.functionName,
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    logger.error(`Error in users handler: ${error.message}`);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      function: req.functionName,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleGet(req, res, next) {
  const { logger } = req;
  const { params } = req;
  const { id, postId } = params;

  logger.info(`GET request for user`, { userId: id, postId });

  // Simulate different responses based on path parameters
  if (postId) {
    // Route: /users/:id/posts/:postId
    return res.json({
      message: `Post ${postId} for user ${id}`,
      data: {
        userId: id,
        postId: postId,
        title: `Post ${postId} Title`,
        content: `This is post ${postId} for user ${id}`,
        createdAt: new Date().toISOString()
      },
      function: req.functionName,
      route: req.routePath,
      timestamp: new Date().toISOString()
    });
  } else if (id) {
    // Route: /users/:id
    return res.json({
      message: `User ${id} details`,
      data: {
        id: id,
        name: `User ${id}`,
        email: `user${id}@example.com`,
        status: 'active',
        createdAt: new Date().toISOString()
      },
      function: req.functionName,
      route: req.routePath,
      timestamp: new Date().toISOString()
    });
  } else {
    // Route: /users (no parameters)
    return res.json({
      message: 'All users',
      data: [
        { id: '1', name: 'User 1', email: 'user1@example.com' },
        { id: '2', name: 'User 2', email: 'user2@example.com' },
        { id: '3', name: 'User 3', email: 'user3@example.com' }
      ],
      function: req.functionName,
      route: req.routePath,
      timestamp: new Date().toISOString()
    });
  }
}

async function handlePost(req, res, next) {
  const { logger } = req;
  const { params, body } = req;
  const { id } = params;

  logger.info(`POST request for user`, { userId: id, body });

  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Request body is required',
      function: req.functionName,
      timestamp: new Date().toISOString()
    });
  }

  const response = {
    message: id ? `Created resource for user ${id}` : 'Created new user',
    data: {
      id: id || `user-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString()
    },
    function: req.functionName,
    route: req.routePath,
    timestamp: new Date().toISOString()
  };

  return res.status(201).json(response);
}

async function handlePut(req, res, next) {
  const { logger } = req;
  const { params, body } = req;
  const { id } = params;

  logger.info(`PUT request for user`, { userId: id, body });

  if (!id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'User ID is required',
      function: req.functionName,
      timestamp: new Date().toISOString()
    });
  }

  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Request body is required',
      function: req.functionName,
      timestamp: new Date().toISOString()
    });
  }

  return res.json({
    message: `Updated user ${id}`,
    data: {
      id: id,
      ...body,
      updatedAt: new Date().toISOString()
    },
    function: req.functionName,
    route: req.routePath,
    timestamp: new Date().toISOString()
  });
}

async function handleDelete(req, res, next) {
  const { logger } = req;
  const { params } = req;
  const { id } = params;

  logger.info(`DELETE request for user`, { userId: id });

  if (!id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'User ID is required',
      function: req.functionName,
      timestamp: new Date().toISOString()
    });
  }

  return res.json({
    message: `Deleted user ${id}`,
    data: {
      id: id,
      deletedAt: new Date().toISOString()
    },
    function: req.functionName,
    route: req.routePath,
    timestamp: new Date().toISOString()
  });
} 
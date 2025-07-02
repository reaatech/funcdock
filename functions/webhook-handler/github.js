/**
 * GitHub Webhook Handler - Specific handler for /webhook-handler/github route
 */

import crypto from 'crypto';

export default async function handler(req, res, next) {
  const { method, headers, body } = req;

  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Signature, X-Hub-Signature-256');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed',
      handler: 'github.js',
      method,
      supportedMethods: ['POST'],
      timestamp: new Date().toISOString()
    });
  }

  const event = headers['x-github-event'];
  const signature = headers['x-hub-signature-256'];
  const delivery = headers['x-github-delivery'];

  // Verify signature if secret is configured
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret && signature) {
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({
        error: 'Invalid signature',
        handler: 'github.js',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Process different GitHub events
  const responseData = {
    message: `Processed GitHub ${event} event`,
    handler: 'github.js',
    event,
    delivery,
    repository: body.repository?.full_name,
    sender: body.sender?.login,
    timestamp: new Date().toISOString()
  };

  // Add event-specific processing
  switch (event) {
    case 'push':
      responseData.commits = body.commits?.length || 0;
      responseData.branch = body.ref?.replace('refs/heads/', '');
      break;

    case 'pull_request':
      responseData.action = body.action;
      responseData.pullRequest = {
        number: body.pull_request?.number,
        title: body.pull_request?.title,
        state: body.pull_request?.state
      };
      break;

    case 'issues':
      responseData.action = body.action;
      responseData.issue = {
        number: body.issue?.number,
        title: body.issue?.title,
        state: body.issue?.state
      };
      break;
  }

  console.log('GitHub webhook processed:', responseData);

  return res.status(200).json(responseData);
} 
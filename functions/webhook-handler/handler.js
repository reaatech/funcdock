/**
 * Webhook Handler Sample Function
 * Demonstrates handling various webhook payloads with validation and processing
 */

import crypto from 'crypto';

export default async function handler(req, res, next) {
  const { method, logger } = req;

  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Signature, X-Hub-Signature-256'
  );

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  switch (method) {
    case 'GET':
      return handleStatus(req, res, next);

    case 'POST':
      return handleWebhook(req, res, logger, next);

    default:
      return res.status(405).json({
        error: 'Method Not Allowed',
        supportedMethods: ['GET', 'POST'],
        timestamp: new Date().toISOString(),
      });
  }
}

async function handleStatus(req, res, _next) {
  return res.status(200).json({
    status: 'active',
    function: 'webhook-handler',
    version: '1.0.0',
    endpoints: {
      github: '/webhook-handler/github',
      stripe: '/webhook-handler/stripe',
      generic: '/webhook-handler/generic',
      slack: '/webhook-handler/slack',
    },
    timestamp: new Date().toISOString(),
  });
}

async function handleWebhook(req, res, logger, next) {
  const { headers, body } = req;
  const webhookType = determineWebhookType(headers, body);

  try {
    switch (webhookType) {
      case 'github':
        return await handleGitHubWebhook(req, res, logger, next);

      case 'stripe':
        return await handleStripeWebhook(req, res, logger, next);

      case 'slack':
        return await handleSlackWebhook(req, res, logger, next);

      default:
        return await handleGenericWebhook(req, res, logger, next);
    }
  } catch (error) {
    if (logger) logger.log('CRON_ERROR', 'Webhook processing error', { error: error.message });
    else console.error('Webhook processing error:', error);
    return res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

function determineWebhookType(headers, body) {
  // GitHub webhook detection
  if (headers['x-github-event']) {
    return 'github';
  }

  // Stripe webhook detection
  if (headers['stripe-signature']) {
    return 'stripe';
  }

  // Slack webhook detection
  if (headers['user-agent']?.includes('Slackbot') || body?.token) {
    return 'slack';
  }

  return 'generic';
}

async function handleGitHubWebhook(req, res, logger, _next) {
  const { headers, body } = req;
  const event = headers['x-github-event'];
  const signature = headers['x-hub-signature-256'];
  const delivery = headers['x-github-delivery'];

  const secret = req.env?.GITHUB_WEBHOOK_SECRET || process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(400).json({
      error: 'GitHub webhook secret not configured',
      timestamp: new Date().toISOString(),
    });
  }

  if (!signature) {
    return res.status(401).json({
      error: 'Missing signature',
      timestamp: new Date().toISOString(),
    });
  }

  const rawBody = req.bodyRaw || (typeof body === 'string' ? body : JSON.stringify(body));
  const expectedSignature =
    'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({
      error: 'Invalid signature',
      timestamp: new Date().toISOString(),
    });
  }

  // Process different GitHub events
  const responseData = {
    message: `Processed GitHub ${event} event`,
    event,
    delivery,
    repository: body.repository?.full_name,
    sender: body.sender?.login,
    timestamp: new Date().toISOString(),
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
        state: body.pull_request?.state,
      };
      break;

    case 'issues':
      responseData.action = body.action;
      responseData.issue = {
        number: body.issue?.number,
        title: body.issue?.title,
        state: body.issue?.state,
      };
      break;
  }

  if (logger) logger.log('CRON', 'GitHub webhook processed', responseData);
  else console.log('GitHub webhook processed:', responseData);

  return res.status(200).json(responseData);
}

async function handleStripeWebhook(req, res, logger, _next) {
  const { headers, body } = req;
  const signature = headers['stripe-signature'];

  const endpointSecret = req.env?.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    return res.status(400).json({
      error: 'Stripe webhook secret not configured',
      timestamp: new Date().toISOString(),
    });
  }

  if (!signature) {
    return res.status(401).json({
      error: 'Missing Stripe signature',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(
      req.env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
    );

    const event = stripe.webhooks.constructEvent(
      req.bodyRaw || (typeof body === 'string' ? body : JSON.stringify(body)),
      signature,
      endpointSecret
    );

    const responseData = {
      message: 'Processed Stripe webhook',
      eventType: event.type,
      eventId: event.id,
      livemode: event.livemode,
      timestamp: new Date().toISOString(),
    };

    switch (event.type) {
      case 'payment_intent.succeeded':
        responseData.paymentIntent = {
          id: event.data.object.id,
          amount: event.data.object.amount,
          currency: event.data.object.currency,
        };
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        responseData.subscription = {
          id: event.data.object.id,
          status: event.data.object.status,
          customerId: event.data.object.customer,
        };
        break;
    }

    if (logger) logger.log('CRON', 'Stripe webhook processed', responseData);
    else console.log('Stripe webhook processed:', responseData);
    return res.status(200).json(responseData);
  } catch (err) {
    return res.status(400).json({
      error: 'Invalid Stripe signature',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
}

async function handleSlackWebhook(req, res, logger, _next) {
  const { headers, body } = req;

  const slackSecret = req.env?.SLACK_SIGNING_SECRET || process.env.SLACK_SIGNING_SECRET;
  if (!slackSecret) {
    return res.status(400).json({
      error: 'Slack signing secret not configured',
      timestamp: new Date().toISOString(),
    });
  }

  const signature = headers['x-slack-signature'];
  const timestamp = headers['x-slack-request-timestamp'];

  if (!signature || !timestamp) {
    return res.status(401).json({
      error: 'Missing Slack signature or timestamp',
      timestamp: new Date().toISOString(),
    });
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return res.status(401).json({
      error: 'Slack request timestamp too old (replay attack protection)',
      timestamp: new Date().toISOString(),
    });
  }

  const rawBody = req.bodyRaw || (typeof body === 'string' ? body : JSON.stringify(body));
  const baseString = `v0:${timestamp}:${rawBody}`;
  const expectedSignature =
    'v0=' + crypto.createHmac('sha256', slackSecret).update(baseString).digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({
      error: 'Invalid Slack signature',
      timestamp: new Date().toISOString(),
    });
  }

  if (body.type === 'url_verification') {
    return res.status(200).json({
      challenge: body.challenge,
    });
  }

  const responseData = {
    message: 'Processed Slack webhook',
    type: body.type,
    team: body.team_id,
    timestamp: new Date().toISOString(),
  };

  if (body.event) {
    responseData.event = {
      type: body.event.type,
      user: body.event.user,
      channel: body.event.channel,
      timestamp: body.event.ts,
    };

    if (body.event.text) {
      responseData.event.text = body.event.text;
    }
  }

  if (logger) logger.log('CRON', 'Slack webhook processed', responseData);
  else console.log('Slack webhook processed:', responseData);

  return res.status(200).json(responseData);
}

async function handleGenericWebhook(req, res, logger, _next) {
  const { headers, body, query } = req;

  const responseData = {
    message: 'Processed generic webhook',
    headers: {
      contentType: headers['content-type'],
      userAgent: headers['user-agent'],
      authorization: headers.authorization ? '[REDACTED]' : undefined,
    },
    bodyType: typeof body,
    hasBody: !!body,
    queryParams: Object.keys(query).length > 0 ? query : undefined,
    timestamp: new Date().toISOString(),
  };

  // Add basic payload analysis
  if (body && typeof body === 'object') {
    responseData.bodyKeys = Object.keys(body);
    responseData.bodySize = JSON.stringify(body).length;
  }

  if (logger) logger.log('CRON', 'Generic webhook processed', responseData);
  else console.log('Generic webhook processed:', responseData);

  return res.status(200).json(responseData);
}

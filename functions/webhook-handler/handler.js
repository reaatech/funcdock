/**
 * Webhook Handler Sample Function
 * Demonstrates handling various webhook payloads with validation and processing
 */

import crypto from 'crypto';

export default async function handler(req, res) {
  const { method, headers, body, query } = req;

  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Signature, X-Hub-Signature-256');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  switch (method) {
    case 'GET':
      return handleStatus(req, res);

    case 'POST':
      return handleWebhook(req, res);

    default:
      return res.status(405).json({
        error: 'Method Not Allowed',
        supportedMethods: ['GET', 'POST'],
        timestamp: new Date().toISOString()
      });
  }
}

async function handleStatus(req, res) {
  return res.status(200).json({
    status: 'active',
    function: 'webhook-handler',
    version: '1.0.0',
    endpoints: {
      github: '/webhook-handler/github',
      stripe: '/webhook-handler/stripe',
      generic: '/webhook-handler/generic',
      slack: '/webhook-handler/slack'
    },
    timestamp: new Date().toISOString()
  });
}

async function handleWebhook(req, res) {
  const { headers, body } = req;
  const webhookType = determineWebhookType(headers, body);

  try {
    switch (webhookType) {
      case 'github':
        return await handleGitHubWebhook(req, res);

      case 'stripe':
        return await handleStripeWebhook(req, res);

      case 'slack':
        return await handleSlackWebhook(req, res);

      default:
        return await handleGenericWebhook(req, res);
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
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

async function handleGitHubWebhook(req, res) {
  const { headers, body } = req;
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
        timestamp: new Date().toISOString()
      });
    }
  }

  // Process different GitHub events
  const responseData = {
    message: `Processed GitHub ${event} event`,
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

async function handleStripeWebhook(req, res) {
  const { headers, body } = req;
  const signature = headers['stripe-signature'];

  // Verify Stripe signature if secret is configured
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (endpointSecret && signature) {
    try {
      // Import Stripe dynamically to avoid issues if not installed
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
      
      // Verify the webhook signature
      const event = stripe.webhooks.constructEvent(
        typeof body === 'string' ? body : JSON.stringify(body),
        signature,
        endpointSecret
      );
      
      // Use the verified event
      const responseData = {
        message: 'Processed Stripe webhook',
        eventType: event.type,
        eventId: event.id,
        livemode: event.livemode,
        timestamp: new Date().toISOString()
      };

      // Add event-specific processing
      switch (event.type) {
        case 'payment_intent.succeeded':
          responseData.paymentIntent = {
            id: event.data.object.id,
            amount: event.data.object.amount,
            currency: event.data.object.currency
          };
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          responseData.subscription = {
            id: event.data.object.id,
            status: event.data.object.status,
            customerId: event.data.object.customer
          };
          break;
      }

      console.log('Stripe webhook processed:', responseData);
      return res.status(200).json(responseData);
      
    } catch (err) {
      return res.status(400).json({
        error: 'Invalid Stripe signature',
        message: err.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // If no signature verification is configured, process without verification
  const responseData = {
    message: 'Processed Stripe webhook (unverified)',
    eventType: body.type,
    eventId: body.id,
    livemode: body.livemode,
    timestamp: new Date().toISOString()
  };

  // Add event-specific processing
  switch (body.type) {
    case 'payment_intent.succeeded':
      responseData.paymentIntent = {
        id: body.data.object.id,
        amount: body.data.object.amount,
        currency: body.data.object.currency
      };
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      responseData.subscription = {
        id: body.data.object.id,
        status: body.data.object.status,
        customerId: body.data.object.customer
      };
      break;
  }

  console.log('Stripe webhook processed (unverified):', responseData);

  return res.status(200).json(responseData);
}

async function handleSlackWebhook(req, res) {
  const { body } = req;

  // Handle Slack URL verification challenge
  if (body.type === 'url_verification') {
    return res.status(200).json({
      challenge: body.challenge
    });
  }

  const responseData = {
    message: 'Processed Slack webhook',
    type: body.type,
    team: body.team_id,
    timestamp: new Date().toISOString()
  };

  // Process different Slack events
  if (body.event) {
    responseData.event = {
      type: body.event.type,
      user: body.event.user,
      channel: body.event.channel,
      timestamp: body.event.ts
    };

    if (body.event.text) {
      responseData.event.text = body.event.text;
    }
  }

  console.log('Slack webhook processed:', responseData);

  return res.status(200).json(responseData);
}

async function handleGenericWebhook(req, res) {
  const { headers, body, query } = req;

  const responseData = {
    message: 'Processed generic webhook',
    headers: {
      contentType: headers['content-type'],
      userAgent: headers['user-agent'],
      authorization: headers.authorization ? '[REDACTED]' : undefined
    },
    bodyType: typeof body,
    hasBody: !!body,
    queryParams: Object.keys(query).length > 0 ? query : undefined,
    timestamp: new Date().toISOString()
  };

  // Add basic payload analysis
  if (body && typeof body === 'object') {
    responseData.bodyKeys = Object.keys(body);
    responseData.bodySize = JSON.stringify(body).length;
  }

  console.log('Generic webhook processed:', responseData);

  return res.status(200).json(responseData);
}

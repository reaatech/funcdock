/**
 * Generic Webhook Handler - Specific handler for /webhook-handler/generic route
 * 
 * This is a catch-all webhook handler that can process any type of webhook payload.
 * Useful for testing, debugging, or handling webhooks from services that don't have
 * specific handlers implemented.
 */

export default async function handler(req, res) {
  const { method, headers, body, query } = req;

  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Signature, X-Hub-Signature-256, X-Webhook-Signature');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (method !== 'POST' && method !== 'GET') {
    return res.status(405).json({
      error: 'Method Not Allowed',
      handler: 'generic.js',
      method,
      supportedMethods: ['POST', 'GET'],
      timestamp: new Date().toISOString()
    });
  }

  try {
    if (method === 'GET') {
      return handleStatus(req, res);
    } else {
      return handleGenericWebhook(req, res);
    }
  } catch (error) {
    console.error('Generic webhook processing error:', error);
    return res.status(500).json({
      error: 'Generic webhook processing failed',
      handler: 'generic.js',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleStatus(req, res) {
  return res.status(200).json({
    status: 'active',
    handler: 'generic.js',
    description: 'Generic webhook handler - accepts any webhook payload',
    endpoints: {
      generic: '/webhook-handler/generic',
      github: '/webhook-handler/github',
      stripe: '/webhook-handler/stripe',
      slack: '/webhook-handler/slack'
    },
    timestamp: new Date().toISOString()
  });
}

async function handleGenericWebhook(req, res) {
  const { headers, body, query } = req;

  const responseData = {
    message: 'Processed generic webhook',
    handler: 'generic.js',
    headers: {
      contentType: headers['content-type'],
      userAgent: headers['user-agent'],
      authorization: headers.authorization ? '[REDACTED]' : undefined,
      // Common webhook signature headers
      xSignature: headers['x-signature'] ? '[PRESENT]' : undefined,
      xHubSignature: headers['x-hub-signature-256'] ? '[PRESENT]' : undefined,
      xWebhookSignature: headers['x-webhook-signature'] ? '[PRESENT]' : undefined,
      stripeSignature: headers['stripe-signature'] ? '[PRESENT]' : undefined,
      slackSignature: headers['x-slack-signature'] ? '[PRESENT]' : undefined
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
    
    // Try to identify the webhook source based on payload structure
    responseData.detectedSource = detectWebhookSource(body, headers);
    
    // Extract common webhook fields
    if (body.type) responseData.webhookType = body.type;
    if (body.event) responseData.event = body.event;
    if (body.id) responseData.webhookId = body.id;
    if (body.timestamp) responseData.webhookTimestamp = body.timestamp;
  } else if (body && typeof body === 'string') {
    responseData.bodySize = body.length;
    responseData.bodyPreview = body.substring(0, 200) + (body.length > 200 ? '...' : '');
  }

  // Add request metadata
  responseData.requestMetadata = {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: headers['user-agent']
  };

  console.log('Generic webhook processed:', responseData);

  return res.status(200).json(responseData);
}

function detectWebhookSource(body, headers) {
  // Try to identify the webhook source based on headers and payload structure
  
  // GitHub
  if (headers['x-github-event'] || body.repository || body.sender) {
    return 'github';
  }
  
  // Stripe
  if (headers['stripe-signature'] || body.type?.startsWith('customer.') || body.type?.startsWith('payment_')) {
    return 'stripe';
  }
  
  // Slack
  if (headers['x-slack-signature'] || body.team_id || body.channel_id || body.user_id) {
    return 'slack';
  }
  
  // Discord
  if (body.guild_id || body.channel_id || body.author) {
    return 'discord';
  }
  
  // Twilio
  if (body.From || body.To || body.MessageSid) {
    return 'twilio';
  }
  
  // SendGrid
  if (body.event || body.email || body.timestamp) {
    return 'sendgrid';
  }
  
  // Mailgun
  if (body['event-data'] || body.signature) {
    return 'mailgun';
  }
  
  // Zapier
  if (body.zap_id || body.webhook_id) {
    return 'zapier';
  }
  
  // IFTTT
  if (body.trigger_identity || body.trigger_time) {
    return 'ifttt';
  }
  
  // Custom/Unknown
  return 'unknown';
} 
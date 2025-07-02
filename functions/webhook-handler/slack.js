/**
 * Slack Webhook Handler - Specific handler for /webhook-handler/slack route
 * 
 * Handles various Slack webhook types including:
 * - URL verification challenges
 * - Event subscriptions (message events, app mentions, etc.)
 * - Interactive components (buttons, menus, etc.)
 * - Slash commands
 */

import crypto from 'crypto';

export default async function handler(req, res, next) {
  const { method, headers, body } = req;

  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Slack-Signature, X-Slack-Request-Timestamp');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed',
      handler: 'slack.js',
      method,
      supportedMethods: ['POST'],
      timestamp: new Date().toISOString()
    });
  }

  // Verify Slack signature if secret is configured
  const slackSecret = process.env.SLACK_SIGNING_SECRET;
  if (slackSecret) {
    const signature = headers['x-slack-signature'];
    const timestamp = headers['x-slack-request-timestamp'];
    
    if (signature && timestamp) {
      const isValid = verifySlackSignature(slackSecret, signature, timestamp, body);
      if (!isValid) {
        return res.status(401).json({
          error: 'Invalid Slack signature',
          handler: 'slack.js',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Handle different types of Slack webhooks
  const webhookType = determineSlackWebhookType(body);
  
  try {
    switch (webhookType) {
      case 'url_verification':
        return handleUrlVerification(req, res, next);
        
      case 'event_subscription':
        return handleEventSubscription(req, res, next);
        
      case 'interactive_component':
        return handleInteractiveComponent(req, res, next);
        
      case 'slash_command':
        return handleSlashCommand(req, res, next);
        
      default:
        return handleGenericSlackWebhook(req, res, next);
    }
  } catch (error) {
    console.error('Slack webhook processing error:', error);
    return res.status(500).json({
      error: 'Slack webhook processing failed',
      handler: 'slack.js',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

function verifySlackSignature(secret, signature, timestamp, body) {
  const baseString = `v0:${timestamp}:${JSON.stringify(body)}`;
  const expectedSignature = 'v0=' + crypto
    .createHmac('sha256', secret)
    .update(baseString)
    .digest('hex');
  
  return signature === expectedSignature;
}

function determineSlackWebhookType(body) {
  // URL verification challenge
  if (body.type === 'url_verification') {
    return 'url_verification';
  }
  
  // Event subscriptions
  if (body.event && body.type === 'event_callback') {
    return 'event_subscription';
  }
  
  // Interactive components (buttons, menus, etc.)
  if (body.type === 'interactive_message' || body.payload) {
    return 'interactive_component';
  }
  
  // Slash commands
  if (body.command) {
    return 'slash_command';
  }
  
  return 'generic';
}

async function handleUrlVerification(req, res, next) {
  const { body } = req;
  
  console.log('Slack URL verification challenge received');
  
  return res.status(200).json({
    challenge: body.challenge,
    handler: 'slack.js',
    type: 'url_verification',
    timestamp: new Date().toISOString()
  });
}

async function handleEventSubscription(req, res, next) {
  const { body } = req;
  
  const responseData = {
    message: 'Processed Slack event subscription',
    handler: 'slack.js',
    type: 'event_subscription',
    eventType: body.event?.type,
    team: body.team_id,
    channel: body.event?.channel,
    user: body.event?.user,
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

    // Handle message events
    if (body.event.type === 'message') {
      responseData.event.text = body.event.text;
      responseData.event.subtype = body.event.subtype;
      responseData.event.threadTs = body.event.thread_ts;
    }
    
    // Handle app mention events
    if (body.event.type === 'app_mention') {
      responseData.event.text = body.event.text;
      responseData.event.threadTs = body.event.thread_ts;
    }
    
    // Handle reaction events
    if (body.event.type === 'reaction_added' || body.event.type === 'reaction_removed') {
      responseData.event.reaction = body.event.reaction;
      responseData.event.item = body.event.item;
    }
  }

  console.log('Slack event subscription processed:', responseData);

  return res.status(200).json(responseData);
}

async function handleInteractiveComponent(req, res, next) {
  const { body } = req;
  
  let payload;
  try {
    // Interactive components send payload as URL-encoded string
    payload = typeof body.payload === 'string' ? JSON.parse(body.payload) : body.payload;
  } catch (error) {
    return res.status(400).json({
      error: 'Invalid payload format',
      handler: 'slack.js',
      timestamp: new Date().toISOString()
    });
  }

  const responseData = {
    message: 'Processed Slack interactive component',
    handler: 'slack.js',
    type: 'interactive_component',
    callbackId: payload.callback_id,
    actionId: payload.actions?.[0]?.action_id,
    team: payload.team?.id,
    user: payload.user?.id,
    channel: payload.channel?.id,
    timestamp: new Date().toISOString()
  };

  // Process different interactive component types
  if (payload.actions && payload.actions.length > 0) {
    const action = payload.actions[0];
    responseData.action = {
      type: action.type,
      actionId: action.action_id,
      value: action.value,
      selectedOption: action.selected_option
    };
  }

  console.log('Slack interactive component processed:', responseData);

  return res.status(200).json(responseData);
}

async function handleSlashCommand(req, res, next) {
  const { body } = req;
  
  const responseData = {
    message: 'Processed Slack slash command',
    handler: 'slack.js',
    type: 'slash_command',
    command: body.command,
    text: body.text,
    team: body.team_id,
    user: body.user_id,
    channel: body.channel_id,
    timestamp: new Date().toISOString()
  };

  // Example: Handle different slash commands
  switch (body.command) {
    case '/hello':
      responseData.response = {
        response_type: 'in_channel',
        text: `Hello <@${body.user_id}>! 👋`
      };
      break;
      
    case '/help':
      responseData.response = {
        response_type: 'ephemeral',
        text: 'Available commands: /hello, /help, /status'
      };
      break;
      
    case '/status':
      responseData.response = {
        response_type: 'in_channel',
        text: '🟢 All systems operational!'
      };
      break;
      
    default:
      responseData.response = {
        response_type: 'ephemeral',
        text: `Unknown command: ${body.command}`
      };
  }

  console.log('Slack slash command processed:', responseData);

  return res.status(200).json(responseData);
}

async function handleGenericSlackWebhook(req, res, next) {
  const { body } = req;
  
  const responseData = {
    message: 'Processed generic Slack webhook',
    handler: 'slack.js',
    type: 'generic',
    bodyType: typeof body,
    bodyKeys: Object.keys(body),
    timestamp: new Date().toISOString()
  };

  // Add basic payload analysis
  if (body && typeof body === 'object') {
    responseData.bodySize = JSON.stringify(body).length;
    
    // Extract common Slack fields
    if (body.team_id) responseData.team = body.team_id;
    if (body.user_id) responseData.user = body.user_id;
    if (body.channel_id) responseData.channel = body.channel_id;
    if (body.type) responseData.slackType = body.type;
  }

  console.log('Generic Slack webhook processed:', responseData);

  return res.status(200).json(responseData);
} 
import { jest } from '@jest/globals';
import crypto from 'crypto';
import slackHandler from './slack.js';

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

const SLACK_SIGNING_SECRET = 'test_slack_signing_secret_for_testing';

function createMockReqRes(method = 'POST', headers = {}, body = {}) {
  const req = { method, headers, body, logger };
  let statusCode = 200;
  let sentData;
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      sentData = data;
      return res;
    },
    header(_key, _value) {
      return res;
    },
    end() {
      return res;
    },
    getStatus: () => statusCode,
    getData: () => sentData,
  };
  return { req, res };
}

function generateSlackSignature(timestamp, body, secret) {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
  const baseString = `v0:${timestamp}:${rawBody}`;
  return 'v0=' + crypto.createHmac('sha256', secret).update(baseString).digest('hex');
}

describe('webhook-handler/slack.js', () => {
  const originalSecret = process.env.SLACK_SIGNING_SECRET;

  beforeAll(() => {
    process.env.SLACK_SIGNING_SECRET = SLACK_SIGNING_SECRET;
  });

  afterAll(() => {
    process.env.SLACK_SIGNING_SECRET = originalSecret;
  });

  describe('URL verification', () => {
    it('should handle url_verification challenge', async () => {
      const body = { type: 'url_verification', challenge: 'test-challenge-123' };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().challenge).toBe('test-challenge-123');
    });
  });

  describe('event_subscription', () => {
    it('should process message event', async () => {
      const body = {
        type: 'event_callback',
        team_id: 'T123',
        event: {
          type: 'message',
          user: 'U456',
          channel: 'C789',
          text: 'Hello!',
          ts: '1234567890.123',
        },
      };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(200);
      const data = res.getData();
      expect(data.eventType).toBe('message');
      expect(data.event.text).toBe('Hello!');
      expect(data.event.user).toBe('U456');
    });

    it('should process app_mention event', async () => {
      const body = {
        type: 'event_callback',
        team_id: 'T123',
        event: {
          type: 'app_mention',
          user: 'U456',
          text: '<@bot> hello',
          thread_ts: '1234567890.123',
        },
      };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().event.text).toBe('<@bot> hello');
    });

    it('should process reaction_added event', async () => {
      const body = {
        type: 'event_callback',
        event: {
          type: 'reaction_added',
          reaction: 'thumbsup',
          item: { type: 'message', channel: 'C123' },
        },
      };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().event.reaction).toBe('thumbsup');
    });

    it('should process reaction_removed event', async () => {
      const body = {
        type: 'event_callback',
        event: { type: 'reaction_removed', reaction: 'thumbsup', item: { type: 'message' } },
      };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(200);
    });
  });

  describe('interactive_component', () => {
    it('should process interactive message with actions', async () => {
      const payload = {
        callback_id: 'button-click',
        team: { id: 'T123' },
        user: { id: 'U456' },
        channel: { id: 'C789' },
        actions: [{ action_id: 'btn_1', type: 'button', value: 'clicked' }],
      };
      const body = { type: 'interactive_message', payload: JSON.stringify(payload) };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().callbackId).toBe('button-click');
      expect(res.getData().actionId).toBe('btn_1');
    });

    it('should handle invalid payload in interactive component', async () => {
      const body = {
        type: 'interactive_message',
        payload: '{invalid json',
      };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(400);
    });

    it('should handle interactive component without actions', async () => {
      const payload = {
        callback_id: 'no-actions',
        team: { id: 'T123' },
      };
      const body = { type: 'interactive_message', payload: JSON.stringify(payload) };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(200);
    });
  });

  describe('slash_command', () => {
    it('should process /hello command', async () => {
      const body = {
        command: '/hello',
        text: '',
        team_id: 'T123',
        user_id: 'U456',
        channel_id: 'C789',
      };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().command).toBe('/hello');
      expect(res.getData().response.text).toContain('Hello');
    });

    it('should process /help command', async () => {
      const body = {
        command: '/help',
        team_id: 'T123',
        user_id: 'U456',
        channel_id: 'C789',
      };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getData().response.text).toBe('Available commands: /hello, /help, /status');
    });

    it('should process /status command', async () => {
      const body = {
        command: '/status',
        team_id: 'T123',
        user_id: 'U456',
        channel_id: 'C789',
      };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getData().response.text).toContain('All systems operational');
    });

    it('should handle unknown slash command', async () => {
      const body = {
        command: '/unknown',
        text: 'arg',
        team_id: 'T123',
        user_id: 'U456',
        channel_id: 'C789',
      };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getData().response.text).toContain('Unknown command');
    });
  });

  describe('generic Slack webhook', () => {
    it('should handle generic Slack webhook', async () => {
      const body = {
        team_id: 'T123',
        user_id: 'U456',
        channel_id: 'C789',
        type: 'unknown_type',
      };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().type).toBe('generic');
      expect(res.getData().team).toBe('T123');
    });
  });

  describe('OPTIONS', () => {
    it('should return 200 for OPTIONS requests', async () => {
      const { req, res } = createMockReqRes('OPTIONS');
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(200);
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for GET method', async () => {
      const { req, res } = createMockReqRes('GET');
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(405);
    });
  });

  describe('security', () => {
    it('should reject requests without signature', async () => {
      const body = { type: 'url_verification', challenge: 'test' };
      const { req, res } = createMockReqRes('POST', {}, body);
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(401);
    });

    it('should reject requests with invalid signature', async () => {
      const body = { type: 'url_verification', challenge: 'test' };
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': 'v0=invalid',
          'x-slack-request-timestamp': String(Math.floor(Date.now() / 1000)),
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(401);
    });

    it('should reject requests with old timestamp', async () => {
      const body = { type: 'url_verification', challenge: 'test' };
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-slack-signature': generateSlackSignature('1000000000', body, SLACK_SIGNING_SECRET),
          'x-slack-request-timestamp': '1000000000',
        },
        body
      );
      await slackHandler(req, res);
      expect(res.getStatus()).toBe(401);
    });
  });
});

import { jest } from '@jest/globals';
import crypto from 'crypto';
import handler from './handler.js';

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), log: jest.fn() };

const GITHUB_WEBHOOK_SECRET = 'test_github_secret';
const SLACK_SIGNING_SECRET = 'test_slack_secret';

function createMockReqRes(method = 'GET', headers = {}, body = {}, query = {}) {
  const req = { method, headers, body, logger, query };
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

function generateGitHubSignature(body, secret) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

function generateSlackSignature(timestamp, body, secret) {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
  const baseString = `v0:${timestamp}:${rawBody}`;
  return 'v0=' + crypto.createHmac('sha256', secret).update(baseString).digest('hex');
}

describe('webhook-handler/handler.js', () => {
  const originalGitHubSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const originalSlackSecret = process.env.SLACK_SIGNING_SECRET;

  beforeAll(() => {
    process.env.GITHUB_WEBHOOK_SECRET = GITHUB_WEBHOOK_SECRET;
    process.env.SLACK_SIGNING_SECRET = SLACK_SIGNING_SECRET;
  });

  afterAll(() => {
    process.env.GITHUB_WEBHOOK_SECRET = originalGitHubSecret;
    process.env.SLACK_SIGNING_SECRET = originalSlackSecret;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_WEBHOOK_SECRET = GITHUB_WEBHOOK_SECRET;
    process.env.SLACK_SIGNING_SECRET = SLACK_SIGNING_SECRET;
  });

  describe('GET /', () => {
    it('should return webhook handler status', async () => {
      const { req, res } = createMockReqRes('GET');
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      const data = res.getData();
      expect(data.status).toBe('active');
      expect(data.function).toBe('webhook-handler');
      expect(data.version).toBe('1.0.0');
      expect(data.endpoints.github).toBe('/webhook-handler/github');
      expect(data.endpoints.stripe).toBe('/webhook-handler/stripe');
    });
  });

  describe('POST / - webhook routing', () => {
    it('should route GitHub webhook to GitHub handler', async () => {
      const body = { repository: { full_name: 'test/repo' }, sender: { login: 'user' } };
      const signature = generateGitHubSignature(body, GITHUB_WEBHOOK_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-github-event': 'push',
          'x-hub-signature-256': signature,
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().event).toBe('push');
    });

    it('should route to generic handler for unknown webhook type', async () => {
      const body = { random: 'payload', value: 123 };
      const { req, res } = createMockReqRes('POST', { 'content-type': 'application/json' }, body);
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().message).toBe('Processed generic webhook');
    });

    it('should detect Slack webhook by user-agent header', async () => {
      const body = { type: 'url_verification', challenge: 'test123' };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'user-agent': 'Slackbot 1.0',
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().challenge).toBe('test123');
    });

    it('should detect Slack webhook by body token', async () => {
      const body = { token: 'slack-token', type: 'url_verification', challenge: 'test123' };
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
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
    });

    it('should route Stripe webhook by stripe-signature header', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      const { req, res } = createMockReqRes(
        'POST',
        { 'stripe-signature': 'sig_test' },
        { id: 'evt_1' }
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getData().error).toBe('Stripe webhook secret not configured');
    });

    it('should include query params in generic webhook response', async () => {
      const body = { test: 'data' };
      const { req, res } = createMockReqRes('POST', {}, body, { foo: 'bar', num: '123' });
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().queryParams).toEqual({ foo: 'bar', num: '123' });
    });

    it('should handle generic webhook without query params', async () => {
      const body = { test: 'data' };
      const { req, res } = createMockReqRes('POST', {}, body, {});
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().queryParams).toBeUndefined();
    });
  });

  describe('OPTIONS', () => {
    it('should return 200 for OPTIONS requests', async () => {
      const { req, res } = createMockReqRes('OPTIONS');
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for PUT method', async () => {
      const { req, res } = createMockReqRes('PUT');
      await handler(req, res);
      expect(res.getStatus()).toBe(405);
    });

    it('should return 405 for DELETE method', async () => {
      const { req, res } = createMockReqRes('DELETE');
      await handler(req, res);
      expect(res.getStatus()).toBe(405);
    });
  });

  describe('GitHub webhook security and events', () => {
    it('should reject GitHub webhook without signature', async () => {
      const body = { repository: { full_name: 'test/repo' } };
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-github-event': 'push',
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(401);
    });

    it('should reject GitHub webhook with invalid signature', async () => {
      const body = { repository: { full_name: 'test/repo' } };
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-github-event': 'push',
          'x-hub-signature-256': 'sha256=invalid',
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(401);
    });

    it('should reject GitHub webhook when secret is missing', async () => {
      delete process.env.GITHUB_WEBHOOK_SECRET;
      const body = { repository: { full_name: 'test/repo' } };
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-github-event': 'push',
          'x-hub-signature-256': 'sha256=anything',
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getData().error).toBe('GitHub webhook secret not configured');
    });

    it('should process pull_request event', async () => {
      const body = {
        action: 'opened',
        pull_request: { number: 42, title: 'Test PR', state: 'open' },
        repository: { full_name: 'test/repo' },
        sender: { login: 'user' },
      };
      const signature = generateGitHubSignature(body, GITHUB_WEBHOOK_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-github-event': 'pull_request',
          'x-hub-signature-256': signature,
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().pullRequest.number).toBe(42);
    });

    it('should process issues event', async () => {
      const body = {
        action: 'opened',
        issue: { number: 7, title: 'Bug', state: 'open' },
        repository: { full_name: 'test/repo' },
        sender: { login: 'user' },
      };
      const signature = generateGitHubSignature(body, GITHUB_WEBHOOK_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-github-event': 'issues',
          'x-hub-signature-256': signature,
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().issue.number).toBe(7);
    });

    it('should process push event with missing optional fields', async () => {
      const body = {};
      const signature = generateGitHubSignature(body, GITHUB_WEBHOOK_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-github-event': 'push',
          'x-hub-signature-256': signature,
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().commits).toBe(0);
    });
  });

  describe('Slack webhook security and events', () => {
    it('should reject Slack webhook when secret is missing', async () => {
      delete process.env.SLACK_SIGNING_SECRET;
      const body = { type: 'url_verification', challenge: 'test' };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, 'any');
      const { req, res } = createMockReqRes(
        'POST',
        {
          'user-agent': 'Slackbot 1.0',
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getData().error).toBe('Slack signing secret not configured');
    });

    it('should reject Slack webhook without signature', async () => {
      const body = { type: 'url_verification' };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const { req, res } = createMockReqRes(
        'POST',
        {
          'user-agent': 'Slackbot 1.0',
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(401);
    });

    it('should reject Slack webhook without timestamp', async () => {
      const body = { type: 'url_verification' };
      const { req, res } = createMockReqRes(
        'POST',
        {
          'user-agent': 'Slackbot 1.0',
          'x-slack-signature': 'v0=anything',
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(401);
    });

    it('should reject Slack webhook with expired timestamp', async () => {
      const body = { type: 'url_verification' };
      const oldTimestamp = String(Math.floor(Date.now() / 1000) - 400);
      const signature = generateSlackSignature(oldTimestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'user-agent': 'Slackbot 1.0',
          'x-slack-signature': signature,
          'x-slack-request-timestamp': oldTimestamp,
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(401);
      expect(res.getData().error).toContain('timestamp too old');
    });

    it('should reject Slack webhook with invalid signature', async () => {
      const body = { type: 'url_verification' };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const { req, res } = createMockReqRes(
        'POST',
        {
          'user-agent': 'Slackbot 1.0',
          'x-slack-signature': 'v0=invalid',
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(401);
    });

    it('should process Slack event callback', async () => {
      const body = {
        type: 'event_callback',
        team_id: 'T123',
        event: {
          type: 'message',
          user: 'U123',
          channel: 'C123',
          ts: '1234567890.123',
          text: 'hello',
        },
      };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'user-agent': 'Slackbot 1.0',
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().event.text).toBe('hello');
    });

    it('should process Slack event without text', async () => {
      const body = {
        type: 'event_callback',
        team_id: 'T123',
        event: { type: 'reaction_added', user: 'U123', channel: 'C123', ts: '1234567890.123' },
      };
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSlackSignature(timestamp, body, SLACK_SIGNING_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'user-agent': 'Slackbot 1.0',
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        body
      );
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().event.text).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should handle errors thrown by webhook sub-handlers', async () => {
      const body = { repository: { full_name: 'test/repo' } };
      const signature = generateGitHubSignature(body, GITHUB_WEBHOOK_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-github-event': 'push',
          'x-hub-signature-256': signature,
        },
        body
      );

      let throwNext = true;
      const originalJson = res.json;
      res.json = (data) => {
        if (throwNext) {
          throwNext = false;
          throw new Error('Response error');
        }
        return originalJson(data);
      };

      await handler(req, res);
      // The error is caught by handleWebhook catch block
      expect(res.getStatus()).toBe(500);
    });
  });
});

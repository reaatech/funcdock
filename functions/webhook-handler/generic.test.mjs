import { jest } from '@jest/globals';
import genericHandler from './generic.js';

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), log: jest.fn() };

function createMockReqRes(method = 'POST', headers = {}, body = {}, query = {}) {
  const req = {
    method,
    headers,
    body,
    query,
    logger,
    ip: '127.0.0.1',
    url: '/webhook-handler/generic',
  };
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

describe('webhook-handler/generic.js', () => {
  describe('POST /generic', () => {
    it('should process generic webhook with JSON body', async () => {
      const body = { event: 'test', data: { key: 'value' } };
      const { req, res } = createMockReqRes('POST', { 'content-type': 'application/json' }, body);
      await genericHandler(req, res);
      expect(res.getStatus()).toBe(200);
      const data = res.getData();
      expect(data.message).toBe('Processed generic webhook');
      expect(data.handler).toBe('generic.js');
      expect(data.bodyType).toBe('object');
      expect(data.hasBody).toBe(true);
      expect(data.bodyKeys).toContain('event');
    });

    it('should detect GitHub webhook source', async () => {
      const body = { repository: { full_name: 'test/repo' }, sender: { login: 'user' } };
      const { req, res } = createMockReqRes('POST', { 'x-github-event': 'push' }, body);
      await genericHandler(req, res);
      expect(res.getData().detectedSource).toBe('github');
    });

    it('should detect Stripe webhook source', async () => {
      const body = { type: 'payment_intent.succeeded' };
      const { req, res } = createMockReqRes('POST', { 'stripe-signature': 'sig' }, body);
      await genericHandler(req, res);
      expect(res.getData().detectedSource).toBe('stripe');
    });

    it('should detect Slack webhook source', async () => {
      const body = { team_id: 'T123', user_id: 'U456' };
      const { req, res } = createMockReqRes('POST', { 'x-slack-signature': 'sig' }, body);
      await genericHandler(req, res);
      expect(res.getData().detectedSource).toBe('slack');
    });

    it('should detect Discord webhook source', async () => {
      const body = { guild_id: '123', author: { id: '789' } };
      const { req, res } = createMockReqRes('POST', {}, body);
      await genericHandler(req, res);
      expect(res.getData().detectedSource).toBe('discord');
    });

    it('should detect Twilio webhook source', async () => {
      const body = { From: '+1234567890', To: '+0987654321', MessageSid: 'SM123' };
      const { req, res } = createMockReqRes('POST', {}, body);
      await genericHandler(req, res);
      expect(res.getData().detectedSource).toBe('twilio');
    });

    it('should detect SendGrid webhook source', async () => {
      const body = { event: 'open', email: 'test@example.com', timestamp: '2024-01-01' };
      const { req, res } = createMockReqRes('POST', {}, body);
      await genericHandler(req, res);
      expect(res.getData().detectedSource).toBe('sendgrid');
    });

    it('should detect Mailgun webhook source', async () => {
      const body = { 'event-data': {}, signature: 'sig' };
      const { req, res } = createMockReqRes('POST', {}, body);
      await genericHandler(req, res);
      expect(res.getData().detectedSource).toBe('mailgun');
    });

    it('should detect Zapier webhook source', async () => {
      const body = { zap_id: 'zap123', webhook_id: 'wh456' };
      const { req, res } = createMockReqRes('POST', {}, body);
      await genericHandler(req, res);
      expect(res.getData().detectedSource).toBe('zapier');
    });

    it('should detect IFTTT webhook source', async () => {
      const body = { trigger_identity: 'trig1', trigger_time: '2024-01-01' };
      const { req, res } = createMockReqRes('POST', {}, body);
      await genericHandler(req, res);
      expect(res.getData().detectedSource).toBe('ifttt');
    });

    it('should return unknown for unrecognized webhooks', async () => {
      const body = { random: 'data' };
      const { req, res } = createMockReqRes('POST', {}, body);
      await genericHandler(req, res);
      expect(res.getData().detectedSource).toBe('unknown');
    });

    it('should redact authorization header', async () => {
      const { req, res } = createMockReqRes(
        'POST',
        { authorization: 'Bearer secret' },
        { test: true }
      );
      await genericHandler(req, res);
      expect(res.getData().headers.authorization).toBe('[REDACTED]');
    });

    it('should handle string body', async () => {
      const body = 'raw string body';
      const { req, res } = createMockReqRes('POST', {}, body);
      await genericHandler(req, res);
      expect(res.getData().bodyType).toBe('string');
      expect(res.getData().bodyPreview).toBeDefined();
    });

    it('should include request metadata', async () => {
      const { req, res } = createMockReqRes('POST', { 'user-agent': 'test-agent' }, { test: true });
      await genericHandler(req, res);
      const data = res.getData();
      expect(data.requestMetadata.method).toBe('POST');
      expect(data.requestMetadata.userAgent).toBe('test-agent');
    });

    it('should handle query parameters', async () => {
      const { req, res } = createMockReqRes('POST', {}, { test: true }, { foo: 'bar' });
      await genericHandler(req, res);
      expect(res.getData().queryParams).toEqual({ foo: 'bar' });
    });
  });

  describe('GET /generic', () => {
    it('should return status', async () => {
      const { req, res } = createMockReqRes('GET');
      await genericHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().status).toBe('active');
    });
  });

  describe('OPTIONS /generic', () => {
    it('should return 200 for OPTIONS requests', async () => {
      const { req, res } = createMockReqRes('OPTIONS');
      await genericHandler(req, res);
      expect(res.getStatus()).toBe(200);
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for DELETE method', async () => {
      const { req, res } = createMockReqRes('DELETE');
      await genericHandler(req, res);
      expect(res.getStatus()).toBe(405);
    });
  });
});

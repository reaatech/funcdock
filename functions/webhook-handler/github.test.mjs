import { jest } from '@jest/globals';
import crypto from 'crypto';
import githubHandler from './github.js';

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

const GITHUB_WEBHOOK_SECRET = 'test_secret_for_testing';

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

function generateSignature(body, secret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}

describe('webhook-handler/github.js', () => {
  const originalSecret = process.env.GITHUB_WEBHOOK_SECRET;

  beforeAll(() => {
    process.env.GITHUB_WEBHOOK_SECRET = GITHUB_WEBHOOK_SECRET;
  });

  afterAll(() => {
    process.env.GITHUB_WEBHOOK_SECRET = originalSecret;
  });

  describe('POST /github', () => {
    it('should process push event', async () => {
      const body = {
        ref: 'refs/heads/main',
        repository: { full_name: 'owner/repo' },
        sender: { login: 'user1' },
        commits: [{ id: 'abc' }, { id: 'def' }],
      };
      const signature = generateSignature(body, GITHUB_WEBHOOK_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-github-event': 'push',
          'x-github-delivery': 'del-123',
          'x-hub-signature-256': signature,
        },
        body
      );
      await githubHandler(req, res);
      expect(res.getStatus()).toBe(200);
      const data = res.getData();
      expect(data.event).toBe('push');
      expect(data.repository).toBe('owner/repo');
      expect(data.sender).toBe('user1');
      expect(data.commits).toBe(2);
      expect(data.branch).toBe('main');
    });

    it('should process pull_request event', async () => {
      const body = {
        action: 'opened',
        pull_request: { number: 42, title: 'Fix bug', state: 'open' },
        repository: { full_name: 'owner/repo' },
        sender: { login: 'dev1' },
      };
      const signature = generateSignature(body, GITHUB_WEBHOOK_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-github-event': 'pull_request',
          'x-hub-signature-256': signature,
        },
        body
      );
      await githubHandler(req, res);
      expect(res.getStatus()).toBe(200);
      const data = res.getData();
      expect(data.action).toBe('opened');
      expect(data.pullRequest.number).toBe(42);
      expect(data.pullRequest.title).toBe('Fix bug');
    });

    it('should process issues event', async () => {
      const body = {
        action: 'closed',
        issue: { number: 100, title: 'Bug report', state: 'closed' },
        repository: { full_name: 'owner/repo' },
        sender: { login: 'support' },
      };
      const signature = generateSignature(body, GITHUB_WEBHOOK_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-github-event': 'issues',
          'x-hub-signature-256': signature,
        },
        body
      );
      await githubHandler(req, res);
      expect(res.getStatus()).toBe(200);
      const data = res.getData();
      expect(data.action).toBe('closed');
      expect(data.issue.number).toBe(100);
    });

    it('should handle event without optional fields', async () => {
      const body = {};
      const signature = generateSignature(body, GITHUB_WEBHOOK_SECRET);
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-github-event': 'ping',
          'x-hub-signature-256': signature,
        },
        body
      );
      await githubHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().event).toBe('ping');
    });

    it('should reject requests without signature', async () => {
      const body = {};
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-github-event': 'ping',
        },
        body
      );
      await githubHandler(req, res);
      expect(res.getStatus()).toBe(401);
    });

    it('should reject requests with invalid signature', async () => {
      const body = {};
      const { req, res } = createMockReqRes(
        'POST',
        {
          'x-github-event': 'ping',
          'x-hub-signature-256': 'sha256=invalid',
        },
        body
      );
      await githubHandler(req, res);
      expect(res.getStatus()).toBe(401);
    });
  });

  describe('OPTIONS /github', () => {
    it('should return 200 for OPTIONS requests', async () => {
      const { req, res } = createMockReqRes('OPTIONS');
      await githubHandler(req, res);
      expect(res.getStatus()).toBe(200);
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for GET method', async () => {
      const { req, res } = createMockReqRes('GET');
      await githubHandler(req, res);
      expect(res.getStatus()).toBe(405);
    });
  });
});

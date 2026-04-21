import { jest } from '@jest/globals';
import testHandler from './test.js';

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

function createMockReqRes(method = 'GET', query = {}) {
  const req = { method, query, logger, headers: {} };
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

describe('hello-world/test.js', () => {
  describe('GET /test', () => {
    it('should return healthy status', async () => {
      const { req, res } = createMockReqRes('GET');
      await testHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().status).toBe('healthy');
      expect(res.getData().message).toBe('Test endpoint working!');
      expect(res.getData().handler).toBe('test.js');
    });

    it('should echo back query parameters', async () => {
      const { req, res } = createMockReqRes('GET', { foo: 'bar', test: 'value' });
      await testHandler(req, res);
      expect(res.getData().query).toEqual({ foo: 'bar', test: 'value' });
    });

    it('should include timestamp', async () => {
      const { req, res } = createMockReqRes('GET');
      await testHandler(req, res);
      expect(res.getData().timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('OPTIONS /test', () => {
    it('should return 200 for OPTIONS requests', async () => {
      const { req, res } = createMockReqRes('OPTIONS');
      await testHandler(req, res);
      expect(res.getStatus()).toBe(200);
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for POST method', async () => {
      const { req, res } = createMockReqRes('POST');
      await testHandler(req, res);
      expect(res.getStatus()).toBe(405);
      expect(res.getData().error).toBe('Method Not Allowed');
      expect(res.getData().supportedMethods).toEqual(['GET']);
    });

    it('should return 405 for PUT method', async () => {
      const { req, res } = createMockReqRes('PUT');
      await testHandler(req, res);
      expect(res.getStatus()).toBe(405);
    });
  });
});

import { jest } from '@jest/globals';
import greetHandler from './greet.js';

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

function createMockReqRes(method = 'GET', query = {}, body = {}) {
  const req = { method, query, body, logger, headers: {} };
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

describe('hello-world/greet.js', () => {
  describe('GET /greet', () => {
    it('should greet with default name when no query param', async () => {
      const { req, res } = createMockReqRes('GET');
      await greetHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().message).toBe('Hello, World!');
      expect(res.getData().handler).toBe('greet.js');
    });

    it('should greet with provided name', async () => {
      const { req, res } = createMockReqRes('GET', { name: 'Alice' });
      await greetHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().message).toBe('Hello, Alice!');
    });

    it('should include timestamp in response', async () => {
      const { req, res } = createMockReqRes('GET');
      await greetHandler(req, res);
      expect(res.getData().timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('POST /greet', () => {
    it('should send greeting with name from body', async () => {
      const { req, res } = createMockReqRes('POST', {}, { name: 'Bob' });
      await greetHandler(req, res);
      expect(res.getStatus()).toBe(201);
      expect(res.getData().message).toBe('Greeting sent to Bob!');
    });

    it('should handle missing name in body', async () => {
      const { req, res } = createMockReqRes('POST', {}, {});
      await greetHandler(req, res);
      expect(res.getStatus()).toBe(201);
      expect(res.getData().message).toBe('Greeting sent to someone!');
    });

    it('should include custom message from body', async () => {
      const { req, res } = createMockReqRes(
        'POST',
        {},
        { name: 'Carol', message: 'Have a great day!' }
      );
      await greetHandler(req, res);
      expect(res.getData().customMessage).toBe('Have a great day!');
    });
  });

  describe('OPTIONS /greet', () => {
    it('should return 200 for OPTIONS requests', async () => {
      const { req, res } = createMockReqRes('OPTIONS');
      await greetHandler(req, res);
      expect(res.getStatus()).toBe(200);
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for PUT method', async () => {
      const { req, res } = createMockReqRes('PUT');
      await greetHandler(req, res);
      expect(res.getStatus()).toBe(405);
      expect(res.getData().error).toBe('Method Not Allowed');
      expect(res.getData().supportedMethods).toEqual(['GET', 'POST']);
    });

    it('should return 405 for DELETE method', async () => {
      const { req, res } = createMockReqRes('DELETE');
      await greetHandler(req, res);
      expect(res.getStatus()).toBe(405);
    });
  });
});

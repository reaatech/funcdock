import { jest } from '@jest/globals';
import handler from './handler.js';

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

function createMockReqRes(method = 'GET', query = {}, body = {}, env = {}, headers = {}) {
  const req = {
    method,
    query,
    body,
    env,
    headers: { 'user-agent': 'jest', ...headers },
    logger,
    routePath: '/',
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
    text(data) {
      sentData = data;
      return res;
    },
    send(data) {
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

describe('hello-world/handler.js', () => {
  describe('GET /', () => {
    it('should return default greeting with name World', async () => {
      const { req, res } = createMockReqRes('GET');
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().message).toBe('Hello, World!');
      expect(res.getData().function).toBe('hello-world');
      expect(res.getData().version).toBe('1.0.0');
    });

    it('should use name from query parameter', async () => {
      const { req, res } = createMockReqRes('GET', { name: 'Alice' });
      await handler(req, res);
      expect(res.getData().message).toBe('Hello, Alice!');
    });

    it('should return text format when format=text', async () => {
      const { req, res } = createMockReqRes('GET', { format: 'text' });
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData()).toBe('Hello, World!');
    });

    it('should return HTML format when format=html', async () => {
      const { req, res } = createMockReqRes('GET', { format: 'html' });
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData()).toContain('<html>');
      expect(res.getData()).toContain('Hello, World!');
    });

    it('should include requestId in response', async () => {
      const { req, res } = createMockReqRes('GET');
      await handler(req, res);
      expect(res.getData().requestId).toMatch(/^req_\d+_/);
    });

    it('should log environment variables when env is provided', async () => {
      const env = {
        API_KEY: 'secret',
        DATABASE_URL: 'postgres://localhost',
        DEBUG: 'true',
        LOG_LEVEL: 'debug',
      };
      const { req, res } = createMockReqRes('GET', {}, {}, env);
      await handler(req, res);
      expect(logger.info).toHaveBeenCalledWith(
        'Function environment variables available',
        expect.any(Object)
      );
    });
  });

  describe('POST /', () => {
    it('should create greeting with name and message', async () => {
      const { req, res } = createMockReqRes('POST', {}, { name: 'Bob', message: 'Hi there!' });
      await handler(req, res);
      expect(res.getStatus()).toBe(201);
      expect(res.getData().message).toContain('Hello, Bob!');
      expect(res.getData().receivedMessage).toBe('Hi there!');
      expect(res.getData().status).toBe('created');
    });

    it('should return 400 when name is missing', async () => {
      const { req, res } = createMockReqRes('POST', {}, { message: 'Hello' });
      await handler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getData().error).toBe('Bad Request');
      expect(res.getData().message).toContain('Name is required');
    });

    it('should handle POST without message field', async () => {
      const { req, res } = createMockReqRes('POST', {}, { name: 'Carol' });
      await handler(req, res);
      expect(res.getStatus()).toBe(201);
      expect(res.getData().receivedMessage).toBeNull();
    });
  });

  describe('PUT /', () => {
    it('should update resource with id', async () => {
      const { req, res } = createMockReqRes('PUT', { id: '123' }, { name: 'Updated Name' });
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().message).toContain('Resource 123 has been updated');
      expect(res.getData().resourceId).toBe('123');
      expect(res.getData().updatedData).toEqual({ name: 'Updated Name' });
    });

    it('should return 400 when id is missing', async () => {
      const { req, res } = createMockReqRes('PUT', {}, { name: 'Test' });
      await handler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getData().message).toContain('ID parameter is required');
    });
  });

  describe('DELETE /', () => {
    it('should delete resource with id', async () => {
      const { req, res } = createMockReqRes('DELETE', { id: '456' });
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().message).toContain('Resource 456 has been deleted');
      expect(res.getData().resourceId).toBe('456');
    });

    it('should return 400 when id is missing', async () => {
      const { req, res } = createMockReqRes('DELETE');
      await handler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getData().message).toContain('ID parameter is required');
    });
  });

  describe('OPTIONS /', () => {
    it('should return 200 for OPTIONS requests', async () => {
      const { req, res } = createMockReqRes('OPTIONS');
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for PATCH method', async () => {
      const { req, res } = createMockReqRes('PATCH');
      await handler(req, res);
      expect(res.getStatus()).toBe(405);
      expect(res.getData().supportedMethods).toEqual(['GET', 'POST', 'PUT', 'DELETE']);
    });
  });
});

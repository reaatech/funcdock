import { jest } from '@jest/globals';
import handler from './handler.js';

// Mock logger
const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

// Mock request/response helpers
function createMockReqRes(method = 'GET', body = {}, query = {}, params = {}) {
  const req = { method, body, query, params, logger, headers: { 'user-agent': 'jest' } };
  let statusCode = 200;
  let sentData;
  const res = {
    status(code) { statusCode = code; return res; },
    json(data) { sentData = data; return res; },
    send(data) { sentData = data; return res; },
    header() { return res; },
    getStatus: () => statusCode,
    getData: () => sentData
  };
  return { req, res };
}

describe('hello-world/handler.js', () => {
  it('should respond to GET', async () => {
    const { req, res } = createMockReqRes('GET');
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getData()).toBeDefined();
  });

  it('should respond to POST', async () => {
    const { req, res } = createMockReqRes('POST', { name: 'Test' });
    await handler(req, res);
    expect(res.getStatus()).toBe(201);
    expect(res.getData()).toBeDefined();
  });
}); 
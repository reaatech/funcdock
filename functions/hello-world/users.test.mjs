import { jest } from '@jest/globals';
import handler from './users.js';

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

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

describe('hello-world/users.js', () => {
  it('should list users', async () => {
    const { req, res } = createMockReqRes('GET');
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getData()).toBeDefined();
  });

  it('should create a user', async () => {
    const { req, res } = createMockReqRes('POST', { name: 'Alice' });
    await handler(req, res);
    expect(res.getStatus()).toBe(201);
    expect(res.getData()).toBeDefined();
  });

  it('should get a user by id', async () => {
    const { req, res } = createMockReqRes('GET', {}, {}, { id: '1' });
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getData()).toBeDefined();
  });
}); 
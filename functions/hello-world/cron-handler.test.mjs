import { jest } from '@jest/globals';
import handler from './cron-handler.js';

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

describe('hello-world/cron-handler.js', () => {
  it('should run cron job and return success', async () => {
    const { req, res } = createMockReqRes('POST', { cronJob: 'test-job', schedule: '* * * * *', timestamp: Date.now() });
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getData()).toBeDefined();
  });
}); 
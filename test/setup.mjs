import { jest } from '@jest/globals';

/**
 * Test helper utilities for FuncDock functions
 */

/**
 * Creates a mock request/response pair for testing handlers
 * @param {Function} handler - The handler function to test
 * @param {Object} options - Test options
 * @returns {Promise<{req: Object, res: Object, statusCode: number, data: any}>}
 */
export function testHandler(handler, options = {}) {
  const {
    method = 'GET',
    query = {},
    body = {},
    headers = {},
    env = {},
    params = {},
    path = '/',
  } = options;

  const logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  };

  const req = {
    method: method.toUpperCase(),
    query,
    body,
    headers: { 'content-type': 'application/json', 'user-agent': 'jest', ...headers },
    env,
    params,
    logger,
    originalUrl: path,
    url: path,
    path,
    ip: '127.0.0.1',
    functionName: 'test-function',
    functionPath: '/tmp/test-function',
    routePath: path,
    routeHandler: 'handler.js',
  };

  let statusCode = 200;
  let responseData = null;
  let responseHeaders = {};

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    send(data) {
      responseData = data;
      return res;
    },
    text(data) {
      responseData = data;
      return res;
    },
    header(key, value) {
      responseHeaders[key] = value;
      return res;
    },
    end() {
      return res;
    },
    getStatus: () => statusCode,
    getData: () => responseData,
    getHeaders: () => responseHeaders,
  };

  const result = handler(req, res, () => {});

  if (result && typeof result.then === 'function') {
    return result.then(() => ({ req, res, statusCode, data: responseData }));
  }

  return Promise.resolve({ req, res, statusCode, data: responseData });
}

/**
 * Assertion helper for status codes
 * @param {Object} res - Mock response object
 * @param {number} expectedStatus - Expected HTTP status code
 */
export function expectStatus(res, expectedStatus) {
  expect(res.getStatus()).toBe(expectedStatus);
}

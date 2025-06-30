/**
 * Jest setup file for FuncDock function testing
 * 
 * This file provides common testing utilities, mocks, and setup
 * for testing FuncDock functions in isolation.
 */

import nock from 'nock';
import fetch from 'node-fetch';

globalThis.fetch = fetch;

// Global test setup
beforeAll(() => {
  // Enable Nock for HTTP mocking
  nock.cleanAll();
});

// Global test teardown
afterAll(() => {
  // Clean up all HTTP mocks
  nock.cleanAll();
});

// Clean up between tests
afterEach(() => {
  nock.cleanAll();
});

/**
 * Create a mock request object for testing handlers
 * @param {Object} options - Request options
 * @returns {Object} Mock request object
 */
export function createMockRequest(options = {}) {
  const {
    method = 'GET',
    url = '/',
    params = {},
    query = {},
    body = {},
    headers = {},
    functionName = 'test-function',
    functionPath = '/test/path',
    routePath = '/',
    routeHandler = 'handler.js'
  } = options;

  return {
    method: method.toUpperCase(),
    url,
    params,
    query,
    body,
    headers: {
      'content-type': 'application/json',
      'user-agent': 'FuncDock-Test/1.0.0',
      ...headers
    },
    functionName,
    functionPath,
    routePath,
    routeHandler,
    logger: createMockLogger()
  };
}

/**
 * Create a mock response object for testing handlers
 * @returns {Object} Mock response object
 */
export function createMockResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    headersSent: false
  };

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.json = (data) => {
    Object.assign(res, data);
    res.headersSent = true;
    return res;
  };

  res.send = (data) => {
    Object.assign(res, data);
    res.headersSent = true;
    return res;
  };

  res.text = (data) => {
    Object.assign(res, data);
    res.headersSent = true;
    return res;
  };

  res.header = (name, value) => {
    res.headers[name] = value;
    return res;
  };

  res.set = (name, value) => {
    res.headers[name] = value;
    return res;
  };

  res.end = () => {
    res.headersSent = true;
    return res;
  };

  return res;
}

/**
 * Create a mock logger for testing
 * @returns {Object} Mock logger object
 */
export function createMockLogger() {
  const logs = {
    info: [],
    warn: [],
    error: [],
    debug: []
  };

  return {
    info: (message, data) => {
      logs.info.push({ message, data, timestamp: new Date().toISOString() });
    },
    warn: (message, data) => {
      logs.warn.push({ message, data, timestamp: new Date().toISOString() });
    },
    error: (message, data) => {
      logs.error.push({ message, data, timestamp: new Date().toISOString() });
    },
    debug: (message, data) => {
      logs.debug.push({ message, data, timestamp: new Date().toISOString() });
    },
    getLogs: () => logs,
    clearLogs: () => {
      Object.keys(logs).forEach(key => logs[key] = []);
    }
  };
}

/**
 * Test helper to run a handler function
 * @param {Function} handler - The handler function to test
 * @param {Object} requestOptions - Request options
 * @returns {Promise<Object>} Test result with request and response
 */
export async function testHandler(handler, requestOptions = {}) {
  const req = createMockRequest(requestOptions);
  const res = createMockResponse();

  try {
    const result = await handler(req, res);
    // If the handler returns a value and no response was sent, use it as the response body
    if (typeof result !== 'undefined' && !res.headersSent) {
      Object.assign(res, result);
    }
    return { req, res, success: true };
  } catch (error) {
    return { req, res, error, success: false };
  }
}

/**
 * Assert that a response has the expected status code
 * @param {Object} res - Mock response object
 * @param {number} expectedStatus - Expected status code
 */
export function expectStatus(res, expectedStatus) {
  expect(res.statusCode).toBe(expectedStatus);
}

/**
 * Assert that a response has the expected JSON body
 * @param {Object} res - Mock response object
 * @param {Object} expectedBody - Expected response body
 */
export function expectJsonBody(res, expectedBody) {
  if (!res.message && !res.data && !res.error) {
    throw new Error('Response fields are undefined. The handler may not have called res.json(), res.send(), or res.text().');
  }
  expect(res).toMatchObject(expectedBody);
}

/**
 * Assert that a response contains specific fields
 * @param {Object} res - Mock response object
 * @param {Object} expectedFields - Expected fields in response
 */
export function expectResponseFields(res, expectedFields) {
  if (!res.message && !res.data && !res.error) {
    // Debug output
    // eslint-disable-next-line no-console
    console.error('DEBUG: Response object:', JSON.stringify(res, null, 2));
    throw new Error('Response fields are undefined. The handler may not have called res.json(), res.send(), or res.text().');
  }
  Object.keys(expectedFields).forEach(key => {
    expect(res[key]).toBe(expectedFields[key]);
  });
}

/**
 * Mock environment variables for testing
 * @param {Object} envVars - Environment variables to mock
 */
export function mockEnvVars(envVars) {
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = { ...originalEnv, ...envVars };
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
}

/**
 * Create a mock cron job request
 * @param {Object} options - Cron job options
 * @returns {Object} Mock cron request object
 */
export function createMockCronRequest(options = {}) {
  const {
    cronJob = 'test-job',
    schedule = '0 * * * *',
    functionName = 'test-function',
    functionPath = '/test/path'
  } = options;

  return createMockRequest({
    functionName,
    functionPath,
    cronJob,
    schedule,
    timestamp: new Date().toISOString()
  });
}

// Export common testing utilities
export {
  nock
}; 
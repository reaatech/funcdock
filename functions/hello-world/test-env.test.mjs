import { jest } from '@jest/globals';
import testEnvHandler from './test-env.js';

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

function createMockReqRes(method = 'GET', env = {}) {
  const req = { method, logger, env, headers: {} };
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

describe('hello-world/test-env.js', () => {
  describe('GET /test-env with env vars', () => {
    it('should return environment variable keys', async () => {
      const env = { API_KEY: 'secret', DATABASE_URL: 'postgres://localhost', DEBUG: 'true' };
      const { req, res } = createMockReqRes('GET', env);
      await testEnvHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().hasEnvironmentVariables).toBe(true);
      expect(res.getData().environmentVariables).toContain('API_KEY');
      expect(res.getData().environmentVariables).toContain('DATABASE_URL');
    });

    it('should return sample values for known env vars', async () => {
      const env = {
        API_KEY: 'secret',
        DATABASE_URL: 'postgres://localhost',
        DEBUG: 'true',
        LOG_LEVEL: 'debug',
      };
      const { req, res } = createMockReqRes('GET', env);
      await testEnvHandler(req, res);
      const data = res.getData();
      expect(data.sampleValues.hasApiKey).toBe(true);
      expect(data.sampleValues.hasDatabaseUrl).toBe(true);
      expect(data.sampleValues.debugMode).toBe('true');
      expect(data.sampleValues.logLevel).toBe('debug');
    });

    it('should handle empty env', async () => {
      const { req, res } = createMockReqRes('GET', {});
      await testEnvHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getData().hasEnvironmentVariables).toBe(true);
      expect(res.getData().environmentVariables).toEqual([]);
    });
  });

  describe('OPTIONS /test-env', () => {
    it('should return 200 for OPTIONS requests', async () => {
      const { req, res } = createMockReqRes('OPTIONS');
      await testEnvHandler(req, res);
      expect(res.getStatus()).toBe(200);
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for POST method', async () => {
      const { req, res } = createMockReqRes('POST');
      await testEnvHandler(req, res);
      expect(res.getStatus()).toBe(405);
    });
  });
});

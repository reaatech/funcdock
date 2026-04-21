import { jest } from '@jest/globals';
import cronHandler from './cron-handler.js';

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), log: jest.fn() };

function createMockReqRes(jobName, loggerOverride = logger) {
  const req = { jobName, logger: loggerOverride };
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
    getStatus: () => statusCode,
    getData: () => sentData,
  };
  return { req, res };
}

describe('webhook-handler/cron-handler.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('with res object', () => {
    describe('webhook-health-check', () => {
      it('should return healthy status with all endpoints', async () => {
        const { req, res } = createMockReqRes('webhook-health-check');
        await cronHandler(req, res);
        expect(res.getStatus()).toBe(200);
        const data = res.getData();
        expect(data.status).toBe('healthy');
        expect(data.jobName).toBe('webhook-health-check');
        expect(Object.keys(data.endpoints)).toEqual(['generic', 'github', 'stripe', 'slack']);
      });
    });

    describe('webhook-stats-cleanup', () => {
      it('should complete cleanup tasks', async () => {
        const { req, res } = createMockReqRes('webhook-stats-cleanup');
        await cronHandler(req, res);
        expect(res.getStatus()).toBe(200);
        const data = res.getData();
        expect(data.jobName).toBe('webhook-stats-cleanup');
        expect(data.status).toBe('completed');
        expect(data.actions.length).toBe(4);
      });
    });

    describe('webhook-rate-limit-reset', () => {
      it('should reset rate limits for all webhook types', async () => {
        const { req, res } = createMockReqRes('webhook-rate-limit-reset');
        await cronHandler(req, res);
        expect(res.getStatus()).toBe(200);
        const data = res.getData();
        expect(data.jobName).toBe('webhook-rate-limit-reset');
        expect(Object.keys(data.resets)).toEqual(['generic', 'github', 'stripe', 'slack']);
      });
    });

    describe('webhook-test-ping', () => {
      it('should ping all endpoints', async () => {
        const { req, res } = createMockReqRes('webhook-test-ping');
        await cronHandler(req, res);
        expect(res.getStatus()).toBe(200);
        const data = res.getData();
        expect(data.jobName).toBe('webhook-test-ping');
        expect(Object.keys(data.pings)).toEqual(['generic', 'github', 'stripe', 'slack']);
      });
    });

    describe('unknown job', () => {
      it('should return 400 for unknown job name', async () => {
        const { req, res } = createMockReqRes('unknown-job');
        await cronHandler(req, res);
        expect(res.getStatus()).toBe(400);
        expect(res.getData().error).toBe('Unknown cron job');
      });
    });

    describe('no job name', () => {
      it('should run default health check when no job name provided', async () => {
        const { req, res } = createMockReqRes(undefined);
        await cronHandler(req, res);
        expect(res.getStatus()).toBe(200);
        expect(res.getData().jobName).toBe('webhook-health-check');
      });
    });

    describe('error handling', () => {
      it('should return 500 when handler throws', async () => {
        const { req, res } = createMockReqRes('webhook-health-check');
        let callCount = 0;
        const originalJson = res.json;
        res.json = (data) => {
          callCount++;
          if (callCount === 1) throw new Error('res.json error');
          return originalJson(data);
        };
        await cronHandler(req, res);
        expect(res.getStatus()).toBe(500);
        expect(res.getData().error).toBe('Cron job failed');
      });
    });
  });

  describe('without res object', () => {
    it('should return health status object for health check', async () => {
      const req = { jobName: 'webhook-health-check', logger };
      const result = await cronHandler(req, undefined);
      expect(result.status).toBe('healthy');
      expect(result.jobName).toBe('webhook-health-check');
    });

    it('should return cleanup result object for stats cleanup', async () => {
      const req = { jobName: 'webhook-stats-cleanup', logger };
      const result = await cronHandler(req, undefined);
      expect(result.status).toBe('completed');
      expect(result.actions.length).toBe(4);
    });

    it('should return reset result object for rate limit reset', async () => {
      const req = { jobName: 'webhook-rate-limit-reset', logger };
      const result = await cronHandler(req, undefined);
      expect(result.status).toBe('completed');
      expect(Object.keys(result.resets)).toEqual(['generic', 'github', 'stripe', 'slack']);
    });

    it('should return ping result object for test ping', async () => {
      const req = { jobName: 'webhook-test-ping', logger };
      const result = await cronHandler(req, undefined);
      expect(result.status).toBe('completed');
      expect(Object.keys(result.pings)).toEqual(['generic', 'github', 'stripe', 'slack']);
    });

    it('should return error object for unknown job', async () => {
      const req = { jobName: 'unknown-job', logger };
      const result = await cronHandler(req, undefined);
      expect(result.error).toBe('Unknown cron job');
      expect(logger.log).toHaveBeenCalledWith('CRON_ERROR', 'Unknown cron job', expect.any(Object));
    });

    it('should return error object when handler throws', async () => {
      const badLogger = {
        log: jest.fn((level, msg) => {
          if (level === 'CRON' && msg.includes('completed')) {
            throw new Error('Logger error');
          }
        }),
      };
      const req = { jobName: 'webhook-health-check', logger: badLogger };
      const result = await cronHandler(req, undefined);
      expect(result.error).toBe('Cron job failed');
    });

    it('should run default health check when no job name provided', async () => {
      const req = { logger };
      const result = await cronHandler(req, undefined);
      expect(result.status).toBe('healthy');
      expect(result.jobName).toBe('webhook-health-check');
    });
  });
});

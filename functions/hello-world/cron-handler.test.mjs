import { jest } from '@jest/globals';
import handler from './cron-handler.js';

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), log: jest.fn() };

function createMockReq(method = 'POST', body = {}) {
  return { method, body, logger, headers: { 'user-agent': 'jest' } };
}

describe('hello-world/cron-handler.js', () => {
  it('should run cron job and return success', async () => {
    const req = createMockReq('POST', {
      cronJob: 'test-job',
      schedule: '* * * * *',
      timestamp: Date.now(),
    });
    const result = await handler(req);
    expect(result).toBeDefined();
    expect(result.message).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.cronJob).toBe('test-job');
  });

  it('should throw error when cronJob is missing', async () => {
    const req = createMockReq('POST', {});
    await expect(handler(req)).rejects.toThrow('Cron job data is required');
  });

  it('should throw error for invalid schedule', async () => {
    const req = createMockReq('POST', { cronJob: 'test-job', schedule: 'invalid-schedule' });
    await expect(handler(req)).rejects.toThrow('Invalid cron job data');
  });

  it('should handle error-prone-job', async () => {
    const req = createMockReq('POST', { cronJob: 'error-prone-job', schedule: '* * * * *' });
    await expect(handler(req)).rejects.toThrow('Simulated cron job error');
  });

  it('should handle daily-morning job', async () => {
    const req = createMockReq('POST', { cronJob: 'daily-morning', schedule: '0 9 * * *' });
    const result = await handler(req);
    expect(result.message).toBe('Daily morning tasks completed');
    expect(result.data.tasksCompleted).toContain('Database backup');
  });

  it('should handle hourly-tasks job', async () => {
    const req = createMockReq('POST', { cronJob: 'hourly-tasks', schedule: '0 * * * *' });
    const result = await handler(req);
    expect(result.message).toBe('Hourly tasks completed');
    expect(result.data.tasksCompleted).toContain('System health check');
  });

  it('should handle custom-backup job', async () => {
    const req = createMockReq('POST', { cronJob: 'custom-backup', schedule: '0 0 * * 0' });
    const result = await handler(req);
    expect(result.message).toBe('Custom cron job completed');
    expect(result.data.tasksCompleted).toContain('Weekly backup');
  });

  it('should handle unknown-job', async () => {
    const req = createMockReq('POST', { cronJob: 'unknown-job', schedule: '0 0 * * *' });
    const result = await handler(req);
    expect(result.message).toBe('Unknown cron job type handled');
    expect(result.data.tasksCompleted).toContain('Default task');
  });

  it('should handle long-running-job', async () => {
    const req = createMockReq('POST', { cronJob: 'long-running-job', schedule: '0 0 * * *' });
    const result = await handler(req);
    expect(result.data.duration).toBe(100);
    expect(result.data.tasksCompleted).toContain('Long running task completed');
  });

  it('should handle test-logging job', async () => {
    const req = createMockReq('POST', { cronJob: 'test-logging', schedule: '0 0 * * *' });
    const result = await handler(req);
    expect(result.data.tasksCompleted).toContain('Test logging task');
  });

  it('should handle generic job name', async () => {
    const req = createMockReq('POST', { cronJob: 'some-random-job', schedule: '0 0 * * *' });
    const result = await handler(req);
    expect(result.data.tasksCompleted).toContain('Generic scheduled task completed');
  });
});

import { jest } from '@jest/globals';
import cronEnvTestHandler from './cron-env-test.js';

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), log: jest.fn() };

function createMockReq(env = {}, functionName = 'hello-world') {
  return {
    logger,
    env,
    functionName,
    cronJob: 'test-cron-job',
    schedule: '0 * * * *',
  };
}

describe('hello-world/cron-env-test.js', () => {
  it('should log environment variable info when env is provided', async () => {
    const env = {
      API_KEY: 'secret',
      DATABASE_URL: 'postgres://localhost',
      DEBUG: 'true',
      LOG_LEVEL: 'debug',
    };
    const req = createMockReq(env);
    await cronEnvTestHandler(req);
    expect(logger.log).toHaveBeenCalled();
  });

  it('should log when no environment variables are provided', async () => {
    const req = createMockReq(null);
    await cronEnvTestHandler(req);
    expect(logger.log).toHaveBeenCalledWith(
      'CRON_ERROR',
      'No environment variables available in cron job'
    );
  });

  it('should log debug mode message when DEBUG is true', async () => {
    const env = { DEBUG: 'true' };
    const req = createMockReq(env);
    await cronEnvTestHandler(req);
    expect(logger.log).toHaveBeenCalledWith('CRON', 'Debug mode is enabled for this function');
  });

  it('should log API key available message when API_KEY is set', async () => {
    const env = { API_KEY: 'my-secret-key' };
    const req = createMockReq(env);
    await cronEnvTestHandler(req);
    expect(logger.log).toHaveBeenCalledWith('CRON', 'API key is available for external API calls');
  });

  it('should log completion message', async () => {
    const req = createMockReq({});
    await cronEnvTestHandler(req);
    expect(logger.log).toHaveBeenCalledWith('CRON', 'Cron job completed successfully');
  });
});

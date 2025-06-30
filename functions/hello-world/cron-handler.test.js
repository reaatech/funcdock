/**
 * Test file for cron handler
 * 
 * This demonstrates how to test FuncDock cron job handlers
 */

import { 
  testHandler, 
  createMockCronRequest,
  expectStatus, 
  expectResponseFields,
  mockEnvVars,
  nock
} from '../../test/setup.js';

// Import the handler to test
import handler from './cron-handler.js';

describe('Cron Handler', () => {
  // Mock environment variables for testing
  mockEnvVars({
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    CRON_SECRET: 'test-secret-123'
  });

  describe('Daily cron job (0 9 * * *)', () => {
    it('should handle daily morning tasks', async () => {
      const { res } = await testHandler(handler, {
        method: 'POST',
        body: {
          cronJob: 'daily-morning',
          schedule: '0 9 * * *',
          timestamp: new Date().toISOString()
        }
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'Daily morning tasks completed',
        function: 'test-function'
      });
      expect(res.data).toMatchObject({
        cronJob: 'daily-morning',
        schedule: '0 9 * * *',
        tasksCompleted: expect.any(Array)
      });
      expect(res.data.tasksCompleted).toContain('Database backup');
      expect(res.data.tasksCompleted).toContain('Email notifications');
    });

    it('should log daily task execution', async () => {
      const { req } = await testHandler(handler, {
        method: 'POST',
        body: {
          cronJob: 'daily-morning',
          schedule: '0 9 * * *'
        }
      });

      const logs = req.logger.getLogs();
      const dailyLog = logs.info.find(log => 
        log.message.includes('Cron job executed')
      );
      expect(dailyLog).toBeDefined();
      expect(dailyLog.data).toMatchObject({
        cronJob: 'daily-morning',
        schedule: '0 9 * * *'
      });
    });
  });

  describe('Hourly cron job (0 * * * *)', () => {
    it('should handle hourly tasks', async () => {
      const { res } = await testHandler(handler, {
        method: 'POST',
        body: {
          cronJob: 'hourly-tasks',
          schedule: '0 * * * *',
          timestamp: new Date().toISOString()
        }
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'Hourly tasks completed',
        function: 'test-function'
      });
      expect(res.data).toMatchObject({
        cronJob: 'hourly-tasks',
        schedule: '0 * * * *',
        tasksCompleted: expect.any(Array)
      });
      expect(res.data.tasksCompleted).toContain('System health check');
      expect(res.data.tasksCompleted).toContain('Cache cleanup');
    });

    it('should log hourly task execution', async () => {
      const { req } = await testHandler(handler, {
        method: 'POST',
        body: {
          cronJob: 'hourly-tasks',
          schedule: '0 * * * *'
        }
      });

      const logs = req.logger.getLogs();
      const hourlyLog = logs.info.find(log => 
        log.message.includes('Cron job executed')
      );
      expect(hourlyLog).toBeDefined();
      expect(hourlyLog.data).toMatchObject({
        cronJob: 'hourly-tasks',
        schedule: '0 * * * *'
      });
    });
  });

  describe('Custom cron jobs', () => {
    it('should handle custom cron job types', async () => {
      const { res } = await testHandler(handler, {
        method: 'POST',
        body: {
          cronJob: 'custom-backup',
          schedule: '0 2 * * 0', // Weekly backup
          timestamp: new Date().toISOString()
        }
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'Custom cron job completed',
        function: 'test-function'
      });
      expect(res.data).toMatchObject({
        cronJob: 'custom-backup',
        schedule: '0 2 * * 0',
        tasksCompleted: expect.any(Array)
      });
    });

    it('should handle unknown cron job types gracefully', async () => {
      const { res } = await testHandler(handler, {
        method: 'POST',
        body: {
          cronJob: 'unknown-job',
          schedule: '0 0 * * *',
          timestamp: new Date().toISOString()
        }
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'Unknown cron job type handled',
        function: 'test-function'
      });
      expect(res.data).toMatchObject({
        cronJob: 'unknown-job',
        schedule: '0 0 * * *',
        tasksCompleted: ['Default task']
      });
    });
  });

  describe('Error handling', () => {
    it('should handle cron job errors gracefully', async () => {
      const { res } = await testHandler(handler, {
        method: 'POST',
        body: {
          cronJob: 'error-prone-job',
          schedule: '0 0 * * *',
          timestamp: new Date().toISOString()
        }
      });

      expectStatus(res, 500);
      expectResponseFields(res, {
        error: 'Internal Server Error',
        message: 'Cron job failed'
      });
      expect(res.data).toMatchObject({
        cronJob: 'error-prone-job',
        schedule: '0 0 * * *',
        error: 'Simulated cron job error'
      });
    });

    it('should handle missing cron job data', async () => {
      const { res } = await testHandler(handler, {
        method: 'POST',
        body: {}
      });

      expectStatus(res, 400);
      expectResponseFields(res, {
        error: 'Bad Request',
        message: 'Cron job data is required'
      });
    });

    it('should handle invalid cron job format', async () => {
      const { res } = await testHandler(handler, {
        method: 'POST',
        body: {
          cronJob: '',
          schedule: 'invalid-schedule'
        }
      });

      expectStatus(res, 400);
      expectResponseFields(res, {
        error: 'Bad Request',
        message: 'Cron job data is required'
      });
    });
  });

  describe('Logging and monitoring', () => {
    it('should log all cron job executions', async () => {
      const { req } = await testHandler(handler, {
        method: 'POST',
        body: {
          cronJob: 'test-logging',
          schedule: '0 0 * * *',
          timestamp: new Date().toISOString()
        }
      });

      const logs = req.logger.getLogs();
      expect(logs.info.length).toBeGreaterThan(0);
      
      // Check for cron job execution log
      const executionLog = logs.info.find(log => 
        log.message.includes('Cron job executed')
      );
      expect(executionLog).toBeDefined();
      expect(executionLog.data).toMatchObject({
        cronJob: 'test-logging',
        schedule: '0 0 * * *'
      });
    });

    it('should log task completion details', async () => {
      const { req } = await testHandler(handler, {
        method: 'POST',
        body: {
          cronJob: 'daily-morning',
          schedule: '0 9 * * *'
        }
      });

      const logs = req.logger.getLogs();
      const taskLog = logs.info.find(log => 
        log.message.includes('Tasks completed')
      );
      expect(taskLog).toBeDefined();
      expect(taskLog.data).toHaveProperty('tasksCompleted');
      expect(Array.isArray(taskLog.data.tasksCompleted)).toBe(true);
    });
  });

  describe('HTTP mocking for external services', () => {
    it('should handle external API calls in cron jobs', async () => {
      // Mock external health check API
      nock('https://health-api.example.com')
        .post('/health-check')
        .reply(200, {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: ['database', 'cache', 'api']
        });

      // Mock external notification service
      nock('https://notifications.example.com')
        .post('/send')
        .reply(200, {
          messageId: 'msg-123',
          status: 'sent'
        });

      const apiCronHandler = async (req, res) => {
        const { cronJob } = req.body;
        
        try {
          // Health check
          const healthResponse = await fetch('https://health-api.example.com/health-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service: 'funcdock' })
          });
          const healthData = await healthResponse.json();

          // Send notification
          const notificationResponse = await fetch('https://notifications.example.com/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              message: `Cron job ${cronJob} completed`,
              priority: 'low'
            })
          });
          const notificationData = await notificationResponse.json();

          res.json({
            message: 'External API cron job completed',
            data: {
              cronJob,
              healthCheck: healthData,
              notification: notificationData,
              timestamp: new Date().toISOString()
            },
            function: req.functionName
          });
        } catch (error) {
          res.status(500).json({
            error: 'External API cron job failed',
            message: error.message,
            data: { cronJob },
            function: req.functionName
          });
        }
      };

      const { res } = await testHandler(apiCronHandler, {
        method: 'POST',
        body: {
          cronJob: 'external-api-check',
          schedule: '0 * * * *'
        }
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'External API cron job completed',
        function: 'test-function'
      });
      expect(res.data).toMatchObject({
        cronJob: 'external-api-check',
        healthCheck: {
          status: 'healthy',
          services: ['database', 'cache', 'api']
        },
        notification: {
          messageId: 'msg-123',
          status: 'sent'
        }
      });
    });

    it('should handle external API failures in cron jobs', async () => {
      // Mock failing external API
      nock('https://failing-api.example.com')
        .post('/health-check')
        .reply(500, { error: 'Service unavailable' });

      const failingApiHandler = async (req, res) => {
        const { cronJob } = req.body;
        
        try {
          const response = await fetch('https://failing-api.example.com/health-check', {
            method: 'POST'
          });
          
          if (!response.ok) {
            throw new Error(`API failed with status ${response.status}`);
          }
          
          const data = await response.json();
          res.json({ message: 'Success', data });
        } catch (error) {
          res.status(500).json({
            error: 'External API cron job failed',
            message: error.message,
            data: { cronJob },
            function: req.functionName
          });
        }
      };

      const { res } = await testHandler(failingApiHandler, {
        method: 'POST',
        body: {
          cronJob: 'failing-api-check',
          schedule: '0 * * * *'
        }
      });

      expectStatus(res, 500);
      expectResponseFields(res, {
        error: 'External API cron job failed',
        function: 'test-function'
      });
      expect(res.data).toMatchObject({
        cronJob: 'failing-api-check'
      });
    });
  });

  describe('Performance testing', () => {
    it('should handle long-running cron jobs', async () => {
      const startTime = Date.now();
      
      const { res } = await testHandler(handler, {
        method: 'POST',
        body: {
          cronJob: 'long-running-job',
          schedule: '0 0 * * *',
          timestamp: new Date().toISOString()
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expectStatus(res, 200);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(res.data).toMatchObject({
        cronJob: 'long-running-job',
        duration: expect.any(Number)
      });
    });

    it('should handle concurrent cron job executions', async () => {
      const promises = [];
      
      // Simulate multiple concurrent cron job executions
      for (let i = 0; i < 5; i++) {
        promises.push(
          testHandler(handler, {
            method: 'POST',
            body: {
              cronJob: `concurrent-job-${i}`,
              schedule: '0 * * * *',
              timestamp: new Date().toISOString()
            }
          })
        );
      }

      const results = await Promise.all(promises);
      
      results.forEach(({ res }) => {
        expectStatus(res, 200);
        expect(res.data).toHaveProperty('cronJob');
        expect(res.data).toHaveProperty('tasksCompleted');
      });
    });
  });
}); 
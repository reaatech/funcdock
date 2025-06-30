/**
 * Test file for hello-world handler
 * 
 * This demonstrates how to test FuncDock functions using Jest and Nock
 */

import { 
  testHandler, 
  createMockRequest, 
  createMockResponse, 
  expectStatus, 
  expectJsonBody,
  expectResponseFields,
  mockEnvVars,
  nock
} from '../../test/setup.js';

// Import the handler to test
import handler from './handler.js';

describe('Hello World Handler', () => {
  // Mock environment variables for testing
  mockEnvVars({
    NODE_ENV: 'test',
    LOG_LEVEL: 'error'
  });

  describe('GET requests', () => {
    it('should return a greeting message for GET requests', async () => {
      const { res } = await testHandler(handler, {
        method: 'GET',
        query: { name: 'TestUser' },
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'Hello, TestUser!',
        function: 'hello-world'
      });
      expect(res).toHaveProperty('timestamp');
    });

    it('should return default greeting when no name is provided', async () => {
      const { res } = await testHandler(handler, {
        method: 'GET',
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'Hello, World!',
        function: 'hello-world'
      });
    });

    it('should handle special characters in name parameter', async () => {
      const { res } = await testHandler(handler, {
        method: 'GET',
        query: { name: 'Test&User@123' },
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'Hello, Test&User@123!',
        function: 'hello-world'
      });
    });
  });

  describe('POST requests', () => {
    it('should create a resource successfully', async () => {
      const testData = { name: 'Test Item', value: 42 };
      
      const { res } = await testHandler(handler, {
        method: 'POST',
        body: testData,
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      expectStatus(res, 201);
      expectResponseFields(res, {
        message: 'Hello, Test Item! Your message has been received.',
        function: 'hello-world'
      });
      expect(res).toMatchObject({
        message: 'Hello, Test Item! Your message has been received.',
        receivedMessage: null,
        function: 'hello-world',
        status: 'created'
      });
      expect(res).toHaveProperty('timestamp');
      expect(res).toHaveProperty('method');
    });

    it('should return 400 for empty POST body', async () => {
      const { res } = await testHandler(handler, {
        method: 'POST',
        body: {},
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      expectStatus(res, 400);
      expectResponseFields(res, {
        error: 'Bad Request',
        message: 'Name is required in request body'
      });
    });

    it('should handle complex nested objects', async () => {
      const complexData = {
        name: 'John',
        user: {
          preferences: {
            theme: 'dark',
            notifications: true
          }
        },
        metadata: {
          tags: ['test', 'example']
        }
      };

      const { res } = await testHandler(handler, {
        method: 'POST',
        body: complexData,
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      expectStatus(res, 201);
      expect(res).toMatchObject({
        message: 'Hello, John! Your message has been received.',
        receivedMessage: null,
        function: 'hello-world',
        status: 'created'
      });
    });
  });

  describe('PUT requests', () => {
    it('should update a resource successfully', async () => {
      const updateData = { name: 'Updated Item', status: 'active' };
      
      const { res } = await testHandler(handler, {
        method: 'PUT',
        query: { id: '123' },
        body: updateData,
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'Resource 123 has been updated',
        function: 'hello-world'
      });
      expect(res).toMatchObject({
        message: 'Resource 123 has been updated',
        updatedData: updateData,
        function: 'hello-world',
        resourceId: '123'
      });
      expect(res).toHaveProperty('timestamp');
      expect(res).toHaveProperty('method');
    });

    it('should return 400 when no ID is provided', async () => {
      const { res } = await testHandler(handler, {
        method: 'PUT',
        body: { name: 'Test' },
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      expectStatus(res, 400);
      expectResponseFields(res, {
        error: 'Bad Request',
        message: 'ID parameter is required for updates'
      });
    });
  });

  describe('DELETE requests', () => {
    it('should delete a resource successfully', async () => {
      const { res } = await testHandler(handler, {
        method: 'DELETE',
        query: { id: '123' },
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'Resource 123 has been deleted',
        function: 'hello-world'
      });
      expect(res).toMatchObject({
        message: 'Resource 123 has been deleted',
        function: 'hello-world',
        resourceId: '123'
      });
      expect(res).toHaveProperty('timestamp');
      expect(res).toHaveProperty('method');
    });

    it('should return 400 when no ID is provided for deletion', async () => {
      const { res } = await testHandler(handler, {
        method: 'DELETE',
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      expectStatus(res, 400);
      expectResponseFields(res, {
        error: 'Bad Request',
        message: 'ID parameter is required for deletion'
      });
    });
  });

  describe('OPTIONS requests', () => {
    it('should handle preflight requests', async () => {
      const { res } = await testHandler(handler, {
        method: 'OPTIONS',
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      expectStatus(res, 200);
      expect(res.headersSent).toBe(true);
    });
  });

  describe('Unsupported methods', () => {
    it('should return 405 for unsupported methods', async () => {
      const { res } = await testHandler(handler, {
        method: 'PATCH',
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      expectStatus(res, 405);
      expectResponseFields(res, {
        error: 'Method Not Allowed',
        method: 'PATCH'
      });
      expect(res.supportedMethods).toContain('GET');
      expect(res.supportedMethods).toContain('POST');
    });
  });

  describe('Error handling', () => {
    it('should handle handler errors gracefully', async () => {
      // Create a handler that throws an error
      const errorHandler = async (req, res) => {
        throw new Error('Test error');
      };

      const { res, error } = await testHandler(errorHandler, {
        method: 'GET'
      });

      expect(error).toBeDefined();
      expect(error.message).toBe('Test error');
    });
  });

  describe('Logging', () => {
    it('should log request information', async () => {
      const { req } = await testHandler(handler, {
        method: 'GET',
        query: { name: 'TestUser' },
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      const logs = req.logger.getLogs();
      expect(logs.info.length).toBeGreaterThan(0);
      
      // Check that request was logged
      const requestLog = logs.info.find(log => 
        log.message.includes('Request received')
      );
      expect(requestLog).toBeDefined();
    });
  });

  describe('HTTP mocking with Nock', () => {
    it('should handle external API calls', async () => {
      // Mock an external API call
      nock('https://api.example.com')
        .get('/users/123')
        .reply(200, {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com'
        });

      // Create a handler that makes external API calls
      const apiHandler = async (req, res) => {
        const response = await fetch('https://api.example.com/users/123');
        const userData = await response.json();
        
        res.json({
          message: 'User data retrieved',
          data: userData,
          function: req.functionName
        });
      };

      const { res } = await testHandler(apiHandler, {
        method: 'GET',
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'User data retrieved',
        function: 'hello-world'
      });
      expect(res).toMatchObject({
        message: 'User data retrieved',
        data: {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com'
        },
        function: 'hello-world'
      });
    });

    it('should handle API errors', async () => {
      // Mock an API error
      nock('https://api.example.com')
        .get('/users/999')
        .reply(404, { error: 'User not found' });

      const apiHandler = async (req, res) => {
        try {
          const response = await fetch('https://api.example.com/users/999');
          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }
          const userData = await response.json();
          res.json({ data: userData });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      };

      const { res } = await testHandler(apiHandler, {
        method: 'GET',
        functionName: 'hello-world',
        routePath: '/hello-world/'
      });

      expectStatus(res, 500);
      expect(res.error).toContain('API error: 404');
    });
  });
}); 
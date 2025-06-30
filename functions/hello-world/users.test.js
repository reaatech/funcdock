/**
 * Test file for users handler (dynamic routing)
 * 
 * This demonstrates how to test FuncDock functions with path parameters
 */

import { 
  testHandler, 
  expectStatus, 
  expectResponseFields,
  mockEnvVars,
  nock
} from '../../test/setup.js';

// Import the handler to test
import handler from './users.js';

describe('Users Handler (Dynamic Routing)', () => {
  // Mock environment variables for testing
  mockEnvVars({
    NODE_ENV: 'test',
    LOG_LEVEL: 'error'
  });

  describe('GET /users (no parameters)', () => {
    it('should return all users when no ID is provided', async () => {
      const { res } = await testHandler(handler, {
        method: 'GET',
        params: {}
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'All users',
        function: 'test-function'
      });
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
      expect(res.data[0]).toHaveProperty('id');
      expect(res.data[0]).toHaveProperty('name');
      expect(res.data[0]).toHaveProperty('email');
    });
  });

  describe('GET /users/:id', () => {
    it('should return user details for valid ID', async () => {
      const { res } = await testHandler(handler, {
        method: 'GET',
        params: { id: '123' }
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'User 123 details',
        function: 'test-function'
      });
      expect(res.data).toMatchObject({
        id: '123',
        name: 'User 123',
        email: 'user123@example.com',
        status: 'active'
      });
      expect(res.data).toHaveProperty('createdAt');
    });

    it('should handle different user IDs', async () => {
      const { res } = await testHandler(handler, {
        method: 'GET',
        params: { id: '456' }
      });

      expectStatus(res, 200);
      expect(res.data).toMatchObject({
        id: '456',
        name: 'User 456',
        email: 'user456@example.com'
      });
    });

    it('should handle special characters in user ID', async () => {
      const { res } = await testHandler(handler, {
        method: 'GET',
        params: { id: 'user-123_abc' }
      });

      expectStatus(res, 200);
      expect(res.data).toMatchObject({
        id: 'user-123_abc',
        name: 'User user-123_abc',
        email: 'useruser-123_abc@example.com'
      });
    });
  });

  describe('GET /users/:id/posts/:postId', () => {
    it('should return post details for valid user and post IDs', async () => {
      const { res } = await testHandler(handler, {
        method: 'GET',
        params: { id: '123', postId: '456' }
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'Post 456 for user 123',
        function: 'test-function'
      });
      expect(res.data).toMatchObject({
        userId: '123',
        postId: '456',
        title: 'Post 456 Title',
        content: 'This is post 456 for user 123'
      });
      expect(res.data).toHaveProperty('createdAt');
    });

    it('should handle different post IDs for same user', async () => {
      const { res } = await testHandler(handler, {
        method: 'GET',
        params: { id: '123', postId: '789' }
      });

      expectStatus(res, 200);
      expect(res.data).toMatchObject({
        userId: '123',
        postId: '789',
        title: 'Post 789 Title',
        content: 'This is post 789 for user 123'
      });
    });

    it('should handle different user and post combinations', async () => {
      const { res } = await testHandler(handler, {
        method: 'GET',
        params: { id: '999', postId: '111' }
      });

      expectStatus(res, 200);
      expect(res.data).toMatchObject({
        userId: '999',
        postId: '111',
        title: 'Post 111 Title',
        content: 'This is post 111 for user 999'
      });
    });
  });

  describe('POST /users', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      };

      const { res } = await testHandler(handler, {
        method: 'POST',
        body: userData
      });

      expectStatus(res, 201);
      expectResponseFields(res, {
        message: 'Created new user',
        function: 'test-function'
      });
      expect(res.data).toMatchObject(userData);
      expect(res.data).toHaveProperty('id');
      expect(res.data).toHaveProperty('createdAt');
    });

    it('should create a resource for existing user when ID is provided', async () => {
      const resourceData = {
        type: 'preference',
        value: 'dark-theme'
      };

      const { res } = await testHandler(handler, {
        method: 'POST',
        params: { id: '123' },
        body: resourceData
      });

      expectStatus(res, 201);
      expectResponseFields(res, {
        message: 'Created resource for user 123',
        function: 'test-function'
      });
      expect(res.data).toMatchObject({
        id: '123',
        ...resourceData
      });
    });

    it('should return 400 for empty request body', async () => {
      const { res } = await testHandler(handler, {
        method: 'POST',
        body: {}
      });

      expectStatus(res, 400);
      expectResponseFields(res, {
        error: 'Bad Request',
        message: 'Request body is required'
      });
    });
  });

  describe('PUT /users/:id', () => {
    it('should update user successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com',
        status: 'inactive'
      };

      const { res } = await testHandler(handler, {
        method: 'PUT',
        params: { id: '123' },
        body: updateData
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'Updated user 123',
        function: 'test-function'
      });
      expect(res.data).toMatchObject({
        id: '123',
        ...updateData
      });
      expect(res.data).toHaveProperty('updatedAt');
    });

    it('should return 400 when no ID is provided', async () => {
      const { res } = await testHandler(handler, {
        method: 'PUT',
        body: { name: 'Test' }
      });

      expectStatus(res, 400);
      expectResponseFields(res, {
        error: 'Bad Request',
        message: 'User ID is required'
      });
    });

    it('should return 400 for empty request body', async () => {
      const { res } = await testHandler(handler, {
        method: 'PUT',
        params: { id: '123' },
        body: {}
      });

      expectStatus(res, 400);
      expectResponseFields(res, {
        error: 'Bad Request',
        message: 'Request body is required'
      });
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete user successfully', async () => {
      const { res } = await testHandler(handler, {
        method: 'DELETE',
        params: { id: '123' }
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'Deleted user 123',
        function: 'test-function'
      });
      expect(res.data).toMatchObject({
        id: '123'
      });
      expect(res.data).toHaveProperty('deletedAt');
    });

    it('should return 400 when no ID is provided', async () => {
      const { res } = await testHandler(handler, {
        method: 'DELETE'
      });

      expectStatus(res, 400);
      expectResponseFields(res, {
        error: 'Bad Request',
        message: 'User ID is required'
      });
    });
  });

  describe('Logging', () => {
    it('should log request information with path parameters', async () => {
      const { req } = await testHandler(handler, {
        method: 'GET',
        params: { id: '123' }
      });

      const logs = req.logger.getLogs();
      expect(logs.info.length).toBeGreaterThan(0);
      
      // Check that request was logged with parameters
      const requestLog = logs.info.find(log => 
        log.message.includes('Users handler called')
      );
      expect(requestLog).toBeDefined();
      expect(requestLog.data).toMatchObject({
        params: { id: '123' }
      });
    });

    it('should log different operations', async () => {
      const { req } = await testHandler(handler, {
        method: 'POST',
        params: { id: '123' },
        body: { name: 'Test' }
      });

      const logs = req.logger.getLogs();
      const postLog = logs.info.find(log => 
        log.message.includes('POST request for user')
      );
      expect(postLog).toBeDefined();
      expect(postLog.data).toMatchObject({
        userId: '123'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle handler errors gracefully', async () => {
      const errorHandler = async (req, res) => {
        throw new Error('Database connection failed');
      };

      const { res, error } = await testHandler(errorHandler, {
        method: 'GET',
        params: { id: '123' }
      });

      expect(error).toBeDefined();
      expect(error.message).toBe('Database connection failed');
    });
  });

  describe('HTTP mocking with Nock for external APIs', () => {
    it('should handle external user API calls', async () => {
      // Mock external user API
      nock('https://api.users.com')
        .get('/users/123')
        .reply(200, {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com',
          profile: {
            avatar: 'https://example.com/avatar.jpg',
            bio: 'Software Developer'
          }
        });

      const apiHandler = async (req, res) => {
        const { id } = req.params;
        const response = await fetch(`https://api.users.com/users/${id}`);
        const userData = await response.json();
        
        res.json({
          message: `User ${id} details from external API`,
          data: userData,
          function: req.functionName
        });
      };

      const { res } = await testHandler(apiHandler, {
        method: 'GET',
        params: { id: '123' }
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'User 123 details from external API',
        function: 'test-function'
      });
      expect(res.data).toMatchObject({
        id: '123',
        name: 'John Doe',
        email: 'john@example.com'
      });
      expect(res.data.profile).toMatchObject({
        avatar: 'https://example.com/avatar.jpg',
        bio: 'Software Developer'
      });
    });

    it('should handle external post API calls', async () => {
      // Mock external post API
      nock('https://api.posts.com')
        .get('/users/123/posts/456')
        .reply(200, {
          id: '456',
          userId: '123',
          title: 'External Post Title',
          content: 'External post content',
          publishedAt: '2023-01-01T00:00:00Z'
        });

      const apiHandler = async (req, res) => {
        const { id, postId } = req.params;
        const response = await fetch(`https://api.posts.com/users/${id}/posts/${postId}`);
        const postData = await response.json();
        
        res.json({
          message: `Post ${postId} for user ${id} from external API`,
          data: postData,
          function: req.functionName
        });
      };

      const { res } = await testHandler(apiHandler, {
        method: 'GET',
        params: { id: '123', postId: '456' }
      });

      expectStatus(res, 200);
      expectResponseFields(res, {
        message: 'Post 456 for user 123 from external API',
        function: 'test-function'
      });
      expect(res.data).toMatchObject({
        id: '456',
        userId: '123',
        title: 'External Post Title',
        content: 'External post content'
      });
    });
  });
}); 
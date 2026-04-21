import { jest } from '@jest/globals';
import usersHandler from './users.js';

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

function createMockReqRes(method = 'GET', params = {}, query = {}, body = {}) {
  const req = {
    method,
    params,
    query,
    body,
    logger,
    routePath: '/users/:id',
    functionName: 'hello-world',
  };
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

describe('hello-world/users.js', () => {
  describe('GET /users', () => {
    it('should return all users when no params', async () => {
      const { req, res } = createMockReqRes('GET');
      await usersHandler(req, res);
      expect(res.getStatus()).toBe(200);
      const data = res.getData();
      expect(data.message).toBe('All users');
      expect(data.data).toHaveLength(3);
      expect(data.data[0].name).toBe('User 1');
    });

    it('should return single user when id param provided', async () => {
      const { req, res } = createMockReqRes('GET', { id: '42' });
      await usersHandler(req, res);
      expect(res.getStatus()).toBe(200);
      const data = res.getData();
      expect(data.message).toBe('User 42 details');
      expect(data.data.id).toBe('42');
      expect(data.data.email).toBe('user42@example.com');
    });

    it('should return user post when id and postId provided', async () => {
      const { req, res } = createMockReqRes('GET', { id: '42', postId: '99' });
      await usersHandler(req, res);
      expect(res.getStatus()).toBe(200);
      const data = res.getData();
      expect(data.message).toBe('Post 99 for user 42');
      expect(data.data.postId).toBe('99');
      expect(data.data.userId).toBe('42');
    });
  });

  describe('POST /users', () => {
    it('should create user with body data', async () => {
      const { req, res } = createMockReqRes(
        'POST',
        {},
        {},
        { name: 'New User', email: 'new@example.com' }
      );
      await usersHandler(req, res);
      expect(res.getStatus()).toBe(201);
      const data = res.getData();
      expect(data.message).toBe('Created new user');
      expect(data.data.name).toBe('New User');
      expect(data.data.email).toBe('new@example.com');
    });

    it('should create resource for user when id provided', async () => {
      const { req, res } = createMockReqRes('POST', { id: '123' }, {}, { name: 'Resource' });
      await usersHandler(req, res);
      expect(res.getStatus()).toBe(201);
      expect(res.getData().message).toContain('Created resource for user 123');
    });

    it('should return 400 when body is empty', async () => {
      const { req, res } = createMockReqRes('POST', {}, {}, {});
      await usersHandler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getData().error).toBe('Bad Request');
    });

    it('should return 400 when body is null', async () => {
      const { req, res } = createMockReqRes('POST', {}, {}, null);
      await usersHandler(req, res);
      expect(res.getStatus()).toBe(400);
    });
  });

  describe('PUT /users/:id', () => {
    it('should update user with id and body', async () => {
      const { req, res } = createMockReqRes('PUT', { id: '42' }, {}, { name: 'Updated Name' });
      await usersHandler(req, res);
      expect(res.getStatus()).toBe(200);
      const data = res.getData();
      expect(data.message).toBe('Updated user 42');
      expect(data.data.name).toBe('Updated Name');
      expect(data.data.updatedAt).toBeDefined();
    });

    it('should return 400 when id is missing', async () => {
      const { req, res } = createMockReqRes('PUT', {}, {}, { name: 'Test' });
      await usersHandler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getData().message).toContain('User ID is required');
    });

    it('should return 400 when body is empty', async () => {
      const { req, res } = createMockReqRes('PUT', { id: '42' }, {}, {});
      await usersHandler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getData().message).toContain('Request body is required');
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete user with id', async () => {
      const { req, res } = createMockReqRes('DELETE', { id: '42' });
      await usersHandler(req, res);
      expect(res.getStatus()).toBe(200);
      const data = res.getData();
      expect(data.message).toBe('Deleted user 42');
      expect(data.data.id).toBe('42');
      expect(data.data.deletedAt).toBeDefined();
    });

    it('should return 400 when id is missing', async () => {
      const { req, res } = createMockReqRes('DELETE');
      await usersHandler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getData().message).toContain('User ID is required');
    });
  });

  describe('OPTIONS /users', () => {
    it('should return 200 for OPTIONS requests', async () => {
      const { req, res } = createMockReqRes('OPTIONS');
      await usersHandler(req, res);
      expect(res.getStatus()).toBe(200);
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for PATCH method', async () => {
      const { req, res } = createMockReqRes('PATCH');
      await usersHandler(req, res);
      expect(res.getStatus()).toBe(405);
    });
  });
});

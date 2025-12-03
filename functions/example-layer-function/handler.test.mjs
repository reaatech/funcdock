import { jest } from '@jest/globals';
import handler from './handler.js';

// Mock logger
const logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn()
};

// Mock request/response helpers
function createMockReqRes(method = 'GET', path = '/', body = {}, query = {}, params = {}) {
  const req = {
    method,
    path,
    body,
    query,
    params,
    logger,
    headers: { 'user-agent': 'jest' },
    routePath: path
  };
  
  let statusCode = 200;
  let sentData;
  let headersSent = false;
  
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      sentData = data;
      headersSent = true;
      return res;
    },
    send(data) {
      sentData = data;
      headersSent = true;
      return res;
    },
    header() {
      return res;
    },
    getStatus: () => statusCode,
    getData: () => sentData,
    getHeadersSent: () => headersSent
  };
  
  return { req, res };
}

describe('example-layer-function/handler.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Root endpoint (/)', () => {
    it('should return function information', async () => {
      const { req, res } = createMockReqRes('GET', '/');
      await handler(req, res);
      
      expect(res.getStatus()).toBe(200);
      expect(res.getData()).toBeDefined();
      expect(res.getData().success).toBe(true);
      expect(res.getData().data).toHaveProperty('message');
      expect(res.getData().data).toHaveProperty('endpoints');
    });
  });

  describe('Validation endpoint (/validate)', () => {
    it('should validate email correctly', async () => {
      const { req, res } = createMockReqRes('POST', '/validate', {
        email: 'test@example.com',
        phone: '5551234567',
        name: 'Test User'
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(200);
      expect(res.getData().success).toBe(true);
      expect(res.getData().data.email.valid).toBe(true);
      expect(res.getData().data.phone.valid).toBe(true);
      expect(res.getData().data.name.valid).toBe(true);
    });

    it('should reject invalid email', async () => {
      const { req, res } = createMockReqRes('POST', '/validate', {
        email: 'invalid-email'
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(400);
      expect(res.getData().success).toBe(false);
      expect(res.getData().errors).toBeDefined();
    });

    it('should reject invalid phone', async () => {
      const { req, res } = createMockReqRes('POST', '/validate', {
        phone: '123'
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(400);
      expect(res.getData().success).toBe(false);
    });

    it('should reject empty name', async () => {
      const { req, res } = createMockReqRes('POST', '/validate', {
        name: ''
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(400);
      expect(res.getData().success).toBe(false);
    });

    it('should reject GET method', async () => {
      const { req, res } = createMockReqRes('GET', '/validate');
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(405);
      expect(res.getData().success).toBe(false);
    });
  });

  describe('Format endpoint (/format)', () => {
    it('should format phone number', async () => {
      const { req, res } = createMockReqRes('POST', '/format', {
        phone: '5551234567'
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(200);
      expect(res.getData().success).toBe(true);
      expect(res.getData().data.phone).toBeDefined();
      expect(res.getData().data.phone.formatted).toContain('555');
    });

    it('should format currency', async () => {
      const { req, res } = createMockReqRes('POST', '/format', {
        amount: 1234.56,
        currency: 'USD'
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(200);
      expect(res.getData().success).toBe(true);
      expect(res.getData().data.currency).toBeDefined();
      expect(res.getData().data.currency.formatted).toContain('$');
    });

    it('should format date', async () => {
      const { req, res } = createMockReqRes('POST', '/format', {
        date: '2024-01-01T00:00:00.000Z'
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(200);
      expect(res.getData().success).toBe(true);
      expect(res.getData().data.date).toBeDefined();
      expect(res.getData().data.date.formatted).toBeDefined();
    });

    it('should reject GET method', async () => {
      const { req, res } = createMockReqRes('GET', '/format');
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(405);
    });
  });

  describe('Users endpoint (/users)', () => {
    it('should return paginated users list', async () => {
      const { req, res } = createMockReqRes('GET', '/users', {}, { page: 1, pageSize: 10 });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(200);
      expect(res.getData().success).toBe(true);
      expect(res.getData().data).toBeInstanceOf(Array);
      expect(res.getData().pagination).toBeDefined();
      expect(res.getData().pagination.page).toBe(1);
    });

    it('should create user with valid data', async () => {
      const { req, res } = createMockReqRes('POST', '/users', {
        name: 'New User',
        email: 'newuser@example.com',
        phone: '555-9999'
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(201);
      expect(res.getData().success).toBe(true);
      expect(res.getData().data).toHaveProperty('id');
      expect(res.getData().data).toHaveProperty('email', 'newuser@example.com');
    });

    it('should reject user creation with invalid email', async () => {
      const { req, res } = createMockReqRes('POST', '/users', {
        name: 'New User',
        email: 'invalid-email'
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(400);
      expect(res.getData().success).toBe(false);
    });

    it('should reject user creation without required fields', async () => {
      const { req, res } = createMockReqRes('POST', '/users', {
        name: 'New User'
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(400);
      expect(res.getData().success).toBe(false);
    });
  });

  describe('Utilities endpoint (/utilities)', () => {
    it('should sanitize string', async () => {
      const { req, res } = createMockReqRes('POST', '/utilities', {
        action: 'sanitize',
        value: '<script>alert("xss")</script>Hello World'
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(200);
      expect(res.getData().success).toBe(true);
      expect(res.getData().data.result).not.toContain('<script>');
    });

    it('should slugify string', async () => {
      const { req, res } = createMockReqRes('POST', '/utilities', {
        action: 'slugify',
        value: 'Hello World Test'
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(200);
      expect(res.getData().success).toBe(true);
      expect(res.getData().data.result).toBe('hello-world-test');
    });

    it('should capitalize string', async () => {
      const { req, res } = createMockReqRes('POST', '/utilities', {
        action: 'capitalize',
        value: 'hello world'
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(200);
      expect(res.getData().success).toBe(true);
      expect(res.getData().data.result).toBe('Hello world');
    });

    it('should clamp number', async () => {
      const { req, res } = createMockReqRes('POST', '/utilities', {
        action: 'clamp',
        value: 150,
        options: { min: 0, max: 100 }
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(200);
      expect(res.getData().success).toBe(true);
      expect(res.getData().data.result).toBe(100);
    });

    it('should round number', async () => {
      const { req, res } = createMockReqRes('POST', '/utilities', {
        action: 'round',
        value: 123.456,
        options: { decimals: 2 }
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(200);
      expect(res.getData().success).toBe(true);
      expect(res.getData().data.result).toBe(123.46);
    });

    it('should reject invalid action', async () => {
      const { req, res } = createMockReqRes('POST', '/utilities', {
        action: 'invalid',
        value: 'test'
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(400);
      expect(res.getData().success).toBe(false);
    });

    it('should reject missing action or value', async () => {
      const { req, res } = createMockReqRes('POST', '/utilities', {
        action: 'sanitize'
      });
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(400);
      expect(res.getData().success).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should return 404 for unknown route', async () => {
      const { req, res } = createMockReqRes('GET', '/unknown');
      
      await handler(req, res);
      
      expect(res.getStatus()).toBe(404);
      expect(res.getData().success).toBe(false);
    });
  });
});


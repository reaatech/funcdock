# 🚀 FuncDock — Testing Guide

## Index
- [Overview](#overview)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [Dockerized Testing](#dockerized-testing)
- [Test Utilities](#test-utilities)
- [Examples](#examples)
- [CI/CD](#cicd)
- [Troubleshooting](#troubleshooting)

---

## Overview
FuncDock supports comprehensive testing with Jest, Nock, and Docker for true production parity.

## Unit Testing
- Write tests for each handler (e.g., `handler.test.js`).
- Use Jest for assertions and mocking.

## Integration Testing
- Test API endpoints and external integrations.
- Use Nock for HTTP mocking.

## Dockerized Testing
- Run tests in a Docker container for production parity.
- `node scripts/test-function-in-docker.js --function=./functions/hello-world`

## Test Utilities
- Use helpers from `test/setup.js` (e.g., `testHandler`, `mockEnvVars`).

## Examples
- See `functions/hello-world/handler.test.js` for real tests.

## CI/CD
- Add tests to your pipeline to block bad deploys.
- Use `make test-functions` for all functions.

## Troubleshooting
- See [TROUBLESHOOTING_README.md](TROUBLESHOOTING_README.md) for test issues.

## Unit Testing with Jest and Nock

FuncDock provides comprehensive testing capabilities using Jest and Nock for mocking external APIs.

### Test Structure

Each function can include test files that follow this pattern:

```
functions/
  my-function/
    handler.js           # Main function code
    handler.test.js      # Unit tests for handler
    users.js             # Custom handler for /users route
    users.test.js        # Tests for users handler
    cron-handler.js      # Cron job handler
    cron-handler.test.js # Tests for cron handler
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for functions only
npm run test:functions

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

### Test Utilities

The testing framework provides several utilities in `test/setup.js`:

```javascript
import { 
  testHandler,           // Test a handler function
  createMockRequest,     // Create mock request object
  createMockResponse,    // Create mock response object
  expectStatus,          // Assert response status
  expectResponseFields,  // Assert response fields
  mockEnvVars,          // Mock environment variables
  nock                  // HTTP mocking library
} from '../../test/setup.js';
```

### Example Test File

```javascript
// handler.test.js
import { testHandler, expectStatus, expectResponseFields, nock } from '../../test/setup.js';
import handler from './handler.js';

describe('My Function Handler', () => {
  describe('GET requests', () => {
    it('should return successful response', async () => {
      const { res } = await testHandler(handler, {
        method: 'GET',
        query: { id: '123' }
      });

      expectStatus(res, 200);
      expectResponseFields(res.body, {
        message: 'Success',
        function: 'my-function'
      });
    });
  });

  describe('External API calls', () => {
    it('should handle external API calls', async () => {
      // Mock external API
      nock('https://api.example.com')
        .get('/users/123')
        .reply(200, { id: '123', name: 'John' });

      const { res } = await testHandler(handler, {
        method: 'GET',
        query: { userId: '123' }
      });

      expectStatus(res, 200);
      expect(res.body.data.name).toBe('John');
    });
  });
});
```

### Testing Features

- ✅ **Isolated Testing**: Each function can be tested independently
- ✅ **HTTP Mocking**: Nock integration for external API testing
- ✅ **Mock Objects**: Pre-built request/response mocks
- ✅ **Environment Mocking**: Easy environment variable mocking
- ✅ **Logging Testing**: Verify logging behavior
- ✅ **Error Testing**: Test error handling scenarios
- ✅ **Coverage Reports**: Generate test coverage reports
- ✅ **Watch Mode**: Automatic test re-runs on file changes

### Testing Dynamic Routes

```javascript
// users.test.js - Testing dynamic routing
describe('Users Handler', () => {
  it('should handle path parameters', async () => {
    const { res } = await testHandler(handler, {
      method: 'GET',
      params: { id: '123', postId: '456' }
    });

    expectStatus(res, 200);
    expect(res.body.data).toMatchObject({
      userId: '123',
      postId: '456'
    });
  });
});
```

### Testing Cron Jobs

```javascript
// cron-handler.test.js
describe('Cron Handler', () => {
  it('should handle scheduled tasks', async () => {
    const { res } = await testHandler(handler, {
      method: 'POST',
      body: {
        cronJob: 'daily-backup',
        schedule: '0 2 * * *',
        timestamp: new Date().toISOString()
      }
    });

    expectStatus(res, 200);
    expect(res.body.data.tasksCompleted).toContain('Database backup');
  });
});
```

## Dockerized Pre-Deployment Function Testing

For true production parity, you can run Jest+Nock unit tests for any function in a Docker environment that matches production. This is the recommended way to ensure your function will work after deployment.

### Run all tests for a function
```bash
node scripts/test-function-in-docker.js --function=./functions/hello-world
```

### Run only tests for a specific route/handler
```bash
node scripts/test-function-in-docker.js --function=./functions/hello-world --route=/greet
```

- Uses `Dockerfile.test` to match the production environment (Node 22, Redis, etc.)
- Mounts your function directory into the container
- Runs all Jest tests (or just the test file for the specified route)
- Proxies all output to your terminal
- Exits with the same code as Jest (for CI/CD)

**Tip:** Add this to your CI/CD pipeline to ensure functions pass all tests before deployment!

## Integration Testing

### Test All Functions
```bash
# Run comprehensive test suite
make test-functions

# With verbose output
VERBOSE=true ./scripts/test-functions.sh

# Test specific URL
./scripts/test-functions.sh --url http://production.com --verbose
```

### Manual Testing
```bash
# Test example functions
make example-test

# Individual function tests
curl http://localhost:3000/hello-world/
curl -X POST http://localhost:3000/webhook-handler/github
``` 
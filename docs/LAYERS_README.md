# Lambda Layers Guide

FuncDock supports AWS Lambda Layer-style shared code functionality, allowing you to share common code and dependencies across multiple functions.

## Overview

Layers enable you to:

- Share common utilities and helpers across functions
- Reduce function bundle size by extracting shared dependencies
- Maintain consistent code across your serverless functions
- Update shared code in one place and have it automatically available to all dependent functions

## Layer Structure

Layers follow AWS Lambda Layer structure for compatibility:

```
layers/
  my-layer/
    nodejs/              # Node.js runtime code
      index.js          # Main layer export
      package.json      # Layer dependencies (optional)
      utils/
        helper.js
    layer.config.json   # Layer metadata (optional)
```

### Directory Structure

- **`layers/{layer-name}/nodejs/`** - Contains the actual layer code for Node.js runtime
- **`layers/{layer-name}/nodejs/package.json`** - Optional package.json for layer-specific dependencies
- **`layers/{layer-name}/layer.config.json`** - Optional metadata file

### layer.config.json

Optional configuration file for layer metadata:

```json
{
  "name": "my-layer",
  "version": "1.0.0",
  "description": "Shared utilities for all functions",
  "runtimes": ["nodejs"]
}
```

## Creating a Layer

### Method 1: Manual Creation

1. Create the layer directory structure:

   ```bash
   mkdir -p layers/my-layer/nodejs
   ```

2. Add your layer code:

   ```javascript
   // layers/my-layer/nodejs/index.js
   export function logger(message) {
     console.log(`[LOG] ${new Date().toISOString()}: ${message}`);
   }

   export function validateEmail(email) {
     return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
   }
   ```

3. (Optional) Add dependencies:

   ```bash
   cd layers/my-layer/nodejs
   npm init -y
   npm install some-package
   ```

4. (Optional) Add layer.config.json:
   ```json
   {
     "name": "my-layer",
     "version": "1.0.0",
     "description": "Shared utilities",
     "runtimes": ["nodejs"]
   }
   ```

### Method 2: Via API

Use the deployment API to upload layer files. **Authentication is required** for API access.

**Step 1: Get Authentication Token**

Login to get a JWT token:

```bash
# Login with admin credentials
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin"
  }'

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": { "username": "admin", "role": "admin" }
# }
```

**Step 2: Use Token in API Requests**

```bash
# Set token variable (replace with your actual token)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Deploy layer via API
curl -X POST http://localhost:3000/api/layers/deploy/local \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=my-layer" \
  -F "files=@index.js" \
  -F "files=@package.json"
```

**Note:** Default credentials are `admin`/`admin`. **Change these in production!** Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables.

### Method 3: From Git Repository

Deploy a layer from a Git repository:

```bash
# Get token first (see Method 2, Step 1)
TOKEN="your-jwt-token-here"

# Deploy from Git
curl -X POST http://localhost:3000/api/layers/deploy/git \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-layer",
    "repo": "https://github.com/user/repo.git",
    "branch": "main"
  }'
```

**Token Management:**

- Tokens expire after 24 hours
- Store token securely (environment variable, not in code)
- Re-login if token expires
- Use `POST /api/auth/logout` to invalidate token (optional)

## Using Layers in Functions

### Step 1: Create layers.json

In your function directory, create a `layers.json` file:

```json
"my-layer"
```

Or using object format:

```json
{
  "layer": "my-layer"
}
```

**Note:** Each function can reference **one layer only**.

### Step 2: Import from Layer

In your function handler, import from the layer as if it were a regular npm package:

```javascript
// functions/my-function/handler.js
import { logger, validateEmail } from 'my-layer';

export default async function handler(req, res) {
  logger('Request received');

  const email = req.body.email;
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  res.json({ message: 'Success' });
}
```

### Step 3: Layer Dependencies

If your layer has dependencies (defined in `layers/{layer-name}/nodejs/package.json`), they are automatically installed and available to your function:

```javascript
// If layer has package.json with "lodash": "^4.17.21"
import _ from 'lodash'; // Works! Layer's node_modules are accessible
import { helper } from 'my-layer';
```

## Layer Management

### List All Layers

```bash
# Get authentication token first
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.token')

# List layers
curl http://localhost:3000/api/layers \
  -H "Authorization: Bearer $TOKEN"
```

### Get Layer Details

```bash
TOKEN="your-jwt-token-here"

curl http://localhost:3000/api/layers/my-layer \
  -H "Authorization: Bearer $TOKEN"
```

### Update Layer

```bash
TOKEN="your-jwt-token-here"

curl -X PUT http://localhost:3000/api/layers/my-layer \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@updated-file.js"
```

### Delete Layer

```bash
TOKEN="your-jwt-token-here"

curl -X DELETE http://localhost:3000/api/layers/my-layer \
  -H "Authorization: Bearer $TOKEN"
```

**Note:** Replace `localhost:3000` with your actual server URL and port. Default port is 3000 if `PORT` environment variable is not set.

**Note:** You cannot delete a layer if any functions are using it.

## Hot Reload

Layers support hot reloading:

1. When you modify a layer file, the system automatically:
   - Reloads the layer
   - Reloads all functions that depend on the layer
   - Recreates symlinks

2. Changes take effect immediately without restarting the server

## Best Practices

### 1. Keep Layers Focused

Create layers for specific purposes:

- `shared-utils` - Common utility functions
- `database-helpers` - Database connection and query helpers
- `auth-helpers` - Authentication and authorization utilities
- `logging` - Centralized logging utilities

### 2. Version Your Layers

Use `layer.config.json` to track layer versions:

```json
{
  "name": "shared-utils",
  "version": "1.2.0",
  "description": "Shared utility functions v1.2.0"
}
```

### 3. Manage Dependencies Carefully

- Keep layer dependencies minimal
- Document required dependencies in layer README
- Avoid conflicting dependencies between layer and function

### 4. Test Layer Changes

Before updating a layer:

1. Test the layer changes in isolation
2. Verify all dependent functions still work
3. Consider creating a new layer version for breaking changes

### 5. Use Descriptive Names

Choose clear, descriptive layer names:

- ✅ `shared-utils`, `database-helpers`, `auth-middleware`
- ❌ `layer1`, `stuff`, `common`

## Complete Authentication Flow Example

Here's a complete example of using layers with authentication:

### Step 1: Create Authentication Layer

```bash
# Create layer structure
mkdir -p layers/auth-utils/nodejs
```

```javascript
// layers/auth-utils/nodejs/index.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function generateToken(payload, expiresIn = '24h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function hashPassword(password) {
  // Use bcrypt or similar
  return require('bcryptjs').hashSync(password, 10);
}

export function comparePassword(password, hash) {
  return require('bcryptjs').compareSync(password, hash);
}
```

```json
// layers/auth-utils/nodejs/package.json
{
  "name": "auth-utils",
  "version": "1.0.0",
  "dependencies": {
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3"
  }
}
```

### Step 2: Use Layer in Function

```json
// functions/user-api/layers.json
"auth-utils"
```

```javascript
// functions/user-api/handler.js
import { verifyToken, generateToken } from 'auth-utils';

export default async function handler(req, res) {
  const { method, headers } = req;

  if (method === 'POST' && req.path === '/login') {
    // Login logic
    const { username, password } = req.body;
    // ... validate credentials ...
    const token = generateToken({ username, role: 'user' });
    return res.json({ token });
  }

  // Protected route - verify token
  const token = headers['authorization']?.split(' ')[1];
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Use authenticated user
  res.json({ message: `Hello, ${user.username}!` });
}
```

### Step 3: Deploy and Use

```bash
# Layer is automatically loaded when function is deployed
# Function can now import from 'auth-utils'
```

## Examples

### Example 1: Shared Logger Layer

**Layer Structure:**

```
layers/
  logger/
    nodejs/
      index.js
      package.json
```

**Layer Code:**

```javascript
// layers/logger/nodejs/index.js
export function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${level.toUpperCase()}] ${timestamp}: ${message}`, meta);
}

export function logError(message, error) {
  log('error', message, { error: error.message, stack: error.stack });
}

export function logInfo(message, meta) {
  log('info', message, meta);
}
```

**Function Usage:**

```javascript
// functions/api-handler/handler.js
import { logInfo, logError } from 'logger';

export default async function handler(req, res) {
  try {
    logInfo('Processing request', { path: req.path });
    // ... handler logic
    res.json({ success: true });
  } catch (error) {
    logError('Request failed', error);
    res.status(500).json({ error: 'Internal error' });
  }
}
```

### Example 2: Database Helpers Layer

**Layer with Dependencies:**

```json
// layers/db-helpers/nodejs/package.json
{
  "name": "db-helpers",
  "version": "1.0.0",
  "dependencies": {
    "pg": "^8.11.0"
  }
}
```

```javascript
// layers/db-helpers/nodejs/index.js
import pg from 'pg';
const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

export async function query(text, params) {
  const pool = getPool();
  return pool.query(text, params);
}
```

**Function Usage:**

```javascript
// functions/user-api/handler.js
import { query } from 'db-helpers';

export default async function handler(req, res) {
  const result = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  res.json(result.rows[0]);
}
```

### Example 3: Complete Example - Shared Utils Layer

A complete, working example demonstrating layer usage is available in the `example-layer-function`. This example includes:

- **Layer**: `layers/shared-utils/` - Comprehensive utility functions for validation, formatting, string manipulation, and response helpers
- **Function**: `functions/example-layer-function/` - Complete function demonstrating all layer features

**Key Features:**

- Validation utilities (email, phone, required fields, length)
- Formatting utilities (phone numbers, currency, dates)
- String utilities (sanitization, slugification, capitalization)
- Response formatting helpers (success, error, pagination)
- Error handling with custom error classes
- Number utilities (clamping, rounding, formatting)

**See the complete example:**

- Function: `functions/example-layer-function/`
- Documentation: `functions/example-layer-function/README.md`
- Tests: `functions/example-layer-function/handler.test.mjs`

This example demonstrates best practices for:

- Creating and structuring layers
- Using layers in functions
- Testing functions that use layers
- Documenting layer usage

## Troubleshooting

### Layer Not Found

**Error:** `Function references layer 'my-layer' which is not loaded`

**Solution:**

1. Verify the layer exists in `layers/my-layer/nodejs/`
2. Check the layer name in `layers.json` matches exactly
3. Restart the server to reload layers

### Import Errors

**Error:** `Cannot find module 'my-layer'`

**Solution:**

1. Verify `layers.json` exists in your function directory
2. Check the symlink exists: `ls -la functions/my-function/node_modules/`
3. Ensure the layer's `nodejs/` directory contains the expected files

### Dependency Conflicts

**Error:** Dependency version conflicts between layer and function

**Solution:**

1. Use the same dependency versions in both layer and function
2. Or move conflicting dependencies to the layer only
3. Check `node_modules` for duplicate packages

### Hot Reload Not Working

**Solution:**

1. Check file watcher logs for errors
2. Verify layer files are not in ignored patterns
3. Manually reload: `POST /api/reload` with function name

## Real-World Usage Examples

### Example: Database Connection Layer

Create a layer for shared database connections:

```javascript
// layers/db-connection/nodejs/index.js
import pg from 'pg';
const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

export async function query(text, params) {
  const pool = getPool();
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function transaction(callback) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

```json
// layers/db-connection/nodejs/package.json
{
  "name": "db-connection",
  "dependencies": {
    "pg": "^8.11.0"
  }
}
```

**Usage in function:**

```javascript
// functions/user-api/handler.js
import { query, transaction } from 'db-connection';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    return res.json(result.rows[0]);
  }

  if (req.method === 'POST') {
    await transaction(async (client) => {
      await client.query('INSERT INTO users ...');
      await client.query('INSERT INTO user_profiles ...');
    });
    return res.json({ success: true });
  }
}
```

### Example: API Client Layer

Create a layer for external API clients:

```javascript
// layers/api-clients/nodejs/index.js
import fetch from 'node-fetch';

export class StripeClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.stripe.com/v1';
  }

  async createCustomer(email) {
    const response = await fetch(`${this.baseUrl}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `email=${encodeURIComponent(email)}`,
    });
    return response.json();
  }
}

export class SendGridClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.sendgrid.com/v3';
  }

  async sendEmail(to, subject, content) {
    const response = await fetch(`${this.baseUrl}/mail/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'noreply@example.com' },
        subject,
        content: [{ type: 'text/plain', value: content }],
      }),
    });
    return response.json();
  }
}
```

**Usage:**

```javascript
// functions/payment/handler.js
import { StripeClient } from 'api-clients';

export default async function handler(req, res) {
  const stripe = new StripeClient(process.env.STRIPE_SECRET_KEY);
  const customer = await stripe.createCustomer(req.body.email);
  res.json({ customerId: customer.id });
}
```

## API Reference

### GET /api/layers

List all layers

**Authentication:** Required  
**Response:**

```json
{
  "layers": [
    {
      "name": "my-layer",
      "version": "1.0.0",
      "status": "loaded"
    }
  ]
}
```

### GET /api/layers/:name

Get layer details

**Authentication:** Required  
**Response:**

```json
{
  "name": "my-layer",
  "version": "1.0.0",
  "description": "Shared utilities",
  "status": "loaded",
  "loadedAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/layers/:name/files

List layer files

**Authentication:** Required

### POST /api/layers/deploy/local

Deploy layer from uploaded files

**Authentication:** Required  
**Content-Type:** `multipart/form-data`  
**Body:**

- `name` (string): Layer name
- `files` (file[]): Layer files to upload

### POST /api/layers/deploy/git

Deploy layer from Git repository

**Authentication:** Required  
**Content-Type:** `application/json`  
**Body:**

```json
{
  "name": "my-layer",
  "repo": "https://github.com/user/repo.git",
  "branch": "main"
}
```

### PUT /api/layers/:name

Update layer files

**Authentication:** Required

### DELETE /api/layers/:name

Delete layer (fails if functions are using it)

**Authentication:** Required

**Note:** All API endpoints require authentication. See [Authentication](#authentication) section for obtaining tokens.

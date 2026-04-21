import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import chokidar from 'chokidar';
import { exec } from 'child_process';
import { promisify } from 'util';
import cron from 'node-cron';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import Logger from './utils/logger.js';
import dotenv from 'dotenv';
import * as layerLoader from './utils/layer-loader.js';
import { initTracer, withSpan, shutdownTracer } from './utils/tracer.js';
import FuncDockMCPServer from './mcp-server.js';
dotenv.config();

import 'tsx';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
const server = createServer(app);

const GIT_URL_REGEX = /^https:\/\/[\w.-]+(?:\/[\w.-]+)*\/[\w.-]+(?:\.git)?$/i;
const BRANCH_NAME_REGEX = /^[a-zA-Z0-9._/-]+$/;
const COMMIT_SHA_REGEX = /^[0-9a-fA-F]{4,64}$/;
const FUNCTION_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const LAYER_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

function validateGitUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return GIT_URL_REGEX.test(url);
}

function validateBranchName(branch) {
  if (!branch || typeof branch !== 'string') return false;
  return BRANCH_NAME_REGEX.test(branch) && !branch.includes('..');
}

function validateCommitSha(sha) {
  if (!sha || typeof sha !== 'string') return false;
  return COMMIT_SHA_REGEX.test(sha);
}

function validateFunctionName(name) {
  if (!name || typeof name !== 'string') return false;
  return FUNCTION_NAME_REGEX.test(name) && name.length <= 100;
}

function validateLayerName(name) {
  if (!name || typeof name !== 'string') return false;
  return LAYER_NAME_REGEX.test(name) && name.length <= 100;
}

function validateFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  if (filePath.includes('\0')) return false;
  if (filePath.includes('..')) return false;
  return true;
}
const DASHBOARD_ORIGIN = process.env.DASHBOARD_ORIGIN || false;
const io = new Server(server, {
  cors: {
    origin:
      DASHBOARD_ORIGIN ||
      (process.env.NODE_ENV === 'production'
        ? false
        : ['http://localhost:3000', 'http://localhost:5173']),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_PASSWORD_HASH_ENV = process.env.ADMIN_PASSWORD_HASH;
const MCP_ENABLED = process.env.MCP_ENABLED !== 'false';
const MCP_HTTP_PORT = parseInt(process.env.MCP_HTTP_PORT || '3001', 10);

if (!JWT_SECRET) {
  console.error(
    'ERROR: JWT_SECRET environment variable is required. Set it to a strong random string (at least 32 characters).'
  );
  process.exit(1);
}

if (!ADMIN_USERNAME) {
  console.error('ERROR: ADMIN_USERNAME environment variable is required.');
  process.exit(1);
}

if (!ADMIN_PASSWORD && !ADMIN_PASSWORD_HASH_ENV) {
  console.error(
    'ERROR: Either ADMIN_PASSWORD or ADMIN_PASSWORD_HASH environment variable is required.'
  );
  process.exit(1);
}

if (JWT_SECRET.length < 16) {
  console.error('ERROR: JWT_SECRET must be at least 16 characters long.');
  process.exit(1);
}

if (ADMIN_PASSWORD && ADMIN_PASSWORD.length < 8) {
  console.error('ERROR: ADMIN_PASSWORD must be at least 8 characters long.');
  process.exit(1);
}

const ADMIN_PASSWORD_HASH = ADMIN_PASSWORD_HASH_ENV || bcrypt.hashSync(ADMIN_PASSWORD, 10);

let mcpServer = null;

// Single-instance in-memory token blacklist for logout.
// For multi-instance deployments, replace with Redis or another shared store.
const tokenBlacklist = new Map();

// Simple mutex for concurrent operations on shared Maps
const mutexes = new Map();
const acquireLock = async (key, timeout = 5000) => {
  const start = Date.now();
  while (mutexes.get(key)) {
    if (Date.now() - start > timeout) {
      throw new Error(`Lock timeout for ${key}`);
    }
    await new Promise((r) => setImmediate(r));
  }
  mutexes.set(key, true);
  return () => mutexes.delete(key);
};

// Function route dispatcher -- stores handler functions keyed by "METHOD /path"
// This allows route removal/replacement without Express router stack accumulation
const functionDispatcher = new Map();
const functionLoggers = new Map();

// Register a function route in the dispatcher
const registerDispatcherRoute = (method, fullPath, functionName, handlerFn) => {
  const routeKey = `${method.toUpperCase()} ${fullPath}`;
  functionDispatcher.set(routeKey, { functionName, handler: handlerFn });
};

// Unregister all routes for a function from the dispatcher
const _unregisterDispatcherRoutes = (functionName) => {
  for (const [key, value] of functionDispatcher.entries()) {
    if (value.functionName === functionName) {
      functionDispatcher.delete(key);
    }
  }
};

// Single Express middleware that dispatches to the current handler from the Map
const functionDispatcherMiddleware = async (req, res, next) => {
  const routeKey = `${req.method.toUpperCase()} ${req.path}`;
  const entry = functionDispatcher.get(routeKey);
  if (!entry) {
    return next();
  }

  const { functionName, handler: routeHandlerFunction } = entry;
  const funcInfo = loadedFunctions.get(functionName);
  const functionDir = funcInfo ? funcInfo.path : '';
  const routeHandler = funcInfo ? funcInfo.config?.handler || 'handler.js' : '';

  // Cache logger instances per function to avoid creating new streams on every request
  let functionLogger = functionLoggers.get(functionName);
  if (!functionLogger) {
    functionLogger = new Logger({
      logLevel: process.env.LOG_LEVEL || 'info',
      logToFile: true,
      logToConsole: true,
      functionName: functionName,
    });
    functionLoggers.set(functionName, functionLogger);
  }

  req.functionName = functionName;
  req.functionPath = functionDir;
  req.logger = functionLogger;

  if (funcInfo && funcInfo.envVars) {
    req.env = funcInfo.envVars;
  }

  const start = Date.now();
  let statusCode = 200;
  const origStatus = res.status;
  res.status = function (code) {
    statusCode = code;
    return origStatus.call(this, code);
  };

  try {
    await withSpan(
      `funcdock.invoke.${functionName}.${req.path}.${req.method.toLowerCase()}`,
      {
        'function.name': functionName,
        'http.route': req.path,
        'http.method': req.method.toUpperCase(),
        'http.url': req.originalUrl || req.url,
      },
      async () => {
        await routeHandlerFunction(req, res, next);
      }
    );
  } catch (err) {
    functionLogger.error(`Error in ${req.path} (${functionName}/${routeHandler}): ${err.message}`, {
      stack: err.stack,
    });
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        function: functionName,
        handler: routeHandler,
        route: req.path,
        timestamp: new Date().toISOString(),
      });
    }
    statusCode = 500;
  } finally {
    const duration = Date.now() - start;
    const ip = req.ip || req.connection?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    functionLogger.info('HTTP access', {
      level: 'ACCESS',
      function: functionName,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode,
      duration,
      ip,
      userAgent,
    });

    try {
      await functionLogger.flushBuffer();
    } catch (flushErr) {
      console.error('Failed to flush log buffer:', flushErr.message);
    }
  }
};

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);
app.use(compression());
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(morgan('combined'));
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.bodyRaw = buf.toString();
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (must be before auth-required routes and dispatcher)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts from this IP, please try again later.',
});

// Serve static files for dashboard with proper MIME types
app.use(
  '/dashboard',
  express.static(path.join(__dirname, 'public/dashboard'), {
    setHeaders: (res, path) => {
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (path.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html');
      }
    },
  })
);

// Deploy API key for CI/CD and CLI tools
const DEPLOY_API_KEY = process.env.DEPLOY_API_KEY || '';

// Auth middleware that accepts either JWT or deploy API key
const requireAuth = (req, res, next) => {
  if (DEPLOY_API_KEY && req.headers['x-deploy-api-key'] === DEPLOY_API_KEY) {
    return next();
  }
  authenticateToken(req, res, next);
};

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    token = req.cookies && req.cookies['funcdock-token'];
  }

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    if (tokenBlacklist.has(token)) {
      return res.status(403).json({ message: 'Token has been revoked' });
    }
    req.user = user;
    next();
  });
};

// Socket.IO authentication
io.use((socket, next) => {
  let token = socket.handshake.auth.token;
  if (!token) {
    const cookies = socket.handshake.headers.cookie;
    if (cookies) {
      const cookieObj = cookies.split(';').reduce((acc, cookie) => {
        const [key, val] = cookie.trim().split('=');
        acc[key] = val;
        return acc;
      }, {});
      token = cookieObj['funcdock-token'];
    }
  }
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return next(new Error('Authentication error'));
    }
    if (tokenBlacklist.has(token)) {
      return next(new Error('Token has been revoked'));
    }
    socket.user = user;
    next();
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Global state
const loadedFunctions = new Map();
const loadedLayers = new Map(); // Track loaded layers
const layerToFunctions = new Map(); // Track which functions use which layers
const registeredRoutes = new Map();
const activeCronJobs = new Map(); // Track active cron jobs
const logger = new Logger();

// Single-instance in-memory OAuth token storage.
// For multi-instance deployments, replace with Redis or another shared store.
const userTokens = {};

// --- GitHub OAuth ---
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'YOUR_GITHUB_CLIENT_ID';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'YOUR_GITHUB_CLIENT_SECRET';
const GITHUB_REDIRECT_URI =
  process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/api/oauth/github/callback';

// OAuth state storage (state token -> { timestamp, userId })
const oauthStates = new Map();

// Clean up expired OAuth states every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.timestamp > 600000) {
      oauthStates.delete(state);
    }
  }
}, 600000);

app.get('/api/oauth/github', authenticateToken, (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  oauthStates.set(state, { timestamp: Date.now(), userId: req.user.username });
  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=repo&state=${state}`;
  res.json({ url });
});

app.get('/api/oauth/github/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('Missing code');
  if (!state || !oauthStates.has(state)) {
    return res.status(400).send('Invalid or expired state parameter');
  }
  const stateData = oauthStates.get(state);
  oauthStates.delete(state);
  // Check state expiration (10 minutes)
  if (Date.now() - stateData.timestamp > 600000) {
    return res.status(400).send('Expired state parameter');
  }
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).json({ error: 'No access token' });
    // For demo, associate token with user (by username)
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${tokenData.access_token}` },
    });
    await userRes.json();
    const funcDockUser = stateData.userId;
    userTokens[`github:${funcDockUser}`] = tokenData.access_token;
    // Redirect to dashboard with success (in production, use a better flow)
    res.redirect('/dashboard?github=success');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/github/repos', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    const token = userTokens[`github:${username}`];
    if (!token) return res.status(401).json({ error: 'Not connected to GitHub' });
    const ghRes = await fetch('https://api.github.com/user/repos?per_page=100', {
      headers: { Authorization: `token ${token}` },
    });
    const repos = await ghRes.json();
    res.json(repos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Bitbucket OAuth ---
const BITBUCKET_CLIENT_ID = process.env.BITBUCKET_CLIENT_ID || 'YOUR_BITBUCKET_CLIENT_ID';
const BITBUCKET_CLIENT_SECRET =
  process.env.BITBUCKET_CLIENT_SECRET || 'YOUR_BITBUCKET_CLIENT_SECRET';
const BITBUCKET_REDIRECT_URI =
  process.env.BITBUCKET_REDIRECT_URI || 'http://localhost:3000/api/oauth/bitbucket/callback';

app.get('/api/oauth/bitbucket', authenticateToken, (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  oauthStates.set(state, { timestamp: Date.now(), userId: req.user.username });
  const url = `https://bitbucket.org/site/oauth2/authorize?client_id=${BITBUCKET_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(BITBUCKET_REDIRECT_URI)}&state=${state}`;
  res.json({ url });
});

app.get('/api/oauth/bitbucket/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('Missing code');
  if (!state || !oauthStates.has(state)) {
    return res.status(400).send('Invalid or expired state parameter');
  }
  const stateData = oauthStates.get(state);
  oauthStates.delete(state);
  if (Date.now() - stateData.timestamp > 600000) {
    return res.status(400).send('Expired state parameter');
  }
  try {
    const tokenRes = await fetch('https://bitbucket.org/site/oauth2/access_token', {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(`${BITBUCKET_CLIENT_ID}:${BITBUCKET_CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(BITBUCKET_REDIRECT_URI)}`,
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).json({ error: 'No access token' });
    // For demo, associate token with user (by username)
    const userRes = await fetch('https://api.bitbucket.org/2.0/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    await userRes.json();
    const funcDockUser = stateData.userId;
    userTokens[`bitbucket:${funcDockUser}`] = tokenData.access_token;
    res.redirect('/dashboard?bitbucket=success');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bitbucket/repos', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    const token = userTokens[`bitbucket:${username}`];
    if (!token) return res.status(401).json({ error: 'Not connected to Bitbucket' });
    const bbRes = await fetch('https://api.bitbucket.org/2.0/repositories?role=member', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await bbRes.json();
    res.json(data.values || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ES modules use ?update= query parameter for cache busting

// Load environment variables from function's .env file
const loadFunctionEnv = async (functionDir) => {
  const envPath = path.join(functionDir, '.env');
  try {
    await fs.access(envPath);
    const envContent = await fs.readFile(envPath, 'utf-8');
    const envVars = {};
    // Parse .env file content, support both '=' and ':' delimiters
    envContent.split('\n').forEach((line) => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        // Accept both KEY=VALUE and KEY: VALUE
        let match = line.match(/^([^=:#]+)\s*[:=]\s*(.*)$/);
        if (match) {
          let key = match[1].trim();
          let value = match[2].replace(/^"|"$/g, '').replace(/^'|'$/g, '').trim();
          // Strip inline comments
          value = value
            .replace(/\s+#.*$/, '')
            .replace(/\s+\/\/.*$/, '')
            .trim();
          envVars[key] = value;
        }
      }
    });
    logger.info(
      `Loaded ${Object.keys(envVars).length} environment variables for function ${path.basename(functionDir)}`
    );
    return envVars;
  } catch {
    // .env file doesn't exist, return empty object
    return {};
  }
};

// Install dependencies for a function
const installDependencies = async (functionPath) => {
  const packageJsonPath = path.join(functionPath, 'package.json');
  const packageLockPath = path.join(functionPath, 'package-lock.json');
  const nodeModulesPath = path.join(functionPath, 'node_modules');

  try {
    await fs.access(packageJsonPath);

    // Check if dependencies are already installed and up to date
    let needsInstall = false;

    try {
      // Check if node_modules exists
      await fs.access(nodeModulesPath);

      // Check if package-lock.json exists and is newer than package.json
      try {
        await fs.access(packageLockPath);
        const packageJsonStats = await fs.stat(packageJsonPath);
        const packageLockStats = await fs.stat(packageLockPath);

        // If package.json is newer than package-lock.json, we need to install
        if (packageJsonStats.mtime > packageLockStats.mtime) {
          needsInstall = true;
        }
      } catch {
        // No package-lock.json, need to install
        needsInstall = true;
      }
    } catch {
      // No node_modules, need to install
      needsInstall = true;
    }

    if (!needsInstall) {
      logger.info(`Dependencies already up to date for ${path.basename(functionPath)}`);
      return true;
    }

    logger.info(`Installing dependencies for ${path.basename(functionPath)}`);

    const { stderr } = await execAsync('npm install --ignore-scripts', {
      cwd: functionPath,
      timeout: 60000,
    });

    if (stderr && !stderr.includes('npm WARN')) {
      logger.error(
        `Dependency installation warnings for ${path.basename(functionPath)}: ${stderr}`,
        { stack: stderr }
      );
    }

    logger.info(`Dependencies installed for ${path.basename(functionPath)}`);
    return true;
  } catch (error) {
    logger.error(
      `Failed to install dependencies for ${path.basename(functionPath)}: ${error.message}`,
      { stack: error.stack }
    );
    return false;
  }
};

// Unregister routes for a function
const unregisterFunctionRoutes = (functionName) => {
  const routesToRemove = [];

  for (const [routeKey, funcName] of registeredRoutes.entries()) {
    if (funcName === functionName) {
      routesToRemove.push(routeKey);
    }
  }

  routesToRemove.forEach((routeKey) => {
    registeredRoutes.delete(routeKey);
    functionDispatcher.delete(routeKey);
    logger.info(`Unregistered route: ${routeKey}`);
  });
};

// Load a single function
const loadFunction = async (functionDir) => {
  const functionName = path.basename(functionDir);
  const configPath = path.join(functionDir, 'route.config.json');

  const releaseLock = await acquireLock(`function:${functionName}`);
  let layerName = null;

  try {
    // Check if config file exists
    await fs.access(configPath);

    // Read and parse config first to get handler path
    const configRaw = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configRaw);

    // Validate config
    if (!config.routes || !Array.isArray(config.routes)) {
      throw new Error('Invalid route.config.json: routes array is required');
    }

    const handlerFileName = config.handler || 'handler.js';
    let handlerPath = path.join(functionDir, handlerFileName);

    if (!handlerFileName.includes('.')) {
      const jsPath = path.join(functionDir, handlerFileName + '.js');
      const tsPath = path.join(functionDir, handlerFileName + '.ts');
      try {
        await fs.access(jsPath);
        handlerPath = jsPath;
      } catch {
        try {
          await fs.access(tsPath);
          handlerPath = tsPath;
        } catch {
          throw new Error(`Handler file not found for ${handlerFileName}`);
        }
      }
    } else {
      try {
        await fs.access(handlerPath);
      } catch {
        const ext = path.extname(handlerFileName);
        if (ext === '.js') {
          const tsPath = path.join(functionDir, handlerFileName.replace('.js', '.ts'));
          try {
            await fs.access(tsPath);
            handlerPath = tsPath;
          } catch {
            throw new Error(
              `Handler file not found: ${handlerFileName} or ${handlerFileName.replace('.js', '.ts')}`
            );
          }
        } else {
          throw new Error(`Handler file not found: ${handlerPath}`);
        }
      }
    }

    // Install dependencies if needed
    const depsInstalled = await installDependencies(functionDir);
    if (!depsInstalled) {
      logger.alert(`Skipping function ${functionName} due to dependency installation failure`);
      return false;
    }

    // Load and setup layer for this function
    layerName = null;
    const previousFunctionInfo = loadedFunctions.get(functionName);

    // Clean up old layer association before reading new one
    if (previousFunctionInfo && previousFunctionInfo.layerName) {
      const oldLayerName = previousFunctionInfo.layerName;
      try {
        // Clean up old layer symlink
        await layerLoader.removeLayerSymlink(functionDir, oldLayerName, logger);
        // Remove from layer-to-function mapping
        const functionsUsingLayer = layerToFunctions.get(oldLayerName);
        if (functionsUsingLayer) {
          functionsUsingLayer.delete(functionName);
          if (functionsUsingLayer.size === 0) {
            layerToFunctions.delete(oldLayerName);
          }
        }
      } catch (cleanupError) {
        // Log but continue - cleanup failure shouldn't block function loading
        logger.error(
          `Failed to cleanup old layer association for ${functionName}: ${cleanupError.message}`,
          { stack: cleanupError.stack }
        );
        // Ensure mapping is cleaned up even if symlink removal fails
        const functionsUsingLayer = layerToFunctions.get(oldLayerName);
        if (functionsUsingLayer) {
          functionsUsingLayer.delete(functionName);
          if (functionsUsingLayer.size === 0) {
            layerToFunctions.delete(oldLayerName);
          }
        }
      }
    }

    // Read layers.json to get layer name
    let functionStatus = 'running';
    let layerError = null;

    try {
      layerName = await layerLoader.readFunctionLayers(functionDir);

      if (layerName) {
        // Validate layer exists
        const layer = loadedLayers.get(layerName);
        if (!layer) {
          logger.error(
            `Function ${functionName} references layer '${layerName}' which is not loaded`
          );
          logger.alert(
            `Function ${functionName} will fail at runtime if it imports from missing layer '${layerName}'`
          );
          functionStatus = 'error';
          layerError = `Layer '${layerName}' not found`;
        } else {
          // Create symlink to layer
          const symlinkCreated = await layerLoader.createLayerSymlink(
            functionDir,
            layerName,
            layer.nodejsPath,
            logger
          );

          if (symlinkCreated) {
            // Track layer-to-function dependency
            if (!layerToFunctions.has(layerName)) {
              layerToFunctions.set(layerName, new Set());
            }
            layerToFunctions.get(layerName).add(functionName);
            logger.info(`Function ${functionName} is using layer: ${layerName}`);
          } else {
            logger.error(
              `Failed to create symlink for layer ${layerName} in function ${functionName}`
            );
            logger.alert(
              `Function ${functionName} will fail at runtime if it imports from layer '${layerName}'`
            );
            functionStatus = 'error';
            layerError = `Failed to create symlink for layer '${layerName}'`;
            // Don't add to layerToFunctions map if symlink creation failed
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to read layers.json for function ${functionName}: ${error.message}`, {
        stack: error.stack,
      });
      // If layers.json exists but is malformed, set error status
      try {
        await fs.access(path.join(functionDir, 'layers.json'));
        functionStatus = 'error';
        layerError = `Invalid layers.json format: ${error.message}`;
      } catch {
        // layers.json doesn't exist, that's fine - no layer specified
      }
    }

    // Clear existing routes for this function
    if (loadedFunctions.has(functionName)) {
      unregisterFunctionRoutes(functionName);
    }

    // Import handler with cache busting for hot reload
    const handlerModule = await import(`${handlerPath}?update=${Date.now()}`);
    const handler = handlerModule.default;

    if (typeof handler !== 'function') {
      throw new Error('Handler must export a default function');
    }

    // Register routes
    const functionRoutes = [];
    const newlyRegisteredRoutes = [];

    for (const route of config.routes) {
      for (const method of route.methods) {
        // Create full path with function name prefix to avoid conflicts
        const basePath = config.base || `/${functionName}`;

        // Handle dynamic routing - don't use path.join for Express routes
        // Express routes can contain path parameters like :id, :userId, etc.
        const routePath = route.path.startsWith('/') ? route.path : `/${route.path}`;
        const fullPath = `${basePath}${routePath}`;
        const routeKey = `${method.toUpperCase()} ${fullPath}`;

        // Check for route conflicts
        if (registeredRoutes.has(routeKey) && registeredRoutes.get(routeKey) !== functionName) {
          logger.alert(
            `Route conflict detected: ${routeKey} already registered by ${registeredRoutes.get(routeKey)}`
          );
          logger.error(`Failed to register ${functionName} due to route conflict`, { stack: null });
          // Clean up any routes already registered in this attempt
          for (const key of newlyRegisteredRoutes) {
            registeredRoutes.delete(key);
            functionDispatcher.delete(key);
          }
          return false;
        }

        // Determine handler for this specific route
        const routeHandler = route.handler || config.handler || 'handler.js';
        let routeHandlerPath = path.join(functionDir, routeHandler);

        try {
          await fs.access(routeHandlerPath);
        } catch {
          if (routeHandler.endsWith('.js')) {
            const tsRouteHandler = routeHandler.replace('.js', '.ts');
            routeHandlerPath = path.join(functionDir, tsRouteHandler);
            try {
              await fs.access(routeHandlerPath);
            } catch {
              throw new Error(`Route handler not found: ${routeHandler} or ${tsRouteHandler}`);
            }
          } else {
            throw new Error(`Route handler not found: ${routeHandlerPath}`);
          }
        }

        // Load the specific handler for this route
        let routeHandlerFunction;
        try {
          const routeHandlerModule = await import(`${routeHandlerPath}?update=${Date.now()}`);
          routeHandlerFunction = routeHandlerModule.default;

          if (typeof routeHandlerFunction !== 'function') {
            throw new Error(`Handler in ${routeHandler} must export a default function`);
          }
        } catch (error) {
          logger.error(
            `Failed to load handler ${routeHandler} for route ${fullPath}: ${error.message}`,
            { stack: error.stack }
          );
          // Clean up any routes already registered in this attempt
          for (const key of newlyRegisteredRoutes) {
            registeredRoutes.delete(key);
            functionDispatcher.delete(key);
          }
          return false;
        }

        // Register the route in the dispatcher (not directly in Express)
        registerDispatcherRoute(method, fullPath, functionName, routeHandlerFunction);

        registeredRoutes.set(routeKey, functionName);
        newlyRegisteredRoutes.push(routeKey);
        functionRoutes.push({
          method: method.toUpperCase(),
          path: fullPath,
          handler: routeHandler,
        });
        logger.info(
          `Registered ${method.toUpperCase()} ${fullPath} -> ${functionName}/${routeHandler}`
        );
      }
    }

    // Load cron jobs for this function
    await loadCronJobs(functionDir);

    // Load environment variables for this function
    const envVars = await loadFunctionEnv(functionDir);

    // Store function info
    loadedFunctions.set(functionName, {
      name: functionName,
      config,
      handler,
      routes: functionRoutes,
      loadedAt: new Date(),
      lastDeployed: new Date().toISOString(),
      status: functionStatus,
      path: functionDir,
      envVars,
      layerName: layerName || null,
      layerError: layerError || null,
    });

    // Emit socket event for function loaded
    io.emit('function:loaded', {
      name: functionName,
      status: functionStatus,
      routes: functionRoutes.length,
      cronJobs: activeCronJobs.has(functionName) ? activeCronJobs.get(functionName).length : 0,
      layerName: layerName || null,
      layerError: layerError || null,
    });

    logger.info(
      `Successfully loaded function: ${functionName} with ${functionRoutes.length} routes`
    );
    return true;
  } catch (error) {
    logger.error(`Failed to load function ${functionName}: ${error.message}`, {
      stack: error.stack,
    });

    // Ensure layer dependency tracking is cleaned up if function load fails
    if (layerName) {
      const functionsUsingLayer = layerToFunctions.get(layerName);
      if (functionsUsingLayer) {
        functionsUsingLayer.delete(functionName);
        if (functionsUsingLayer.size === 0) {
          layerToFunctions.delete(layerName);
        }
      }
    }

    return false;
  } finally {
    releaseLock();
  }
};

// Unload a function
const unloadFunction = async (functionName) => {
  if (loadedFunctions.has(functionName)) {
    const functionInfo = loadedFunctions.get(functionName);

    // Clean up layer symlink
    if (functionInfo.layerName) {
      await layerLoader.removeLayerSymlink(functionInfo.path, functionInfo.layerName, logger);
      // Remove from layer-to-function mapping
      const functionsUsingLayer = layerToFunctions.get(functionInfo.layerName);
      if (functionsUsingLayer) {
        functionsUsingLayer.delete(functionName);
        if (functionsUsingLayer.size === 0) {
          layerToFunctions.delete(functionInfo.layerName);
        }
      }
    }

    unregisterFunctionRoutes(functionName);
    stopCronJobs(functionName);
    loadedFunctions.delete(functionName);

    // Emit socket event for function unloaded
    io.emit('function:unloaded', { name: functionName });

    logger.info(`Unloaded function: ${functionName}`);
  }
};

// Load all functions from the functions directory
const loadAllFunctions = async () => {
  const functionsDir = path.join(__dirname, 'functions');

  try {
    // Create functions directory if it doesn't exist
    await fs.mkdir(functionsDir, { recursive: true });

    const functionDirs = await fs.readdir(functionsDir);
    let loadedCount = 0;

    for (const dir of functionDirs) {
      const functionPath = path.join(functionsDir, dir);
      const stats = await fs.stat(functionPath);

      if (stats.isDirectory()) {
        const success = await loadFunction(functionPath);
        if (success) loadedCount++;
      }
    }

    logger.info(`Loaded ${loadedCount}/${functionDirs.length} functions successfully`);
  } catch (error) {
    logger.error(`Error loading functions: ${error.message}`, { stack: error.stack });
  }
};

// Set up file system watching
const setupFileWatcher = () => {
  const functionsDir = path.join(__dirname, 'functions');
  const layersDir = path.join(__dirname, 'layers');

  // Watch functions directory
  const functionsWatcher = chokidar.watch(functionsDir, {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/package-lock.json',
      '**/.package-lock.json',
      '**/npm-debug.log*',
      '**/yarn-debug.log*',
      '**/yarn-error.log*',
      '**/.npm/**',
      '**/.cache/**',
      '**/coverage/**',
      '**/.nyc_output/**',
      '**/.npmrc',
      '**/.yarnrc',
      '**/yarn.lock',
      '**/pnpm-lock.yaml',
      '**/bun.lockb',
      '**/.pnpm/**',
      '**/.yarn/**',
      '**/node_modules/.cache/**',
      '**/node_modules/.package-lock.json',
      '**/node_modules/.staging/**',
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/*.tmp',
      '**/*.temp',
      '**/.vscode/**',
      '**/.idea/**',
      '**/.idea/**/*',
      '**/*.swp',
      '**/*.swo',
      '**/*~',
      '**/.vscode/**/*',
      '**/.*.swp',
      '**/.*.swo',
      '**/.*~',
      '**/workspace.xml',
      '**/tasks.xml',
      '**/modules.xml',
      '**/misc.xml',
      '**/vcs.xml',
      '**/inspectionProfiles/**',
      '**/libraries/**',
      '**/shelf/**',
      '**/usage.statistics.xml',
      '**/contentModel.xml',
      '**/indexLayout.xml',
      '**/projectCodeStyle.xml',
      '**/encodings.xml',
      '**/compiler.xml',
      '**/jarRepositories.xml',
      '**/uiDesigner.xml',
      '**/dataSources.xml',
      '**/dataSources.local.xml',
      '**/sqlDataSources.xml',
      '**/dynamic.xml',
      '**/runConfigurations.xml',
      '**/shelf/**/*',
      '**/inspectionProfiles/**/*',
      '**/libraries/**/*',
    ],
    persistent: true,
    ignoreInitial: true,
    depth: 3,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
  });

  // Debounce function to avoid multiple rapid reloads
  const debounceReload = (() => {
    const timeouts = new Map();
    const lastReload = new Map();

    return (functionName, delay = 2000) => {
      const now = Date.now();
      const lastTime = lastReload.get(functionName) || 0;

      // Prevent reloading the same function more than once every 5 seconds
      if (now - lastTime < 5000) {
        return;
      }

      if (timeouts.has(functionName)) {
        clearTimeout(timeouts.get(functionName));
      }

      timeouts.set(
        functionName,
        setTimeout(async () => {
          try {
            const functionPath = path.join(functionsDir, functionName);
            await loadFunction(functionPath);
            lastReload.set(functionName, Date.now());
          } catch (error) {
            logger.error(`Failed to reload function ${functionName}: ${error.message}`, {
              stack: error.stack,
            });
          } finally {
            timeouts.delete(functionName);
          }
        }, delay)
      );
    };
  })();

  functionsWatcher
    .on('add', (filePath) => {
      // CRITICAL SAFETY: Prevent reloads on IDE files
      if (
        filePath.includes('.idea') ||
        filePath.includes('.vscode') ||
        filePath.includes('workspace.xml') ||
        filePath.includes('.swp') ||
        filePath.includes('.swo') ||
        filePath.endsWith('~')
      ) {
        logger.info(`Ignoring IDE file: ${filePath}`);
        return;
      }

      const functionName = path.relative(functionsDir, filePath).split(path.sep)[0];
      logger.info(`File added: ${filePath}`);
      debounceReload(functionName);
    })
    .on('change', (filePath) => {
      // CRITICAL SAFETY: Prevent reloads on IDE files
      if (
        filePath.includes('.idea') ||
        filePath.includes('.vscode') ||
        filePath.includes('workspace.xml') ||
        filePath.includes('.swp') ||
        filePath.includes('.swo') ||
        filePath.endsWith('~')
      ) {
        logger.info(`Ignoring IDE file change: ${filePath}`);
        return;
      }

      const functionName = path.relative(functionsDir, filePath).split(path.sep)[0];
      logger.info(`File changed: ${filePath}`);
      debounceReload(functionName);
    })
    .on('unlink', async (filePath) => {
      const functionName = path.relative(functionsDir, filePath).split(path.sep)[0];
      logger.info(`File removed: ${filePath}`);

      // If it's a critical file, unload the function
      const fileName = path.basename(filePath);
      if (fileName === 'route.config.json') {
        await unloadFunction(functionName);
      } else if (fileName === 'cron.json') {
        // For cron.json deletion, just reload the function without cron jobs
        debounceReload(functionName);
      } else if (fileName.endsWith('.js')) {
        // Check if this is any handler file for this function
        try {
          const functionPath = path.join(functionsDir, functionName);
          const configPath = path.join(functionPath, 'route.config.json');
          const configRaw = await fs.readFile(configPath, 'utf-8');
          const config = JSON.parse(configRaw);

          // Check if this file is used as a handler in any route
          let isHandlerFile = false;

          // Check default handler
          const defaultHandlerPath = path.join(functionPath, config.handler || 'handler.js');
          if (filePath === defaultHandlerPath) {
            isHandlerFile = true;
          }

          // Check route-specific handlers
          if (config.routes) {
            for (const route of config.routes) {
              const routeHandler = route.handler || config.handler || 'handler.js';
              const routeHandlerPath = path.join(functionPath, routeHandler);
              if (filePath === routeHandlerPath) {
                isHandlerFile = true;
                break;
              }
            }
          }

          if (isHandlerFile) {
            await unloadFunction(functionName);
          }
        } catch {
          // If we can't read the config, just reload the function
          debounceReload(functionName);
        }
      }
    })
    .on('addDir', (dirPath) => {
      const relativePath = path.relative(functionsDir, dirPath);
      if (!relativePath.includes(path.sep)) {
        // This is a new function directory
        logger.info(`New function directory detected: ${relativePath}`);
        debounceReload(relativePath, 2000); // Longer delay for new directories
      }
    })
    .on('unlinkDir', async (dirPath) => {
      const relativePath = path.relative(functionsDir, dirPath);
      if (!relativePath.includes(path.sep)) {
        logger.info(`Function directory removed: ${relativePath}`);
        try {
          await unloadFunction(relativePath);
        } catch (error) {
          logger.error(`Error unloading function ${relativePath}: ${error.message}`, {
            stack: error.stack,
          });
        }
      }
    });

  logger.info('File system watcher initialized for functions');

  // Watch layers directory
  const layersWatcher = chokidar.watch(layersDir, {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/package-lock.json',
      '**/.package-lock.json',
      '**/npm-debug.log*',
      '**/yarn-debug.log*',
      '**/yarn-error.log*',
      '**/.npm/**',
      '**/.cache/**',
      '**/coverage/**',
      '**/.nyc_output/**',
      '**/.npmrc',
      '**/.yarnrc',
      '**/yarn.lock',
      '**/pnpm-lock.yaml',
      '**/bun.lockb',
      '**/.pnpm/**',
      '**/.yarn/**',
      '**/node_modules/.cache/**',
      '**/node_modules/.package-lock.json',
      '**/node_modules/.staging/**',
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/*.tmp',
      '**/*.temp',
      '**/.vscode/**',
      '**/.idea/**',
    ],
    persistent: true,
    ignoreInitial: true,
    depth: 3,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
  });

  // Debounce function for layer reloads
  const debounceLayerReload = (() => {
    const timeouts = new Map();
    const lastReload = new Map();

    return (layerName, delay = 2000) => {
      const now = Date.now();
      const lastTime = lastReload.get(layerName) || 0;

      // Prevent reloading the same layer more than once every 5 seconds
      if (now - lastTime < 5000) {
        return;
      }

      if (timeouts.has(layerName)) {
        clearTimeout(timeouts.get(layerName));
      }

      timeouts.set(
        layerName,
        setTimeout(async () => {
          try {
            const layerPath = path.join(layersDir, layerName);
            const reloadedLayer = await layerLoader.loadLayer(layerPath, logger);
            loadedLayers.set(layerName, reloadedLayer);

            // Reload all functions that use this layer
            const functionsUsingLayer = layerToFunctions.get(layerName);
            if (functionsUsingLayer) {
              logger.info(
                `Reloading ${functionsUsingLayer.size} function(s) using layer ${layerName}`
              );
              for (const functionName of functionsUsingLayer) {
                const functionPath = path.join(functionsDir, functionName);
                await loadFunction(functionPath);
              }
            }

            lastReload.set(layerName, Date.now());
          } catch (error) {
            logger.error(`Failed to reload layer ${layerName}: ${error.message}`, {
              stack: error.stack,
            });
          } finally {
            timeouts.delete(layerName);
          }
        }, delay)
      );
    };
  })();

  layersWatcher
    .on('add', (filePath) => {
      const layerName = path.relative(layersDir, filePath).split(path.sep)[0];
      logger.info(`Layer file added: ${filePath}`);
      debounceLayerReload(layerName);
    })
    .on('change', (filePath) => {
      const layerName = path.relative(layersDir, filePath).split(path.sep)[0];
      logger.info(`Layer file changed: ${filePath}`);
      debounceLayerReload(layerName);
    })
    .on('unlink', async (filePath) => {
      const layerName = path.relative(layersDir, filePath).split(path.sep)[0];
      logger.info(`Layer file removed: ${filePath}`);
      debounceLayerReload(layerName);
    })
    .on('addDir', (dirPath) => {
      const relativePath = path.relative(layersDir, dirPath);
      if (!relativePath.includes(path.sep)) {
        // This is a new layer directory
        logger.info(`New layer directory detected: ${relativePath}`);
        debounceLayerReload(relativePath, 2000);
      }
    })
    .on('unlinkDir', async (dirPath) => {
      const relativePath = path.relative(layersDir, dirPath);
      if (!relativePath.includes(path.sep)) {
        logger.info(`Layer directory removed: ${relativePath}`);
        try {
          const functionsUsingLayer = layerToFunctions.get(relativePath);
          loadedLayers.delete(relativePath);
          layerToFunctions.delete(relativePath);
          if (functionsUsingLayer) {
            for (const functionName of functionsUsingLayer) {
              const functionPath = path.join(functionsDir, functionName);
              await loadFunction(functionPath);
            }
          }
        } catch (error) {
          logger.error(`Error handling layer removal ${relativePath}: ${error.message}`, {
            stack: error.stack,
          });
        }
      }
    });

  logger.info('File system watcher initialized for layers');

  // Return combined watcher object
  return {
    close: () => {
      functionsWatcher.close();
      layersWatcher.close();
    },
  };
};

// API endpoints for management
app.get('/api/status', requireAuth, (req, res) => {
  const functions = Array.from(loadedFunctions.values()).map((func) => ({
    name: func.name,
    status: func.status || 'running',
    routes: func.routes || [],
    cronJobs: activeCronJobs.has(func.name) ? activeCronJobs.get(func.name).length : 0,
    lastDeployed: func.lastDeployed || new Date().toISOString(),
  }));

  res.json({
    status: 'running',
    uptime: process.uptime(),
    functions,
    totalFunctions: loadedFunctions.size,
    totalRoutes: registeredRoutes.size,
    totalCronJobs: Array.from(activeCronJobs.values()).flat().length,
  });
});

app.post('/api/reload', requireAuth, async (req, res) => {
  const { functionName } = req.body;

  if (functionName) {
    if (!validateFunctionName(functionName)) {
      return res.status(400).json({
        message:
          'Invalid function name. Use only alphanumeric characters, hyphens, and underscores.',
      });
    }
    // Reload specific function
    const functionPath = path.join(__dirname, 'functions', functionName);
    const success = await loadFunction(functionPath);

    res.json({
      success,
      message: success
        ? `Function ${functionName} reloaded successfully`
        : `Failed to reload function ${functionName}`,
      timestamp: new Date().toISOString(),
    });
  } else {
    // Reload all functions
    logger.info('Manual reload triggered for all functions');
    await loadAllFunctions();

    res.json({
      success: true,
      message: 'All functions reloaded',
      functionsLoaded: loadedFunctions.size,
      timestamp: new Date().toISOString(),
    });
  }
});

function safeStringEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Authentication routes
app.post(
  '/api/auth/login',
  loginLimiter,
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { username, password } = req.body;

    try {
      const usernameOk = safeStringEqual(username, ADMIN_USERNAME);
      const passwordOk = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

      if (usernameOk && passwordOk) {
        const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });

        res.cookie('funcdock-token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000,
        });

        res.json({
          token,
          user: { username, role: 'admin' },
        });
      } else {
        res.status(401).json({ message: 'Invalid credentials' });
      }
    } catch (error) {
      logger.error(`Login error: ${error.message}`, { stack: error.stack });
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  const authHeader = req.headers['authorization'];
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : req.cookies && req.cookies['funcdock-token'];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          tokenBlacklist.set(token, Date.now() + ttl * 1000);
        }
      }
    });
    if (tokenBlacklist.size > 1000) {
      const now = Date.now();
      for (const [t, expiresAt] of tokenBlacklist.entries()) {
        if (now > expiresAt) {
          tokenBlacklist.delete(t);
        }
      }
    }
  }

  res.clearCookie('funcdock-token');
  res.json({ message: 'Logged out successfully' });
});

// Dashboard API routes

app.get('/api/functions', authenticateToken, (req, res) => {
  const functions = Array.from(loadedFunctions.values()).map((func) => ({
    name: func.name,
    status: func.status || 'running',
    routes: func.routes || [],
    cronJobs: activeCronJobs.has(func.name) ? activeCronJobs.get(func.name).length : 0,
    lastDeployed: func.lastDeployed || new Date().toISOString(),
    layerName: func.layerName || null,
  }));

  res.json({ functions });
});

app.get('/api/functions/:name', authenticateToken, async (req, res) => {
  const { name } = req.params;
  const func = loadedFunctions.get(name);

  if (!func) {
    return res.status(404).json({ message: 'Function not found' });
  }

  // Read route.config.json to get base URL
  let baseUrl;
  try {
    const configPath = path.join(func.path, 'route.config.json');
    const configRaw = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configRaw);
    baseUrl = config.base || '';
  } catch {
    baseUrl = '';
  }

  // Read cron.json to get cron job details
  let cronJobDetails = [];
  const cronPath = path.join(func.path, 'cron.json');

  try {
    await fs.access(cronPath);
    // File exists, proceed to read it
    try {
      const cronRaw = await fs.readFile(cronPath, 'utf-8');
      const cronConfig = JSON.parse(cronRaw);
      if (Array.isArray(cronConfig.jobs)) {
        cronJobDetails = cronConfig.jobs.map((job) => ({
          schedule: job.schedule,
          handler: job.handler,
          description: job.description || '',
        }));
      }
    } catch {
      // If the file exists but is unreadable or invalid, still do not log an error
      cronJobDetails = [];
    }
  } catch {
    // File doesn't exist, this is normal - leave cronJobDetails as empty array
  }

  const functionData = {
    name: func.name,
    status: func.status || 'running',
    routes: func.routes || [],
    cronJobs: cronJobDetails,
    lastDeployed: func.lastDeployed || new Date().toISOString(),
    path: func.path,
    baseUrl,
    layerName: func.layerName || null,
  };

  res.json(functionData);
});

// Cleanup helper for temp upload files
const cleanupTempFiles = async (files) => {
  if (!files || files.length === 0) return;
  for (const file of files) {
    try {
      await fs.unlink(file.path);
    } catch {
      // Ignore cleanup errors
    }
  }
};

// File upload configuration for function deployment
const upload = multer({
  dest: 'temp/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 20, // Max 20 files
  },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(js|mjs|ts|json|md|txt|yaml|yml|env|gitignore|config)$/i;
    cb(null, allowed.test(file.originalname));
  },
});

app.post(
  '/api/functions/deploy/local',
  authenticateToken,
  upload.array('files'),
  async (req, res) => {
    const files = req.files;
    try {
      const { name } = req.body;

      if (!name || !files || files.length === 0) {
        return res.status(400).json({ message: 'Function name and files are required' });
      }

      if (!validateFunctionName(name)) {
        return res.status(400).json({
          message:
            'Invalid function name. Use only alphanumeric characters, hyphens, and underscores.',
        });
      }

      const functionDir = path.join(__dirname, 'functions', name);
      await fs.mkdir(functionDir, { recursive: true });

      for (const file of files) {
        const safeName = path.basename(file.originalname);
        const destPath = path.join(functionDir, safeName);
        const resolvedDest = path.resolve(destPath);
        const resolvedFunctionDir = path.resolve(functionDir);
        if (!resolvedDest.startsWith(resolvedFunctionDir)) {
          return res.status(400).json({ message: 'Invalid file path' });
        }
        await fs.rename(file.path, destPath);
      }

      // Load the function
      const success = await loadFunction(functionDir);

      if (success) {
        // Emit socket event
        io.emit('function:deployed', { name, status: 'running' });

        res.json({
          message: 'Function deployed successfully',
          function: { name, status: 'running' },
        });
      } else {
        res.status(500).json({ message: 'Failed to deploy function' });
      }
    } catch (error) {
      logger.error(`Deployment error: ${error.message}`, { stack: error.stack });
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      await cleanupTempFiles(files);
    }
  }
);

app.delete('/api/functions/:name', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;

    // Unload function (await to ensure cleanup completes before deletion)
    try {
      await unloadFunction(name);
    } catch (unloadError) {
      // Log error but continue with deletion - symlink cleanup failure shouldn't block deletion
      logger.error(`Error unloading function ${name} during deletion: ${unloadError.message}`, {
        stack: unloadError.stack,
      });
      logger.warn(`Continuing with function deletion despite unload error`);
    }

    // Remove function directory
    const functionDir = path.join(__dirname, 'functions', name);
    await fs.rm(functionDir, { recursive: true, force: true });

    // Emit socket event
    io.emit('function:deleted', { name });

    res.json({ message: 'Function deleted successfully' });
  } catch (error) {
    logger.error(`Delete function error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update function
app.put('/api/functions/:name', authenticateToken, upload.array('files'), async (req, res) => {
  const files = req.files;
  try {
    const { name } = req.params;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'Files are required' });
    }

    const functionDir = path.join(__dirname, 'functions', name);

    if (!loadedFunctions.has(name)) {
      return res.status(404).json({ message: 'Function not found' });
    }

    for (const file of files) {
      const safeName = path.basename(file.originalname);
      const destPath = path.join(functionDir, safeName);
      const resolvedDest = path.resolve(destPath);
      const resolvedFunctionDir = path.resolve(functionDir);
      if (!resolvedDest.startsWith(resolvedFunctionDir)) {
        return res.status(400).json({ message: 'Invalid file path' });
      }
      await fs.rename(file.path, destPath);
    }

    // Reload the function
    const success = await loadFunction(functionDir);

    if (success) {
      // Emit socket event
      io.emit('function:updated', { name, status: 'running' });

      res.json({
        message: 'Function updated successfully',
        function: { name, status: 'running' },
      });
    } else {
      res.status(500).json({ message: 'Failed to update function' });
    }
  } catch (error) {
    logger.error(`Update function error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await cleanupTempFiles(files);
  }
});

// Deploy function from Git
app.post('/api/functions/deploy/git', authenticateToken, async (req, res) => {
  try {
    const { name, repo, branch = 'main', commit } = req.body;

    if (!name || !repo) {
      return res.status(400).json({ message: 'Function name and repository URL are required' });
    }

    if (!validateFunctionName(name)) {
      return res.status(400).json({
        message:
          'Invalid function name. Use only alphanumeric characters, hyphens, and underscores.',
      });
    }

    if (!validateGitUrl(repo)) {
      return res
        .status(400)
        .json({ message: 'Invalid repository URL. Use a valid HTTPS Git URL.' });
    }

    if (!validateBranchName(branch)) {
      return res.status(400).json({ message: 'Invalid branch name.' });
    }

    if (commit && !validateCommitSha(commit)) {
      return res.status(400).json({ message: 'Invalid commit SHA.' });
    }

    const functionDir = path.join(__dirname, 'functions', name);

    // Clone the repository using argument array to prevent command injection
    const { spawn } = await import('child_process');

    const cloneArgs = ['clone', '--depth', '1'];
    if (branch && branch !== 'main') {
      cloneArgs.push('-b', branch);
    }
    cloneArgs.push(repo, functionDir);

    await new Promise((resolve, reject) => {
      const child = spawn('git', cloneArgs, { stdio: 'pipe' });
      child.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`git clone failed with code ${code}`))
      );
      child.on('error', reject);
    });

    if (commit) {
      await new Promise((resolve, reject) => {
        const child = spawn('git', ['fetch', '--depth', '1', 'origin', commit], {
          cwd: functionDir,
          stdio: 'pipe',
        });
        child.on('close', () => {
          const checkout = spawn('git', ['checkout', commit], { cwd: functionDir, stdio: 'pipe' });
          checkout.on('close', (code) =>
            code === 0 ? resolve() : reject(new Error(`git checkout failed with code ${code}`))
          );
          checkout.on('error', reject);
        });
        child.on('error', reject);
      });
    }

    // Load the function
    const success = await loadFunction(functionDir);

    if (success) {
      io.emit('function:deployed', { name, status: 'running' });

      res.json({
        message: 'Function deployed from Git successfully',
        function: { name, status: 'running' },
      });
    } else {
      res.status(500).json({ message: 'Failed to deploy function from Git' });
    }
  } catch (error) {
    logger.error(`Git deployment error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Failed to deploy from Git repository' });
  }
});

// Get function logs
app.get('/api/functions/:name/logs', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { limit = 100, type = 'all' } = req.query;

    // Use the logger to get function-specific logs
    const functionLogger = new Logger({ functionName: name });

    let logs = [];

    if (type === 'error' || type === 'all') {
      const errorLogs = await functionLogger.getFunctionErrorLogs(name, parseInt(limit));
      if (!errorLogs.error) {
        logs = logs.concat(
          errorLogs.lines
            .map((line) => {
              let entry;
              try {
                entry = JSON.parse(line);
              } catch {
                entry = { message: line, level: 'ERROR', timestamp: new Date().toISOString() };
              }
              // Only include if level is ERROR
              if (entry.level === 'ERROR') return entry;
              return null;
            })
            .filter(Boolean)
        );
      }
    }

    if (
      type === 'all' ||
      type === 'ACCESS' ||
      type === 'INFO' ||
      type === 'WARN' ||
      type === 'ERROR'
    ) {
      const mainLogs = await functionLogger.getFunctionLogs(name, parseInt(limit));
      if (!mainLogs.error) {
        logs = logs.concat(
          mainLogs.lines
            .map((line) => {
              let entry;
              try {
                entry = JSON.parse(line);
              } catch {
                entry = { message: line, level: 'INFO', timestamp: new Date().toISOString() };
              }
              // If a specific type is requested, filter by that level
              if (type !== 'all' && entry.level !== type) return null;
              return entry;
            })
            .filter(Boolean)
        );
      }
    }

    // Sort by timestamp (newest first) and limit
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    logs = logs.slice(0, parseInt(limit));

    res.json({ logs });
  } catch (error) {
    logger.error(`Get function logs error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get function metrics
app.get('/api/functions/:name/metrics', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const func = loadedFunctions.get(name);

    if (!func) {
      return res.status(404).json({ message: 'Function not found' });
    }

    // Count invocations from function log file
    let invocations = 0;
    try {
      const Logger = (await import('./utils/logger.js')).default;
      const logger = new Logger({ functionName: name });
      const logResult = await logger.getFunctionLogs(name, 10000); // Read up to 10k lines
      if (!logResult.error) {
        for (const line of logResult.lines) {
          let entry;
          if (typeof line === 'object' && line !== null) {
            entry = line;
          } else {
            try {
              entry = JSON.parse(line);
            } catch {
              continue;
            }
          }
          if (
            entry &&
            entry.level === 'ACCESS' &&
            typeof entry.method === 'string' &&
            ['GET', 'POST', 'PUT', 'DELETE'].includes(entry.method.toUpperCase())
          ) {
            invocations++;
          }
        }
      }
    } catch {
      // If log file missing or unreadable, invocations = 0
    }

    // Mock other metrics for now
    const metrics = {
      name,
      invocations,
      errors: 0,
      avgResponseTime: 0,
      lastInvocation: null,
      routes: func.routes || [],
      cronJobs: activeCronJobs.has(name) ? activeCronJobs.get(name).length : 0,
    };

    res.json(metrics);
  } catch (error) {
    logger.error(`Get function metrics error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Test function
app.post('/api/functions/:name/test', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { method = 'GET', path = '/', data, headers = {} } = req.body;

    const func = loadedFunctions.get(name);
    if (!func) {
      return res.status(404).json({ message: 'Function not found' });
    }

    // Create a mock request object
    const mockReq = {
      method: method.toUpperCase(),
      url: path,
      body: data,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      params: {},
      query: {},
    };

    // Create a mock response object
    const mockRes = {
      statusCode: 200,
      headers: {},
      body: null,
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        this.body = data;
        return this;
      },
      send: function (data) {
        this.body = data;
        return this;
      },
      text: function (data) {
        this.body = data;
        return this;
      },
      header: function (key, value) {
        this.headers[key] = value;
        return this;
      },
      setHeader: function (key, value) {
        this.headers[key] = value;
        return this;
      },
      getHeader: function (key) {
        return this.headers[key];
      },
      end: function () {
        return this;
      },
    };

    // Try to execute the function
    try {
      const handlerPath = path.join(func.path, func.handler || 'handler.js');
      const handler = await import(`${handlerPath}?update=${Date.now()}`);

      if (handler.default) {
        await handler.default(mockReq, mockRes);
      } else {
        throw new Error('Handler does not export a default function');
      }

      res.json({
        success: true,
        statusCode: mockRes.statusCode,
        response: mockRes.body,
        headers: mockRes.headers,
      });
    } catch (error) {
      res.json({
        success: false,
        error: error.message,
        statusCode: 500,
      });
    }
  } catch (error) {
    logger.error(`Test function error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get system logs
app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const logResult = await logger.getRecentLogs(parseInt(limit));

    // Transform the log lines into the expected format
    const logs = logResult.lines
      ? logResult.lines.map((line) => {
          try {
            // Parse the JSON log entry
            const logEntry = JSON.parse(line);
            return {
              timestamp: logEntry.timestamp,
              message: logEntry.message,
              level: logEntry.level,
              function: logEntry.function || null,
            };
          } catch {
            // If parsing fails, return a simple object with the raw line
            return {
              timestamp: new Date().toISOString(),
              message: line,
              level: 'info',
              function: null,
            };
          }
        })
      : [];

    res.json({ logs });
  } catch (error) {
    logger.error(`Get system logs error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all function log files
app.get('/api/logs/functions', authenticateToken, async (req, res) => {
  try {
    const functionLogs = await logger.getFunctionLogFiles();
    res.json(functionLogs);
  } catch (error) {
    logger.error(`Get function logs error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get system metrics
app.get('/api/metrics', authenticateToken, async (req, res) => {
  try {
    const metrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      functions: loadedFunctions.size,
      activeRoutes: registeredRoutes.size,
      activeCronJobs: Array.from(activeCronJobs.values()).flat().length,
      timestamp: new Date().toISOString(),
    };

    res.json(metrics);
  } catch (error) {
    logger.error(`Get system metrics error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get function cron jobs
app.get('/api/functions/:name/cron', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const func = loadedFunctions.get(name);

    if (!func) {
      return res.status(404).json({ message: 'Function not found' });
    }

    const cronJobsPath = path.join(func.path, 'cron.json');
    let jobs = [];

    try {
      const cronContent = await fs.readFile(cronJobsPath, 'utf-8');
      const cronData = JSON.parse(cronContent);
      jobs = cronData.jobs || [];
    } catch {
      // cron.json doesn't exist or is invalid, return empty array
      logger.info(`No cron.json found for function ${name}`);
    }

    res.json({ jobs });
  } catch (error) {
    logger.error(`Get function cron jobs error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update function cron jobs
app.put('/api/functions/:name/cron', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { jobs } = req.body;

    const func = loadedFunctions.get(name);
    if (!func) {
      return res.status(404).json({ message: 'Function not found' });
    }

    if (!Array.isArray(jobs)) {
      return res.status(400).json({ message: 'Jobs must be an array' });
    }

    // Validate cron jobs
    for (const job of jobs) {
      if (!job.name || !job.schedule || !job.handler) {
        return res.status(400).json({
          message: 'Each job must have name, schedule, and handler fields',
        });
      }
    }

    const cronJobsPath = path.join(func.path, 'cron.json');
    const cronData = { jobs };

    await fs.writeFile(cronJobsPath, JSON.stringify(cronData, null, 2));

    // Reload cron jobs for this function
    await loadCronJobs(func.path);

    logger.info(`Updated cron jobs for function ${name}`);
    res.json({ message: 'Cron jobs updated successfully', jobs });
  } catch (error) {
    logger.error(`Update function cron jobs error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get function files
app.get('/api/functions/:name/files', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const func = loadedFunctions.get(name);

    if (!func) {
      return res.status(404).json({ message: 'Function not found' });
    }

    const buildFileTree = async (dirPath, relativePath = '') => {
      const items = [];
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const itemPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

        if (entry.isDirectory()) {
          // Skip node_modules and other system directories
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name.startsWith('.')
          ) {
            continue;
          }

          const children = await buildFileTree(fullPath, itemPath);
          if (children.length > 0) {
            items.push({
              name: entry.name,
              path: itemPath,
              type: 'directory',
              children,
            });
          }
        } else {
          items.push({
            name: entry.name,
            path: itemPath,
            type: 'file',
            size: (await fs.stat(fullPath)).size,
          });
        }
      }

      return items.sort((a, b) => {
        // Directories first, then files
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    };

    const files = await buildFileTree(func.path);
    res.json({ files });
  } catch (error) {
    logger.error(`Get function files error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get file content
app.get('/api/functions/:name/files/content', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { path: filePath } = req.query;

    if (!filePath || !validateFilePath(filePath)) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    const func = loadedFunctions.get(name);
    if (!func) {
      return res.status(404).json({ message: 'Function not found' });
    }

    const fullPath = path.join(func.path, filePath);

    // Security check: ensure the file is within the function directory
    const normalizedFullPath = path.resolve(fullPath);
    const normalizedFuncPath = path.resolve(func.path);

    if (!normalizedFullPath.startsWith(normalizedFuncPath)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      res.json({ content });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ message: 'File not found' });
      }
      throw error;
    }
  } catch (error) {
    logger.error(`Get file content error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Download file
app.get('/api/functions/:name/files/download', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { path: filePath } = req.query;

    if (!filePath || !validateFilePath(filePath)) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    const func = loadedFunctions.get(name);
    if (!func) {
      return res.status(404).json({ message: 'Function not found' });
    }

    const fullPath = path.join(func.path, filePath);

    // Security check: ensure the file is within the function directory
    const normalizedFullPath = path.resolve(fullPath);
    const normalizedFuncPath = path.resolve(func.path);

    if (!normalizedFullPath.startsWith(normalizedFuncPath)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    try {
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        return res.status(400).json({ message: 'Cannot download directory' });
      }

      res.download(fullPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ message: 'File not found' });
      }
      throw error;
    }
  } catch (error) {
    logger.error(`Download file error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Serve dashboard at root
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Global error handler
app.use((err, req, res, _next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  });
});

// Load all layers
const loadAllLayers = async () => {
  const layersDir = path.join(__dirname, 'layers');
  const layers = await layerLoader.loadAllLayers(layersDir, logger);

  // Update global loadedLayers map
  for (const [name, layer] of layers.entries()) {
    loadedLayers.set(name, layer);
  }

  logger.info(`Loaded ${layers.size} layers`);
  return layers;
};

const invokeFunctionAPI = async (functionName, options = {}) => {
  const funcInfo = loadedFunctions.get(functionName);
  if (!funcInfo) {
    throw new Error(`Function '${functionName}' not found`);
  }

  const { method = 'GET', routePath = '/', body = {}, query = {}, params = {} } = options;

  const functionLogger = new Logger({
    logLevel: process.env.LOG_LEVEL || 'info',
    logToFile: true,
    logToConsole: true,
    functionName,
  });

  const req = {
    method,
    body,
    query,
    params,
    headers: { 'content-type': 'application/json', 'user-agent': 'mcp-client' },
    ip: '127.0.0.1',
    functionName,
    functionPath: funcInfo.path,
    routePath,
    routeHandler: 'handler',
    logger: functionLogger,
    env: funcInfo.envVars || {},
    originalUrl: routePath,
    url: routePath,
  };

  let responseStatus = 200;
  let responseData = null;

  const res = {
    statusCode: 200,
    status(code) {
      responseStatus = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    send(data) {
      responseData = data;
      return res;
    },
    text(data) {
      responseData = data;
      return res;
    },
    header() {
      return res;
    },
    setHeader() {
      return res;
    },
    getHeader() {
      return undefined;
    },
    end() {
      return res;
    },
    headersSent: false,
  };

  const routeMatch = funcInfo.routes?.find((r) => {
    const rp = r.path.startsWith('/') ? r.path : `/${r.path}`;
    return rp === routePath || rp === routePath.replace(/^\/+/, '');
  });

  if (!routeMatch) {
    throw new Error(`Route '${routePath}' not found for function '${functionName}'`);
  }

  const handlerFileName = routeMatch.handler || funcInfo.config?.handler || 'handler.js';
  let handlerFilePath = path.join(funcInfo.path, handlerFileName);

  try {
    await import(handlerFilePath);
  } catch {
    if (handlerFileName.endsWith('.js')) {
      handlerFilePath = path.join(funcInfo.path, handlerFileName.replace('.js', '.ts'));
    }
  }

  const handlerModule = await import(`${handlerFilePath}?update=${Date.now()}`);
  const handler = handlerModule.default;

  if (typeof handler !== 'function') {
    throw new Error(`Handler in ${handlerFileName} must export a default function`);
  }

  await handler(req, res);

  return {
    status: responseStatus,
    data: responseData,
  };
};

// Initialize the server
const initializeServer = async () => {
  logger.info('Initializing FuncDock Platform...');

  // Initialize OpenTelemetry
  initTracer();

  // Load all layers first
  await loadAllLayers();

  // Load all functions
  await loadAllFunctions();

  // Start MCP server if enabled
  if (MCP_ENABLED) {
    try {
      mcpServer = new FuncDockMCPServer({
        loadedFunctions,
        registeredRoutes,
        invokeFunction: invokeFunctionAPI,
      });
      mcpServer.runHTTP(MCP_HTTP_PORT);
      logger.info(`🔌 MCP server running on http://localhost:${MCP_HTTP_PORT}`);
    } catch (error) {
      logger.error(`Failed to start MCP server: ${error.message}`, { stack: error.stack });
    }
  }

  // Register function dispatcher AFTER all API routes to prevent hijacking
  app.use(functionDispatcherMiddleware);

  // Register catch-all route after functions are loaded
  app.use('*', (req, res) => {
    // Don't serve React app for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        error: 'Route not found',
        method: req.method,
        path: req.path,
        availableRoutes: Array.from(registeredRoutes.keys()),
        timestamp: new Date().toISOString(),
      });
    }

    // Function routes should be handled by their respective handlers
    // If we reach here, it means no function route matched

    // Serve React app for all other routes
    res.sendFile(path.join(__dirname, 'public/dashboard/index.html'));
  });

  // Set up file watching
  const watcher = setupFileWatcher();

  // Start server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    logger.info(`🚀 FuncDock platform running on http://localhost:${PORT}`);
    logger.info(`📊 Management API available at http://localhost:${PORT}/api/status`);
    logger.info(`🔄 Hot reload enabled - watching for changes...`);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    if (watcher && typeof watcher.close === 'function') {
      watcher.close();
    }

    // Stop all cron jobs
    for (const [functionName] of activeCronJobs.entries()) {
      stopCronJobs(functionName);
    }

    // Stop MCP server if running
    if (mcpServer && typeof mcpServer.stop === 'function') {
      try {
        await mcpServer.stop();
        logger.info('MCP server stopped');
      } catch (err) {
        logger.error(`Error stopping MCP server: ${err.message}`);
      }
    }

    shutdownTracer();

    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  // Attempt graceful shutdown
  server.close(() => {
    logger.info('Server closed after uncaught exception');
    shutdownTracer();
    process.exit(1);
  });
  // Force exit after 5s if graceful shutdown hangs
  setTimeout(() => {
    process.exit(1);
  }, 5000);
});

// Start the server
initializeServer().catch((error) => {
  logger.error(`Failed to initialize server: ${error.message}`, { stack: error.stack });
  process.exit(1);
});

// Cron job management
const loadCronJobs = async (functionDir) => {
  const functionName = path.basename(functionDir);

  // Check if cron.json exists BEFORE creating any paths or doing anything else
  const cronConfigPath = path.join(functionDir, 'cron.json');

  try {
    await fs.access(cronConfigPath);
    // File exists, proceed to read it
  } catch {
    // File doesn't exist, this is normal - return silently
    return true;
  }

  // Only proceed if the file actually exists
  let cronConfigRaw;
  try {
    cronConfigRaw = await fs.readFile(cronConfigPath, 'utf-8');
  } catch {
    // File exists but can't be read - still don't log anything
    return true;
  }

  let cronConfig;
  try {
    cronConfig = JSON.parse(cronConfigRaw);
  } catch (parseError) {
    logger.warn(`Invalid cron.json for function ${functionName}: ${parseError.message}`);
    return true;
  }

  // Validate cron config
  if (!cronConfig.jobs || !Array.isArray(cronConfig.jobs)) {
    return true;
  }

  // Stop existing cron jobs for this function
  stopCronJobs(functionName);

  const functionCronJobs = [];

  for (const job of cronConfig.jobs) {
    // Validate job config
    if (!job.schedule || !job.handler) {
      continue;
    }

    // Validate cron schedule
    if (!cron.validate(job.schedule)) {
      continue;
    }

    // Determine handler path and check if it exists
    const handlerPath = path.join(functionDir, job.handler);
    try {
      await fs.access(handlerPath);
    } catch {
      // Handler doesn't exist, skip this job
      continue;
    }

    // Import handler once at schedule time (file watcher will reload on changes)
    let handlerFunction;
    try {
      const handlerModule = await import(`${handlerPath}?update=${Date.now()}`);
      handlerFunction = handlerModule.default;
      if (typeof handlerFunction !== 'function') {
        logger.warn(
          `Cron handler ${job.handler} for ${functionName} does not export a default function`
        );
        continue;
      }
    } catch (importErr) {
      logger.warn(
        `Failed to import cron handler ${job.handler} for ${functionName}: ${importErr.message}`
      );
      continue;
    }

    // Cache logger per function for cron jobs
    let cronLogger = functionLoggers.get(functionName);
    if (!cronLogger) {
      cronLogger = new Logger({
        logLevel: process.env.LOG_LEVEL || 'info',
        logToFile: true,
        logToConsole: true,
        functionName: functionName,
      });
      functionLoggers.set(functionName, cronLogger);
    }

    // Register the cron job
    const cronJob = cron.schedule(job.schedule, async () => {
      try {
        const functionInfo = loadedFunctions.get(functionName);
        // Log CRON invocation (start)
        cronLogger.log('CRON', 'CRON job started', {
          function: functionName,
          job: job.name,
          schedule: job.schedule,
          timestamp: new Date().toISOString(),
        });
        const req = {
          functionName,
          functionPath: functionDir,
          jobName: job.name,
          logger: cronLogger,
          env: functionInfo ? functionInfo.envVars : {},
        };
        try {
          await handlerFunction(req);
          // Log CRON completion
          cronLogger.log('CRON', 'CRON job completed', {
            function: functionName,
            job: job.name,
            schedule: job.schedule,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          // Always log as CRON_ERROR for any error thrown by a cron handler
          cronLogger.log(
            'CRON_ERROR',
            `Error in ${functionName}/${job.handler}: ${err && err.message ? err.message : err}`,
            {
              function: functionName,
              job: job.name,
              schedule: job.schedule,
              timestamp: new Date().toISOString(),
            }
          );
        }
      } catch (err) {
        logger.error(`Unhandled error in cron job ${functionName}/${job.name}: ${err.message}`, {
          stack: err.stack,
        });
      }
    });
    functionCronJobs.push(cronJob);
  }

  // Store cron jobs
  activeCronJobs.set(functionName, functionCronJobs);
  return true;
};

// Stop all cron jobs for a function
const stopCronJobs = (functionName) => {
  if (activeCronJobs.has(functionName)) {
    const functionCronJobs = activeCronJobs.get(functionName);
    functionCronJobs.forEach((cronJob) => cronJob.stop());
    activeCronJobs.delete(functionName);
    logger.info(`Stopped all cron jobs for ${functionName}`);
  }
};

// Get cron jobs status
const _getCronJobsStatus = () => {
  const status = Array.from(activeCronJobs.entries()).map(([name, jobs]) => ({
    name,
    jobs: jobs.map((job) => ({
      name: job.name,
      schedule: job.schedule,
      handler: job.handler,
      timezone: job.timezone,
    })),
  }));

  return status;
};

// Dashboard API routes
app.get('/api/functions/:name/env', authenticateToken, async (req, res) => {
  const { name } = req.params;
  const func = loadedFunctions.get(name);
  if (!func) {
    return res.status(404).json({ message: 'Function not found' });
  }
  try {
    const envVars = await loadFunctionEnv(func.path);
    res.json({ env: envVars });
  } catch (error) {
    logger.error(`Failed to load env for function ${name}: ${error.message}`, {
      stack: error.stack,
    });
    res.status(500).json({ message: 'Failed to load environment variables' });
  }
});

// Set/update function's layer association
app.put('/api/functions/:name/layer', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { layer } = req.body;

    const func = loadedFunctions.get(name);
    if (!func) {
      return res.status(404).json({ message: 'Function not found' });
    }

    // Validate layer exists if provided
    if (layer) {
      const layerObj = loadedLayers.get(layer);
      if (!layerObj) {
        return res.status(404).json({ message: `Layer '${layer}' not found` });
      }
    }

    // Write or update layers.json
    const layersJsonPath = path.join(func.path, 'layers.json');
    if (layer) {
      // Set layer - write as string directly for consistency with readFunctionLayers support
      await fs.writeFile(layersJsonPath, JSON.stringify(layer), 'utf-8');
    } else {
      // Remove layer association
      try {
        await fs.unlink(layersJsonPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // File doesn't exist, that's fine
      }
    }

    // Reload the function to apply changes
    const success = await loadFunction(func.path);

    if (success) {
      res.json({
        message: layer ? `Layer '${layer}' associated with function` : 'Layer association removed',
        layer: layer || null,
      });
    } else {
      res.status(500).json({ message: 'Failed to reload function after layer change' });
    }
  } catch (error) {
    logger.error(`Set function layer error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Remove function's layer association
app.delete('/api/functions/:name/layer', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;

    const func = loadedFunctions.get(name);
    if (!func) {
      return res.status(404).json({ message: 'Function not found' });
    }

    // Remove layers.json
    const layersJsonPath = path.join(func.path, 'layers.json');
    try {
      await fs.unlink(layersJsonPath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, that's fine
    }

    // Reload the function to apply changes
    const success = await loadFunction(func.path);

    if (success) {
      res.json({ message: 'Layer association removed' });
    } else {
      res.status(500).json({ message: 'Failed to reload function after layer removal' });
    }
  } catch (error) {
    logger.error(`Remove function layer error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== Layer Management API ====================

// Get all layers
app.get('/api/layers', authenticateToken, (req, res) => {
  const layers = Array.from(loadedLayers.values()).map((layer) => ({
    name: layer.name,
    version: layer.config.version || '1.0.0',
    description: layer.config.description || '',
    status: layer.status,
    loadedAt: layer.loadedAt,
    functionsUsing: Array.from(layerToFunctions.get(layer.name) || []),
  }));

  res.json({ layers });
});

// Get layer details
app.get('/api/layers/:name', authenticateToken, async (req, res) => {
  const { name } = req.params;
  const layer = loadedLayers.get(name);

  if (!layer) {
    return res.status(404).json({ message: 'Layer not found' });
  }

  const functionsUsing = Array.from(layerToFunctions.get(name) || []);

  res.json({
    name: layer.name,
    version: layer.config.version || '1.0.0',
    description: layer.config.description || '',
    status: layer.status,
    loadedAt: layer.loadedAt,
    path: layer.path,
    nodejsPath: layer.nodejsPath,
    functionsUsing,
    config: layer.config,
  });
});

// Get layer files
app.get('/api/layers/:name/files', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const layer = loadedLayers.get(name);

    if (!layer) {
      return res.status(404).json({ message: 'Layer not found' });
    }

    const buildFileTree = async (dirPath, relativePath = '') => {
      const items = [];
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const itemPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

        if (entry.isDirectory()) {
          // Skip node_modules and other system directories
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name.startsWith('.')
          ) {
            continue;
          }

          const children = await buildFileTree(fullPath, itemPath);
          if (children.length > 0) {
            items.push({
              name: entry.name,
              path: itemPath,
              type: 'directory',
              children,
            });
          }
        } else {
          items.push({
            name: entry.name,
            path: itemPath,
            type: 'file',
            size: (await fs.stat(fullPath)).size,
          });
        }
      }

      return items.sort((a, b) => {
        // Directories first, then files
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    };

    const files = await buildFileTree(layer.nodejsPath);
    res.json({ files });
  } catch (error) {
    logger.error(`Get layer files error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get layer file content
app.get('/api/layers/:name/files/content', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { path: filePath } = req.query;

    if (!filePath || !validateFilePath(filePath)) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    const layer = loadedLayers.get(name);
    if (!layer) {
      return res.status(404).json({ message: 'Layer not found' });
    }

    const fullPath = path.join(layer.nodejsPath, filePath);

    // Security check: ensure the file is within the layer nodejs directory
    const normalizedFullPath = path.resolve(fullPath);
    const normalizedLayerPath = path.resolve(layer.nodejsPath);

    if (!normalizedFullPath.startsWith(normalizedLayerPath)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      res.json({ content });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ message: 'File not found' });
      }
      throw error;
    }
  } catch (error) {
    logger.error(`Get layer file content error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Download layer file
app.get('/api/layers/:name/files/download', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { path: filePath } = req.query;

    if (!filePath || !validateFilePath(filePath)) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    const layer = loadedLayers.get(name);
    if (!layer) {
      return res.status(404).json({ message: 'Layer not found' });
    }

    const fullPath = path.join(layer.nodejsPath, filePath);

    // Security check: ensure the file is within the layer nodejs directory
    const normalizedFullPath = path.resolve(fullPath);
    const normalizedLayerPath = path.resolve(layer.nodejsPath);

    if (!normalizedFullPath.startsWith(normalizedLayerPath)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    try {
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        return res.status(400).json({ message: 'Cannot download directory' });
      }

      res.download(fullPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ message: 'File not found' });
      }
      throw error;
    }
  } catch (error) {
    logger.error(`Download layer file error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Deploy layer from local files
app.post('/api/layers/deploy/local', authenticateToken, upload.array('files'), async (req, res) => {
  const files = req.files;
  try {
    const { name } = req.body;

    if (!name || !files || files.length === 0) {
      return res.status(400).json({ message: 'Layer name and files are required' });
    }

    // Validate layer name
    if (!validateLayerName(name)) {
      return res.status(400).json({
        message: 'Invalid layer name. Use only alphanumeric characters, hyphens, and underscores.',
      });
    }

    // Check if layer already exists
    if (loadedLayers.has(name)) {
      return res.status(409).json({
        message: `Layer '${name}' already exists. Use PUT /api/layers/${name} to update it.`,
      });
    }

    // Create layer directory structure
    const layerDir = path.join(__dirname, 'layers', name);
    const nodejsDir = path.join(layerDir, 'nodejs');
    await fs.mkdir(nodejsDir, { recursive: true });

    // Move uploaded files to layer nodejs directory
    for (const file of files) {
      const safeFileName = path.basename(file.originalname);
      const destPath = path.join(nodejsDir, safeFileName);
      const resolvedDest = path.resolve(destPath);
      if (!resolvedDest.startsWith(path.resolve(nodejsDir))) {
        return res.status(400).json({ message: 'Invalid file path' });
      }
      await fs.rename(file.path, destPath);
    }

    // Load the layer
    const layers = await layerLoader.loadAllLayers(path.join(__dirname, 'layers'), logger);
    for (const [layerName, layer] of layers.entries()) {
      loadedLayers.set(layerName, layer);
    }

    // Reload functions that use this layer
    const functionsUsingLayer = layerToFunctions.get(name);
    if (functionsUsingLayer) {
      for (const functionName of functionsUsingLayer) {
        const functionPath = path.join(__dirname, 'functions', functionName);
        await loadFunction(functionPath);
      }
    }

    // Emit socket event
    io.emit('layer:deployed', { name, status: 'loaded' });

    res.json({
      message: 'Layer deployed successfully',
      layer: { name, status: 'loaded' },
    });
  } catch (error) {
    logger.error(`Layer deployment error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await cleanupTempFiles(files);
  }
});

// Deploy layer from Git
app.post('/api/layers/deploy/git', authenticateToken, async (req, res) => {
  try {
    const { name, repo, branch = 'main', commit } = req.body;

    if (!name || !repo) {
      return res.status(400).json({ message: 'Layer name and repository URL are required' });
    }

    if (!validateLayerName(name)) {
      return res.status(400).json({
        message: 'Invalid layer name. Use only alphanumeric characters, hyphens, and underscores.',
      });
    }

    if (!validateGitUrl(repo)) {
      return res
        .status(400)
        .json({ message: 'Invalid repository URL. Use a valid HTTPS Git URL.' });
    }

    if (!validateBranchName(branch)) {
      return res.status(400).json({ message: 'Invalid branch name.' });
    }

    if (commit && !validateCommitSha(commit)) {
      return res.status(400).json({ message: 'Invalid commit SHA.' });
    }

    if (loadedLayers.has(name)) {
      return res.status(409).json({
        message: `Layer '${name}' already exists. Use PUT /api/layers/${name} to update it.`,
      });
    }

    const layerDir = path.join(__dirname, 'layers', name);

    try {
      const stats = await fs.stat(layerDir);
      if (stats.isDirectory()) {
        try {
          await fs.access(path.join(layerDir, '.git'));
          logger.info(`Layer directory ${name} already exists as git repo, pulling latest changes`);
          const { spawn } = await import('child_process');
          await new Promise((resolve, reject) => {
            const child = spawn('git', ['fetch', 'origin'], { cwd: layerDir, stdio: 'pipe' });
            child.on('close', (code) =>
              code === 0 ? resolve() : reject(new Error(`git fetch failed with code ${code}`))
            );
            child.on('error', reject);
          });
          if (commit) {
            await new Promise((resolve, reject) => {
              const child = spawn('git', ['checkout', commit], { cwd: layerDir, stdio: 'pipe' });
              child.on('close', (code) =>
                code === 0 ? resolve() : reject(new Error(`git checkout failed with code ${code}`))
              );
              child.on('error', reject);
            });
          } else {
            await new Promise((resolve, reject) => {
              const child = spawn('git', ['checkout', branch], { cwd: layerDir, stdio: 'pipe' });
              child.on('close', (code) =>
                code === 0 ? resolve() : reject(new Error(`git checkout failed with code ${code}`))
              );
              child.on('error', reject);
            });
          }
        } catch {
          logger.info(`Removing existing layer directory ${name} before cloning`);
          await fs.rm(layerDir, { recursive: true, force: true });
          await cloneGitRepo(repo, branch, commit, layerDir);
        }
      } else {
        await fs.rm(layerDir, { recursive: true, force: true });
        await cloneGitRepo(repo, branch, commit, layerDir);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        await cloneGitRepo(repo, branch, commit, layerDir);
      } else {
        throw error;
      }
    }

    const layers = await layerLoader.loadAllLayers(path.join(__dirname, 'layers'), logger);
    for (const [layerName, layer] of layers.entries()) {
      loadedLayers.set(layerName, layer);
    }

    const functionsUsingLayer = layerToFunctions.get(name);
    if (functionsUsingLayer) {
      for (const functionName of functionsUsingLayer) {
        const functionPath = path.join(__dirname, 'functions', functionName);
        await loadFunction(functionPath);
      }
    }

    io.emit('layer:deployed', { name, status: 'loaded' });

    res.json({
      message: 'Layer deployed from Git successfully',
      layer: { name, status: 'loaded' },
    });
  } catch (error) {
    logger.error(`Git layer deployment error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Failed to deploy from Git repository' });
  }
});

async function cloneGitRepo(repo, branch, commit, targetDir) {
  const { spawn } = await import('child_process');

  const cloneArgs = ['clone', '--depth', '1'];
  if (branch && branch !== 'main') {
    cloneArgs.push('-b', branch);
  }
  cloneArgs.push(repo, targetDir);

  await new Promise((resolve, reject) => {
    const child = spawn('git', cloneArgs, { stdio: 'pipe' });
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`git clone failed with code ${code}`))
    );
    child.on('error', reject);
  });

  if (commit) {
    await new Promise((resolve, reject) => {
      const child = spawn('git', ['fetch', '--depth', '1', 'origin', commit, ':' + commit], {
        cwd: targetDir,
        stdio: 'pipe',
      });
      child.on('close', () => {
        const checkout = spawn('git', ['checkout', commit], { cwd: targetDir, stdio: 'pipe' });
        checkout.on('close', (code) =>
          code === 0 ? resolve() : reject(new Error(`git checkout failed with code ${code}`))
        );
        checkout.on('error', reject);
      });
      child.on('error', reject);
    });
  }
}

// Update layer
app.put('/api/layers/:name', authenticateToken, upload.array('files'), async (req, res) => {
  const files = req.files;
  try {
    const { name } = req.params;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'Files are required' });
    }

    const layer = loadedLayers.get(name);
    if (!layer) {
      return res.status(404).json({ message: 'Layer not found' });
    }

    const nodejsDir = path.join(layer.path, 'nodejs');

    // Move uploaded files to layer nodejs directory
    for (const file of files) {
      const safeFileName = path.basename(file.originalname);
      const destPath = path.join(nodejsDir, safeFileName);
      const resolvedDest = path.resolve(destPath);
      if (!resolvedDest.startsWith(path.resolve(nodejsDir))) {
        return res.status(400).json({ message: 'Invalid file path' });
      }
      await fs.rename(file.path, destPath);
    }

    // Reload the layer
    const reloadedLayer = await layerLoader.loadLayer(layer.path, logger);
    loadedLayers.set(name, reloadedLayer);

    // Reload functions that use this layer
    const functionsUsingLayer = layerToFunctions.get(name);
    if (functionsUsingLayer) {
      for (const functionName of functionsUsingLayer) {
        const functionPath = path.join(__dirname, 'functions', functionName);
        await loadFunction(functionPath);
      }
    }

    // Emit socket event
    io.emit('layer:updated', { name, status: 'loaded' });

    res.json({
      message: 'Layer updated successfully',
      layer: { name, status: 'loaded' },
    });
  } catch (error) {
    logger.error(`Update layer error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await cleanupTempFiles(files);
  }
});

// Reload a specific layer
app.post('/api/layers/:name/reload', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;

    const layer = loadedLayers.get(name);
    if (!layer) {
      return res.status(404).json({ message: 'Layer not found' });
    }

    // Reload the layer
    const reloadedLayer = await layerLoader.loadLayer(layer.path, logger);
    loadedLayers.set(name, reloadedLayer);

    // Reload all functions that use this layer
    const functionsUsingLayer = layerToFunctions.get(name);
    if (functionsUsingLayer) {
      logger.info(`Reloading ${functionsUsingLayer.size} function(s) using layer ${name}`);
      for (const functionName of functionsUsingLayer) {
        const functionPath = path.join(__dirname, 'functions', functionName);
        await loadFunction(functionPath);
      }
    }

    // Emit socket event
    io.emit('layer:updated', { name, status: 'loaded' });

    res.json({
      message: 'Layer reloaded successfully',
      layer: { name, status: 'loaded' },
    });
  } catch (error) {
    logger.error(`Reload layer error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reload all layers
app.post('/api/layers/reload', authenticateToken, async (req, res) => {
  try {
    const layersDir = path.join(__dirname, 'layers');
    const layers = await layerLoader.loadAllLayers(layersDir, logger);

    // Update global loadedLayers map
    for (const [layerName, layer] of layers.entries()) {
      loadedLayers.set(layerName, layer);
    }

    // Reload all functions that use any layer
    const allFunctionNames = new Set();
    for (const [layerName] of layers.entries()) {
      const functionsUsingLayer = layerToFunctions.get(layerName);
      if (functionsUsingLayer) {
        functionsUsingLayer.forEach((funcName) => allFunctionNames.add(funcName));
      }
    }

    for (const functionName of allFunctionNames) {
      const functionPath = path.join(__dirname, 'functions', functionName);
      await loadFunction(functionPath);
    }

    res.json({
      message: 'All layers reloaded successfully',
      layersReloaded: layers.size,
      functionsReloaded: allFunctionNames.size,
    });
  } catch (error) {
    logger.error(`Reload all layers error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update layer file content
app.put('/api/layers/:name/files', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { path: filePath, content } = req.body;

    if (!filePath || content === undefined || !validateFilePath(filePath)) {
      return res.status(400).json({ message: 'Invalid file path or missing content' });
    }

    const layer = loadedLayers.get(name);
    if (!layer) {
      return res.status(404).json({ message: 'Layer not found' });
    }

    const fullPath = path.join(layer.nodejsPath, filePath);

    // Security check: ensure the file is within the layer nodejs directory
    const normalizedFullPath = path.resolve(fullPath);
    const normalizedLayerPath = path.resolve(layer.nodejsPath);

    if (!normalizedFullPath.startsWith(normalizedLayerPath)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(fullPath);
    await fs.mkdir(parentDir, { recursive: true });

    // Read original file content for potential rollback
    let originalContent = null;
    try {
      originalContent = await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      // File doesn't exist yet, that's fine
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Write file content
    await fs.writeFile(fullPath, content, 'utf-8');

    try {
      // Reload the layer
      const reloadedLayer = await layerLoader.loadLayer(layer.path, logger);
      loadedLayers.set(name, reloadedLayer);

      // Reload functions that use this layer
      const functionsUsingLayer = layerToFunctions.get(name);
      if (functionsUsingLayer) {
        for (const functionName of functionsUsingLayer) {
          const functionPath = path.join(__dirname, 'functions', functionName);
          await loadFunction(functionPath);
        }
      }

      // Emit socket event
      io.emit('layer:updated', { name, status: 'loaded' });

      res.json({ message: 'Layer file updated successfully' });
    } catch (reloadError) {
      // Rollback file content if layer reload fails
      logger.error(`Layer reload failed after file update, rolling back: ${reloadError.message}`, {
        stack: reloadError.stack,
      });
      try {
        if (originalContent !== null) {
          await fs.writeFile(fullPath, originalContent, 'utf-8');
          logger.info(`Rolled back file ${filePath} to original content`);
        } else {
          // File was new, delete it
          await fs.unlink(fullPath);
          logger.info(`Removed newly created file ${filePath} due to reload failure`);
        }
      } catch (rollbackError) {
        logger.error(`Failed to rollback file ${filePath}: ${rollbackError.message}`, {
          stack: rollbackError.stack,
        });
      }
      res.status(500).json({
        message: 'Failed to reload layer after file update',
        error: reloadError.message,
        details: 'File was rolled back to original state',
      });
      return;
    }
  } catch (error) {
    logger.error(`Update layer file error: ${error.message}`, { stack: error.stack });

    // Provide more detailed error messages
    let errorMessage = 'Internal server error';
    let statusCode = 500;

    if (error.code === 'ENOENT') {
      errorMessage = `File not found: ${error.message}`;
      statusCode = 404;
    } else if (error.code === 'EACCES' || error.code === 'EPERM') {
      errorMessage = `Permission denied: ${error.message}`;
      statusCode = 403;
    } else if (error.message.includes('Access denied')) {
      errorMessage = error.message;
      statusCode = 403;
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(statusCode).json({
      message: errorMessage,
      error: error.message,
    });
  }
});

// Delete layer
app.delete('/api/layers/:name', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;

    const layer = loadedLayers.get(name);
    if (!layer) {
      return res.status(404).json({ message: 'Layer not found' });
    }

    // Check if any functions are using this layer
    const functionsUsingLayer = layerToFunctions.get(name);
    if (functionsUsingLayer && functionsUsingLayer.size > 0) {
      return res.status(400).json({
        message: `Cannot delete layer: ${functionsUsingLayer.size} function(s) are using it`,
        functionsUsing: Array.from(functionsUsingLayer),
      });
    }

    // Remove layer directory
    await fs.rm(layer.path, { recursive: true, force: true });

    // Remove from loaded layers
    loadedLayers.delete(name);
    layerToFunctions.delete(name);

    // Emit socket event
    io.emit('layer:deleted', { name });

    res.json({ message: 'Layer deleted successfully' });
  } catch (error) {
    logger.error(`Delete layer error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Internal server error' });
  }
});

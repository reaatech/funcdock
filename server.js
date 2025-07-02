import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
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

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(compression());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Serve static files for dashboard with proper MIME types
app.use('/dashboard', express.static(path.join(__dirname, 'public/dashboard'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    }
  }
}));

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Socket.IO authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return next(new Error('Authentication error'));
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
const registeredRoutes = new Map();
const activeCronJobs = new Map(); // Track active cron jobs
const logger = new Logger();

// Helper function to clear module cache (ES modules don't have require.cache)
// ES modules are cached differently and the ?update= parameter handles cache busting
const clearModuleCache = (modulePath) => {
  delete require.cache[require.resolve(modulePath)];
};

// Load environment variables from function's .env file
const loadFunctionEnv = async (functionDir) => {
  const envPath = path.join(functionDir, '.env');
  
  try {
    await fs.access(envPath);
    const envContent = await fs.readFile(envPath, 'utf-8');
    const envVars = {};
    
    // Parse .env file content
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
          envVars[key.trim()] = value.trim();
        }
      }
    });
    
    logger.info(`Loaded ${Object.keys(envVars).length} environment variables for function ${path.basename(functionDir)}`);
    return envVars;
  } catch (error) {
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

    const { stdout, stderr } = await execAsync('npm install', {
      cwd: functionPath,
      timeout: 60000 // 1 minute timeout
    });

    if (stderr && !stderr.includes('npm WARN')) {
      logger.error(`Dependency installation warnings for ${path.basename(functionPath)}: ${stderr}`);
    }

    logger.info(`Dependencies installed for ${path.basename(functionPath)}`);
    return true;
  } catch (error) {
    logger.error(`Failed to install dependencies for ${path.basename(functionPath)}: ${error.message}`);
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

  routesToRemove.forEach(routeKey => {
    registeredRoutes.delete(routeKey);
    logger.info(`Unregistered route: ${routeKey}`);
  });

  // Remove from Express router stack
  app._router.stack = app._router.stack.filter(layer => {
    if (layer.route) {
      const routeKey = `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`;
      return !routesToRemove.includes(routeKey);
    }
    return true;
  });
};

// Load a single function
const loadFunction = async (functionDir) => {
  const functionName = path.basename(functionDir);
  const configPath = path.join(functionDir, 'route.config.json');

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

    // Determine handler path (default to handler.js, but allow custom path)
    const handlerPath = path.join(functionDir, config.handler || 'handler.js');
    
    // Check if handler file exists
    await fs.access(handlerPath);

    // Install dependencies if needed
    const depsInstalled = await installDependencies(functionDir);
    if (!depsInstalled) {
      logger.alert(`Skipping function ${functionName} due to dependency installation failure`);
      return false;
    }

    // Clear existing routes for this function
    if (loadedFunctions.has(functionName)) {
      unregisterFunctionRoutes(functionName);
    }

    // Import handler with cache busting
    const handlerModule = await import(`${handlerPath}?update=${Date.now()}`);
    const handler = handlerModule.default;

    if (typeof handler !== 'function') {
      throw new Error('Handler must export a default function');
    }

    // Register routes
    const functionRoutes = [];

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
          logger.alert(`Route conflict detected: ${routeKey} already registered by ${registeredRoutes.get(routeKey)}`);
          logger.error(`Failed to register ${functionName} due to route conflict`);
          return false;
        }

        // Determine handler for this specific route
        const routeHandler = route.handler || config.handler || 'handler.js';
        const routeHandlerPath = path.join(functionDir, routeHandler);
        
        // Load the specific handler for this route
        let routeHandlerFunction;
        try {
          const routeHandlerModule = await import(`${routeHandlerPath}?update=${Date.now()}`);
          routeHandlerFunction = routeHandlerModule.default;
          
          if (typeof routeHandlerFunction !== 'function') {
            throw new Error(`Handler in ${routeHandler} must export a default function`);
          }
        } catch (error) {
          logger.error(`Failed to load handler ${routeHandler} for route ${fullPath}: ${error.message}`);
          return false;
        }

        // Register the route
        const methodLower = method.toLowerCase();

        app[methodLower](fullPath, async (req, res) => {
          // Create function-specific logger
          const functionLogger = new Logger({
            logLevel: process.env.LOG_LEVEL || 'info',
            logToFile: true,
            logToConsole: true,
            functionName: functionName // Pass function name to logger
          });

          // Add function context to request
          req.functionName = functionName;
          req.functionPath = functionDir;
          req.routePath = route.path;
          req.routeHandler = routeHandler;
          req.logger = functionLogger; // Inject logger into request
          
          // Add function-specific environment variables
          const functionInfo = loadedFunctions.get(functionName);
          if (functionInfo && functionInfo.envVars) {
            req.env = functionInfo.envVars;
          }

          try {
            await routeHandlerFunction(req, res);
          } catch (err) {
            functionLogger.error(`Error in ${fullPath} (${functionName}/${routeHandler}): ${err.message}`);

            // Only send response if not already sent
            if (!res.headersSent) {
              res.status(500).json({
                error: "Internal Server Error",
                function: functionName,
                handler: routeHandler,
                route: route.path,
                timestamp: new Date().toISOString()
              });
            }
          }
        });

        registeredRoutes.set(routeKey, functionName);
        functionRoutes.push({ 
          method: method.toUpperCase(), 
          path: fullPath, 
          handler: routeHandler 
        });
        logger.info(`Registered ${method.toUpperCase()} ${fullPath} -> ${functionName}/${routeHandler}`);
      }
    }

    // Load cron jobs for this function
    try {
      await loadCronJobs(functionDir);
    } catch (error) {
      // Cron job loading errors are handled within loadCronJobs function
      // Only log if it's not a missing cron.json file
      if (error.code !== 'ENOENT') {
        logger.error(`Failed to load cron jobs for ${functionName}: ${error.message}`);
      }
    }

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
      status: 'running',
      path: functionDir,
      envVars
    });

    // Emit socket event for function loaded
    io.emit('function:loaded', { 
      name: functionName, 
      status: 'running',
      routes: functionRoutes.length,
      cronJobs: activeCronJobs.has(functionName) ? activeCronJobs.get(functionName).length : 0
    });

    logger.info(`Successfully loaded function: ${functionName} with ${functionRoutes.length} routes`);
    return true;

  } catch (error) {
    logger.error(`Failed to load function ${functionName}: ${error.message}`);
    return false;
  }
};

// Unload a function
const unloadFunction = (functionName) => {
  if (loadedFunctions.has(functionName)) {
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
    logger.error(`Error loading functions: ${error.message}`);
  }
};

// Set up file system watching
const setupFileWatcher = () => {
  const functionsDir = path.join(__dirname, 'functions');

  const watcher = chokidar.watch(functionsDir, {
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
      '**/node_modules/.staging/**'
    ],
    persistent: true,
    ignoreInitial: true,
    depth: 3
  });

  // Debounce function to avoid multiple rapid reloads
  const debounceReload = (() => {
    const timeouts = new Map();

    return (functionName, delay = 1000) => {
      if (timeouts.has(functionName)) {
        clearTimeout(timeouts.get(functionName));
      }

      timeouts.set(functionName, setTimeout(async () => {
        try {
          const functionPath = path.join(functionsDir, functionName);
          await loadFunction(functionPath);
        } catch (error) {
          logger.error(`Failed to reload function ${functionName}: ${error.message}`);
        } finally {
          timeouts.delete(functionName);
        }
      }, delay));
    };
  })();

  watcher
    .on('add', (filePath) => {
      const functionName = path.relative(functionsDir, filePath).split(path.sep)[0];
      logger.info(`File added: ${filePath}`);
      debounceReload(functionName);
    })
    .on('change', (filePath) => {
      const functionName = path.relative(functionsDir, filePath).split(path.sep)[0];
      logger.info(`File changed: ${filePath}`);
      debounceReload(functionName);
    })
    .on('unlink', async (filePath) => {
      const functionName = path.relative(functionsDir, filePath).split(path.sep)[0];
      logger.info(`File removed: ${filePath}`);

      // If it's a critical file, unload the function
      const fileName = path.basename(filePath);
      if (['route.config.json', 'cron.json'].includes(fileName)) {
        unloadFunction(functionName);
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
            unloadFunction(functionName);
          }
        } catch (error) {
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
    .on('unlinkDir', (dirPath) => {
      const relativePath = path.relative(functionsDir, dirPath);
      if (!relativePath.includes(path.sep)) {
        // Function directory was removed
        logger.info(`Function directory removed: ${relativePath}`);
        unloadFunction(relativePath);
      }
    });

  logger.info('File system watcher initialized');
  return watcher;
};

// API endpoints for management
app.get('/api/status', (req, res) => {
  const functions = Array.from(loadedFunctions.entries()).map(([name, info]) => ({
    name,
    routes: info.routes,
    loadedAt: info.loadedAt,
    routeCount: info.routes.length,
    cronJobs: activeCronJobs.get(name)?.map(job => ({
      name: job.name,
      schedule: job.schedule,
      handler: job.handler,
      timezone: job.timezone
    })) || []
  }));

  res.json({
    status: 'running',
    functionsLoaded: loadedFunctions.size,
    routesRegistered: registeredRoutes.size,
    cronJobsActive: Array.from(activeCronJobs.values()).flat().length,
    functions,
    cronJobs: getCronJobsStatus(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/reload', async (req, res) => {
  const { functionName } = req.body;

  if (functionName) {
    // Reload specific function
    const functionPath = path.join(__dirname, 'functions', functionName);
    const success = await loadFunction(functionPath);

    res.json({
      success,
      message: success
        ? `Function ${functionName} reloaded successfully`
        : `Failed to reload function ${functionName}`,
      timestamp: new Date().toISOString()
    });
  } else {
    // Reload all functions
    logger.info('Manual reload triggered for all functions');
    await loadAllFunctions();

    res.json({
      success: true,
      message: 'All functions reloaded',
      functionsLoaded: loadedFunctions.size,
      timestamp: new Date().toISOString()
    });
  }
});

// Authentication routes
app.post('/api/auth/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { username, password } = req.body;

  try {
    // Simple admin authentication (in production, use a database)
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = jwt.sign(
        { username, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: { username, role: 'admin' }
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  // In a real app, you might want to blacklist the token
  res.json({ message: 'Logged out successfully' });
});

// Dashboard API routes
app.get('/api/status', authenticateToken, (req, res) => {
  const functions = Array.from(loadedFunctions.values()).map(func => ({
    name: func.name,
    status: func.status || 'running',
    routes: func.routes || [],
    cronJobs: activeCronJobs.has(func.name) ? activeCronJobs.get(func.name).length : 0,
    lastDeployed: func.lastDeployed || new Date().toISOString()
  }));

  res.json({
    status: 'running',
    uptime: process.uptime(),
    functions,
    totalFunctions: loadedFunctions.size,
    totalRoutes: registeredRoutes.size,
    totalCronJobs: Array.from(activeCronJobs.values()).flat().length
  });
});

app.get('/api/functions', authenticateToken, (req, res) => {
  const functions = Array.from(loadedFunctions.values()).map(func => ({
    name: func.name,
    status: func.status || 'running',
    routes: func.routes || [],
    cronJobs: activeCronJobs.has(func.name) ? activeCronJobs.get(func.name).length : 0,
    lastDeployed: func.lastDeployed || new Date().toISOString()
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
  let baseUrl = '';
  try {
    const configPath = path.join(func.path, 'route.config.json');
    const configRaw = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configRaw);
    baseUrl = config.base || '';
  } catch (e) {
    baseUrl = '';
  }

  // Read cron.json to get cron job details
  let cronJobDetails = [];
  try {
    const cronPath = path.join(func.path, 'cron.json');
    const cronRaw = await fs.readFile(cronPath, 'utf-8');
    const cronConfig = JSON.parse(cronRaw);
    if (Array.isArray(cronConfig.jobs)) {
      cronJobDetails = cronConfig.jobs.map(job => ({
        schedule: job.schedule,
        handler: job.handler,
        description: job.description || ''
      }));
    }
  } catch (e) {
    cronJobDetails = [];
  }

  const functionData = {
    name: func.name,
    status: func.status || 'running',
    routes: func.routes || [],
    cronJobs: cronJobDetails,
    lastDeployed: func.lastDeployed || new Date().toISOString(),
    path: func.path,
    baseUrl
  };

  res.json(functionData);
});

// File upload configuration for function deployment
const upload = multer({
  dest: 'temp/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 20 // Max 20 files
  }
});

app.post('/api/functions/deploy/local', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { name } = req.body;
    const files = req.files;

    if (!name || !files || files.length === 0) {
      return res.status(400).json({ message: 'Function name and files are required' });
    }

    // Create function directory
    const functionDir = path.join(__dirname, 'functions', name);
    await fs.mkdir(functionDir, { recursive: true });

    // Move uploaded files to function directory
    for (const file of files) {
      const destPath = path.join(functionDir, file.originalname);
      await fs.rename(file.path, destPath);
    }

    // Load the function
    const success = await loadFunction(functionDir);
    
    if (success) {
      // Emit socket event
      io.emit('function:deployed', { name, status: 'running' });
      
      res.json({ 
        message: 'Function deployed successfully',
        function: { name, status: 'running' }
      });
    } else {
      res.status(500).json({ message: 'Failed to deploy function' });
    }
  } catch (error) {
    logger.error(`Deployment error: ${error.message}`);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/functions/:name', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    
    // Unload function
    unloadFunction(name);
    
    // Remove function directory
    const functionDir = path.join(__dirname, 'functions', name);
    await fs.rm(functionDir, { recursive: true, force: true });
    
    // Emit socket event
    io.emit('function:deleted', { name });
    
    res.json({ message: 'Function deleted successfully' });
  } catch (error) {
    logger.error(`Delete function error: ${error.message}`);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update function
app.put('/api/functions/:name', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { name } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'Files are required' });
    }

    const functionDir = path.join(__dirname, 'functions', name);
    
    // Check if function exists
    if (!loadedFunctions.has(name)) {
      return res.status(404).json({ message: 'Function not found' });
    }

    // Move uploaded files to function directory
    for (const file of files) {
      const destPath = path.join(functionDir, file.originalname);
      await fs.rename(file.path, destPath);
    }

    // Reload the function
    const success = await loadFunction(functionDir);
    
    if (success) {
      // Emit socket event
      io.emit('function:updated', { name, status: 'running' });
      
      res.json({ 
        message: 'Function updated successfully',
        function: { name, status: 'running' }
      });
    } else {
      res.status(500).json({ message: 'Failed to update function' });
    }
  } catch (error) {
    logger.error(`Update function error: ${error.message}`);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Deploy function from Git
app.post('/api/functions/deploy/git', authenticateToken, async (req, res) => {
  try {
    const { name, repo, branch = 'main', commit } = req.body;

    if (!name || !repo) {
      return res.status(400).json({ message: 'Function name and repository URL are required' });
    }

    const functionDir = path.join(__dirname, 'functions', name);
    
    // Clone or pull the repository
    const gitCommand = commit 
      ? `git clone -b ${branch} ${repo} ${functionDir} && cd ${functionDir} && git checkout ${commit}`
      : `git clone -b ${branch} ${repo} ${functionDir}`;

    await execAsync(gitCommand);

    // Load the function
    const success = await loadFunction(functionDir);
    
    if (success) {
      // Emit socket event
      io.emit('function:deployed', { name, status: 'running' });
      
      res.json({ 
        message: 'Function deployed from Git successfully',
        function: { name, status: 'running' }
      });
    } else {
      res.status(500).json({ message: 'Failed to deploy function from Git' });
    }
  } catch (error) {
    logger.error(`Git deployment error: ${error.message}`);
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
        logs = logs.concat(errorLogs.lines.map(line => ({
          message: line,
          level: 'ERROR',
          timestamp: new Date().toISOString()
        })));
      }
    }
    
    if (type === 'all') {
      const mainLogs = await functionLogger.getFunctionLogs(name, parseInt(limit));
      if (!mainLogs.error) {
        logs = logs.concat(mainLogs.lines.map(line => ({
          message: line,
          level: 'INFO',
          timestamp: new Date().toISOString()
        })));
      }
    }

    // Sort by timestamp (newest first) and limit
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    logs = logs.slice(0, parseInt(limit));

    res.json({ logs });
  } catch (error) {
    logger.error(`Get function logs error: ${error.message}`);
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

    // Mock metrics for now - in a real implementation, you'd collect actual metrics
    const metrics = {
      name,
      invocations: Math.floor(Math.random() * 1000),
      errors: Math.floor(Math.random() * 50),
      avgResponseTime: Math.random() * 100 + 50,
      lastInvocation: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      routes: func.routes || [],
      cronJobs: activeCronJobs.has(name) ? activeCronJobs.get(name).length : 0
    };

    res.json(metrics);
  } catch (error) {
    logger.error(`Get function metrics error: ${error.message}`);
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
        ...headers
      },
      params: {},
      query: {}
    };

    // Create a mock response object
    const mockRes = {
      statusCode: 200,
      headers: {},
      body: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = data;
        return this;
      },
      send: function(data) {
        this.body = data;
        return this;
      }
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
        headers: mockRes.headers
      });
    } catch (error) {
      res.json({
        success: false,
        error: error.message,
        statusCode: 500
      });
    }
  } catch (error) {
    logger.error(`Test function error: ${error.message}`);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get system logs
app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const logs = await logger.getRecentLogs(parseInt(limit));
    res.json(logs);
  } catch (error) {
    logger.error(`Get system logs error: ${error.message}`);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all function log files
app.get('/api/logs/functions', authenticateToken, async (req, res) => {
  try {
    const functionLogs = await logger.getFunctionLogFiles();
    res.json(functionLogs);
  } catch (error) {
    logger.error(`Get function logs error: ${error.message}`);
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
      timestamp: new Date().toISOString()
    };

    res.json(metrics);
  } catch (error) {
    logger.error(`Get system metrics error: ${error.message}`);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    functions: loadedFunctions.size
  });
});

// Serve dashboard at root
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Initialize the server
const initializeServer = async () => {
  logger.info('Initializing FuncDock Platform...');

  // Load all functions
  await loadAllFunctions();

  // Register catch-all route after functions are loaded
  app.get('*', (req, res) => {
    // Don't serve React app for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        error: 'Route not found',
        method: req.method,
        path: req.path,
        availableRoutes: Array.from(registeredRoutes.keys()),
        timestamp: new Date().toISOString()
      });
    }
    
    // Function routes should be handled by their respective handlers
    // If we reach here, it means no function route matched
    
    // Serve React app for all other routes
    res.sendFile(path.join(__dirname, 'public/dashboard/index.html'));
  });

  // 404 handler for undefined routes (after catch-all)
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Route not found',
      method: req.method,
      path: req.originalUrl,
      availableRoutes: Array.from(registeredRoutes.keys()),
      timestamp: new Date().toISOString()
    });
  });

  // Set up file watching
  const watcher = setupFileWatcher();

  // Start server
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    logger.info(`🚀 FuncDock platform running on http://localhost:${PORT}`);
    logger.info(`📊 Management API available at http://localhost:${PORT}/api/status`);
    logger.info(`🔄 Hot reload enabled - watching for changes...`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    watcher.close();
    
    // Stop all cron jobs
    for (const [functionName] of activeCronJobs.entries()) {
      stopCronJobs(functionName);
    }
    
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    watcher.close();
    
    // Stop all cron jobs
    for (const [functionName] of activeCronJobs.entries()) {
      stopCronJobs(functionName);
    }
    
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
};

// Start the server
initializeServer().catch(error => {
  logger.error(`Failed to initialize server: ${error.message}`);
  process.exit(1);
});

// Cron job management
const loadCronJobs = async (functionDir) => {
  const functionName = path.basename(functionDir);
  const cronConfigPath = path.join(functionDir, 'cron.json');

  try {
    // Check if cron.json exists
    await fs.access(cronConfigPath);
    
    // Read and parse cron config
    const cronConfigRaw = await fs.readFile(cronConfigPath, 'utf-8');
    const cronConfig = JSON.parse(cronConfigRaw);

    // Validate cron config
    if (!cronConfig.jobs || !Array.isArray(cronConfig.jobs)) {
      logger.info(`No cron jobs configured for ${functionName} (empty jobs array)`);
      return true;
    }

    // Stop existing cron jobs for this function
    stopCronJobs(functionName);

    const functionCronJobs = [];

    for (const job of cronConfig.jobs) {
      // Validate job config
      if (!job.schedule || !job.handler) {
        logger.error(`Invalid cron job in ${functionName}: schedule and handler are required`);
        continue;
      }

      // Validate cron schedule
      if (!cron.validate(job.schedule)) {
        logger.error(`Invalid cron schedule in ${functionName}: ${job.schedule}`);
        continue;
      }

      // Determine handler path
      const handlerPath = path.join(functionDir, job.handler);
      
      try {
        await fs.access(handlerPath);
      } catch (error) {
        logger.error(`Cron handler not found for ${functionName}: ${job.handler}`);
        continue;
      }

      // Register the cron job
      const cronJob = cron.schedule(job.schedule, async () => {
        // Create function-specific logger
        const functionLogger = new Logger({
          logLevel: process.env.LOG_LEVEL || 'info',
          logToFile: true,
          logToConsole: true,
          functionName: functionName // Pass function name to logger
        });

        // Get function info including environment variables
        const functionInfo = loadedFunctions.get(functionName);

        // Add function context to request
        const req = {
          functionName,
          functionPath: functionDir,
          jobName: job.name, // Add the job name
          logger: functionLogger,
          // Include function-specific environment variables
          env: functionInfo ? functionInfo.envVars : {}
        };

        try {
          // Import and execute the handler
          const handlerModule = await import(handlerPath);
          const handlerFunction = handlerModule.default;
          
          if (typeof handlerFunction === 'function') {
            await handlerFunction(req);
          } else {
            functionLogger.error(`Handler ${job.handler} does not export a default function`);
          }
        } catch (err) {
          functionLogger.error(`Error in ${functionName}/${job.handler}: ${err.message}`);
        }
      });

      functionCronJobs.push(cronJob);
      logger.info(`Registered cron job: ${job.schedule} -> ${functionName}: ${job.handler}`);
    }

    // Store cron jobs
    activeCronJobs.set(functionName, functionCronJobs);

    logger.info(`Successfully loaded ${functionCronJobs.length} cron jobs for ${functionName}`);
    return true;

  } catch (error) {
    if (error.code === 'ENOENT') {
      // No cron.json file exists - this is normal for functions without cron jobs
      logger.info(`No cron.json found for ${functionName} - skipping cron jobs`);
      return true;
    } else {
      logger.error(`Failed to load cron jobs for ${functionName}: ${error.message}`);
      return false;
    }
  }
};

// Stop all cron jobs for a function
const stopCronJobs = (functionName) => {
  if (activeCronJobs.has(functionName)) {
    const functionCronJobs = activeCronJobs.get(functionName);
    functionCronJobs.forEach(cronJob => cronJob.stop());
    activeCronJobs.delete(functionName);
    logger.info(`Stopped all cron jobs for ${functionName}`);
  }
};

// Get cron jobs status
const getCronJobsStatus = () => {
  const status = Array.from(activeCronJobs.entries()).map(([name, jobs]) => ({
    name,
    jobs: jobs.map(job => ({
      name: job.name,
      schedule: job.schedule,
      handler: job.handler,
      timezone: job.timezone
    }))
  }));

  return status;
};
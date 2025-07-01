import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import { exec } from 'child_process';
import { promisify } from 'util';
import cron from 'node-cron';
import Logger from './utils/logger.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global state
const loadedFunctions = new Map();
const registeredRoutes = new Map();
const activeCronJobs = new Map(); // Track active cron jobs
const logger = new Logger();

// Helper function to clear module cache (ES modules don't have require.cache)
// ES modules are cached differently and the ?update= parameter handles cache busting
const clearModuleCache = (modulePath) => {
  // ES modules don't have a cache that can be cleared like CommonJS
  // The import with ?update=${Date.now()} handles cache busting
};

// Install dependencies for a function
const installDependencies = async (functionPath) => {
  const packageJsonPath = path.join(functionPath, 'package.json');

  try {
    await fs.access(packageJsonPath);
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
            logToConsole: true
          });

          // Add function context to request
          req.functionName = functionName;
          req.functionPath = functionDir;
          req.routePath = route.path;
          req.routeHandler = routeHandler;
          req.logger = functionLogger; // Inject logger into request

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
    await loadCronJobs(functionDir);

    // Store function info
    loadedFunctions.set(functionName, {
      config,
      handler,
      routes: functionRoutes,
      loadedAt: new Date(),
      functionDir
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
      '**/package-lock.json'
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    functions: loadedFunctions.size
  });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
    availableRoutes: Array.from(registeredRoutes.keys()),
    timestamp: new Date().toISOString()
  });
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

  // Set up file watching
  const watcher = setupFileWatcher();

  // Start server
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
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
      throw new Error('Invalid cron.json: jobs array is required');
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
        logger.error(error);
        continue;
      }

      // Register the cron job
      const cronJob = cron.schedule(job.schedule, async () => {
        // Create function-specific logger
        const functionLogger = new Logger({
          logLevel: process.env.LOG_LEVEL || 'info',
          logToFile: true,
          logToConsole: true
        });

        // Add function context to request
        const req = {
          functionName,
          functionPath,
          logger: functionLogger
        };

        try {
          await job.handler(req);
        } catch (err) {
          functionLogger.error(`Error in ${functionName}: ${err.message}`);
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
    logger.error(`Failed to load cron jobs for ${functionName}: ${error.message}`);
    return false;
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
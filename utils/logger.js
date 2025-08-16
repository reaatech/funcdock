import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class Logger extends EventEmitter {
  constructor(options = {}) {
    super();

    // Define levels FIRST before validation
    this.levels = {
      error: 0,
      alert: 1,
      warn: 2,
      info: 3,
      debug: 4,
      CRON: 5,
      CRON_ERROR: 6
    };

    this.logLevel = this.validateLogLevel(options.logLevel || process.env.LOG_LEVEL || 'info');
    this.logToFile = options.logToFile !== false;
    this.logToConsole = options.logToConsole !== false;
    this.logDir = options.logDir || path.join(__dirname, '..', 'logs');
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = options.maxLogFiles || 5;
    this.functionName = this.sanitizeFunctionName(options.functionName || null);

    this.colors = {
      error: '\x1b[31m',
      alert: '\x1b[35m',
      warn: '\x1b[33m',
      info: '\x1b[36m',
      debug: '\x1b[37m',
      CRON: '\x1b[32m',
      CRON_ERROR: '\x1b[41m',
      reset: '\x1b[0m'
    };

    // Track streams for cleanup
    this.streams = new Map();
    this.rotationLocks = new Set();

    // Buffer for batching writes
    this.writeBuffer = [];
    this.bufferTimer = null;
    this.bufferSize = 100; // Max entries before forced flush
    this.bufferTimeout = 1000; // Max ms to wait before flush

    this.initialized = false;
    this.initPromise = this.initialize();
  }

  validateLogLevel(level) {
    if (typeof level !== 'string' || !this.levels.hasOwnProperty(level)) {
      console.warn(`Invalid log level: ${level}, defaulting to 'info'`);
      return 'info';
    }
    return level;
  }

  sanitizeFunctionName(name) {
    if (!name) return null;
    // Remove any path separators and limit length
    return name.replace(/[/\\]/g, '').substring(0, 50);
  }

  async initialize() {
    if (this.initialized) return;

    try {
      if (this.logToFile) {
        await fs.mkdir(this.logDir, { recursive: true });
        if (this.functionName) {
          const functionLogDir = path.join(this.logDir, 'functions');
          await fs.mkdir(functionLogDir, { recursive: true });
        }
      }
      this.initialized = true;
      this.emit('ready');
    } catch (error) {
      console.error('Failed to initialize logger:', error.message);
      this.emit('error', error);
    }
  }

  shouldLog(level) {
    const should = this.levels[level] <= this.levels[this.logLevel];
    console.log(`[DEBUG] shouldLog(${level}): ${should} (level=${this.levels[level]}, logLevel=${this.logLevel}:${this.levels[this.logLevel]})`);
    return should;
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const processId = process.pid;

    // Handle undefined/null/empty messages better
    let formattedMessage;
    if (message === undefined) {
      formattedMessage = '[undefined]';
    } else if (message === null) {
      formattedMessage = '[null]';
    } else if (message === '') {
      formattedMessage = '[empty string]';
    } else if (typeof message === 'string') {
      formattedMessage = message;
    } else if (typeof message === 'object') {
      try {
        formattedMessage = JSON.stringify(message, null, 2);
      } catch (e) {
        formattedMessage = '[object - could not stringify]';
      }
    } else {
      formattedMessage = String(message);
    }

    const logEntry = {
      timestamp,
      pid: processId,
      level: level.toUpperCase(),
      message: formattedMessage,
      ...meta
    };

    if (this.functionName && !logEntry.function) {
      logEntry.function = this.functionName;
    }

    return JSON.stringify(logEntry);
  }

  getLogFilePath(suffix = '') {
    if (this.functionName) {
      const functionLogDir = path.join(this.logDir, 'functions');
      return path.join(functionLogDir, `${this.functionName}${suffix}.log`);
    }
    return path.join(this.logDir, `app${suffix}.log`);
  }

  async getOrCreateStream(filePath) {
    if (this.streams.has(filePath)) {
      return this.streams.get(filePath);
    }

    try {
      const stream = createWriteStream(filePath, { flags: 'a' });

      stream.on('error', (error) => {
        console.error(`Log stream error for ${filePath}:`, error.message);
        this.streams.delete(filePath);
      });

      this.streams.set(filePath, stream);
      return stream;
    } catch (error) {
      console.error(`Failed to create log stream for ${filePath}:`, error.message);
      return null;
    }
  }

  async writeToFile(level, formattedMessage) {
    if (!this.logToFile || !this.initialized) return;

    try {
      const mainLogPath = this.getLogFilePath();
      const errorLogPath = this.getLogFilePath('-error');

      // Write to main log
      const mainStream = await this.getOrCreateStream(mainLogPath);
      if (mainStream) {
        mainStream.write(formattedMessage + '\n');
        await this.checkAndRotate(mainLogPath);
      }

      // Write errors and alerts to separate error log
      if (level === 'error' || level === 'alert') {
        const errorStream = await this.getOrCreateStream(errorLogPath);
        if (errorStream) {
          errorStream.write(formattedMessage + '\n');
          await this.checkAndRotate(errorLogPath);
        }
      }
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  async checkAndRotate(logFile) {
    // Prevent multiple simultaneous rotations of the same file
    if (this.rotationLocks.has(logFile)) return;

    try {
      const stats = await fs.stat(logFile);
      if (stats.size > this.maxLogSize) {
        this.rotationLocks.add(logFile);
        await this.rotateLogs(logFile);
      }
    } catch (error) {
      // Log file might not exist yet
    } finally {
      this.rotationLocks.delete(logFile);
    }
  }

  async rotateLogs(logFile) {
    try {
      // Close existing stream
      const stream = this.streams.get(logFile);
      if (stream) {
        stream.end();
        this.streams.delete(logFile);
      }

      // Rotate files
      for (let i = this.maxLogFiles - 1; i > 0; i--) {
        const oldFile = `${logFile}.${i}`;
        const newFile = `${logFile}.${i + 1}`;

        try {
          await fs.access(oldFile);
          if (i === this.maxLogFiles - 1) {
            await fs.unlink(oldFile);
          } else {
            await fs.rename(oldFile, newFile);
          }
        } catch (error) {
          // File doesn't exist, continue
        }
      }

      // Move current log to .1
      await fs.rename(logFile, `${logFile}.1`);
    } catch (error) {
      console.error('Failed to rotate logs:', error.message);
    }
  }

  formatConsoleMessage(level, logObj) {
    const colorCode = this.colors[level] || this.colors.reset;
    return `${colorCode}${logObj.timestamp} [${logObj.level}]${logObj.function ? ` [${logObj.function}]` : ''} ${logObj.message}${this.colors.reset}`;
  }

  writeToConsole(level, formattedMessage) {
    if (!this.logToConsole) return;

    try {
      const logObj = JSON.parse(formattedMessage);
      const coloredMessage = this.formatConsoleMessage(level, logObj);

      if (level === 'error' || level === 'alert') {
        console.error(coloredMessage);
        if (logObj.stack) {
          console.error(logObj.stack);
        }
        if (logObj.error && logObj.error.stack) {
          console.error(logObj.error.stack);
        }
      } else if (level === 'warn') {
        console.warn(coloredMessage);
      } else {
        console.log(coloredMessage);
      }
    } catch (parseError) {
      // Fallback to raw message
      const outputFn = level === 'error' || level === 'alert' ? console.error :
        level === 'warn' ? console.warn : console.log;
      outputFn(formattedMessage);
    }
  }

  async log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    try {
      // Wait for initialization
      if (!this.initialized) {
        console.log(`[DEBUG] Logger waiting for initialization...`);
        await this.initPromise;
        console.log(`[DEBUG] Logger initialized, logToFile: ${this.logToFile}, functionName: ${this.functionName}`);
      }

      // Handle the common pattern: logger.error("message", errorObject)
      // If meta is an Error object and message is a string, combine them
      if (typeof message === 'string' && meta instanceof Error && Object.keys(meta).length === 0) {
        const errorInfo = {
          name: meta.name,
          message: meta.message,
          stack: meta.stack
        };
        message = `${message} ${meta.name}: ${meta.message}`;
        meta = { error: errorInfo, stack: meta.stack };
      }
      // Handle error objects properly
      else if (meta.error instanceof Error) {
        meta.error = {
          name: meta.error.name,
          message: meta.error.message,
          stack: meta.error.stack
        };
        meta.stack = meta.error.stack; // Also add to root for console display
      }
      else if (message instanceof Error) {
        const errorObj = {
          name: message.name,
          message: message.message,
          stack: message.stack
        };
        meta.error = errorObj;
        meta.stack = message.stack; // Add to root for console display
        message = `${message.name}: ${message.message}`; // Better error message formatting
      }

      const formattedMessage = this.formatMessage(level, message, meta);

      // Write to console immediately
      this.writeToConsole(level, formattedMessage);
      console.log(`[DEBUG] Wrote to console: ${level}`);

      // Buffer file writes for better performance
      if (this.logToFile) {
        console.log(`[DEBUG] Buffering write for file: ${level}, functionName: ${this.functionName}`);
        this.bufferWrite(level, formattedMessage);
      } else {
        console.log(`[DEBUG] File logging disabled`);
      }

      // Send alerts if configured
      if (level === 'alert') {
        await this.sendAlert(message, meta);
      }

    } catch (error) {
      console.error('Logger error:', error.message);
    }
  }

  bufferWrite(level, formattedMessage) {
    this.writeBuffer.push({ level, message: formattedMessage });
    console.log(`[DEBUG] Buffer size: ${this.writeBuffer.length}/${this.bufferSize}`);

    // Flush if buffer is full
    if (this.writeBuffer.length >= this.bufferSize) {
      console.log(`[DEBUG] Flushing buffer - full`);
      this.flushBuffer();
    } else {
      // Set timer for periodic flush
      if (!this.bufferTimer) {
        console.log(`[DEBUG] Setting buffer timer for ${this.bufferTimeout}ms`);
        this.bufferTimer = setTimeout(() => {
          console.log(`[DEBUG] Flushing buffer - timeout`);
          this.flushBuffer();
        }, this.bufferTimeout);
      }
    }
  }

  async flushBuffer() {
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }

    const buffer = this.writeBuffer.splice(0);

    for (const { level, message } of buffer) {
      await this.writeToFile(level, message);
    }
  }

  async sendAlert(message, meta = {}) {
    const alertMessage = `🚨 ALERT: ${message}`;
    console.error(`\x1b[41m\x1b[37m${alertMessage}\x1b[0m`);

    if (process.env.SLACK_WEBHOOK_URL) {
      await this.sendSlackAlert(message, meta);
    }
  }

  async sendSlackAlert(message, meta = {}) {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (!webhookUrl) return;

      const payload = {
        text: `🚨 FuncDock Platform Alert`,
        attachments: [{
          color: 'danger',
          fields: [
            {
              title: 'Message',
              value: message,
              short: false
            },
            {
              title: 'Timestamp',
              value: new Date().toISOString(),
              short: true
            },
            {
              title: 'Process ID',
              value: process.pid.toString(),
              short: true
            }
          ]
        }]
      };

      if (meta && Object.keys(meta).length > 0) {
        payload.attachments[0].fields.push({
          title: 'Additional Info',
          value: JSON.stringify(meta, null, 2),
          short: false
        });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to send Slack alert:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending Slack alert:', error.message);
    }
  }

  // Cleanup method
  async cleanup() {
    await this.flushBuffer();

    for (const [filePath, stream] of this.streams) {
      stream.end();
    }

    this.streams.clear();
  }

  // Convenience methods
  error(message, meta = {}) {
    return this.log('error', message, meta);
  }

  alert(message, meta = {}) {
    return this.log('alert', message, meta);
  }

  warn(message, meta = {}) {
    return this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    return this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    return this.log('debug', message, meta);
  }

  logFunction(functionName, level, message, meta = {}) {
    return this.log(level, message, { ...meta, function: this.sanitizeFunctionName(functionName) });
  }

  // Request logging middleware
  requestLogger() {
    return (req, res, next) => {
      const start = Date.now();

      this.info(`${req.method} ${req.originalUrl}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        function: req.functionName
      });

      res.on('finish', () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 400 ? 'warn' : 'info';

        this.log(level, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
          statusCode: res.statusCode,
          duration,
          ip: req.ip,
          function: req.functionName
        });
      });

      next();
    };
  }

  // Get recent logs with better error handling
  async getRecentLogs(lines = 100, functionName = null) {
    if (!this.logToFile) {
      return { error: 'File logging is disabled' };
    }

    try {
      await this.initPromise; // Ensure initialization

      const sanitizedFunctionName = functionName ? this.sanitizeFunctionName(functionName) : null;
      let logFile;

      if (sanitizedFunctionName) {
        const functionLogDir = path.join(this.logDir, 'functions');
        logFile = path.join(functionLogDir, `${sanitizedFunctionName}.log`);
      } else {
        logFile = path.join(this.logDir, 'app.log');
      }

      const resolvedPath = path.resolve(logFile);
      if (!resolvedPath.startsWith(path.resolve(this.logDir))) {
        return { error: 'Invalid log file path' };
      }

      const logContent = await fs.readFile(logFile, 'utf-8');
      const logLines = logContent.split('\n').filter(line => line.trim());

      return {
        total: logLines.length,
        lines: logLines.slice(-Math.max(1, Math.min(1000, lines))) // Limit between 1-1000
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Other methods remain similar but with better error handling...
  async getErrorLogs(lines = 50, functionName = null) {
    if (!this.logToFile) {
      return { error: 'File logging is disabled' };
    }

    try {
      await this.initPromise;

      const sanitizedFunctionName = functionName ? this.sanitizeFunctionName(functionName) : null;
      let errorLogFile;

      if (sanitizedFunctionName) {
        const functionLogDir = path.join(this.logDir, 'functions');
        errorLogFile = path.join(functionLogDir, `${sanitizedFunctionName}-error.log`);
      } else {
        errorLogFile = path.join(this.logDir, 'error.log');
      }

      const resolvedPath = path.resolve(errorLogFile);
      if (!resolvedPath.startsWith(path.resolve(this.logDir))) {
        return { error: 'Invalid log file path' };
      }

      const logContent = await fs.readFile(errorLogFile, 'utf-8');
      const logLines = logContent.split('\n').filter(line => line.trim());

      return {
        total: logLines.length,
        lines: logLines.slice(-Math.max(1, Math.min(500, lines)))
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async getFunctionLogs(functionName, lines = 100) {
    return this.getRecentLogs(lines, functionName);
  }

  async getFunctionErrorLogs(functionName, lines = 50) {
    return this.getErrorLogs(lines, functionName);
  }

  async getFunctionLogFiles() {
    if (!this.logToFile) {
      return { error: 'File logging is disabled' };
    }

    try {
      await this.initPromise;

      const functionLogDir = path.join(this.logDir, 'functions');

      try {
        await fs.access(functionLogDir);
      } catch {
        return { functions: [] };
      }

      const files = await fs.readdir(functionLogDir);
      const functionMap = new Map();

      for (const file of files) {
        if (file.endsWith('.log')) {
          const functionName = file.replace('-error.log', '').replace('.log', '');

          if (!functionMap.has(functionName)) {
            functionMap.set(functionName, {
              name: functionName,
              hasMainLog: false,
              hasErrorLog: false,
              mainLogSize: 0,
              errorLogSize: 0
            });
          }

          const func = functionMap.get(functionName);
          const filePath = path.join(functionLogDir, file);

          try {
            const stats = await fs.stat(filePath);

            if (file.endsWith('-error.log')) {
              func.hasErrorLog = true;
              func.errorLogSize = stats.size;
            } else {
              func.hasMainLog = true;
              func.mainLogSize = stats.size;
            }
          } catch (error) {
            // File might not exist or be accessible
          }
        }
      }

      return {
        functions: Array.from(functionMap.values())
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}

export default Logger;

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class Logger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || process.env.LOG_LEVEL || 'info';
    this.logToFile = options.logToFile !== false;
    this.logToConsole = options.logToConsole !== false;
    this.logDir = options.logDir || path.join(__dirname, '..', 'logs');
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = options.maxLogFiles || 5;
    this.functionName = options.functionName || null;

    this.levels = {
      error: 0,
      alert: 1,
      warn: 2,
      info: 3,
      debug: 4
    };

    this.colors = {
      error: '\x1b[31m',   // Red
      alert: '\x1b[35m',   // Magenta
      warn: '\x1b[33m',    // Yellow
      info: '\x1b[36m',    // Cyan
      debug: '\x1b[37m',   // White
      reset: '\x1b[0m'     // Reset
    };

    // Initialize log directory
    this.initLogDirectory();
  }

  async initLogDirectory() {
    if (this.logToFile) {
      try {
        await fs.mkdir(this.logDir, { recursive: true });
      } catch (error) {
        console.error('Failed to create log directory:', error.message);
      }
    }
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const processId = process.pid;

    let formattedMessage = `[${timestamp}] [${processId}] [${level.toUpperCase()}]`;

    if (meta.function) {
      formattedMessage += ` [${meta.function}]`;
    }

    formattedMessage += ` ${message}`;

    if (meta && Object.keys(meta).length > 0) {
      const metaCopy = { ...meta };
      delete metaCopy.function; // Already included above

      if (Object.keys(metaCopy).length > 0) {
        formattedMessage += ` ${JSON.stringify(metaCopy)}`;
      }
    }

    return formattedMessage;
  }

  async writeToFile(level, formattedMessage) {
    if (!this.logToFile) return;

    try {
      // Create function-specific log files if functionName is provided
      let logFile, errorLogFile;
      
      if (this.functionName) {
        // Function-specific logs
        const functionLogDir = path.join(this.logDir, 'functions');
        await fs.mkdir(functionLogDir, { recursive: true });
        
        logFile = path.join(functionLogDir, `${this.functionName}.log`);
        errorLogFile = path.join(functionLogDir, `${this.functionName}-error.log`);
      } else {
        // System-wide logs
        logFile = path.join(this.logDir, `app.log`);
        errorLogFile = path.join(this.logDir, `error.log`);
      }

      // Write to main log file
      await fs.appendFile(logFile, formattedMessage + '\n');

      // Write errors and alerts to separate error log
      if (level === 'error' || level === 'alert') {
        await fs.appendFile(errorLogFile, formattedMessage + '\n');
      }

      // Check and rotate logs if needed
      await this.rotateLogs(logFile);
      if (level === 'error' || level === 'alert') {
        await this.rotateLogs(errorLogFile);
      }

    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  async rotateLogs(logFile) {
    try {
      const stats = await fs.stat(logFile);

      if (stats.size > this.maxLogSize) {
        // Move current log to numbered backup
        for (let i = this.maxLogFiles - 1; i > 0; i--) {
          const oldFile = `${logFile}.${i}`;
          const newFile = `${logFile}.${i + 1}`;

          try {
            await fs.access(oldFile);
            if (i === this.maxLogFiles - 1) {
              await fs.unlink(oldFile); // Delete oldest log
            } else {
              await fs.rename(oldFile, newFile);
            }
          } catch (error) {
            // File doesn't exist, continue
          }
        }

        // Move current log to .1
        await fs.rename(logFile, `${logFile}.1`);
      }
    } catch (error) {
      // Log file might not exist yet, that's okay
    }
  }

  writeToConsole(level, formattedMessage) {
    if (!this.logToConsole) return;

    const colorCode = this.colors[level] || this.colors.reset;
    const coloredMessage = `${colorCode}${formattedMessage}${this.colors.reset}`;

    if (level === 'error' || level === 'alert') {
      console.error(coloredMessage);
    } else if (level === 'warn') {
      console.warn(coloredMessage);
    } else {
      console.log(coloredMessage);
    }
  }

  async log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, meta);

    // Write to console
    this.writeToConsole(level, formattedMessage);

    // Write to file
    await this.writeToFile(level, formattedMessage);

    // Send alerts if configured (webhook, email, etc.)
    if (level === 'alert') {
      await this.sendAlert(message, meta);
    }
  }

  async sendAlert(message, meta = {}) {
    // This is where you'd integrate with external alerting systems
    // For now, just log to console with special formatting
    const alertMessage = `🚨 ALERT: ${message}`;
    console.error(`\x1b[41m\x1b[37m${alertMessage}\x1b[0m`);

    // You could add integrations here for:
    // - Slack webhooks
    // - Email notifications
    // - PagerDuty
    // - Discord webhooks
    // - etc.

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

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error('Failed to send Slack alert:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending Slack alert:', error.message);
    }
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

  // Function-specific logging
  logFunction(functionName, level, message, meta = {}) {
    return this.log(level, message, { ...meta, function: functionName });
  }

  // Request logging middleware
  requestLogger() {
    return (req, res, next) => {
      const start = Date.now();

      // Log request
      this.info(`${req.method} ${req.originalUrl}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        function: req.functionName
      });

      // Log response when finished
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

  // Get recent logs
  async getRecentLogs(lines = 100, functionName = null) {
    if (!this.logToFile) {
      return { error: 'File logging is disabled' };
    }

    try {
      let logFile;
      
      if (functionName) {
        // Function-specific logs
        const functionLogDir = path.join(this.logDir, 'functions');
        logFile = path.join(functionLogDir, `${functionName}.log`);
      } else {
        // System-wide logs
        logFile = path.join(this.logDir, 'app.log');
      }
      
      // Validate path to prevent directory traversal
      const resolvedPath = path.resolve(logFile);
      if (!resolvedPath.startsWith(path.resolve(this.logDir))) {
        return { error: 'Invalid log file path' };
      }
      
      const logContent = await fs.readFile(logFile, 'utf-8');
      const logLines = logContent.split('\n').filter(line => line.trim());

      return {
        total: logLines.length,
        lines: logLines.slice(-lines)
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Get error logs
  async getErrorLogs(lines = 50, functionName = null) {
    if (!this.logToFile) {
      return { error: 'File logging is disabled' };
    }

    try {
      let errorLogFile;
      
      if (functionName) {
        // Function-specific error logs
        const functionLogDir = path.join(this.logDir, 'functions');
        errorLogFile = path.join(functionLogDir, `${functionName}-error.log`);
      } else {
        // System-wide error logs
        errorLogFile = path.join(this.logDir, 'error.log');
      }
      
      // Validate path to prevent directory traversal
      const resolvedPath = path.resolve(errorLogFile);
      if (!resolvedPath.startsWith(path.resolve(this.logDir))) {
        return { error: 'Invalid log file path' };
      }
      
      const logContent = await fs.readFile(errorLogFile, 'utf-8');
      const logLines = logContent.split('\n').filter(line => line.trim());

      return {
        total: logLines.length,
        lines: logLines.slice(-lines)
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Get function-specific logs
  async getFunctionLogs(functionName, lines = 100) {
    return this.getRecentLogs(lines, functionName);
  }

  // Get function-specific error logs
  async getFunctionErrorLogs(functionName, lines = 50) {
    return this.getErrorLogs(lines, functionName);
  }

  // Get all function log files
  async getFunctionLogFiles() {
    if (!this.logToFile) {
      return { error: 'File logging is disabled' };
    }

    try {
      const functionLogDir = path.join(this.logDir, 'functions');
      
      // Check if function log directory exists
      try {
        await fs.access(functionLogDir);
      } catch {
        return { functions: [] };
      }
      
      const files = await fs.readdir(functionLogDir);
      const functionLogs = [];
      
      // Group by function name (remove -error suffix)
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

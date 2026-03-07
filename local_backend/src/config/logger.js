const fs = require('fs');
const path = require('path');

// Try to import electron-log if running in Electron environment
let electronLog = null;
try {
  // Check if we're running in Electron and electron-log is available
  if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
    electronLog = require('electron-log');
  }
} catch (e) {
  // electron-log not available, will use only file logging
}

class Logger {
  constructor() {
    // Default: place logs next to repository when running in dev
    let defaultLogDir = path.join(__dirname, '../../logs');

    // If running from an asar-packed app, __dirname will include '.asar' and
    // writing inside the ASAR archive will fail. In packaged Electron apps
    // use the resources path to store logs outside the ASAR.
    try {
      const resourcesPath = process.resourcesPath; // set by Electron when packaged
      if (typeof resourcesPath === 'string' && resourcesPath.length > 0 && __dirname.includes('.asar')) {
        defaultLogDir = path.join(resourcesPath, 'logs');
      }
    } catch (e) {
      // ignore and use fallback
    }

    // Allow override via environment variable
    this.logDir = process.env.LOG_PATH || defaultLogDir;
    this.ensureLogDir();
  }

  ensureLogDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      // If we cannot create the directory (e.g., invalid path inside ASAR),
      // fallback to a temp directory so logging doesn't crash the app.
      try {
        const os = require('os');
        const fallback = path.join(os.tmpdir(), 'digi-biometric-logs');
        if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
        this.logDir = fallback;
      } catch (err2) {
        // Last resort: keep logDir as null so writeToFile will skip file writes.
        this.logDir = null;
      }
    }
  }

  getTimestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').replace('Z', '');
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = this.getTimestamp();
    const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  writeToFile(filename, message) {
    if (!this.logDir) return; // cannot write to file
    try {
      const logFile = path.join(this.logDir, filename);
      fs.appendFileSync(logFile, message + '\n');
    } catch (err) {
      // If file writing fails, write to console to avoid crashing
      try {
        console.error('Failed to write log to file, falling back to console:', err.message);
        console.log(message);
      } catch (e) {
        // ignore
      }
    }
  }

  info(message, meta = {}) {
    const formattedMessage = this.formatMessage('info', message, meta);
    console.log(`\x1b[36m${formattedMessage}\x1b[0m`); // Cyan color
    this.writeToFile('app.log', formattedMessage);
    
    // Also send to electron-log if available
    if (electronLog) {
      electronLog.info(message, meta);
    }
  }

  warn(message, meta = {}) {
    const formattedMessage = this.formatMessage('warn', message, meta);
    console.warn(`\x1b[33m${formattedMessage}\x1b[0m`); // Yellow color
    this.writeToFile('app.log', formattedMessage);
    
    // Also send to electron-log if available
    if (electronLog) {
      electronLog.warn(message, meta);
    }
  }

  error(message, meta = {}) {
    const formattedMessage = this.formatMessage('error', message, meta);
    console.error(`\x1b[31m${formattedMessage}\x1b[0m`); // Red color
    this.writeToFile('app.log', formattedMessage);
    this.writeToFile('error.log', formattedMessage);
    
    // Also send to electron-log if available
    if (electronLog) {
      electronLog.error(message, meta);
    }
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      const formattedMessage = this.formatMessage('debug', message, meta);
      console.log(`\x1b[90m${formattedMessage}\x1b[0m`); // Gray color
      this.writeToFile('debug.log', formattedMessage);
      
      // Also send to electron-log if available
      if (electronLog) {
        electronLog.debug(message, meta);
      }
    }
  }

  success(message, meta = {}) {
    const formattedMessage = this.formatMessage('success', message, meta);
    console.log(`\x1b[32m${formattedMessage}\x1b[0m`); // Green color
    this.writeToFile('app.log', formattedMessage);
    
    // Also send to electron-log if available
    if (electronLog) {
      electronLog.info(message, meta); // Use info level for success messages
    }
  }

  // HTTP request logging
  http(req, res, responseTime) {
    const message = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${responseTime}ms - ${req.ip}`;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    const meta = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    this[level](message, meta);
    
    // Also send to electron-log if available
    if (electronLog) {
      if (res.statusCode >= 400) {
        electronLog.warn(message, meta);
      } else {
        electronLog.info(message, meta);
      }
    }
  }
}

module.exports = new Logger();

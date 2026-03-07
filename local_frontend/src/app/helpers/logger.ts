/**
 * Frontend Logger for Electron Application
 * Logs to both console and localStorage for debugging
 */

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs

  private addLog(level: string, message: string, meta?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta
    };

    // Add to memory
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output
    const consoleMethod = level === 'ERROR' ? 'error' : 
                         level === 'WARN' ? 'warn' : 
                         level === 'DEBUG' ? 'debug' : 'log';
    console[consoleMethod](`[${level}] ${message}`, meta || '');

    // Save to localStorage
    try {
      localStorage.setItem('frontend_logs', JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save logs to localStorage:', error);
    }
  }

  info(message: string, meta?: any) {
    this.addLog('INFO', message, meta);
  }

  error(message: string, meta?: any) {
    this.addLog('ERROR', message, meta);
  }

  warn(message: string, meta?: any) {
    this.addLog('WARN', message, meta);
  }

  debug(message: string, meta?: any) {
    this.addLog('DEBUG', message, meta);
  }

  success(message: string, meta?: any) {
    this.addLog('SUCCESS', message, meta);
  }

  // Get all logs for debugging
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
    localStorage.removeItem('frontend_logs');
  }
}

export const logger = new Logger();

// Log application startup
logger.info('Frontend logger initialized');

/**
 * Logger Utility
 * Winston-based logging configuration for the monitoring system
 */

const winston = require('winston');
const path = require('path');

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Color format for console
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'enterprise-monitoring',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'info'
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log')
    })
  ]
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add custom methods for monitoring
logger.monitoring = {
  metric: (name, value, tags = {}) => {
    logger.info('Metric recorded', { name, value, tags, type: 'metric' });
  },
  
  alert: (name, message, severity, data = {}) => {
    logger.warn('Alert triggered', { 
      name, 
      message, 
      severity, 
      data, 
      type: 'alert' 
    });
  },
  
  health: (status, checks = {}) => {
    logger.info('Health check', { status, checks, type: 'health' });
  },
  
  request: (method, url, statusCode, duration, ip) => {
    logger.info('HTTP request', { 
      method, 
      url, 
      statusCode, 
      duration, 
      ip, 
      type: 'request' 
    });
  },
  
  error: (error, context = {}) => {
    logger.error('Application error', { 
      error: error.message, 
      stack: error.stack, 
      context, 
      type: 'error' 
    });
  }
};

// Add performance logging
logger.performance = {
  start: (operation) => {
    const startTime = Date.now();
    return {
      end: (data = {}) => {
        const duration = Date.now() - startTime;
        logger.info('Performance measurement', {
          operation,
          duration,
          data,
          type: 'performance'
        });
        return duration;
      }
    };
  },
  
  measure: async (operation, fn) => {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      logger.info('Performance measurement', {
        operation,
        duration,
        type: 'performance'
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Performance measurement failed', {
        operation,
        duration,
        error: error.message,
        type: 'performance'
      });
      throw error;
    }
  }
};

// Add structured logging helpers
logger.structured = {
  user: (userId, action, data = {}) => {
    logger.info('User action', { userId, action, data, type: 'user' });
  },
  
  system: (component, action, data = {}) => {
    logger.info('System action', { component, action, data, type: 'system' });
  },
  
  security: (event, data = {}) => {
    logger.warn('Security event', { event, data, type: 'security' });
  },
  
  business: (metric, value, context = {}) => {
    logger.info('Business metric', { metric, value, context, type: 'business' });
  }
};

// Add log rotation helper
logger.rotate = () => {
  logger.info('Log rotation requested');
  // This would trigger log rotation in production
  // For now, just log the request
};

// Add log level management
logger.setLevel = (level) => {
  logger.level = level;
  logger.transports.forEach(transport => {
    if (transport.level !== 'error') {
      transport.level = level;
    }
  });
  logger.info(`Log level changed to: ${level}`);
};

// Add log filtering
logger.filter = (filterFn) => {
  logger.transports.forEach(transport => {
    if (transport.format) {
      transport.format = winston.format.combine(
        winston.format((info) => {
          return filterFn(info) ? info : false;
        })(),
        transport.format
      );
    }
  });
};

// Export logger instance
module.exports = logger; 
/**
 * Express Integration
 * Middleware for Express.js applications
 */

const logger = require('../utils/logger');
const helpers = require('../utils/helpers');

/**
 * Create Express middleware
 */
function createMiddleware(monitoring) {
  return (req, res, next) => {
    if (!monitoring || !monitoring.isStarted) {
      return next();
    }

    const startTime = Date.now();
    const clientIp = helpers.getClientIp(req);
    const userAgent = helpers.parseUserAgent(req.headers['user-agent']);

    // Skip monitoring for certain paths
    if (shouldSkipMonitoring(req.path)) {
      return next();
    }

    // Add monitoring data to request
    req.monitoring = {
      startTime,
      clientIp,
      userAgent,
      trackingId: helpers.generateId('req_')
    };

    // Track request start
    monitoring.increment('http_requests_total', 1, {
      method: req.method,
      path: req.path,
      status: 'started'
    });

    // Override res.end to capture response data
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Track request completion
      monitoring.increment('http_requests_total', 1, {
        method: req.method,
        path: req.path,
        status: 'completed'
      });

      // Track response time
      monitoring.timing('http_requests_duration', duration, {
        method: req.method,
        path: req.path,
        statusCode: statusCode.toString()
      });

      // Track errors
      if (statusCode >= 400) {
        monitoring.increment('http_requests_errors', 1, {
          method: req.method,
          path: req.path,
          statusCode: statusCode.toString()
        });
      }

      // Log request
      logger.monitoring.request(
        req.method,
        req.path,
        statusCode,
        duration,
        clientIp
      );

      // Call original end method
      originalEnd.call(this, chunk, encoding);
    };

    // Handle errors
    const originalError = res.error;
    res.error = function(error) {
      monitoring.increment('app_errors', 1, {
        type: 'http_error',
        path: req.path,
        method: req.method
      });

      logger.monitoring.error(error, {
        requestId: req.monitoring.trackingId,
        path: req.path,
        method: req.method
      });

      if (originalError) {
        originalError.call(this, error);
      }
    };

    next();
  };
}

/**
 * Create health check endpoint
 */
function createHealthEndpoint(monitoring) {
  return (req, res) => {
    try {
      const health = monitoring.getHealth();
      
      res.status(health.status === 'healthy' ? 200 : 503)
         .json({
           status: health.status,
           timestamp: health.timestamp,
           uptime: health.uptime,
           version: health.version,
           checks: health.checks
         });
    } catch (error) {
      logger.error('Health check endpoint error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        timestamp: Date.now()
      });
    }
  };
}

/**
 * Create metrics endpoint
 */
function createMetricsEndpoint(monitoring) {
  return (req, res) => {
    try {
      const metrics = monitoring.getMetrics();
      const summary = monitoring.metrics.getMetricsSummary();
      
      res.json({
        timestamp: Date.now(),
        metrics,
        summary
      });
    } catch (error) {
      logger.error('Metrics endpoint error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve metrics',
        timestamp: Date.now()
      });
    }
  };
}

/**
 * Create alerts endpoint
 */
function createAlertsEndpoint(monitoring) {
  return (req, res) => {
    try {
      const { status, severity, limit = 50 } = req.query;
      const alerts = monitoring.getAlerts({ status, severity, limit: parseInt(limit) });
      const stats = monitoring.alerts.getAlertStats();
      
      res.json({
        timestamp: Date.now(),
        alerts,
        stats
      });
    } catch (error) {
      logger.error('Alerts endpoint error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve alerts',
        timestamp: Date.now()
      });
    }
  };
}

/**
 * Create status endpoint
 */
function createStatusEndpoint(monitoring) {
  return (req, res) => {
    try {
      const status = monitoring.service.getStatus();
      const health = monitoring.getHealth();
      const metrics = monitoring.getMetrics();
      const alerts = monitoring.getAlerts({ limit: 10 });
      
      res.json({
        timestamp: Date.now(),
        service: status,
        health: health.status,
        metrics: Object.keys(metrics).length,
        recentAlerts: alerts.length,
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      });
    } catch (error) {
      logger.error('Status endpoint error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve status',
        timestamp: Date.now()
      });
    }
  };
}

/**
 * Create custom metrics endpoint
 */
function createCustomMetricsEndpoint(monitoring) {
  return (req, res) => {
    try {
      const { method, body } = req;
      
      if (method === 'POST') {
        const { name, value, type = 'gauge', tags = {} } = body;
        
        if (!name || value === undefined) {
          return res.status(400).json({
            error: 'Missing required fields: name and value'
          });
        }
        
        switch (type) {
          case 'counter':
            monitoring.increment(name, value, tags);
            break;
          case 'gauge':
            monitoring.gauge(name, value, tags);
            break;
          case 'timing':
            monitoring.timing(name, value, tags);
            break;
          default:
            return res.status(400).json({
              error: 'Invalid metric type. Must be counter, gauge, or timing'
            });
        }
        
        res.json({ success: true, message: 'Metric recorded' });
      } else {
        res.status(405).json({ error: 'Method not allowed' });
      }
    } catch (error) {
      logger.error('Custom metrics endpoint error:', error);
      res.status(500).json({
        error: 'Failed to process metric',
        message: error.message
      });
    }
  };
}

/**
 * Create Express router with all monitoring endpoints
 */
function createMonitoringRouter(monitoring) {
  const express = require('express');
  const router = express.Router();
  
  // Health check endpoint
  router.get('/health', createHealthEndpoint(monitoring));
  
  // Metrics endpoint
  router.get('/metrics', createMetricsEndpoint(monitoring));
  
  // Alerts endpoint
  router.get('/alerts', createAlertsEndpoint(monitoring));
  
  // Status endpoint
  router.get('/status', createStatusEndpoint(monitoring));
  
  // Custom metrics endpoint
  router.post('/metrics/custom', createCustomMetricsEndpoint(monitoring));
  
  // Force health check
  router.post('/health/check', async (req, res) => {
    try {
      const health = await monitoring.health.forceCheck();
      res.json(health);
    } catch (error) {
      logger.error('Force health check error:', error);
      res.status(500).json({
        error: 'Health check failed',
        message: error.message
      });
    }
  });
  
  // Reset metrics
  router.post('/metrics/reset', (req, res) => {
    try {
      monitoring.metrics.reset();
      res.json({ success: true, message: 'Metrics reset' });
    } catch (error) {
      logger.error('Reset metrics error:', error);
      res.status(500).json({
        error: 'Failed to reset metrics',
        message: error.message
      });
    }
  });
  
  return router;
}

/**
 * Check if request should skip monitoring
 */
function shouldSkipMonitoring(path) {
  const skipPaths = [
    '/health',
    '/metrics',
    '/alerts',
    '/status',
    '/monitoring',
    '/favicon.ico',
    '/robots.txt'
  ];
  
  return skipPaths.some(skipPath => path.startsWith(skipPath));
}

/**
 * Add monitoring to Express app
 */
function addMonitoringToApp(app, monitoring, options = {}) {
  const {
    path = '/monitoring',
    middleware = true,
    endpoints = true
  } = options;
  
  // Add monitoring middleware
  if (middleware) {
    app.use(createMiddleware(monitoring));
  }
  
  // Add monitoring endpoints
  if (endpoints) {
    const router = createMonitoringRouter(monitoring);
    app.use(path, router);
  }
  
  // Add error handling middleware
  app.use((error, req, res, next) => {
    if (req.monitoring) {
      monitoring.increment('app_errors', 1, {
        type: 'express_error',
        path: req.path,
        method: req.method
      });
      
      logger.monitoring.error(error, {
        requestId: req.monitoring.trackingId,
        path: req.path,
        method: req.method
      });
    }
    
    next(error);
  });
  
  logger.info(`Monitoring added to Express app at path: ${path}`);
}

module.exports = {
  createMiddleware,
  createHealthEndpoint,
  createMetricsEndpoint,
  createAlertsEndpoint,
  createStatusEndpoint,
  createCustomMetricsEndpoint,
  createMonitoringRouter,
  addMonitoringToApp
}; 
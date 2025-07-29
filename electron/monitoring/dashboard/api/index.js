/**
 * Dashboard API
 * REST API endpoints for the monitoring dashboard
 */

const express = require('express');
const logger = require('../../utils/logger');

/**
 * Create dashboard router
 */
function createRouter(monitoring) {
  const router = express.Router();
  
  // Authentication middleware
  const auth = createAuthMiddleware(monitoring);
  
  // Dashboard home
  router.get('/', auth, (req, res) => {
    res.json({
      title: 'Enterprise Monitoring Dashboard',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: Date.now(),
      endpoints: {
        metrics: '/api/metrics',
        alerts: '/api/alerts',
        health: '/api/health',
        status: '/api/status'
      }
    });
  });
  
  // Metrics API
  router.get('/api/metrics', auth, (req, res) => {
    try {
      const { timeRange = '1h', limit = 100 } = req.query;
      const metrics = monitoring.getMetrics();
      
      res.json({
        timestamp: Date.now(),
        timeRange,
        metrics,
        summary: monitoring.metrics.getMetricsSummary()
      });
    } catch (error) {
      logger.error('Dashboard metrics API error:', error);
      res.status(500).json({
        error: 'Failed to retrieve metrics',
        message: error.message
      });
    }
  });
  
  // Alerts API
  router.get('/api/alerts', auth, (req, res) => {
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
      logger.error('Dashboard alerts API error:', error);
      res.status(500).json({
        error: 'Failed to retrieve alerts',
        message: error.message
      });
    }
  });
  
  // Health API
  router.get('/api/health', auth, (req, res) => {
    try {
      const health = monitoring.getHealth();
      
      res.json({
        timestamp: Date.now(),
        health
      });
    } catch (error) {
      logger.error('Dashboard health API error:', error);
      res.status(500).json({
        error: 'Failed to retrieve health status',
        message: error.message
      });
    }
  });
  
  // Status API
  router.get('/api/status', auth, (req, res) => {
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
      logger.error('Dashboard status API error:', error);
      res.status(500).json({
        error: 'Failed to retrieve status',
        message: error.message
      });
    }
  });
  
  // Custom metrics API
  router.post('/api/metrics/custom', auth, (req, res) => {
    try {
      const { name, value, type = 'gauge', tags = {} } = req.body;
      
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
    } catch (error) {
      logger.error('Dashboard custom metrics API error:', error);
      res.status(500).json({
        error: 'Failed to process metric',
        message: error.message
      });
    }
  });
  
  // Alert management API
  router.post('/api/alerts/:id/resolve', auth, (req, res) => {
    try {
      const { id } = req.params;
      monitoring.alerts.resolveAlert(id);
      
      res.json({ success: true, message: 'Alert resolved' });
    } catch (error) {
      logger.error('Dashboard resolve alert API error:', error);
      res.status(500).json({
        error: 'Failed to resolve alert',
        message: error.message
      });
    }
  });
  
  // Configuration API
  router.get('/api/config', auth, (req, res) => {
    try {
      const config = monitoring.config;
      
      // Remove sensitive information
      const safeConfig = {
        namespace: config.namespace,
        metrics: config.metrics,
        alerts: config.alerts,
        dashboard: {
          enabled: config.dashboard.enabled,
          path: config.dashboard.path,
          features: config.dashboard.features
        },
        health: config.health
      };
      
      res.json({
        timestamp: Date.now(),
        config: safeConfig
      });
    } catch (error) {
      logger.error('Dashboard config API error:', error);
      res.status(500).json({
        error: 'Failed to retrieve configuration',
        message: error.message
      });
    }
  });
  
  // Storage stats API
  router.get('/api/storage', auth, async (req, res) => {
    try {
      const stats = await monitoring.service.storage.getStats();
      
      res.json({
        timestamp: Date.now(),
        stats
      });
    } catch (error) {
      logger.error('Dashboard storage API error:', error);
      res.status(500).json({
        error: 'Failed to retrieve storage stats',
        message: error.message
      });
    }
  });
  
  // Force health check API
  router.post('/api/health/check', auth, async (req, res) => {
    try {
      const health = await monitoring.health.forceCheck();
      
      res.json({
        timestamp: Date.now(),
        health
      });
    } catch (error) {
      logger.error('Dashboard force health check API error:', error);
      res.status(500).json({
        error: 'Health check failed',
        message: error.message
      });
    }
  });
  
  // Reset metrics API
  router.post('/api/metrics/reset', auth, (req, res) => {
    try {
      monitoring.metrics.reset();
      
      res.json({ success: true, message: 'Metrics reset' });
    } catch (error) {
      logger.error('Dashboard reset metrics API error:', error);
      res.status(500).json({
        error: 'Failed to reset metrics',
        message: error.message
      });
    }
  });
  
  return router;
}

/**
 * Create authentication middleware
 */
function createAuthMiddleware(monitoring) {
  return (req, res, next) => {
    const config = monitoring.config.dashboard;
    
    // Skip auth if not configured
    if (!config.auth) {
      return next();
    }
    
    // Basic authentication
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Monitoring Dashboard"');
      return res.status(401).json({
        error: 'Authentication required'
      });
    }
    
    const credentials = Buffer.from(authHeader.substring(6), 'base64').toString();
    const [username, password] = credentials.split(':');
    
    if (username === config.auth.username && password === config.auth.password) {
      return next();
    }
    
    res.setHeader('WWW-Authenticate', 'Basic realm="Monitoring Dashboard"');
    res.status(401).json({
      error: 'Invalid credentials'
    });
  };
}

module.exports = {
  createRouter
}; 
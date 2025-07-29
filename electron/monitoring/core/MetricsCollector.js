/**
 * Metrics Collector
 * Handles collection and aggregation of various metrics
 */

const logger = require('../utils/logger');

class MetricsCollector {
  constructor(config) {
    this.config = config;
    this.metrics = new Map();
    this.customMetrics = new Map();
    this.collectionInterval = null;
    this.isCollecting = false;
    
    this.initializeDefaultMetrics();
  }

  /**
   * Initialize default system metrics
   */
  initializeDefaultMetrics() {
    // System metrics
    this.addMetric('cpu_usage', { type: 'gauge', description: 'CPU usage percentage' });
    this.addMetric('memory_usage', { type: 'gauge', description: 'Memory usage percentage' });
    this.addMetric('heap_used', { type: 'gauge', description: 'Heap memory used in bytes' });
    this.addMetric('heap_total', { type: 'gauge', description: 'Total heap memory in bytes' });
    
    // HTTP metrics
    this.addMetric('http_requests_total', { type: 'counter', description: 'Total HTTP requests' });
    this.addMetric('http_requests_duration', { type: 'histogram', description: 'HTTP request duration' });
    this.addMetric('http_requests_errors', { type: 'counter', description: 'Total HTTP errors' });
    
    // Application metrics
    this.addMetric('app_uptime', { type: 'gauge', description: 'Application uptime in seconds' });
    this.addMetric('app_errors', { type: 'counter', description: 'Total application errors' });
    
    // Custom metrics from config
    this.config.custom.forEach(metricName => {
      this.addMetric(metricName, { type: 'gauge', description: `Custom metric: ${metricName}` });
    });
  }

  /**
   * Start metrics collection
   */
  async start() {
    if (this.isCollecting) {
      return;
    }

    this.isCollecting = true;
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.interval);

    logger.info('Metrics collection started');
  }

  /**
   * Stop metrics collection
   */
  async stop() {
    if (!this.isCollecting) {
      return;
    }

    this.isCollecting = false;
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }

    logger.info('Metrics collection stopped');
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    try {
      // CPU usage
      const cpuUsage = process.cpuUsage();
      this.gauge('cpu_usage', (cpuUsage.user + cpuUsage.system) / 1000000);

      // Memory usage
      const memUsage = process.memoryUsage();
      const totalMem = require('os').totalmem();
      const usedMem = totalMem - require('os').freemem();
      
      this.gauge('memory_usage', (usedMem / totalMem) * 100);
      this.gauge('heap_used', memUsage.heapUsed);
      this.gauge('heap_total', memUsage.heapTotal);

      // Application uptime
      this.gauge('app_uptime', process.uptime());

    } catch (error) {
      logger.error('Error collecting system metrics:', error);
    }
  }

  /**
   * Add custom metric
   */
  addMetric(name, config) {
    const metric = {
      name,
      type: config.type || 'gauge',
      description: config.description || '',
      value: 0,
      tags: config.tags || {},
      timestamp: Date.now(),
      alerts: config.alerts || null
    };

    this.customMetrics.set(name, metric);
    logger.debug(`Added custom metric: ${name}`);
  }

  /**
   * Track custom event
   */
  track(event, data = {}) {
    const eventMetric = {
      name: `event_${event}`,
      type: 'counter',
      value: 1,
      tags: data,
      timestamp: Date.now()
    };

    this.storeMetric(eventMetric);
    logger.debug(`Tracked event: ${event}`, data);
  }

  /**
   * Increment counter metric
   */
  increment(name, value = 1, tags = {}) {
    const metric = this.getOrCreateMetric(name, 'counter');
    metric.value += value;
    metric.tags = { ...metric.tags, ...tags };
    metric.timestamp = Date.now();

    this.storeMetric(metric);
    logger.debug(`Incremented metric: ${name} by ${value}`);
  }

  /**
   * Set gauge metric
   */
  gauge(name, value, tags = {}) {
    const metric = this.getOrCreateMetric(name, 'gauge');
    metric.value = value;
    metric.tags = { ...metric.tags, ...tags };
    metric.timestamp = Date.now();

    this.storeMetric(metric);
    logger.debug(`Set gauge metric: ${name} = ${value}`);
  }

  /**
   * Record timing metric
   */
  timing(name, value, tags = {}) {
    const metric = this.getOrCreateMetric(name, 'histogram');
    
    if (!metric.values) {
      metric.values = [];
    }
    
    metric.values.push(value);
    metric.tags = { ...metric.tags, ...tags };
    metric.timestamp = Date.now();

    // Calculate statistics
    metric.min = Math.min(...metric.values);
    metric.max = Math.max(...metric.values);
    metric.avg = metric.values.reduce((a, b) => a + b, 0) / metric.values.length;

    this.storeMetric(metric);
    logger.debug(`Recorded timing metric: ${name} = ${value}ms`);
  }

  /**
   * Get or create metric
   */
  getOrCreateMetric(name, type) {
    if (this.metrics.has(name)) {
      return this.metrics.get(name);
    }

    const metric = {
      name,
      type,
      value: 0,
      tags: {},
      timestamp: Date.now()
    };

    this.metrics.set(name, metric);
    return metric;
  }

  /**
   * Store metric data
   */
  storeMetric(metric) {
    // Store in memory
    this.metrics.set(metric.name, metric);

    // Check for alerts
    this.checkMetricAlerts(metric);
  }

  /**
   * Check metric alerts
   */
  checkMetricAlerts(metric) {
    const customMetric = this.customMetrics.get(metric.name);
    if (!customMetric || !customMetric.alerts) {
      return;
    }

    const { threshold, comparator = '>' } = customMetric.alerts;
    let shouldAlert = false;

    switch (comparator) {
      case '>':
        shouldAlert = metric.value > threshold;
        break;
      case '<':
        shouldAlert = metric.value < threshold;
        break;
      case '>=':
        shouldAlert = metric.value >= threshold;
        break;
      case '<=':
        shouldAlert = metric.value <= threshold;
        break;
      case '==':
        shouldAlert = metric.value === threshold;
        break;
    }

    if (shouldAlert) {
      this.triggerAlert(metric, customMetric.alerts);
    }
  }

  /**
   * Trigger alert
   */
  triggerAlert(metric, alertConfig) {
    const alert = {
      name: `${metric.name}_alert`,
      message: `${metric.name} exceeded threshold: ${metric.value} ${alertConfig.comparator} ${alertConfig.threshold}`,
      severity: alertConfig.severity || 'warning',
      metric: metric.name,
      value: metric.value,
      threshold: alertConfig.threshold,
      timestamp: Date.now()
    };

    // Emit alert event
    this.emit('alert', alert);
    logger.warn(`Alert triggered: ${alert.message}`);
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    const metrics = {};
    
    for (const [name, metric] of this.metrics) {
      metrics[name] = {
        ...metric,
        value: metric.value || 0
      };
    }

    return metrics;
  }

  /**
   * Get specific metric
   */
  getMetric(name) {
    return this.metrics.get(name);
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    const summary = {
      total: this.metrics.size,
      types: {},
      recent: []
    };

    for (const [name, metric] of this.metrics) {
      // Count by type
      summary.types[metric.type] = (summary.types[metric.type] || 0) + 1;

      // Recent metrics (last 5 minutes)
      if (Date.now() - metric.timestamp < 5 * 60 * 1000) {
        summary.recent.push({
          name,
          value: metric.value,
          timestamp: metric.timestamp
        });
      }
    }

    return summary;
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics.clear();
    logger.info('Metrics reset');
  }
}

module.exports = MetricsCollector; 
/**
 * Alert Manager
 * Handles alert rules, evaluation, and notification triggering
 */

const logger = require('../utils/logger');

class AlertManager {
  constructor(config) {
    this.config = config;
    this.rules = new Map();
    this.alerts = [];
    this.evaluationInterval = null;
    this.isRunning = false;
    this.cooldowns = new Map();
    
    this.initializeDefaultRules();
  }

  /**
   * Initialize default alert rules
   */
  initializeDefaultRules() {
    // Error rate alert
    this.addRule('error_rate', {
      condition: (metrics) => {
        const errorRate = metrics.http_requests_errors?.value || 0;
        const totalRequests = metrics.http_requests_total?.value || 1;
        return (errorRate / totalRequests) * 100 > (this.config.errorRate?.threshold || 5);
      },
      severity: this.config.errorRate?.severity || 'warning',
      message: 'Error rate exceeded threshold',
      window: this.config.errorRate?.window || '5m',
      cooldown: 5 * 60 * 1000 // 5 minutes
    });

    // Response time alert
    this.addRule('response_time', {
      condition: (metrics) => {
        const avgResponseTime = metrics.http_requests_duration?.avg || 0;
        return avgResponseTime > (this.config.responseTime?.threshold || 2000);
      },
      severity: this.config.responseTime?.severity || 'warning',
      message: 'Response time exceeded threshold',
      window: this.config.responseTime?.window || '1m',
      cooldown: 2 * 60 * 1000 // 2 minutes
    });

    // Memory usage alert
    this.addRule('memory_usage', {
      condition: (metrics) => {
        const memoryUsage = metrics.memory_usage?.value || 0;
        return memoryUsage > (this.config.memoryUsage?.threshold || 80);
      },
      severity: this.config.memoryUsage?.severity || 'critical',
      message: 'Memory usage exceeded threshold',
      window: this.config.memoryUsage?.window || '5m',
      cooldown: 10 * 60 * 1000 // 10 minutes
    });
  }

  /**
   * Start alert manager
   */
  async start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.evaluationInterval = setInterval(() => {
      this.evaluateRules();
    }, 30 * 1000); // Evaluate every 30 seconds

    logger.info('Alert manager started');
  }

  /**
   * Stop alert manager
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }

    logger.info('Alert manager stopped');
  }

  /**
   * Add alert rule
   */
  addRule(name, rule) {
    const alertRule = {
      name,
      condition: rule.condition,
      severity: rule.severity || 'warning',
      message: rule.message || `Alert: ${name}`,
      window: rule.window || '5m',
      cooldown: rule.cooldown || 5 * 60 * 1000,
      enabled: rule.enabled !== false,
      tags: rule.tags || {}
    };

    this.rules.set(name, alertRule);
    logger.debug(`Added alert rule: ${name}`);
  }

  /**
   * Remove alert rule
   */
  removeRule(name) {
    this.rules.delete(name);
    logger.debug(`Removed alert rule: ${name}`);
  }

  /**
   * Enable/disable alert rule
   */
  setRuleEnabled(name, enabled) {
    const rule = this.rules.get(name);
    if (rule) {
      rule.enabled = enabled;
      logger.debug(`${enabled ? 'Enabled' : 'Disabled'} alert rule: ${name}`);
    }
  }

  /**
   * Evaluate all alert rules
   */
  evaluateRules() {
    if (!this.isRunning) {
      return;
    }

    try {
      // Get current metrics (this would come from MetricsCollector)
      const metrics = this.getCurrentMetrics();

      for (const [name, rule] of this.rules) {
        if (!rule.enabled) {
          continue;
        }

        // Check cooldown
        if (this.isInCooldown(name)) {
          continue;
        }

        // Evaluate condition
        if (rule.condition(metrics)) {
          this.triggerAlert(name, rule, metrics);
        }
      }
    } catch (error) {
      logger.error('Error evaluating alert rules:', error);
    }
  }

  /**
   * Get current metrics (placeholder - would be injected)
   */
  getCurrentMetrics() {
    // This would typically come from MetricsCollector
    // For now, return empty object
    return {};
  }

  /**
   * Check if alert is in cooldown
   */
  isInCooldown(ruleName) {
    const lastTriggered = this.cooldowns.get(ruleName);
    if (!lastTriggered) {
      return false;
    }

    const rule = this.rules.get(ruleName);
    const cooldownPeriod = rule?.cooldown || 5 * 60 * 1000;
    
    return (Date.now() - lastTriggered) < cooldownPeriod;
  }

  /**
   * Trigger alert
   */
  triggerAlert(ruleName, rule, metrics) {
    const alert = {
      id: `${ruleName}_${Date.now()}`,
      name: ruleName,
      message: rule.message,
      severity: rule.severity,
      timestamp: Date.now(),
      metrics: this.extractRelevantMetrics(metrics, rule),
      tags: rule.tags,
      status: 'active'
    };

    // Add to alerts list
    this.alerts.push(alert);

    // Set cooldown
    this.cooldowns.set(ruleName, Date.now());

    // Emit alert event
    this.emit('alert', alert);

    logger.warn(`Alert triggered: ${ruleName} - ${rule.message}`, {
      severity: rule.severity,
      metrics: alert.metrics
    });
  }

  /**
   * Extract relevant metrics for alert
   */
  extractRelevantMetrics(metrics, rule) {
    const relevant = {};
    
    // Extract metrics mentioned in the condition
    const conditionStr = rule.condition.toString();
    const metricNames = Object.keys(metrics);
    
    for (const metricName of metricNames) {
      if (conditionStr.includes(metricName)) {
        relevant[metricName] = metrics[metricName];
      }
    }

    return relevant;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = Date.now();
      
      logger.info(`Alert resolved: ${alert.name}`);
      this.emit('alertResolved', alert);
    }
  }

  /**
   * Get all alerts
   */
  getAlerts(options = {}) {
    let alerts = [...this.alerts];

    // Filter by status
    if (options.status) {
      alerts = alerts.filter(alert => alert.status === options.status);
    }

    // Filter by severity
    if (options.severity) {
      alerts = alerts.filter(alert => alert.severity === options.severity);
    }

    // Filter by time range
    if (options.since) {
      alerts = alerts.filter(alert => alert.timestamp >= options.since);
    }

    // Sort by timestamp (newest first)
    alerts.sort((a, b) => b.timestamp - a.timestamp);

    // Limit results
    if (options.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return alerts;
  }

  /**
   * Get alert statistics
   */
  getAlertStats() {
    const stats = {
      total: this.alerts.length,
      active: 0,
      resolved: 0,
      bySeverity: {},
      byRule: {},
      recent: []
    };

    for (const alert of this.alerts) {
      // Count by status
      if (alert.status === 'active') {
        stats.active++;
      } else {
        stats.resolved++;
      }

      // Count by severity
      stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;

      // Count by rule
      stats.byRule[alert.name] = (stats.byRule[alert.name] || 0) + 1;

      // Recent alerts (last hour)
      if (Date.now() - alert.timestamp < 60 * 60 * 1000) {
        stats.recent.push(alert);
      }
    }

    return stats;
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const cutoff = Date.now() - maxAge;
    const initialCount = this.alerts.length;
    
    this.alerts = this.alerts.filter(alert => alert.timestamp >= cutoff);
    
    const removedCount = initialCount - this.alerts.length;
    if (removedCount > 0) {
      logger.info(`Cleared ${removedCount} old alerts`);
    }
  }

  /**
   * Get rule status
   */
  getRuleStatus() {
    const status = {};
    
    for (const [name, rule] of this.rules) {
      status[name] = {
        enabled: rule.enabled,
        inCooldown: this.isInCooldown(name),
        lastTriggered: this.cooldowns.get(name),
        cooldownPeriod: rule.cooldown
      };
    }

    return status;
  }
}

module.exports = AlertManager; 
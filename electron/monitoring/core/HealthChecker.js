/**
 * Health Checker
 * Performs health checks and provides health status endpoints
 */

const logger = require('../utils/logger');

class HealthChecker {
  constructor(config) {
    this.config = config;
    this.checks = new Map();
    this.healthStatus = {
      status: 'healthy',
      timestamp: Date.now(),
      uptime: 0,
      checks: {},
      version: process.env.npm_package_version || '1.0.0'
    };
    
    this.initializeDefaultChecks();
  }

  /**
   * Initialize default health checks
   */
  initializeDefaultChecks() {
    // Memory check
    this.addCheck('memory', {
      check: () => this.checkMemory(),
      interval: 30 * 1000, // 30 seconds
      timeout: 5000, // 5 seconds
      critical: true
    });

    // CPU check
    this.addCheck('cpu', {
      check: () => this.checkCPU(),
      interval: 60 * 1000, // 1 minute
      timeout: 5000,
      critical: false
    });

    // Uptime check
    this.addCheck('uptime', {
      check: () => this.checkUptime(),
      interval: 30 * 1000,
      timeout: 1000,
      critical: false
    });

    // Process check
    this.addCheck('process', {
      check: () => this.checkProcess(),
      interval: 30 * 1000,
      timeout: 1000,
      critical: true
    });
  }

  /**
   * Start health checker
   */
  async start() {
    // Run initial health check
    await this.performHealthCheck();
    
    // Start periodic health checks
    this.healthInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30 * 1000); // Every 30 seconds

    logger.info('Health checker started');
  }

  /**
   * Stop health checker
   */
  async stop() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }

    logger.info('Health checker stopped');
  }

  /**
   * Add custom health check
   */
  addCheck(name, checkConfig) {
    const check = {
      name,
      check: checkConfig.check,
      interval: checkConfig.interval || 30 * 1000,
      timeout: checkConfig.timeout || 5000,
      critical: checkConfig.critical || false,
      lastRun: null,
      lastResult: null,
      consecutiveFailures: 0
    };

    this.checks.set(name, check);
    logger.debug(`Added health check: ${name}`);
  }

  /**
   * Remove health check
   */
  removeCheck(name) {
    this.checks.delete(name);
    logger.debug(`Removed health check: ${name}`);
  }

  /**
   * Perform all health checks
   */
  async performHealthCheck() {
    const results = {};
    let overallStatus = 'healthy';
    let criticalFailures = 0;

    for (const [name, check] of this.checks) {
      try {
        const result = await this.runCheck(name, check);
        results[name] = result;

        if (result.status === 'unhealthy') {
          if (check.critical) {
            criticalFailures++;
          }
          overallStatus = 'unhealthy';
        }
      } catch (error) {
        logger.error(`Health check ${name} failed:`, error);
        results[name] = {
          status: 'unhealthy',
          error: error.message,
          timestamp: Date.now()
        };
        
        if (check.critical) {
          criticalFailures++;
        }
        overallStatus = 'unhealthy';
      }
    }

    // Update health status
    this.healthStatus = {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: process.uptime(),
      checks: results,
      version: process.env.npm_package_version || '1.0.0',
      criticalFailures
    };

    // Log status change
    if (overallStatus === 'unhealthy') {
      logger.warn('Health check failed', { results, criticalFailures });
    } else {
      logger.debug('Health check passed');
    }
  }

  /**
   * Run individual health check
   */
  async runCheck(name, check) {
    const startTime = Date.now();
    
    try {
      // Check if enough time has passed since last run
      if (check.lastRun && (Date.now() - check.lastRun) < check.interval) {
        return check.lastResult;
      }

      // Run check with timeout
      const result = await Promise.race([
        check.check(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Check timeout')), check.timeout)
        )
      ]);

      const duration = Date.now() - startTime;
      const checkResult = {
        status: 'healthy',
        duration,
        timestamp: Date.now(),
        data: result
      };

      // Update check state
      check.lastRun = Date.now();
      check.lastResult = checkResult;
      check.consecutiveFailures = 0;

      return checkResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      check.consecutiveFailures++;
      
      const checkResult = {
        status: 'unhealthy',
        duration,
        timestamp: Date.now(),
        error: error.message,
        consecutiveFailures: check.consecutiveFailures
      };

      check.lastRun = Date.now();
      check.lastResult = checkResult;

      return checkResult;
    }
  }

  /**
   * Memory health check
   */
  async checkMemory() {
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const usedMem = totalMem - require('os').freemem();
    const memoryUsagePercent = (usedMem / totalMem) * 100;

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      memoryUsagePercent,
      threshold: 90 // Alert if memory usage > 90%
    };
  }

  /**
   * CPU health check
   */
  async checkCPU() {
    const startUsage = process.cpuUsage();
    
    // Wait a bit to measure CPU usage
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const endUsage = process.cpuUsage(startUsage);
    const cpuUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds

    return {
      cpuUsage,
      user: endUsage.user,
      system: endUsage.system,
      threshold: 80 // Alert if CPU usage > 80%
    };
  }

  /**
   * Uptime health check
   */
  async checkUptime() {
    const uptime = process.uptime();
    const osUptime = require('os').uptime();

    return {
      processUptime: uptime,
      osUptime: osUptime,
      formatted: this.formatUptime(uptime)
    };
  }

  /**
   * Process health check
   */
  async checkProcess() {
    return {
      pid: process.pid,
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      nodeEnv: process.env.NODE_ENV || 'development',
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }

  /**
   * Format uptime in human readable format
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Get current health status
   */
  getStatus() {
    return this.healthStatus;
  }

  /**
   * Get detailed health status
   */
  getDetailedStatus() {
    const status = this.getStatus();
    
    return {
      ...status,
      summary: {
        total: Object.keys(status.checks).length,
        healthy: Object.values(status.checks).filter(c => c.status === 'healthy').length,
        unhealthy: Object.values(status.checks).filter(c => c.status === 'unhealthy').length,
        critical: status.criticalFailures
      },
      recommendations: this.getRecommendations(status)
    };
  }

  /**
   * Get health recommendations
   */
  getRecommendations(status) {
    const recommendations = [];

    if (status.criticalFailures > 0) {
      recommendations.push('Critical health checks are failing. Immediate attention required.');
    }

    // Check memory usage
    const memoryCheck = status.checks.memory;
    if (memoryCheck && memoryCheck.data && memoryCheck.data.memoryUsagePercent > 80) {
      recommendations.push('Memory usage is high. Consider optimizing or scaling.');
    }

    // Check CPU usage
    const cpuCheck = status.checks.cpu;
    if (cpuCheck && cpuCheck.data && cpuCheck.data.cpuUsage > 70) {
      recommendations.push('CPU usage is high. Consider load balancing or optimization.');
    }

    return recommendations;
  }

  /**
   * Force health check
   */
  async forceCheck() {
    logger.info('Forcing health check');
    await this.performHealthCheck();
    return this.getStatus();
  }

  /**
   * Get health check history
   */
  getHistory(limit = 10) {
    // This would typically come from storage
    // For now, return empty array
    return [];
  }
}

module.exports = HealthChecker; 
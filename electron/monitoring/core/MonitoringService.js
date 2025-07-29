/**
 * Monitoring Service
 * Core service for managing the monitoring system lifecycle
 */

const logger = require('../utils/logger');
const config = require('../utils/config');

class MonitoringService {
  constructor(config) {
    this.config = config;
    this.isRunning = false;
    this.startTime = null;
    this.storage = null;
    this.notifiers = [];
    
    this.initializeStorage();
    this.initializeNotifiers();
  }

  /**
   * Initialize storage backend
   */
  async initializeStorage() {
    const { type, connection, options } = this.config.storage;
    
    try {
      switch (type) {
        case 'redis':
          const RedisStorage = require('../storage/RedisStorage');
          this.storage = new RedisStorage(connection, options);
          break;
        case 'mongo':
          const MongoStorage = require('../storage/MongoStorage');
          this.storage = new MongoStorage(connection, options);
          break;
        case 'file':
          const FileStorage = require('../storage/FileStorage');
          this.storage = new FileStorage(options);
          break;
        default:
          const MemoryStorage = require('../storage/MemoryStorage');
          this.storage = new MemoryStorage(options);
      }
      
      await this.storage.connect();
      logger.info(`Storage initialized: ${type}`);
    } catch (error) {
      logger.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  /**
   * Initialize notification channels
   */
  initializeNotifiers() {
    const { notifications } = this.config;
    
    if (notifications.slack) {
      const SlackNotifier = require('../notifications/SlackNotifier');
      this.notifiers.push(new SlackNotifier(notifications.slack));
    }
    
    if (notifications.discord) {
      const DiscordNotifier = require('../notifications/DiscordNotifier');
      this.notifiers.push(new DiscordNotifier(notifications.discord));
    }
    
    if (notifications.email) {
      const EmailNotifier = require('../notifications/EmailNotifier');
      this.notifiers.push(new EmailNotifier(notifications.email));
    }
    
    if (notifications.webhook) {
      const WebhookNotifier = require('../notifications/WebhookNotifier');
      this.notifiers.push(new WebhookNotifier(notifications.webhook));
    }
    
    logger.info(`Initialized ${this.notifiers.length} notification channels`);
  }

  /**
   * Start the monitoring service
   */
  async start() {
    if (this.isRunning) {
      return;
    }

    try {
      this.startTime = Date.now();
      this.isRunning = true;
      
      // Start background tasks
      this.startBackgroundTasks();
      
      logger.info('Monitoring service started');
    } catch (error) {
      logger.error('Failed to start monitoring service:', error);
      throw error;
    }
  }

  /**
   * Stop the monitoring service
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      this.isRunning = false;
      
      // Stop background tasks
      this.stopBackgroundTasks();
      
      // Close storage connection
      if (this.storage) {
        await this.storage.disconnect();
      }
      
      logger.info('Monitoring service stopped');
    } catch (error) {
      logger.error('Error stopping monitoring service:', error);
      throw error;
    }
  }

  /**
   * Start background tasks
   */
  startBackgroundTasks() {
    // Data cleanup task
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000); // Every hour
    
    // Health check task
    this.healthInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30 * 1000); // Every 30 seconds
  }

  /**
   * Stop background tasks
   */
  stopBackgroundTasks() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }
  }

  /**
   * Cleanup old data
   */
  async cleanupOldData() {
    try {
      const retention = this.config.metrics.retention;
      const cutoff = Date.now() - retention;
      
      await this.storage.cleanup(cutoff);
      logger.debug('Old data cleanup completed');
    } catch (error) {
      logger.error('Data cleanup failed:', error);
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    try {
      const health = {
        uptime: Date.now() - this.startTime,
        memory: process.memoryUsage(),
        storage: await this.storage.isHealthy(),
        timestamp: Date.now()
      };
      
      await this.storage.store('health', health);
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  /**
   * Send notification
   */
  async sendNotification(alert) {
    const promises = this.notifiers.map(notifier => 
      notifier.send(alert).catch(error => {
        logger.error(`Notification failed for ${notifier.constructor.name}:`, error);
      })
    );
    
    await Promise.allSettled(promises);
  }

  /**
   * Store metric data
   */
  async storeMetric(name, value, tags = {}, timestamp = Date.now()) {
    try {
      const metric = {
        name,
        value,
        tags,
        timestamp,
        namespace: this.config.namespace
      };
      
      await this.storage.store('metrics', metric);
      return metric;
    } catch (error) {
      logger.error('Failed to store metric:', error);
      throw error;
    }
  }

  /**
   * Store alert data
   */
  async storeAlert(alert) {
    try {
      const alertData = {
        ...alert,
        timestamp: Date.now(),
        namespace: this.config.namespace
      };
      
      await this.storage.store('alerts', alertData);
      
      // Send notifications
      await this.sendNotification(alertData);
      
      return alertData;
    } catch (error) {
      logger.error('Failed to store alert:', error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      running: this.isRunning,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      storage: this.storage ? this.storage.getStatus() : null,
      notifiers: this.notifiers.length,
      config: {
        namespace: this.config.namespace,
        storage: this.config.storage.type
      }
    };
  }
}

module.exports = MonitoringService; 
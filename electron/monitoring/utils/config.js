/**
 * Configuration Utility
 * Handles configuration management and validation
 */

const path = require('path');
const fs = require('fs');

class ConfigManager {
  constructor() {
    this.config = {};
    this.envPrefix = 'ENTERPRISE_MONITORING_';
    this.configFile = 'monitoring.config.js';
    
    this.loadConfiguration();
  }

  /**
   * Load configuration from multiple sources
   */
  loadConfiguration() {
    // Default configuration
    const defaultConfig = this.getDefaultConfig();
    
    // Environment variables
    const envConfig = this.loadFromEnvironment();
    
    // Config file
    const fileConfig = this.loadFromFile();
    
    // Merge configurations (file > env > default)
    this.config = this.mergeConfigs(defaultConfig, envConfig, fileConfig);
    
    // Validate configuration
    this.validateConfig();
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      enabled: true,
      namespace: 'enterprise-monitoring',
      logLevel: 'info',
      
      metrics: {
        interval: 10000, // 10 seconds
        retention: 24 * 60 * 60 * 1000, // 24 hours
        custom: []
      },
      
      alerts: {
        errorRate: { threshold: 5, window: '5m', severity: 'warning' },
        responseTime: { threshold: 2000, window: '1m', severity: 'warning' },
        memoryUsage: { threshold: 80, window: '5m', severity: 'critical' }
      },
      
      notifications: {
        slack: null,
        discord: null,
        email: null,
        webhook: null
      },
      
      storage: {
        type: 'memory', // memory, redis, mongo, file
        connection: null,
        options: {
          ttl: 3600,
          maxSize: 1000
        }
      },
      
      dashboard: {
        enabled: true,
        path: '/monitoring',
        auth: null,
        features: ['metrics', 'alerts', 'logs', 'health'],
        theme: 'light'
      },
      
      health: {
        enabled: true,
        path: '/health',
        checks: ['memory', 'cpu', 'uptime'],
        interval: 30000
      },
      
      security: {
        cors: {
          enabled: true,
          origin: '*',
          methods: ['GET', 'POST', 'PUT', 'DELETE']
        },
        rateLimit: {
          enabled: false,
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100
        }
      }
    };
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnvironment() {
    const envConfig = {};
    
    // Basic settings
    if (process.env[this.envPrefix + 'ENABLED']) {
      envConfig.enabled = process.env[this.envPrefix + 'ENABLED'] === 'true';
    }
    
    if (process.env[this.envPrefix + 'NAMESPACE']) {
      envConfig.namespace = process.env[this.envPrefix + 'NAMESPACE'];
    }
    
    if (process.env[this.envPrefix + 'LOG_LEVEL']) {
      envConfig.logLevel = process.env[this.envPrefix + 'LOG_LEVEL'];
    }
    
    // Metrics configuration
    if (process.env[this.envPrefix + 'METRICS_INTERVAL']) {
      envConfig.metrics = {
        ...envConfig.metrics,
        interval: parseInt(process.env[this.envPrefix + 'METRICS_INTERVAL'])
      };
    }
    
    // Storage configuration
    if (process.env[this.envPrefix + 'STORAGE_TYPE']) {
      envConfig.storage = {
        ...envConfig.storage,
        type: process.env[this.envPrefix + 'STORAGE_TYPE']
      };
    }
    
    if (process.env[this.envPrefix + 'STORAGE_CONNECTION']) {
      envConfig.storage = {
        ...envConfig.storage,
        connection: process.env[this.envPrefix + 'STORAGE_CONNECTION']
      };
    }
    
    // Notification configurations
    if (process.env[this.envPrefix + 'SLACK_WEBHOOK']) {
      envConfig.notifications = {
        ...envConfig.notifications,
        slack: { webhook: process.env[this.envPrefix + 'SLACK_WEBHOOK'] }
      };
    }
    
    if (process.env[this.envPrefix + 'DISCORD_WEBHOOK']) {
      envConfig.notifications = {
        ...envConfig.notifications,
        discord: { webhook: process.env[this.envPrefix + 'DISCORD_WEBHOOK'] }
      };
    }
    
    if (process.env[this.envPrefix + 'EMAIL_SMTP']) {
      envConfig.notifications = {
        ...envConfig.notifications,
        email: { smtp: process.env[this.envPrefix + 'EMAIL_SMTP'] }
      };
    }
    
    // Dashboard configuration
    if (process.env[this.envPrefix + 'DASHBOARD_PATH']) {
      envConfig.dashboard = {
        ...envConfig.dashboard,
        path: process.env[this.envPrefix + 'DASHBOARD_PATH']
      };
    }
    
    if (process.env[this.envPrefix + 'DASHBOARD_AUTH']) {
      const [username, password] = process.env[this.envPrefix + 'DASHBOARD_AUTH'].split(':');
      envConfig.dashboard = {
        ...envConfig.dashboard,
        auth: { username, password }
      };
    }
    
    return envConfig;
  }

  /**
   * Load configuration from file
   */
  loadFromFile() {
    const configPaths = [
      path.join(process.cwd(), this.configFile),
      path.join(process.cwd(), 'config', this.configFile),
      path.join(process.cwd(), '.config', this.configFile)
    ];
    
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const config = require(configPath);
          return typeof config === 'function' ? config() : config;
        } catch (error) {
          console.warn(`Failed to load config file: ${configPath}`, error.message);
        }
      }
    }
    
    return {};
  }

  /**
   * Merge multiple configuration objects
   */
  mergeConfigs(...configs) {
    return configs.reduce((merged, config) => {
      return this.deepMerge(merged, config);
    }, {});
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Validate configuration
   */
  validateConfig() {
    const errors = [];
    
    // Validate required fields
    if (!this.config.namespace) {
      errors.push('Namespace is required');
    }
    
    // Validate metrics configuration
    if (this.config.metrics.interval < 1000) {
      errors.push('Metrics interval must be at least 1000ms');
    }
    
    // Validate storage configuration
    const validStorageTypes = ['memory', 'redis', 'mongo', 'file'];
    if (!validStorageTypes.includes(this.config.storage.type)) {
      errors.push(`Invalid storage type. Must be one of: ${validStorageTypes.join(', ')}`);
    }
    
    // Validate notification configurations
    if (this.config.notifications.slack && !this.config.notifications.slack.webhook) {
      errors.push('Slack webhook URL is required when Slack notifications are enabled');
    }
    
    if (this.config.notifications.discord && !this.config.notifications.discord.webhook) {
      errors.push('Discord webhook URL is required when Discord notifications are enabled');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Get configuration value
   */
  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  /**
   * Set configuration value
   */
  set(key, value) {
    const keys = key.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get entire configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  update(newConfig) {
    this.config = this.mergeConfigs(this.config, newConfig);
    this.validateConfig();
  }

  /**
   * Reset to default configuration
   */
  reset() {
    this.config = this.getDefaultConfig();
  }

  /**
   * Export configuration to file
   */
  exportToFile(filePath = this.configFile) {
    const configContent = `module.exports = ${JSON.stringify(this.config, null, 2)};`;
    fs.writeFileSync(filePath, configContent);
  }

  /**
   * Get configuration for specific component
   */
  getComponentConfig(component) {
    return this.config[component] || {};
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature) {
    const featureConfig = {
      dashboard: this.config.dashboard?.enabled,
      health: this.config.health?.enabled,
      metrics: this.config.enabled,
      alerts: this.config.enabled,
      notifications: Object.values(this.config.notifications).some(n => n !== null)
    };
    
    return featureConfig[feature] || false;
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig() {
    const env = process.env.NODE_ENV || 'development';
    const envConfig = this.config.environments?.[env] || {};
    
    return this.mergeConfigs(this.config, envConfig);
  }
}

// Create singleton instance
const configManager = new ConfigManager();

// Export both the class and the instance
module.exports = configManager;
module.exports.ConfigManager = ConfigManager; 
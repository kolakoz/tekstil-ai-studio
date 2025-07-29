/**
 * Webhook Notifier
 * Send notifications to generic webhook endpoints
 */

const logger = require('../utils/logger');
const helpers = require('../utils/helpers');

class WebhookNotifier {
  constructor(config) {
    this.config = config;
    this.url = config.url;
    this.method = config.method || 'POST';
    this.headers = config.headers || { 'Content-Type': 'application/json' };
    this.timeout = config.timeout || 10000;
    this.retries = config.retries || 3;
    
    if (!this.url) {
      throw new Error('Webhook URL is required');
    }
  }

  /**
   * Send notification to webhook
   */
  async send(alert) {
    try {
      const payload = this.formatPayload(alert);
      
      const response = await this.makeRequest(payload);
      
      logger.info('Webhook notification sent', {
        alert: alert.name,
        severity: alert.severity,
        url: this.url,
        status: response.status
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to send webhook notification:', error);
      throw error;
    }
  }

  /**
   * Make HTTP request with retries
   */
  async makeRequest(payload, attempt = 1) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(this.url, {
        method: this.method,
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      if (attempt < this.retries && this.shouldRetry(error)) {
        logger.warn(`Webhook request failed, retrying (${attempt}/${this.retries}):`, error.message);
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.makeRequest(payload, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * Check if error should trigger a retry
   */
  shouldRetry(error) {
    // Retry on network errors, timeouts, and 5xx server errors
    return error.name === 'AbortError' || 
           error.message.includes('timeout') ||
           error.message.includes('network') ||
           error.message.includes('5');
  }

  /**
   * Format alert payload for webhook
   */
  formatPayload(alert) {
    const basePayload = {
      alert: {
        id: alert.id,
        name: alert.name,
        message: alert.message,
        severity: alert.severity,
        timestamp: alert.timestamp,
        status: alert.status
      },
      metadata: {
        source: 'enterprise-monitoring',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: Date.now()
      }
    };
    
    // Add metrics if available
    if (alert.metrics && Object.keys(alert.metrics).length > 0) {
      basePayload.metrics = alert.metrics;
    }
    
    // Add tags if available
    if (alert.tags && Object.keys(alert.tags).length > 0) {
      basePayload.tags = alert.tags;
    }
    
    // Add custom fields from config
    if (this.config.customFields) {
      basePayload.custom = this.config.customFields;
    }
    
    return basePayload;
  }

  /**
   * Test notification
   */
  async test() {
    const testAlert = {
      id: 'test_alert_' + Date.now(),
      name: 'test_alert',
      message: 'This is a test notification from Enterprise Monitoring',
      severity: 'info',
      timestamp: Date.now(),
      status: 'active',
      metrics: {
        test_metric: 42,
        response_time: 150
      },
      tags: {
        test: true,
        source: 'webhook_notifier',
        environment: 'development'
      }
    };
    
    return await this.send(testAlert);
  }

  /**
   * Get notifier status
   */
  getStatus() {
    return {
      type: 'webhook',
      enabled: !!this.url,
      url: this.url,
      method: this.method,
      timeout: this.timeout,
      retries: this.retries
    };
  }

  /**
   * Validate webhook configuration
   */
  validate() {
    const errors = [];
    
    if (!this.url) {
      errors.push('Webhook URL is required');
    }
    
    if (!helpers.isValidUrl(this.url)) {
      errors.push('Invalid webhook URL format');
    }
    
    if (this.timeout < 1000 || this.timeout > 60000) {
      errors.push('Timeout must be between 1000ms and 60000ms');
    }
    
    if (this.retries < 0 || this.retries > 10) {
      errors.push('Retries must be between 0 and 10');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = WebhookNotifier; 
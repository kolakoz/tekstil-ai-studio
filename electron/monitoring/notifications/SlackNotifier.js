/**
 * Slack Notifier
 * Send notifications to Slack channels
 */

const logger = require('../utils/logger');
const helpers = require('../utils/helpers');

class SlackNotifier {
  constructor(config) {
    this.config = config;
    this.webhook = config.webhook;
    this.channel = config.channel || '#monitoring';
    this.username = config.username || 'Enterprise Monitoring';
    this.icon = config.icon || ':warning:';
    
    if (!this.webhook) {
      throw new Error('Slack webhook URL is required');
    }
  }

  /**
   * Send notification to Slack
   */
  async send(alert) {
    try {
      const message = this.formatMessage(alert);
      
      const response = await fetch(this.webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });
      
      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
      }
      
      logger.info('Slack notification sent', {
        alert: alert.name,
        severity: alert.severity,
        channel: this.channel
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
      throw error;
    }
  }

  /**
   * Format alert message for Slack
   */
  formatMessage(alert) {
    const color = this.getSeverityColor(alert.severity);
    const icon = this.getSeverityIcon(alert.severity);
    
    const message = {
      channel: this.channel,
      username: this.username,
      icon_emoji: this.icon,
      attachments: [
        {
          color: color,
          title: `${icon} Alert: ${alert.name}`,
          text: alert.message,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Timestamp',
              value: helpers.formatTimestamp(alert.timestamp),
              short: true
            }
          ],
          footer: 'Enterprise Monitoring',
          ts: Math.floor(alert.timestamp / 1000)
        }
      ]
    };
    
    // Add metric data if available
    if (alert.metrics && Object.keys(alert.metrics).length > 0) {
      const metricFields = [];
      
      for (const [name, metric] of Object.entries(alert.metrics)) {
        metricFields.push({
          title: name,
          value: typeof metric === 'object' ? JSON.stringify(metric) : String(metric),
          short: true
        });
      }
      
      message.attachments[0].fields.push(...metricFields);
    }
    
    // Add tags if available
    if (alert.tags && Object.keys(alert.tags).length > 0) {
      const tagText = Object.entries(alert.tags)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      
      message.attachments[0].fields.push({
        title: 'Tags',
        value: tagText,
        short: false
      });
    }
    
    return message;
  }

  /**
   * Get color for severity level
   */
  getSeverityColor(severity) {
    const colors = {
      critical: '#ff0000',
      error: '#ff6b6b',
      warning: '#ffa500',
      info: '#4ecdc4',
      success: '#2ecc71'
    };
    
    return colors[severity] || colors.info;
  }

  /**
   * Get icon for severity level
   */
  getSeverityIcon(severity) {
    const icons = {
      critical: ':rotating_light:',
      error: ':x:',
      warning: ':warning:',
      info: ':information_source:',
      success: ':white_check_mark:'
    };
    
    return icons[severity] || icons.info;
  }

  /**
   * Test notification
   */
  async test() {
    const testAlert = {
      name: 'test_alert',
      message: 'This is a test notification from Enterprise Monitoring',
      severity: 'info',
      timestamp: Date.now(),
      metrics: {
        test_metric: 42
      },
      tags: {
        test: true,
        source: 'slack_notifier'
      }
    };
    
    return await this.send(testAlert);
  }

  /**
   * Get notifier status
   */
  getStatus() {
    return {
      type: 'slack',
      enabled: !!this.webhook,
      channel: this.channel,
      username: this.username
    };
  }
}

module.exports = SlackNotifier; 
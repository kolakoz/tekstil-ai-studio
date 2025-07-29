/**
 * Discord Notifier
 * Send notifications to Discord channels
 */

const logger = require('../utils/logger');
const helpers = require('../utils/helpers');

class DiscordNotifier {
  constructor(config) {
    this.config = config;
    this.webhook = config.webhook;
    this.username = config.username || 'Enterprise Monitoring';
    this.avatar = config.avatar;
    
    if (!this.webhook) {
      throw new Error('Discord webhook URL is required');
    }
  }

  /**
   * Send notification to Discord
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
        throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
      }
      
      logger.info('Discord notification sent', {
        alert: alert.name,
        severity: alert.severity
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to send Discord notification:', error);
      throw error;
    }
  }

  /**
   * Format alert message for Discord
   */
  formatMessage(alert) {
    const color = this.getSeverityColor(alert.severity);
    const icon = this.getSeverityIcon(alert.severity);
    
    const embed = {
      title: `${icon} Alert: ${alert.name}`,
      description: alert.message,
      color: color,
      timestamp: new Date(alert.timestamp).toISOString(),
      footer: {
        text: 'Enterprise Monitoring'
      },
      fields: [
        {
          name: 'Severity',
          value: alert.severity.toUpperCase(),
          inline: true
        },
        {
          name: 'Timestamp',
          value: helpers.formatTimestamp(alert.timestamp),
          inline: true
        }
      ]
    };
    
    // Add metric data if available
    if (alert.metrics && Object.keys(alert.metrics).length > 0) {
      const metricFields = [];
      
      for (const [name, metric] of Object.entries(alert.metrics)) {
        metricFields.push({
          name: name,
          value: typeof metric === 'object' ? JSON.stringify(metric) : String(metric),
          inline: true
        });
      }
      
      embed.fields.push(...metricFields);
    }
    
    // Add tags if available
    if (alert.tags && Object.keys(alert.tags).length > 0) {
      const tagText = Object.entries(alert.tags)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      
      embed.fields.push({
        name: 'Tags',
        value: tagText,
        inline: false
      });
    }
    
    const message = {
      username: this.username,
      embeds: [embed]
    };
    
    if (this.avatar) {
      message.avatar_url = this.avatar;
    }
    
    return message;
  }

  /**
   * Get color for severity level
   */
  getSeverityColor(severity) {
    const colors = {
      critical: 0xff0000, // Red
      error: 0xff6b6b,    // Light red
      warning: 0xffa500,  // Orange
      info: 0x4ecdc4,     // Teal
      success: 0x2ecc71   // Green
    };
    
    return colors[severity] || colors.info;
  }

  /**
   * Get icon for severity level
   */
  getSeverityIcon(severity) {
    const icons = {
      critical: '🚨',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      success: '✅'
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
        source: 'discord_notifier'
      }
    };
    
    return await this.send(testAlert);
  }

  /**
   * Get notifier status
   */
  getStatus() {
    return {
      type: 'discord',
      enabled: !!this.webhook,
      username: this.username
    };
  }
}

module.exports = DiscordNotifier; 
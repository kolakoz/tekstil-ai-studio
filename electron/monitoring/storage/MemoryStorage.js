/**
 * Memory Storage
 * In-memory storage implementation for metrics and alerts
 */

const logger = require('../utils/logger');
const helpers = require('../utils/helpers');

class MemoryStorage {
  constructor(options = {}) {
    this.options = {
      maxSize: options.maxSize || 10000,
      ttl: options.ttl || 3600 * 1000, // 1 hour default
      cleanupInterval: options.cleanupInterval || 5 * 60 * 1000, // 5 minutes
      ...options
    };
    
    this.data = new Map();
    this.metadata = new Map();
    this.cleanupTimer = null;
    this.isConnected = false;
  }

  /**
   * Connect to storage
   */
  async connect() {
    if (this.isConnected) {
      return;
    }

    try {
      // Start cleanup timer
      this.startCleanupTimer();
      
      this.isConnected = true;
      logger.info('Memory storage connected');
    } catch (error) {
      logger.error('Failed to connect to memory storage:', error);
      throw error;
    }
  }

  /**
   * Disconnect from storage
   */
  async disconnect() {
    if (!this.isConnected) {
      return;
    }

    try {
      // Stop cleanup timer
      this.stopCleanupTimer();
      
      // Clear all data
      this.data.clear();
      this.metadata.clear();
      
      this.isConnected = false;
      logger.info('Memory storage disconnected');
    } catch (error) {
      logger.error('Error disconnecting from memory storage:', error);
      throw error;
    }
  }

  /**
   * Store data
   */
  async store(collection, data) {
    if (!this.isConnected) {
      throw new Error('Storage not connected');
    }

    try {
      const key = this.generateKey(collection, data);
      const timestamp = Date.now();
      
      // Store data with metadata
      this.data.set(key, {
        ...data,
        _timestamp: timestamp,
        _collection: collection
      });
      
      // Store metadata
      this.metadata.set(key, {
        collection,
        timestamp,
        ttl: this.options.ttl
      });
      
      // Check size limit
      this.enforceSizeLimit();
      
      logger.debug(`Stored data in ${collection}:`, { key, timestamp });
      return key;
    } catch (error) {
      logger.error('Failed to store data:', error);
      throw error;
    }
  }

  /**
   * Retrieve data
   */
  async get(collection, query = {}) {
    if (!this.isConnected) {
      throw new Error('Storage not connected');
    }

    try {
      const results = [];
      const now = Date.now();
      
      for (const [key, data] of this.data.entries()) {
        const metadata = this.metadata.get(key);
        
        // Check if data belongs to collection
        if (metadata?.collection !== collection) {
          continue;
        }
        
        // Check if data is expired
        if (now - metadata.timestamp > metadata.ttl) {
          this.data.delete(key);
          this.metadata.delete(key);
          continue;
        }
        
        // Apply query filters
        if (this.matchesQuery(data, query)) {
          results.push({
            key,
            data: { ...data },
            metadata: { ...metadata }
          });
        }
      }
      
      // Sort by timestamp (newest first)
      results.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
      
      logger.debug(`Retrieved ${results.length} items from ${collection}`);
      return results;
    } catch (error) {
      logger.error('Failed to retrieve data:', error);
      throw error;
    }
  }

  /**
   * Update data
   */
  async update(collection, query, updates) {
    if (!this.isConnected) {
      throw new Error('Storage not connected');
    }

    try {
      const items = await this.get(collection, query);
      let updatedCount = 0;
      
      for (const item of items) {
        const updatedData = { ...item.data, ...updates };
        this.data.set(item.key, updatedData);
        updatedCount++;
      }
      
      logger.debug(`Updated ${updatedCount} items in ${collection}`);
      return updatedCount;
    } catch (error) {
      logger.error('Failed to update data:', error);
      throw error;
    }
  }

  /**
   * Delete data
   */
  async delete(collection, query = {}) {
    if (!this.isConnected) {
      throw new Error('Storage not connected');
    }

    try {
      const items = await this.get(collection, query);
      let deletedCount = 0;
      
      for (const item of items) {
        this.data.delete(item.key);
        this.metadata.delete(item.key);
        deletedCount++;
      }
      
      logger.debug(`Deleted ${deletedCount} items from ${collection}`);
      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete data:', error);
      throw error;
    }
  }

  /**
   * Count items in collection
   */
  async count(collection, query = {}) {
    if (!this.isConnected) {
      throw new Error('Storage not connected');
    }

    try {
      const items = await this.get(collection, query);
      return items.length;
    } catch (error) {
      logger.error('Failed to count data:', error);
      throw error;
    }
  }

  /**
   * Aggregate data
   */
  async aggregate(collection, pipeline) {
    if (!this.isConnected) {
      throw new Error('Storage not connected');
    }

    try {
      const items = await this.get(collection);
      let data = items.map(item => item.data);
      
      // Apply aggregation pipeline
      for (const stage of pipeline) {
        data = this.applyAggregationStage(data, stage);
      }
      
      return data;
    } catch (error) {
      logger.error('Failed to aggregate data:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired data
   */
  async cleanup(cutoff = null) {
    if (!this.isConnected) {
      return;
    }

    try {
      const now = Date.now();
      const threshold = cutoff || (now - this.options.ttl);
      let deletedCount = 0;
      
      for (const [key, metadata] of this.metadata.entries()) {
        if (metadata.timestamp < threshold) {
          this.data.delete(key);
          this.metadata.delete(key);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired items`);
      }
    } catch (error) {
      logger.error('Failed to cleanup data:', error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    if (!this.isConnected) {
      return null;
    }

    try {
      const collections = new Set();
      let totalItems = 0;
      let totalSize = 0;
      
      for (const [key, metadata] of this.metadata.entries()) {
        collections.add(metadata.collection);
        totalItems++;
        
        const data = this.data.get(key);
        if (data) {
          totalSize += JSON.stringify(data).length;
        }
      }
      
      return {
        type: 'memory',
        connected: this.isConnected,
        collections: Array.from(collections),
        totalItems,
        totalSize: helpers.formatBytes(totalSize),
        maxSize: this.options.maxSize,
        ttl: this.options.ttl
      };
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      return null;
    }
  }

  /**
   * Check if storage is healthy
   */
  async isHealthy() {
    return this.isConnected;
  }

  /**
   * Generate unique key
   */
  generateKey(collection, data) {
    const timestamp = Date.now();
    const random = helpers.randomString(8);
    return `${collection}_${timestamp}_${random}`;
  }

  /**
   * Check if data matches query
   */
  matchesQuery(data, query) {
    for (const [key, value] of Object.entries(query)) {
      if (data[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Apply aggregation stage
   */
  applyAggregationStage(data, stage) {
    const { $match, $group, $sort, $limit, $project } = stage;
    
    if ($match) {
      return data.filter(item => this.matchesQuery(item, $match));
    }
    
    if ($group) {
      const groups = new Map();
      
      for (const item of data) {
        const groupKey = $group._id ? item[$group._id] : 'default';
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, { _id: groupKey });
        }
        
        const group = groups.get(groupKey);
        
        // Apply aggregation functions
        for (const [field, operation] of Object.entries($group)) {
          if (field === '_id') continue;
          
          const { $sum, $avg, $min, $max, $count } = operation;
          
          if ($sum) {
            group[field] = (group[field] || 0) + (item[$sum] || 0);
          } else if ($avg) {
            if (!group[field]) {
              group[field] = { sum: 0, count: 0 };
            }
            group[field].sum += item[$avg] || 0;
            group[field].count++;
          } else if ($min) {
            if (!group[field] || item[$min] < group[field]) {
              group[field] = item[$min];
            }
          } else if ($max) {
            if (!group[field] || item[$max] > group[field]) {
              group[field] = item[$max];
            }
          } else if ($count) {
            group[field] = (group[field] || 0) + 1;
          }
        }
      }
      
      // Convert averages
      for (const group of groups.values()) {
        for (const [field, value] of Object.entries(group)) {
          if (field === '_id') continue;
          if (value && typeof value === 'object' && value.sum !== undefined) {
            group[field] = value.sum / value.count;
          }
        }
      }
      
      return Array.from(groups.values());
    }
    
    if ($sort) {
      return data.sort((a, b) => {
        for (const [field, order] of Object.entries($sort)) {
          const aVal = a[field];
          const bVal = b[field];
          
          if (aVal < bVal) return order === 1 ? -1 : 1;
          if (aVal > bVal) return order === 1 ? 1 : -1;
        }
        return 0;
      });
    }
    
    if ($limit) {
      return data.slice(0, $limit);
    }
    
    if ($project) {
      return data.map(item => {
        const projected = {};
        for (const [field, value] of Object.entries($project)) {
          projected[field] = value === 1 ? item[field] : value;
        }
        return projected;
      });
    }
    
    return data;
  }

  /**
   * Enforce size limit
   */
  enforceSizeLimit() {
    if (this.data.size <= this.options.maxSize) {
      return;
    }
    
    // Remove oldest items
    const items = Array.from(this.metadata.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = this.data.size - this.options.maxSize;
    
    for (let i = 0; i < toRemove; i++) {
      const [key] = items[i];
      this.data.delete(key);
      this.metadata.delete(key);
    }
    
    logger.warn(`Removed ${toRemove} items to enforce size limit`);
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get storage status
   */
  getStatus() {
    return {
      type: 'memory',
      connected: this.isConnected,
      size: this.data.size,
      maxSize: this.options.maxSize,
      ttl: this.options.ttl
    };
  }
}

module.exports = MemoryStorage; 
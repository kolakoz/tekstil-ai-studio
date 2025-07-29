const logger = require('../utils/logger');

class RedisStorage {
  constructor(config = {}) {
    this.config = {
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password || null,
      db: config.db || 0,
      keyPrefix: config.keyPrefix || 'monitoring:',
      ttl: config.ttl || 24 * 60 * 60, // 24 hours default
      maxSize: config.maxSize || 10000,
      ...config
    };
    
    this.client = null;
    this.isConnected = false;
    this.namespace = config.namespace || 'default';
  }

  async connect() {
    try {
      // Redis client'ı dinamik olarak import et
      const redis = require('redis');
      
      this.client = redis.createClient({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis server refused connection', { error: options.error });
            return new Error('Redis server refused connection');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis retry time exhausted', { total_retry_time: options.total_retry_time });
            return new Error('Redis retry time exhausted');
          }
          if (options.attempt > 10) {
            logger.error('Redis max retry attempts reached', { attempt: options.attempt });
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error', { error: err.message });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected', { 
          host: this.config.host, 
          port: this.config.port,
          db: this.config.db 
        });
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.info('Redis client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      
      // Test connection
      await this.client.ping();
      logger.info('Redis storage connected', { 
        host: this.config.host, 
        port: this.config.port,
        namespace: this.namespace 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to connect to Redis', { 
        error: error.message, 
        host: this.config.host,
        port: this.config.port 
      });
      throw error;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        logger.info('Redis storage disconnected');
      } catch (error) {
        logger.error('Error disconnecting from Redis', { error: error.message });
      }
    }
  }

  getKey(type, id = '') {
    return `${this.config.keyPrefix}${this.namespace}:${type}${id ? ':' + id : ''}`;
  }

  async store(type, id, data, ttl = null) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const key = this.getKey(type, id);
      const value = JSON.stringify({
        ...data,
        timestamp: Date.now(),
        namespace: this.namespace
      });

      const pipeline = this.client.pipeline();
      
      // Store the data
      pipeline.set(key, value);
      
      // Set TTL if provided
      if (ttl || this.config.ttl) {
        pipeline.expire(key, ttl || this.config.ttl);
      }
      
      // Add to index for listing
      const indexKey = this.getKey(`${type}_index`);
      pipeline.sadd(indexKey, id);
      
      // Add to sorted set for time-based queries
      const timeKey = this.getKey(`${type}_time`);
      pipeline.zadd(timeKey, Date.now(), id);
      
      await pipeline.exec();
      
      logger.debug('Data stored in Redis', { 
        type, 
        id, 
        key,
        size: value.length 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to store data in Redis', { 
        error: error.message, 
        type, 
        id 
      });
      throw error;
    }
  }

  async get(type, id) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const key = this.getKey(type, id);
      const data = await this.client.get(key);
      
      if (!data) {
        return null;
      }
      
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to get data from Redis', { 
        error: error.message, 
        type, 
        id 
      });
      throw error;
    }
  }

  async update(type, id, data) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const existing = await this.get(type, id);
      if (!existing) {
        throw new Error(`Data not found: ${type}:${id}`);
      }

      const updatedData = {
        ...existing,
        ...data,
        updatedAt: Date.now()
      };

      return await this.store(type, id, updatedData);
    } catch (error) {
      logger.error('Failed to update data in Redis', { 
        error: error.message, 
        type, 
        id 
      });
      throw error;
    }
  }

  async delete(type, id) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const key = this.getKey(type, id);
      const pipeline = this.client.pipeline();
      
      // Remove the data
      pipeline.del(key);
      
      // Remove from index
      const indexKey = this.getKey(`${type}_index`);
      pipeline.srem(indexKey, id);
      
      // Remove from time index
      const timeKey = this.getKey(`${type}_time`);
      pipeline.zrem(timeKey, id);
      
      await pipeline.exec();
      
      logger.debug('Data deleted from Redis', { type, id, key });
      return true;
    } catch (error) {
      logger.error('Failed to delete data from Redis', { 
        error: error.message, 
        type, 
        id 
      });
      throw error;
    }
  }

  async list(type, options = {}) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const {
        limit = 100,
        offset = 0,
        sortBy = 'timestamp',
        sortOrder = 'desc',
        filter = null
      } = options;

      let ids = [];
      
      if (sortBy === 'timestamp') {
        const timeKey = this.getKey(`${type}_time`);
        if (sortOrder === 'desc') {
          ids = await this.client.zrevrange(timeKey, offset, offset + limit - 1);
        } else {
          ids = await this.client.zrange(timeKey, offset, offset + limit - 1);
        }
      } else {
        const indexKey = this.getKey(`${type}_index`);
        ids = await this.client.smembers(indexKey);
        // Simple sorting - in production you might want more sophisticated sorting
        if (sortOrder === 'desc') {
          ids = ids.reverse();
        }
        ids = ids.slice(offset, offset + limit);
      }

      const results = [];
      for (const id of ids) {
        const data = await this.get(type, id);
        if (data) {
          if (filter && typeof filter === 'function') {
            if (filter(data)) {
              results.push(data);
            }
          } else {
            results.push(data);
          }
        }
      }

      return results;
    } catch (error) {
      logger.error('Failed to list data from Redis', { 
        error: error.message, 
        type 
      });
      throw error;
    }
  }

  async count(type) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const indexKey = this.getKey(`${type}_index`);
      return await this.client.scard(indexKey);
    } catch (error) {
      logger.error('Failed to count data in Redis', { 
        error: error.message, 
        type 
      });
      throw error;
    }
  }

  async aggregate(type, aggregation, options = {}) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const data = await this.list(type, { limit: 1000, ...options });
      
      if (aggregation === 'sum') {
        return data.reduce((sum, item) => sum + (item.value || 0), 0);
      } else if (aggregation === 'avg') {
        const sum = data.reduce((sum, item) => sum + (item.value || 0), 0);
        return data.length > 0 ? sum / data.length : 0;
      } else if (aggregation === 'min') {
        return Math.min(...data.map(item => item.value || 0));
      } else if (aggregation === 'max') {
        return Math.max(...data.map(item => item.value || 0));
      } else if (aggregation === 'count') {
        return data.length;
      }
      
      return data;
    } catch (error) {
      logger.error('Failed to aggregate data in Redis', { 
        error: error.message, 
        type, 
        aggregation 
      });
      throw error;
    }
  }

  async cleanup(type, maxAge = null) {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const cutoff = Date.now() - (maxAge || this.config.ttl * 1000);
      const timeKey = this.getKey(`${type}_time`);
      
      // Get IDs older than cutoff
      const oldIds = await this.client.zrangebyscore(timeKey, 0, cutoff);
      
      if (oldIds.length > 0) {
        const pipeline = this.client.pipeline();
        
        for (const id of oldIds) {
          const key = this.getKey(type, id);
          pipeline.del(key);
          
          const indexKey = this.getKey(`${type}_index`);
          pipeline.srem(indexKey, id);
        }
        
        pipeline.zremrangebyscore(timeKey, 0, cutoff);
        await pipeline.exec();
        
        logger.info('Cleaned up old data from Redis', { 
          type, 
          count: oldIds.length 
        });
      }
      
      return oldIds.length;
    } catch (error) {
      logger.error('Failed to cleanup Redis data', { 
        error: error.message, 
        type 
      });
      throw error;
    }
  }

  async getStats() {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const info = await this.client.info();
      const memory = await this.client.info('memory');
      
      return {
        connected: this.isConnected,
        host: this.config.host,
        port: this.config.port,
        namespace: this.namespace,
        info: info,
        memory: memory,
        metrics: await this.count('metrics'),
        alerts: await this.count('alerts')
      };
    } catch (error) {
      logger.error('Failed to get Redis stats', { error: error.message });
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected', error: 'Redis not connected' };
      }
      
      await this.client.ping();
      return { status: 'healthy' };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message 
      };
    }
  }

  getStatus() {
    return {
      type: 'redis',
      connected: this.isConnected,
      host: this.config.host,
      port: this.config.port,
      namespace: this.namespace
    };
  }
}

module.exports = RedisStorage; 
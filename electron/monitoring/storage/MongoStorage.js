const logger = require('../utils/logger');

class MongoStorage {
  constructor(config = {}) {
    this.config = {
      url: config.url || 'mongodb://localhost:27017',
      database: config.database || 'monitoring',
      collections: {
        metrics: config.collections?.metrics || 'metrics',
        alerts: config.collections?.alerts || 'alerts',
        health: config.collections?.health || 'health'
      },
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        ...config.options
      },
      ttl: config.ttl || 24 * 60 * 60, // 24 hours default
      maxSize: config.maxSize || 10000,
      ...config
    };
    
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.namespace = config.namespace || 'default';
  }

  async connect() {
    try {
      // MongoDB client'ı dinamik olarak import et
      const { MongoClient } = require('mongodb');
      
      this.client = new MongoClient(this.config.url, this.config.options);
      
      await this.client.connect();
      this.db = this.client.db(this.config.database);
      this.isConnected = true;
      
      // Collections'ları oluştur ve index'leri ayarla
      await this.initializeCollections();
      
      logger.info('MongoDB storage connected', { 
        url: this.config.url,
        database: this.config.database,
        namespace: this.namespace 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to connect to MongoDB', { 
        error: error.message, 
        url: this.config.url 
      });
      throw error;
    }
  }

  async initializeCollections() {
    try {
      // Metrics collection
      const metricsCollection = this.db.collection(this.config.collections.metrics);
      await metricsCollection.createIndex({ namespace: 1, timestamp: -1 });
      await metricsCollection.createIndex({ namespace: 1, name: 1, timestamp: -1 });
      await metricsCollection.createIndex({ timestamp: 1 }, { expireAfterSeconds: this.config.ttl });
      
      // Alerts collection
      const alertsCollection = this.db.collection(this.config.collections.alerts);
      await alertsCollection.createIndex({ namespace: 1, timestamp: -1 });
      await alertsCollection.createIndex({ namespace: 1, severity: 1, timestamp: -1 });
      await alertsCollection.createIndex({ timestamp: 1 }, { expireAfterSeconds: this.config.ttl });
      
      // Health collection
      const healthCollection = this.db.collection(this.config.collections.health);
      await healthCollection.createIndex({ namespace: 1, timestamp: -1 });
      await healthCollection.createIndex({ timestamp: 1 }, { expireAfterSeconds: this.config.ttl });
      
      logger.debug('MongoDB collections initialized with indexes');
    } catch (error) {
      logger.error('Failed to initialize MongoDB collections', { error: error.message });
      throw error;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.close();
        logger.info('MongoDB storage disconnected');
      } catch (error) {
        logger.error('Error disconnecting from MongoDB', { error: error.message });
      }
    }
  }

  async store(type, id, data, ttl = null) {
    if (!this.isConnected) {
      throw new Error('MongoDB not connected');
    }

    try {
      const collection = this.db.collection(this.config.collections[type] || type);
      
      const document = {
        _id: id,
        namespace: this.namespace,
        timestamp: Date.now(),
        ...data
      };

      await collection.replaceOne(
        { _id: id, namespace: this.namespace },
        document,
        { upsert: true }
      );
      
      logger.debug('Data stored in MongoDB', { 
        type, 
        id, 
        collection: collection.collectionName,
        size: JSON.stringify(document).length 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to store data in MongoDB', { 
        error: error.message, 
        type, 
        id 
      });
      throw error;
    }
  }

  async get(type, id) {
    if (!this.isConnected) {
      throw new Error('MongoDB not connected');
    }

    try {
      const collection = this.db.collection(this.config.collections[type] || type);
      const document = await collection.findOne({ 
        _id: id, 
        namespace: this.namespace 
      });
      
      if (!document) {
        return null;
      }
      
      // Remove MongoDB specific fields
      const { _id, ...data } = document;
      return { id: _id, ...data };
    } catch (error) {
      logger.error('Failed to get data from MongoDB', { 
        error: error.message, 
        type, 
        id 
      });
      throw error;
    }
  }

  async update(type, id, data) {
    if (!this.isConnected) {
      throw new Error('MongoDB not connected');
    }

    try {
      const collection = this.db.collection(this.config.collections[type] || type);
      
      const result = await collection.updateOne(
        { _id: id, namespace: this.namespace },
        { 
          $set: {
            ...data,
            updatedAt: Date.now()
          }
        }
      );
      
      if (result.matchedCount === 0) {
        throw new Error(`Data not found: ${type}:${id}`);
      }
      
      logger.debug('Data updated in MongoDB', { type, id });
      return true;
    } catch (error) {
      logger.error('Failed to update data in MongoDB', { 
        error: error.message, 
        type, 
        id 
      });
      throw error;
    }
  }

  async delete(type, id) {
    if (!this.isConnected) {
      throw new Error('MongoDB not connected');
    }

    try {
      const collection = this.db.collection(this.config.collections[type] || type);
      
      const result = await collection.deleteOne({ 
        _id: id, 
        namespace: this.namespace 
      });
      
      logger.debug('Data deleted from MongoDB', { 
        type, 
        id, 
        deletedCount: result.deletedCount 
      });
      
      return result.deletedCount > 0;
    } catch (error) {
      logger.error('Failed to delete data from MongoDB', { 
        error: error.message, 
        type, 
        id 
      });
      throw error;
    }
  }

  async list(type, options = {}) {
    if (!this.isConnected) {
      throw new Error('MongoDB not connected');
    }

    try {
      const {
        limit = 100,
        offset = 0,
        sortBy = 'timestamp',
        sortOrder = 'desc',
        filter = null
      } = options;

      const collection = this.db.collection(this.config.collections[type] || type);
      
      // Build query
      const query = { namespace: this.namespace };
      if (filter && typeof filter === 'function') {
        // Note: MongoDB query filters are more complex to implement
        // For now, we'll fetch and filter in memory
      }
      
      // Build sort
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
      
      const cursor = collection
        .find(query)
        .sort(sort)
        .skip(offset)
        .limit(limit);
      
      const documents = await cursor.toArray();
      
      // Transform documents
      const results = documents.map(doc => {
        const { _id, ...data } = doc;
        return { id: _id, ...data };
      });
      
      return results;
    } catch (error) {
      logger.error('Failed to list data from MongoDB', { 
        error: error.message, 
        type 
      });
      throw error;
    }
  }

  async count(type) {
    if (!this.isConnected) {
      throw new Error('MongoDB not connected');
    }

    try {
      const collection = this.db.collection(this.config.collections[type] || type);
      return await collection.countDocuments({ namespace: this.namespace });
    } catch (error) {
      logger.error('Failed to count data in MongoDB', { 
        error: error.message, 
        type 
      });
      throw error;
    }
  }

  async aggregate(type, aggregation, options = {}) {
    if (!this.isConnected) {
      throw new Error('MongoDB not connected');
    }

    try {
      const collection = this.db.collection(this.config.collections[type] || type);
      
      const pipeline = [
        { $match: { namespace: this.namespace } }
      ];
      
      switch (aggregation) {
        case 'sum':
          pipeline.push({
            $group: {
              _id: null,
              total: { $sum: '$value' }
            }
          });
          break;
        case 'avg':
          pipeline.push({
            $group: {
              _id: null,
              average: { $avg: '$value' }
            }
          });
          break;
        case 'min':
          pipeline.push({
            $group: {
              _id: null,
              minimum: { $min: '$value' }
            }
          });
          break;
        case 'max':
          pipeline.push({
            $group: {
              _id: null,
              maximum: { $max: '$value' }
            }
          });
          break;
        case 'count':
          pipeline.push({
            $group: {
              _id: null,
              count: { $sum: 1 }
            }
          });
          break;
        default:
          // Return all documents
          pipeline.push({ $limit: 1000 });
      }
      
      const results = await collection.aggregate(pipeline).toArray();
      
      if (results.length === 0) {
        return aggregation === 'count' ? 0 : 0;
      }
      
      const result = results[0];
      
      switch (aggregation) {
        case 'sum':
          return result.total || 0;
        case 'avg':
          return result.average || 0;
        case 'min':
          return result.minimum || 0;
        case 'max':
          return result.maximum || 0;
        case 'count':
          return result.count || 0;
        default:
          return results.map(doc => {
            const { _id, ...data } = doc;
            return { id: _id, ...data };
          });
      }
    } catch (error) {
      logger.error('Failed to aggregate data in MongoDB', { 
        error: error.message, 
        type, 
        aggregation 
      });
      throw error;
    }
  }

  async cleanup(type, maxAge = null) {
    if (!this.isConnected) {
      throw new Error('MongoDB not connected');
    }

    try {
      const collection = this.db.collection(this.config.collections[type] || type);
      const cutoff = new Date(Date.now() - (maxAge || this.config.ttl * 1000));
      
      const result = await collection.deleteMany({
        namespace: this.namespace,
        timestamp: { $lt: cutoff.getTime() }
      });
      
      if (result.deletedCount > 0) {
        logger.info('Cleaned up old data from MongoDB', { 
          type, 
          count: result.deletedCount 
        });
      }
      
      return result.deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup MongoDB data', { 
        error: error.message, 
        type 
      });
      throw error;
    }
  }

  async getStats() {
    if (!this.isConnected) {
      throw new Error('MongoDB not connected');
    }

    try {
      const stats = await this.db.stats();
      const metrics = await this.count('metrics');
      const alerts = await this.count('alerts');
      
      return {
        connected: this.isConnected,
        url: this.config.url,
        database: this.config.database,
        namespace: this.namespace,
        stats: stats,
        metrics: metrics,
        alerts: alerts
      };
    } catch (error) {
      logger.error('Failed to get MongoDB stats', { error: error.message });
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected', error: 'MongoDB not connected' };
      }
      
      // Simple ping test
      await this.db.admin().ping();
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
      type: 'mongo',
      connected: this.isConnected,
      url: this.config.url,
      database: this.config.database,
      namespace: this.namespace
    };
  }
}

module.exports = MongoStorage; 
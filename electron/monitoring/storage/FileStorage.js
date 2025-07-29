const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class FileStorage {
  constructor(config = {}) {
    this.config = {
      basePath: config.basePath || './data/monitoring',
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles || 100,
      ttl: config.ttl || 24 * 60 * 60, // 24 hours default
      compression: config.compression || false,
      ...config
    };
    
    this.isConnected = false;
    this.namespace = config.namespace || 'default';
    this.dataPath = path.join(this.config.basePath, this.namespace);
  }

  async connect() {
    try {
      // Data directory'yi oluştur
      await this.ensureDirectory(this.dataPath);
      
      // Alt dizinleri oluştur
      await this.ensureDirectory(path.join(this.dataPath, 'metrics'));
      await this.ensureDirectory(path.join(this.dataPath, 'alerts'));
      await this.ensureDirectory(path.join(this.dataPath, 'health'));
      
      this.isConnected = true;
      
      logger.info('File storage connected', { 
        basePath: this.config.basePath,
        namespace: this.namespace,
        dataPath: this.dataPath 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to connect to file storage', { 
        error: error.message, 
        basePath: this.config.basePath 
      });
      throw error;
    }
  }

  async disconnect() {
    this.isConnected = false;
    logger.info('File storage disconnected');
  }

  async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  getFilePath(type, id) {
    const fileName = `${id}.json`;
    return path.join(this.dataPath, type, fileName);
  }

  getIndexPath(type) {
    return path.join(this.dataPath, `${type}_index.json`);
  }

  async store(type, id, data, ttl = null) {
    if (!this.isConnected) {
      throw new Error('File storage not connected');
    }

    try {
      const filePath = this.getFilePath(type, id);
      const indexPath = this.getIndexPath(type);
      
      const document = {
        id,
        namespace: this.namespace,
        timestamp: Date.now(),
        ttl: ttl || this.config.ttl,
        ...data
      };

      // Dosyayı yaz
      await fs.writeFile(filePath, JSON.stringify(document, null, 2));
      
      // Index'i güncelle
      await this.updateIndex(type, id, document.timestamp);
      
      logger.debug('Data stored in file', { 
        type, 
        id, 
        filePath,
        size: JSON.stringify(document).length 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to store data in file', { 
        error: error.message, 
        type, 
        id 
      });
      throw error;
    }
  }

  async get(type, id) {
    if (!this.isConnected) {
      throw new Error('File storage not connected');
    }

    try {
      const filePath = this.getFilePath(type, id);
      
      try {
        const data = await fs.readFile(filePath, 'utf8');
        const document = JSON.parse(data);
        
        // TTL kontrolü
        if (document.ttl && Date.now() - document.timestamp > document.ttl * 1000) {
          await this.delete(type, id);
          return null;
        }
        
        return document;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return null;
        }
        throw error;
      }
    } catch (error) {
      logger.error('Failed to get data from file', { 
        error: error.message, 
        type, 
        id 
      });
      throw error;
    }
  }

  async update(type, id, data) {
    if (!this.isConnected) {
      throw new Error('File storage not connected');
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
      logger.error('Failed to update data in file', { 
        error: error.message, 
        type, 
        id 
      });
      throw error;
    }
  }

  async delete(type, id) {
    if (!this.isConnected) {
      throw new Error('File storage not connected');
    }

    try {
      const filePath = this.getFilePath(type, id);
      const indexPath = this.getIndexPath(type);
      
      // Dosyayı sil
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      // Index'den kaldır
      await this.removeFromIndex(type, id);
      
      logger.debug('Data deleted from file', { type, id, filePath });
      return true;
    } catch (error) {
      logger.error('Failed to delete data from file', { 
        error: error.message, 
        type, 
        id 
      });
      throw error;
    }
  }

  async list(type, options = {}) {
    if (!this.isConnected) {
      throw new Error('File storage not connected');
    }

    try {
      const {
        limit = 100,
        offset = 0,
        sortBy = 'timestamp',
        sortOrder = 'desc',
        filter = null
      } = options;

      const indexPath = this.getIndexPath(type);
      let index = [];
      
      try {
        const indexData = await fs.readFile(indexPath, 'utf8');
        index = JSON.parse(indexData);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // Sort index
      if (sortBy === 'timestamp') {
        index.sort((a, b) => {
          const aTime = a.timestamp || 0;
          const bTime = b.timestamp || 0;
          return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
        });
      }

      // Apply offset and limit
      const paginatedIndex = index.slice(offset, offset + limit);
      
      // Load actual data
      const results = [];
      for (const item of paginatedIndex) {
        const data = await this.get(type, item.id);
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
      logger.error('Failed to list data from file', { 
        error: error.message, 
        type 
      });
      throw error;
    }
  }

  async count(type) {
    if (!this.isConnected) {
      throw new Error('File storage not connected');
    }

    try {
      const indexPath = this.getIndexPath(type);
      
      try {
        const indexData = await fs.readFile(indexPath, 'utf8');
        const index = JSON.parse(indexData);
        return index.length;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return 0;
        }
        throw error;
      }
    } catch (error) {
      logger.error('Failed to count data in file', { 
        error: error.message, 
        type 
      });
      throw error;
    }
  }

  async aggregate(type, aggregation, options = {}) {
    if (!this.isConnected) {
      throw new Error('File storage not connected');
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
      logger.error('Failed to aggregate data in file', { 
        error: error.message, 
        type, 
        aggregation 
      });
      throw error;
    }
  }

  async updateIndex(type, id, timestamp) {
    try {
      const indexPath = this.getIndexPath(type);
      let index = [];
      
      try {
        const indexData = await fs.readFile(indexPath, 'utf8');
        index = JSON.parse(indexData);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // Remove existing entry if exists
      index = index.filter(item => item.id !== id);
      
      // Add new entry
      index.push({ id, timestamp });
      
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    } catch (error) {
      logger.error('Failed to update index', { error: error.message, type, id });
      throw error;
    }
  }

  async removeFromIndex(type, id) {
    try {
      const indexPath = this.getIndexPath(type);
      
      try {
        const indexData = await fs.readFile(indexPath, 'utf8');
        let index = JSON.parse(indexData);
        
        index = index.filter(item => item.id !== id);
        
        await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    } catch (error) {
      logger.error('Failed to remove from index', { error: error.message, type, id });
      throw error;
    }
  }

  async cleanup(type, maxAge = null) {
    if (!this.isConnected) {
      throw new Error('File storage not connected');
    }

    try {
      const cutoff = Date.now() - (maxAge || this.config.ttl * 1000);
      const indexPath = this.getIndexPath(type);
      
      let index = [];
      try {
        const indexData = await fs.readFile(indexPath, 'utf8');
        index = JSON.parse(indexData);
      } catch (error) {
        if (error.code === 'ENOENT') {
          return 0;
        }
        throw error;
      }

      const oldIds = index
        .filter(item => item.timestamp < cutoff)
        .map(item => item.id);

      let deletedCount = 0;
      for (const id of oldIds) {
        try {
          await this.delete(type, id);
          deletedCount++;
        } catch (error) {
          logger.warn('Failed to delete old file', { error: error.message, type, id });
        }
      }

      if (deletedCount > 0) {
        logger.info('Cleaned up old data from file', { 
          type, 
          count: deletedCount 
        });
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup file data', { 
        error: error.message, 
        type 
      });
      throw error;
    }
  }

  async getStats() {
    if (!this.isConnected) {
      throw new Error('File storage not connected');
    }

    try {
      const metrics = await this.count('metrics');
      const alerts = await this.count('alerts');
      
      // Calculate directory size
      let totalSize = 0;
      try {
        const stats = await fs.stat(this.dataPath);
        totalSize = stats.size;
      } catch (error) {
        // Directory might not exist yet
      }

      return {
        connected: this.isConnected,
        basePath: this.config.basePath,
        namespace: this.namespace,
        dataPath: this.dataPath,
        totalSize,
        metrics,
        alerts
      };
    } catch (error) {
      logger.error('Failed to get file storage stats', { error: error.message });
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected', error: 'File storage not connected' };
      }
      
      // Test write access
      const testFile = path.join(this.dataPath, '.health_check');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
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
      type: 'file',
      connected: this.isConnected,
      basePath: this.config.basePath,
      namespace: this.namespace,
      dataPath: this.dataPath
    };
  }
}

module.exports = FileStorage; 
const LRU = require('lru-cache');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SmartCache {
  constructor(options = {}) {
    // In-memory cache
    this.memoryCache = new LRU({
      max: options.maxMemoryItems || 10000,
      maxSize: options.maxMemorySize || 500 * 1024 * 1024, // 500MB
      sizeCalculation: (value) => value.size || 1,
      ttl: options.ttl || 1000 * 60 * 60, // 1 hour
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });
    
    // Disk cache settings
    this.diskCachePath = options.diskCachePath || path.join(__dirname, '..', 'cache');
    this.compressionEnabled = options.compression !== false;
    this.maxDiskSize = options.maxDiskSize || 2 * 1024 * 1024 * 1024; // 2GB
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      diskHits: 0,
      diskMisses: 0,
      writes: 0,
      deletes: 0
    };
    
    this.initDiskCache();
  }
  
  async initDiskCache() {
    try {
      await fs.mkdir(this.diskCachePath, { recursive: true });
      console.log(`📁 Disk cache hazır: ${this.diskCachePath}`);
    } catch (error) {
      console.error(`❌ Disk cache oluşturma hatası:`, error);
    }
  }
  
  async get(key) {
    // Check memory cache first
    const memValue = this.memoryCache.get(key);
    if (memValue) {
      this.stats.hits++;
      return memValue;
    }
    
    // Check disk cache
    const diskValue = await this.getFromDisk(key);
    if (diskValue) {
      this.stats.diskHits++;
      // Promote to memory cache
      this.memoryCache.set(key, diskValue);
      return diskValue;
    }
    
    this.stats.misses++;
    return null;
  }
  
  async set(key, value, options = {}) {
    // Always set in memory
    this.memoryCache.set(key, value);
    this.stats.writes++;
    
    // Optionally persist to disk
    if (options.persist !== false) {
      await this.saveToDisk(key, value);
    }
  }
  
  async delete(key) {
    // Remove from memory
    this.memoryCache.delete(key);
    
    // Remove from disk
    await this.deleteFromDisk(key);
    this.stats.deletes++;
  }
  
  async clear() {
    // Clear memory cache
    this.memoryCache.clear();
    
    // Clear disk cache
    try {
      const files = await fs.readdir(this.diskCachePath);
      const deletePromises = files.map(file => 
        fs.unlink(path.join(this.diskCachePath, file))
      );
      await Promise.all(deletePromises);
      console.log(`🗑️ Disk cache temizlendi`);
    } catch (error) {
      console.error(`❌ Disk cache temizleme hatası:`, error);
    }
  }
  
  async getFromDisk(key) {
    try {
      const filePath = this.getDiskPath(key);
      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data);
      
      // Check if expired
      if (parsed.expires && Date.now() > parsed.expires) {
        await this.deleteFromDisk(key);
        return null;
      }
      
      return parsed.value;
      
    } catch (error) {
      this.stats.diskMisses++;
      return null;
    }
  }
  
  async saveToDisk(key, value) {
    try {
      const filePath = this.getDiskPath(key);
      const data = {
        value,
        timestamp: Date.now(),
        expires: Date.now() + (this.memoryCache.options.ttl || 3600000)
      };
      
      await fs.writeFile(filePath, JSON.stringify(data), 'utf8');
      
    } catch (error) {
      console.error(`❌ Disk cache yazma hatası:`, error);
    }
  }
  
  async deleteFromDisk(key) {
    try {
      const filePath = this.getDiskPath(key);
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist, ignore error
    }
  }
  
  getDiskPath(key) {
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(this.diskCachePath, `${hash}.json`);
  }
  
  // Predictive pre-loading
  async warmCache(predictions) {
    const promises = predictions.map(async (item) => {
      if (!this.memoryCache.has(item.key)) {
        const value = await this.getFromDisk(item.key);
        if (value) {
          this.memoryCache.set(item.key, value);
        }
      }
    });
    
    await Promise.all(promises);
  }
  
  // Cache statistics
  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) * 100;
    const diskHitRate = this.stats.diskHits / (this.stats.diskHits + this.stats.diskMisses) * 100;
    
    return {
      ...this.stats,
      hitRate: isNaN(hitRate) ? 0 : hitRate.toFixed(2),
      diskHitRate: isNaN(diskHitRate) ? 0 : diskHitRate.toFixed(2),
      memorySize: this.memoryCache.calculatedSize,
      memoryItems: this.memoryCache.size,
      maxMemorySize: this.memoryCache.options.maxSize,
      maxMemoryItems: this.memoryCache.options.max
    };
  }
  
  // Memory pressure monitoring
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      cacheSize: this.memoryCache.calculatedSize,
      cacheItems: this.memoryCache.size
    };
  }
  
  // Auto-cleanup based on memory pressure
  async cleanupIfNeeded() {
    const usage = this.getMemoryUsage();
    const memoryPressure = usage.heapUsed / usage.heapTotal;
    
    if (memoryPressure > 0.8) {
      console.log(`⚠️ Yüksek bellek kullanımı, cache temizleniyor...`);
      
      // Remove oldest items
      const itemsToRemove = Math.floor(this.memoryCache.size * 0.3); // Remove 30%
      for (let i = 0; i < itemsToRemove; i++) {
        this.memoryCache.pop();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      console.log(`✅ Cache temizlendi, ${itemsToRemove} öğe kaldırıldı`);
    }
  }
  
  // Batch operations
  async getMultiple(keys) {
    const results = {};
    const missingKeys = [];
    
    for (const key of keys) {
      const value = await this.get(key);
      if (value !== null) {
        results[key] = value;
      } else {
        missingKeys.push(key);
      }
    }
    
    return { results, missingKeys };
  }
  
  async setMultiple(items, options = {}) {
    const promises = items.map(([key, value]) => 
      this.set(key, value, options)
    );
    await Promise.all(promises);
  }
  
  // Cache warming strategies
  async warmFromPattern(pattern) {
    try {
      const files = await fs.readdir(this.diskCachePath);
      const matchingFiles = files.filter(file => file.includes(pattern));
      
      const warmPromises = matchingFiles.map(async (file) => {
        const key = file.replace('.json', '');
        const value = await this.getFromDisk(key);
        if (value) {
          this.memoryCache.set(key, value);
        }
      });
      
      await Promise.all(warmPromises);
      console.log(`🔥 ${matchingFiles.length} öğe cache'e yüklendi`);
      
    } catch (error) {
      console.error(`❌ Cache warming hatası:`, error);
    }
  }
}

module.exports = SmartCache; 
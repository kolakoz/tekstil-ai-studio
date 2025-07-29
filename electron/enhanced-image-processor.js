const WorkerPool = require('./workers/worker-pool');
const SmartCache = require('./cache/smart-cache');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

class EnhancedImageProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Initialize components
    this.workerPool = new WorkerPool({
      workerScript: path.join(__dirname, 'workers', 'image-worker.js'),
      minWorkers: options.minWorkers || 2,
      maxWorkers: options.maxWorkers || 8,
      workerCount: options.workerCount || 4
    });
    
    this.cache = new SmartCache({
      maxMemorySize: options.cacheSize || 1024 * 1024 * 1024, // 1GB
      diskCachePath: options.cachePath || path.join(__dirname, 'cache'),
      ttl: options.cacheTTL || 1000 * 60 * 60 * 24 // 24 hours
    });
    
    // Processing options
    this.batchSize = options.batchSize || 50;
    this.maxConcurrency = options.maxConcurrency || 10;
    this.enableCache = options.enableCache !== false;
    
    // Statistics
    this.stats = {
      totalProcessed: 0,
      totalTime: 0,
      averageProcessingTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    // Worker pool events
    this.workerPool.on('progress', (progress) => {
      this.emit('progress', {
        ...progress,
        cacheStats: this.cache.getStats()
      });
    });
    
    // Cache events
    this.cache.on('cleanup', () => {
      console.log('🧹 Cache temizlendi');
    });
  }
  
  async processImages(imagePaths, options = {}) {
    const startTime = Date.now();
    const totalImages = imagePaths.length;
    
    console.log(`🚀 Gelişmiş görsel işleme başlatılıyor: ${totalImages} görsel`);
    
    // Progress tracking
    let processedCount = 0;
    const results = [];
    const errors = [];
    
    // Batch processing
    for (let i = 0; i < imagePaths.length; i += this.batchSize) {
      const batch = imagePaths.slice(i, i + this.batchSize);
      const batchStartTime = Date.now();
      
      try {
        const batchResults = await this.processBatch(batch, options);
        results.push(...batchResults);
        
        processedCount += batch.length;
        const batchTime = Date.now() - batchStartTime;
        
        // Progress update
        this.emit('progress', {
          processed: processedCount,
          total: totalImages,
          batchSize: batch.length,
          batchTime,
          averageTime: this.stats.averageProcessingTime,
          cacheStats: this.cache.getStats()
        });
        
        console.log(`📊 Batch tamamlandı: ${processedCount}/${totalImages} (${batchTime}ms)`);
        
      } catch (error) {
        console.error(`❌ Batch işleme hatası:`, error);
        errors.push(...batch.map(path => ({ path, error: error.message })));
      }
    }
    
    // Final statistics
    const totalTime = Date.now() - startTime;
    this.updateStats({
      processed: results.length,
      totalTime,
      errors: errors.length
    });
    
    console.log(`✅ Gelişmiş işleme tamamlandı: ${results.length} görsel (${totalTime}ms)`);
    
    return {
      results,
      errors,
      stats: this.getStats(),
      cacheStats: this.cache.getStats()
    };
  }
  
  async processBatch(imagePaths, options = {}) {
    const batchPromises = imagePaths.map(imagePath => 
      this.processSingleImage(imagePath, options)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    const results = [];
    const errors = [];
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push({
          path: imagePaths[index],
          error: result.reason.message
        });
        this.stats.errors++;
      }
    });
    
    return results;
  }
  
  async processSingleImage(imagePath, options = {}) {
    const cacheKey = `fingerprint:${imagePath}`;
    
    // Check cache first
    if (this.enableCache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
      this.stats.cacheMisses++;
    }
    
    // Process with worker pool
    const result = await this.workerPool.execute({
      type: 'generateFingerprint',
      data: { 
        imagePath, 
        options: {
          ...options,
          enableCache: this.enableCache
        }
      }
    }, {
      timeout: options.timeout || 30000 // 30 seconds
    });
    
    // Cache result
    if (this.enableCache) {
      await this.cache.set(cacheKey, result, { persist: true });
    }
    
    return result;
  }
  
  async findSimilarImages(targetImagePath, similarityThreshold = 0.8, options = {}) {
    console.log(`🔍 Benzer görsel aranıyor: ${targetImagePath} (eşik: ${similarityThreshold})`);
    
    // Get target image fingerprint
    const targetFingerprint = await this.processSingleImage(targetImagePath, options);
    
    // Get all cached fingerprints
    const allFingerprints = await this.getAllCachedFingerprints();
    
    // Calculate similarities
    const similarities = [];
    const maxDistance = Math.floor((1 - similarityThreshold) * 64); // 64-bit hash
    
    for (const fingerprint of allFingerprints) {
      if (fingerprint.path === targetImagePath) continue;
      
      const similarity = this.calculateSimilarity(
        targetFingerprint.fingerprint,
        fingerprint.fingerprint
      );
      
      if (similarity >= similarityThreshold) {
        similarities.push({
          ...fingerprint,
          similarity,
          distance: 1 - similarity
        });
      }
    }
    
    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    console.log(`📊 ${similarities.length} benzer görsel bulundu (eşik: ${similarityThreshold})`);
    
    return similarities;
  }
  
  calculateSimilarity(fingerprint1, fingerprint2) {
    // Multi-hash similarity calculation
    const similarities = [];
    
    // Perceptual hash similarity
    if (fingerprint1.perceptual && fingerprint2.perceptual) {
      const phashSimilarity = this.calculateHashSimilarity(
        fingerprint1.perceptual,
        fingerprint2.perceptual
      );
      similarities.push(phashSimilarity * 0.4); // 40% weight
    }
    
    // Difference hash similarity
    if (fingerprint1.difference && fingerprint2.difference) {
      const dhashSimilarity = this.calculateHashSimilarity(
        fingerprint1.difference,
        fingerprint2.difference
      );
      similarities.push(dhashSimilarity * 0.3); // 30% weight
    }
    
    // Average hash similarity
    if (fingerprint1.average && fingerprint2.average) {
      const ahashSimilarity = this.calculateHashSimilarity(
        fingerprint1.average,
        fingerprint2.average
      );
      similarities.push(ahashSimilarity * 0.2); // 20% weight
    }
    
    // Color fingerprint similarity
    if (fingerprint1.color && fingerprint2.color) {
      const colorSimilarity = this.calculateColorSimilarity(
        fingerprint1.color,
        fingerprint2.color
      );
      similarities.push(colorSimilarity * 0.1); // 10% weight
    }
    
    // Return weighted average
    return similarities.length > 0 
      ? similarities.reduce((sum, sim) => sum + sim, 0)
      : 0;
  }
  
  calculateHashSimilarity(hash1, hash2) {
    if (!hash1 || !hash2 || hash1.length !== hash2.length) return 0;
    
    let differences = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) differences++;
    }
    
    return 1 - (differences / hash1.length);
  }
  
  calculateColorSimilarity(color1, color2) {
    if (!color1 || !color2 || color1.length !== color2.length) return 0;
    
    let totalDiff = 0;
    for (let i = 0; i < color1.length; i++) {
      totalDiff += Math.abs(color1[i] - color2[i]);
    }
    
    const maxDiff = color1.length * 255;
    return 1 - (totalDiff / maxDiff);
  }
  
  async getAllCachedFingerprints() {
    // This would typically query the database
    // For now, return empty array
    return [];
  }
  
  updateStats(newStats) {
    this.stats.totalProcessed += newStats.processed || 0;
    this.stats.totalTime += newStats.totalTime || 0;
    this.stats.errors += newStats.errors || 0;
    
    if (this.stats.totalProcessed > 0) {
      this.stats.averageProcessingTime = this.stats.totalTime / this.stats.totalProcessed;
    }
  }
  
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    const processingRate = this.stats.totalProcessed / (uptime / 1000); // images per second
    
    return {
      ...this.stats,
      uptime,
      processingRate: processingRate.toFixed(2),
      errorRate: this.stats.totalProcessed > 0 
        ? (this.stats.errors / this.stats.totalProcessed * 100).toFixed(2)
        : 0
    };
  }
  
  async shutdown() {
    console.log('🛑 Gelişmiş görsel işleyici kapatılıyor...');
    
    // Shutdown worker pool
    await this.workerPool.shutdown();
    
    // Clear cache if needed
    if (options.clearCacheOnShutdown) {
      await this.cache.clear();
    }
    
    console.log('✅ Gelişmiş görsel işleyici kapatıldı');
  }
  
  // Performance monitoring
  getPerformanceMetrics() {
    return {
      workerPool: this.workerPool.getStats(),
      cache: this.cache.getStats(),
      memory: this.cache.getMemoryUsage(),
      processor: this.getStats()
    };
  }
}

module.exports = EnhancedImageProcessor; 
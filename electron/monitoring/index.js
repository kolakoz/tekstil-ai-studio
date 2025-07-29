/**
 * Enterprise Real-time Monitoring Package
 * Main entry point for the monitoring system
 */

const EventEmitter = require('events');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const winston = require('winston');

class TekstilMonitoring extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.metrics = {
      system: {},
      application: {},
      custom: config.customMetrics || {}
    };
    this.alerts = [];
    this.isRunning = false;
    this.intervals = [];
    
    // Logger oluştur
    this.logger = this.createLogger();
    
    // Metrik toplama zamanlayıcıları
    this.systemInterval = null;
    this.appInterval = null;
  }

  // Logger oluştur
  createLogger() {
    const logDir = path.dirname(this.config.notifications.file.path);
    
    // Log dizinini oluştur
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (error) {
      console.error('Log dizini oluşturulamadı:', error);
    }

    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        // Dosya transport'u
        new winston.transports.File({
          filename: this.config.notifications.file.path,
          level: this.config.notifications.file.level
        }),
        // Console transport'u
        new winston.transports.Console({
          level: this.config.notifications.console.level,
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  // Monitoring'i başlat
  async start() {
    if (this.isRunning) {
      this.logger.warn('Monitoring zaten çalışıyor');
      return;
    }

    try {
      this.logger.info('Tekstil AI Studio Monitoring başlatılıyor...');
      
      // Storage dizinini oluştur
      await this.createStorageDirectory();
      
      // Sistem metriklerini toplamaya başla
      this.startSystemMetrics();
      
      // Uygulama metriklerini toplamaya başla
      this.startApplicationMetrics();
      
      // Alert kurallarını başlat
      this.startAlertRules();
      
      this.isRunning = true;
      this.logger.info('Monitoring başarıyla başlatıldı');
      
      this.emit('started');
      
    } catch (error) {
      this.logger.error('Monitoring başlatma hatası:', error);
      throw error;
    }
  }

  // Monitoring'i durdur
  async stop() {
    if (!this.isRunning) {
      this.logger.warn('Monitoring zaten durmuş');
      return;
    }

    try {
      this.logger.info('Monitoring durduruluyor...');
      
      // Zamanlayıcıları temizle
      this.clearIntervals();
      
      this.isRunning = false;
      this.logger.info('Monitoring durduruldu');
      
      this.emit('stopped');
      
    } catch (error) {
      this.logger.error('Monitoring durdurma hatası:', error);
      throw error;
    }
  }

  // Storage dizinini oluştur
  async createStorageDirectory() {
    try {
      await fs.mkdir(this.config.storage.basePath, { recursive: true });
      this.logger.info('Storage dizini oluşturuldu:', this.config.storage.basePath);
    } catch (error) {
      this.logger.error('Storage dizini oluşturma hatası:', error);
      throw error;
    }
  }

  // Sistem metriklerini toplamaya başla
  startSystemMetrics() {
    this.systemInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.metrics.systemInterval);
    
    this.intervals.push(this.systemInterval);
  }

  // Uygulama metriklerini toplamaya başla
  startApplicationMetrics() {
    this.appInterval = setInterval(() => {
      this.collectApplicationMetrics();
    }, this.config.metrics.appInterval);
    
    this.intervals.push(this.appInterval);
  }

  // Sistem metriklerini topla
  collectSystemMetrics() {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsage = (usedMem / totalMem) * 100;

      const cpus = os.cpus();
      const cpuUsage = cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total);
      }, 0) / cpus.length * 100;

      this.metrics.system = {
        timestamp: Date.now(),
        memory: {
          total: totalMem,
          used: usedMem,
          free: freeMem,
          usage: memoryUsage
        },
        cpu: {
          cores: cpus.length,
          usage: cpuUsage,
          load: os.loadavg()
        },
        uptime: os.uptime(),
        platform: os.platform(),
        arch: os.arch()
      };

      // Bellek kullanımı alert'i
      if (memoryUsage > this.config.metrics.memoryThreshold * 100) {
        this.triggerAlert('memory_usage', {
          severity: 'warning',
          message: `Yüksek bellek kullanımı: ${memoryUsage.toFixed(2)}%`,
          value: memoryUsage,
          threshold: this.config.metrics.memoryThreshold * 100
        });
      }

      // CPU kullanımı alert'i
      if (cpuUsage > this.config.metrics.cpuThreshold * 100) {
        this.triggerAlert('cpu_usage', {
          severity: 'critical',
          message: `Yüksek CPU kullanımı: ${cpuUsage.toFixed(2)}%`,
          value: cpuUsage,
          threshold: this.config.metrics.cpuThreshold * 100
        });
      }

      this.emit('system-metrics', this.metrics.system);
      
    } catch (error) {
      this.logger.error('Sistem metrikleri toplama hatası:', error);
    }
  }

  // Uygulama metriklerini topla
  collectApplicationMetrics() {
    try {
      const process = require('process');
      
      this.metrics.application = {
        timestamp: Date.now(),
        memory: {
          rss: process.memoryUsage().rss,
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external
        },
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
        pid: process.pid
      };

      this.emit('application-metrics', this.metrics.application);
      
    } catch (error) {
      this.logger.error('Uygulama metrikleri toplama hatası:', error);
    }
  }

  // Alert kurallarını başlat
  startAlertRules() {
    // Hata oranı alert'i
    setInterval(() => {
      this.checkErrorRate();
    }, 60000); // 1 dakika

    // Yanıt süresi alert'i
    setInterval(() => {
      this.checkResponseTime();
    }, 30000); // 30 saniye

    // Proje durumu kontrolü
    setInterval(() => {
      this.checkProjectStatus();
    }, 30000); // 30 saniye
  }

  // Hata oranını kontrol et
  checkErrorRate() {
    // Bu metod daha sonra implement edilecek
  }

  // Yanıt süresini kontrol et
  checkResponseTime() {
    // Bu metod daha sonra implement edilecek
  }

  // Alert tetikle
  triggerAlert(type, data) {
    const alert = {
      id: Date.now(),
      type,
      timestamp: Date.now(),
      ...data
    };

    this.alerts.push(alert);
    this.logger.warn(`Alert tetiklendi: ${data.message}`, alert);
    
    this.emit('alert', alert);
  }

  // Metrik ekle
  increment(name, value = 1, tags = {}) {
    if (!this.metrics.custom[name]) {
      this.metrics.custom[name] = 0;
    }
    this.metrics.custom[name] += value;
    
    this.logger.debug(`Metrik artırıldı: ${name} = ${this.metrics.custom[name]}`, { tags });
  }

  // Gauge metrik
  gauge(name, value, tags = {}) {
    this.metrics.custom[name] = value;
    
    this.logger.debug(`Gauge metrik: ${name} = ${value}`, { tags });
  }

  // Timing metrik
  timing(name, value, tags = {}) {
    if (!this.metrics.custom[`${name}_count`]) {
      this.metrics.custom[`${name}_count`] = 0;
      this.metrics.custom[`${name}_total`] = 0;
      this.metrics.custom[`${name}_avg`] = 0;
    }
    
    this.metrics.custom[`${name}_count`]++;
    this.metrics.custom[`${name}_total`] += value;
    this.metrics.custom[`${name}_avg`] = this.metrics.custom[`${name}_total`] / this.metrics.custom[`${name}_count`];
    
    this.logger.debug(`Timing metrik: ${name} = ${value}ms`, { tags });
  }

  // Özel event track et
  track(event, data = {}) {
    this.logger.info(`Event tracked: ${event}`, data);
    this.emit('event', { event, data, timestamp: Date.now() });
  }

  // İstatistikleri al
  getStats() {
    return {
      system: this.metrics.system,
      application: this.metrics.application,
      custom: this.metrics.custom,
      alerts: this.alerts.slice(-10), // Son 10 alert
      isRunning: this.isRunning
    };
  }

  // Proje durumunu kontrol et
  async checkProjectStatus() {
    try {
      // ONNX Runtime kontrolü
      let onnxAvailable = false;
      try {
        require('onnxruntime-node');
        onnxAvailable = true;
      } catch (e) {
        onnxAvailable = false;
      }

      // Sharp HOG kontrolü (OpenCV yerine)
      let opencvAvailable = false;
      try {
        // Sharp.js ile HOG özellik çıkarımı test et
        const sharp = require('sharp');
        const testImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
        await sharp(testImage).resize(32, 32).grayscale().raw().toBuffer();
        opencvAvailable = true;
      } catch (e) {
        opencvAvailable = false;
      }

      // Font Recognition kontrolü
      let fontRecognitionAvailable = false;
      try {
        const FontRecognizer = require('../font-recognizer');
        const fontRecognizer = new FontRecognizer();
        const status = fontRecognizer.getStatus();
        fontRecognitionAvailable = status.isInitialized;
      } catch (e) {
        fontRecognitionAvailable = false;
      }

      // Worker Pool kontrolü
      let workerPoolActive = false;
      try {
        const WorkerPool = require('../workers/worker-pool');
        if (global.workerPool) {
          const stats = global.workerPool.getStats();
          workerPoolActive = stats.totalWorkers > 0;
        }
      } catch (e) {
        workerPoolActive = false;
      }

      // Veritabanı istatistikleri
      const dbStats = await this.getDatabaseStats();

      // Proje metriklerini güncelle
      this.metrics.custom.projectMetrics = {
        total_images: dbStats.totalImages || 0,
        active_images: dbStats.activeImages || 0,
        scans_completed: this.metrics.custom.scans_completed || 0,
        scan_errors: this.metrics.custom.scan_errors || 0,
        searches_completed: this.metrics.custom.searches_completed || 0,
        search_errors: this.metrics.custom.search_errors || 0,
        uploads_completed: this.metrics.custom.uploads_completed || 0,
        upload_errors: this.metrics.custom.upload_errors || 0,
        avg_processing_time: this.metrics.custom.avg_processing_time || 0,
        onnx_available: onnxAvailable,
        opencv_available: opencvAvailable,
        font_recognition_available: fontRecognitionAvailable,
        worker_pool_active: workerPoolActive
      };

      this.logger.info('Proje durumu kontrol edildi', {
        onnx: onnxAvailable,
        opencv: opencvAvailable,
        fontRecognition: fontRecognitionAvailable,
        workerPool: workerPoolActive,
        dbStats
      });

    } catch (error) {
      this.logger.error('Proje durumu kontrol hatası:', error);
    }
  }

  // Veritabanı istatistiklerini al
  async getDatabaseStats() {
    try {
      // Enhanced database'den istatistikleri al
      const enhancedDb = require('../enhanced-database');
      const stats = await enhancedDb.getStatistics();
      return {
        totalImages: stats.total_images || 0,
        activeImages: stats.active_images || 0
      };
    } catch (error) {
      this.logger.error('Veritabanı istatistikleri alma hatası:', error);
      return {
        totalImages: 0,
        activeImages: 0
      };
    }
  }

  // Sağlık durumunu al
  getHealth() {
    const memoryUsage = this.metrics.system.memory?.usage || 0;
    const cpuUsage = this.metrics.system.cpu?.usage || 0;
    
    let status = 'healthy';
    let issues = [];

    if (memoryUsage > this.config.metrics.memoryThreshold * 100) {
      status = 'warning';
      issues.push(`Yüksek bellek kullanımı: ${memoryUsage.toFixed(2)}%`);
    }

    if (cpuUsage > this.config.metrics.cpuThreshold * 100) {
      status = 'critical';
      issues.push(`Yüksek CPU kullanımı: ${cpuUsage.toFixed(2)}%`);
    }

    return {
      status,
      issues,
      timestamp: Date.now(),
      uptime: process.uptime()
    };
  }

  // Zamanlayıcıları temizle
  clearIntervals() {
    this.intervals.forEach(interval => {
      if (interval) {
        clearInterval(interval);
      }
    });
    this.intervals = [];
  }
}

module.exports = TekstilMonitoring; 
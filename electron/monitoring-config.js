const path = require('path');
const os = require('os');

// Monitoring konfigürasyonu
const monitoringConfig = {
  namespace: 'tekstil-ai-studio',
  
  // Storage konfigürasyonu
  storage: {
    type: 'file',
    basePath: path.join(__dirname, '../data/monitoring'),
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 100
  },
  
  // Alert kuralları
  alerts: {
    // Hata oranı eşiği
    errorRate: { 
      threshold: 5, 
      window: '5m',
      severity: 'critical' 
    },
    
    // Yanıt süresi eşiği
    responseTime: { 
      threshold: 5000, // 5 saniye
      window: '1m',
      severity: 'warning' 
    },
    
    // Bellek kullanımı eşiği
    memoryUsage: { 
      threshold: 80, // %80
      window: '5m',
      severity: 'warning' 
    },
    
    // CPU kullanımı eşiği
    cpuUsage: { 
      threshold: 90, // %90
      window: '5m',
      severity: 'critical' 
    },
    
    // Disk tarama süresi eşiği
    scanDuration: { 
      threshold: 300000, // 5 dakika
      window: '10m',
      severity: 'warning' 
    }
  },
  
  // Bildirim konfigürasyonu
  notifications: {
    // Dosya log'u
    file: {
      path: path.join(__dirname, '../logs/monitoring-alerts.log'),
      level: 'warn'
    },
    
    // Console log'u
    console: {
      level: 'info'
    }
  },
  
  // Metrik toplama ayarları
  metrics: {
    // Sistem metrikleri toplama sıklığı (ms)
    systemInterval: 30000, // 30 saniye
    
    // Uygulama metrikleri toplama sıklığı (ms)
    appInterval: 10000, // 10 saniye
    
    // Bellek kullanımı eşiği
    memoryThreshold: 0.8, // %80
    
    // CPU kullanımı eşiği
    cpuThreshold: 0.9 // %90
  },
  
  // Dashboard konfigürasyonu
  dashboard: {
    port: 3001,
    title: 'Tekstil AI Studio Monitoring',
    theme: 'dark',
    refreshInterval: 5000, // 5 saniye
    widgets: [
      {
        name: 'Sistem Kaynakları',
        type: 'system',
        size: 'large'
      },
      {
        name: 'Uygulama Performansı',
        type: 'performance',
        size: 'medium'
      },
      {
        name: 'Hata Oranları',
        type: 'errors',
        size: 'small'
      },
      {
        name: 'Disk Tarama İstatistikleri',
        type: 'scan',
        size: 'medium'
      }
    ]
  },
  
  // Özel metrikler
  customMetrics: {
    // Disk tarama metrikleri
    scanMetrics: {
      totalScanned: 0,
      totalProcessed: 0,
      scanDuration: 0,
      scanErrors: 0
    },
    
    // Görsel işleme metrikleri
    imageMetrics: {
      processedImages: 0,
      processingTime: 0,
      imageErrors: 0
    },
    
    // Kullanıcı etkileşim metrikleri
    userMetrics: {
      searches: 0,
      uploads: 0,
      downloads: 0,
      activeTime: 0
    },
    
    // Proje özel metrikleri
    projectMetrics: {
      total_images: 0,
      active_images: 0,
      scans_completed: 0,
      scan_errors: 0,
      searches_completed: 0,
      search_errors: 0,
      uploads_completed: 0,
      upload_errors: 0,
      avg_processing_time: 0,
      onnx_available: false,
      opencv_available: false,
      font_recognition_available: false,
      worker_pool_active: false
    }
  }
};

module.exports = monitoringConfig; 
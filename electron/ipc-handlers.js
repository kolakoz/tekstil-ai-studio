const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const configStore = require('./config-store');
const fileScanner = require('./file-scanner');
const driveScanner = require('./drive-scanner');
const imageProcessor = require('./image-processor');
const internetSearcher = require('./internet-searcher');
const database = require('./database');
const EnhancedImageProcessor = require('./enhanced-image-processor');
const smartScanner = require('./smart-disk-scanner');
const enhancedDb = require('./enhanced-database');
const ExportManager = require('./export-manager');
const ProjectStructureManager = require('./project-structure-manager');

// Monitoring instance'ını al
const getMonitoring = () => {
  return global.monitoring;
};

module.exports = (mainWindow) => {
  ipcMain.handle('ping', async () => {
    console.log('Renderer\'dan ping alındı, pong gönderiliyor.');
    return 'pong';
  });

  // Monitoring metodları
  ipcMain.handle('get-monitoring-stats', async () => {
    try {
      const monitoring = getMonitoring();
      if (!monitoring) {
        return { error: 'Monitoring başlatılmamış' };
      }
      return monitoring.getStats();
    } catch (error) {
      console.error('Monitoring stats hatası:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('get-monitoring-health', async () => {
    try {
      const monitoring = getMonitoring();
      if (!monitoring) {
        return { error: 'Monitoring başlatılmamış' };
      }
      return monitoring.getHealth();
    } catch (error) {
      console.error('Monitoring health hatası:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('track-event', async (event, eventName, data) => {
    try {
      const monitoring = getMonitoring();
      if (monitoring) {
        monitoring.track(eventName, data);
      }
      return { success: true };
    } catch (error) {
      console.error('Event tracking hatası:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('increment-metric', async (event, name, value, tags) => {
    try {
      const monitoring = getMonitoring();
      if (monitoring) {
        monitoring.increment(name, value, tags);
      }
      return { success: true };
    } catch (error) {
      console.error('Metric increment hatası:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('gauge-metric', async (event, name, value, tags) => {
    try {
      const monitoring = getMonitoring();
      if (monitoring) {
        monitoring.gauge(name, value, tags);
      }
      return { success: true };
    } catch (error) {
      console.error('Metric gauge hatası:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('timing-metric', async (event, name, value, tags) => {
    try {
      const monitoring = getMonitoring();
      if (monitoring) {
        monitoring.timing(name, value, tags);
      }
      return { success: true };
    } catch (error) {
      console.error('Metric timing hatası:', error);
      return { error: error.message };
    }
  });

  // Export metodları
  ipcMain.handle('export-monitoring-data', async (event, format = 'json') => {
    try {
      const monitoring = getMonitoring();
      const workerPool = global.workerPool;
      
      if (!monitoring) {
        return { error: 'Monitoring başlatılmamış' };
      }

      const exportManager = new ExportManager();
      const result = await exportManager.autoExport(monitoring, workerPool, format);
      
      return result;
    } catch (error) {
      console.error('Export hatası:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('get-export-formats', async () => {
    try {
      const exportManager = new ExportManager();
      return exportManager.getAvailableFormats();
    } catch (error) {
      console.error('Export formatları hatası:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('export-custom-data', async (event, data, format = 'json', filename = 'custom-data') => {
    try {
      const exportManager = new ExportManager();
      
      switch (format.toLowerCase()) {
        case 'csv':
          return await exportManager.exportToCSV(data, filename);
        case 'json':
          return await exportManager.exportToJSON(data, filename);
        case 'txt':
          return await exportManager.exportToText(data, filename);
        default:
          return await exportManager.exportToJSON(data, filename);
      }
    } catch (error) {
      console.error('Custom export hatası:', error);
      return { error: error.message };
    }
  });

  // Proje Yapısı Yönetimi
  ipcMain.handle('save-project-structure', async (event, structure) => {
    try {
      const manager = new ProjectStructureManager();
      return await manager.saveProjectStructure(structure);
    } catch (error) {
      console.error('Proje yapısı kaydetme hatası:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('update-project-structure', async (event, structure) => {
    try {
      const manager = new ProjectStructureManager();
      return await manager.updateProjectStructure(structure);
    } catch (error) {
      console.error('Proje yapısı güncelleme hatası:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('test-project-structure', async (event, structure) => {
    try {
      const manager = new ProjectStructureManager();
      return await manager.testProjectStructure(structure);
    } catch (error) {
      console.error('Proje yapısı test hatası:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('load-project-structure', async () => {
    try {
      const manager = new ProjectStructureManager();
      return await manager.loadProjectStructure();
    } catch (error) {
      console.error('Proje yapısı yükleme hatası:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('get-config', async () => {
    console.log('get-config isteği alındı.');
    return configStore.store;
  });

  ipcMain.handle('set-config', async (event, config) => {
    console.log('set-config isteği alındı:', config);
    configStore.set(config);
    return true;
  });

  ipcMain.handle('list-drives', async () => {
    console.log('list-drives isteği alındı.');
    const drives = await driveScanner.getAvailableDrives();
    return { success: true, drives };
  });

  // Disk listesi (eski uyumluluk için)
  ipcMain.handle('get-disks', async () => {
    console.log('get-disks isteği alındı.');
    const drives = await driveScanner.getAvailableDrives();
    return { success: true, drives };
  });

  // Tarama durumu kontrolü
  ipcMain.handle('check-scan-status', async () => {
    try {
      console.log('🔍 Tarama durumu kontrol ediliyor...');
      
      // Akıllı tarama kontrolü
      const setupCheck = await smartScanner.checkFirstTimeSetup();
      
      if (setupCheck.needsScan) {
        console.log('⚠️ Tarama gerekli:', setupCheck.reason);
        return {
          needsScan: true,
          reason: setupCheck.reason,
          estimatedTime: setupCheck.reason === 'first_time' ? '5-10 dakika' : '2-5 dakika'
        };
      }
      
      console.log('✅ Veritabanı güncel, tarama gerekmiyor');
      return {
        needsScan: false,
        reason: 'up_to_date'
      };
      
    } catch (error) {
      console.error('❌ Tarama durumu kontrol hatası:', error);
      return {
        needsScan: true,
        reason: 'error',
        error: error.message
      };
    }
  });

  // Disk tarama işlemleri - Akıllı Tarama Sistemi
  ipcMain.handle('scan-drives', async (event, { drives, scanMode = 'full' }) => {
    console.log('🚀 Akıllı disk tarama başlatılıyor...');
    console.log(`📋 Tarama modu: ${scanMode}`);
    
    // Monitoring event'i
    const monitoring = getMonitoring();
    if (monitoring) {
      monitoring.track('scan_started', { drives, scanMode });
      monitoring.increment('scan_attempts', 1, { mode: scanMode });
    }
    
    // Drives parametresini kontrol et
    if (!drives || !Array.isArray(drives) || drives.length === 0) {
      console.error('❌ Geçersiz drives parametresi:', drives);
      event.sender.send('scan-error', { error: 'Geçersiz disk listesi' });
      
      // Monitoring error event'i
      if (monitoring) {
        monitoring.increment('scan_errors', 1, { type: 'invalid_drives' });
      }
      
      return { success: false, error: 'Geçersiz disk listesi' };
    }
    
    console.log(`💿 Diskler: ${drives.join(', ')}`);
    
    // Tarama başlangıç zamanı
    const scanStartTime = Date.now();
    
    try {
      // Progress listener
      smartScanner.on('progress', (progress) => {
        // Monitoring progress event'i
        if (monitoring) {
          monitoring.gauge('scan_progress', progress.percentage);
          monitoring.increment('files_scanned', progress.stats.totalScanned);
        }
        
        event.sender.send('scan-progress', {
          ...progress,
          type: 'smart-scan',
          message: `Akıllı tarama: ${progress.stats.totalScanned} dosya işlendi`
        });
      });
      
      // Akıllı tarama seçenekleri
      const scanOptions = {
        force: scanMode === 'force', // Zorla tarama
        quickScan: scanMode === 'quick' // Hızlı tarama
      };
      
      // Akıllı taramayı başlat
      const result = await smartScanner.smartScan(drives, scanOptions);
      
      if (result.skipped) {
        console.log('✅ Tarama atlandı:', result.reason);
        
        // Monitoring skip event'i
        if (monitoring) {
          monitoring.track('scan_skipped', { reason: result.reason, stats: result.stats });
          monitoring.timing('scan_duration', Date.now() - scanStartTime, { mode: scanMode, skipped: true });
        }
        
        event.sender.send('scan-complete', {
          success: true,
          skipped: true,
          reason: result.reason,
          stats: result.stats
        });
        return { success: true, skipped: true, reason: result.reason };
      }
      
      console.log('📊 Tarama tamamlandı:', result.totalStats);
      
      // Monitoring completion event'i
      if (monitoring) {
        const scanDuration = Date.now() - scanStartTime;
        monitoring.track('scan_completed', { 
          mode: scanMode, 
          duration: scanDuration,
          stats: result.totalStats 
        });
        monitoring.timing('scan_duration', scanDuration, { mode: scanMode });
        monitoring.increment('scans_completed', 1, { mode: scanMode });
      }
      
      // Frontend'e sonuçları gönder
      event.sender.send('scan-complete', {
        success: true,
        results: result.results,
        totalStats: result.totalStats,
        dbStats: await enhancedDb.getStatistics()
      });
      
      return { success: true, results: result.results, totalStats: result.totalStats };
      
    } catch (error) {
      console.error('❌ Disk tarama hatası:', error);
      
      // Monitoring error event'i
      if (monitoring) {
        monitoring.increment('scan_errors', 1, { type: 'scan_failed' });
        monitoring.track('scan_error', { error: error.message, mode: scanMode });
      }
      
      event.sender.send('scan-error', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  // cancel-scan handler'ı simple-ipc.js'de zaten var, burada kaldırıldı

  ipcMain.handle('select-workspace', async () => {
    console.log('select-workspace isteği alındı.');
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });

  ipcMain.handle('scan-workspace', async (event, folderPath) => {
    console.log('scan-workspace isteği alındı:', folderPath);
    const allProcessedImages = [];
    let processedCount = 0;
    
    try {
      const discoveredFiles = await fileScanner.scanDirectory(folderPath, (p) => {
        // Genel ilerlemeyi burada yayabiliriz, ancak detaylı dosya bazlı ilerleme processImage içinde olacak
      });
      const totalFiles = discoveredFiles.length;

      for (const filePath of discoveredFiles) {
        try {
          const imageData = await imageProcessor.processImage(filePath);
          if (imageData) {
            database.insertImage(imageData);
            allProcessedImages.push(imageData);
          }
          processedCount += 1;
          event.sender.send('scan-progress', { current: processedCount, total: totalFiles, currentFile: filePath });
        } catch (imageErr) {
          console.error(`Görsel işleme başarısız oldu ${filePath}:`, imageErr.message);
        }
      }
      event.sender.send('scan-complete', allProcessedImages);
      return allProcessedImages;
    } catch (err) {
      console.error(`Workspace tarama hatası (${folderPath}):`, err.message);
      throw err;
    }
  });

  // search-similar handler'ı simple-ipc.js'de zaten var, burada kaldırıldı

  // Sayfalı arama
  ipcMain.handle('search-similar-paginated', async (event, { targetEmbedding, page, pageSize, threshold, weights }) => {
    try {
      await database.ensureDatabase();
      const result = await database.searchSimilarImagesPaginated(targetEmbedding, page, pageSize, threshold, weights);
      return result;
    } catch (error) {
      console.error('search-similar-paginated error:', error);
      return { results: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }
  });

  // Performans istatistikleri
  ipcMain.handle('get-performance-stats', async (event) => {
    try {
      const stats = await database.getPerformanceStats();
      return stats;
    } catch (error) {
      console.error('get-performance-stats error:', error);
      return { cacheSize: 0, cacheHits: 0, cacheMisses: 0 };
    }
  });

  // Önbellek temizleme
  ipcMain.handle('clear-search-cache', async (event) => {
    try {
      await database.clearSearchCache();
      return { success: true };
    } catch (error) {
      console.error('clear-search-cache error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('search-internet', async (event, imagePath) => {
    console.log('search-internet isteği alındı:', imagePath);
    return internetSearcher.searchImageOnline(imagePath);
  });

  ipcMain.handle('open-in-explorer', async (event, filepath) => {
    console.log('open-in-explorer isteği alındı:', filepath);
    return shell.showItemInFolder(filepath);
  });

  ipcMain.handle('get-image-base64', async (event, filepath) => {
    console.log('get-image-base64 isteği alındı:', filepath);
    
    // Kullanıcı adı düzeltmesi - "Akay Adem" -> "AkayAdem"
    let correctedPath = filepath.replace(/Akay Adem/g, 'AkayAdem');
    
    // Dosya yolunu normalize et
    const normalizedPath = path.resolve(correctedPath);
    console.log('get-image-base64: Normalized path:', normalizedPath);
    
    // Dosyanın varlığını kontrol et
    try {
      await fs.access(normalizedPath);
      console.log('get-image-base64: Dosya mevcut ✓');
      return imageProcessor.getImageBase64(normalizedPath);
    } catch (error) {
      console.error('get-image-base64: Dosya bulunamadı:', error.message);
      
      // Alternatif yolları dene
      const alternativePaths = [
        correctedPath.replace(/\\/g, '/'), // Backslash'leri forward slash'a çevir
        correctedPath.replace(/\s+/g, ' '), // Fazla boşlukları temizle
        path.normalize(correctedPath), // Path normalize et
        filepath.replace(/\\/g, '/'), // Orijinal yol ile de dene
        filepath.replace(/\s+/g, ' '),
        path.normalize(filepath),
      ];
      
      for (const altPath of alternativePaths) {
        try {
          const altNormalized = path.resolve(altPath);
          await fs.access(altNormalized);
          console.log('get-image-base64: Alternatif yol bulundu:', altNormalized);
          return imageProcessor.getImageBase64(altNormalized);
        } catch (altError) {
          console.log('get-image-base64: Alternatif yol başarısız:', altPath);
        }
      }
      
      return { success: false, error: `Dosya bulunamadı: ${filepath}` };
    }
  });

  // Görsel sayılarını al
  ipcMain.handle('get-image-counts', async (event) => {
    try {
      await database.ensureDatabase();
      const counts = await database.getImageCounts();
      return counts;
    } catch (error) {
      console.error('get-image-counts error:', error);
      return { totalImages: 0, totalEmbeddings: 0 };
    }
  });

  // Veritabanını temizle
  ipcMain.handle('clear-database', async (event) => {
    try {
      await database.ensureDatabase();
      await database.clearDatabase();
      return { success: true };
    } catch (error) {
      console.error('clear-database error:', error);
      return { success: false, error: error.message };
    }
  });

  // Debug: Veritabanındaki dosya yollarını kontrol et
  ipcMain.handle('debug-filepaths', async () => {
    console.log('debug-filepaths isteği alındı.');
    const allImages = database.getAllImages();
    const filepaths = allImages.map(img => ({
      id: img.id,
      filename: img.filename,
      filepath: img.filepath,
      exists: require('fs').existsSync(img.filepath)
    }));
    console.log('Veritabanındaki dosya yolları:', filepaths.slice(0, 5)); // İlk 5 kayıt
    return filepaths;
  });

  // Veritabanındaki dosya yollarını düzelt
  ipcMain.handle('fix-database-paths', async () => {
    console.log('fix-database-paths isteği alındı.');
    
    try {
      const allImages = database.getAllImages();
      let fixedCount = 0;
      let errorCount = 0;
      
      for (const image of allImages) {
        try {
          const originalPath = image.filepath;
          
          // Kullanıcı adı düzeltmesi
          let correctedPath = originalPath.replace(/Akay Adem/g, 'AkayAdem');
          
          // Dosya yolunu normalize et
          const normalizedPath = path.resolve(correctedPath);
          
          // Dosyanın varlığını kontrol et
          if (require('fs').existsSync(normalizedPath)) {
            // Dosya mevcut, yolu güncelle
            if (normalizedPath !== originalPath) {
              database.updateImagePath(image.id, normalizedPath);
              console.log(`✓ Düzeltildi: ${image.filename}`);
              console.log(`  Eski: ${originalPath}`);
              console.log(`  Yeni: ${normalizedPath}`);
              fixedCount++;
            }
          } else {
            console.log(`✗ Dosya bulunamadı: ${image.filename}`);
            console.log(`  Yol: ${normalizedPath}`);
            errorCount++;
          }
        } catch (error) {
          console.error(`Hata (${image.filename}):`, error.message);
          errorCount++;
        }
      }
      
      console.log('\n=== ÖZET ===');
      console.log(`Toplam görsel: ${allImages.length}`);
      console.log(`Düzeltilen: ${fixedCount}`);
      console.log(`Hata: ${errorCount}`);
      
      return { success: true, fixedCount, errorCount, totalCount: allImages.length };
    } catch (error) {
      console.error('Veritabanı düzeltme hatası:', error);
      return { success: false, error: error.message };
    }
  });

  // IPC Renderer olayları (preload.js'de ipcRenderer.on ile dinlenenler)
  // Bu olaylar, ana süreçteki mantık tarafından tetiklenecek.

  // Base64 görsel yükleme handler'ı
  ipcMain.handle('load-image-as-base64', async (event, filepath) => {
    try {
      console.log('Base64 yükleme isteği:', filepath);
      
      // Dosya var mı kontrol et
      if (!require('fs').existsSync(filepath)) {
        console.error('Dosya bulunamadı:', filepath);
        return { success: false, error: 'Dosya bulunamadı' };
      }

      // Dosyayı oku
      const imageBuffer = require('fs').readFileSync(filepath);
      const base64 = imageBuffer.toString('base64');
      
      // MIME type belirle
      const extension = path.extname(filepath).toLowerCase().substring(1);
      const mimeType = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'webp': 'image/webp'
      }[extension] || 'image/jpeg';
      
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      console.log('Base64 URL oluşturuldu, boyut:', Math.round(dataUrl.length / 1024), 'KB');
      return { success: true, dataUrl };
      
    } catch (error) {
      console.error('Base64 yükleme hatası:', error);
      return { success: false, error: error.message };
    }
  });

  // Görsel işleme
  ipcMain.handle('process-image', async (event, imagePath) => {
    try {
      console.log('Görsel işleme başlatılıyor:', imagePath);
      const processedImageData = await imageProcessor.processImage(imagePath);
      
      if (!processedImageData || !processedImageData.embedding) {
        console.warn('Görsel işlenemedi veya embedding oluşturulamadı');
        return null;
      }
      
      console.log('✅ Görsel işlendi, embedding boyutu:', processedImageData.embedding.length);
      return processedImageData;
    } catch (error) {
      console.error('Görsel işleme hatası:', error);
      return null;
    }
  });

  // Görsel ekleme
  ipcMain.handle('add-image-to-database', async (event, { filepath, filename, embedding, colorHistogram, hogFeatures }) => {
    try {
      console.log('IPC: add-image-to-database çağrıldı');
      await database.ensureDatabase();
      const result = await database.addImageToDatabase(filepath, filename, embedding, colorHistogram, hogFeatures);
      console.log('IPC: add-image-to-database başarıyla tamamlandı');
      return result;
    } catch (error) {
      console.error('add-image-to-database error:', error);
      return { success: false, error: error.message };
    }
  });

  // Toplu görsel ekleme
  ipcMain.handle('add-images-to-database', async (event, imageDataArray) => {
    try {
      await database.ensureDatabase();
      const result = await database.addImagesToDatabase(imageDataArray);
      return result;
    } catch (error) {
      console.error('add-images-to-database error:', error);
      return { success: false, error: error.message };
    }
  });

  // Yeni eklenen görselleri kontrol et
  ipcMain.handle('check-new-images', async (event) => {
    try {
      console.log('🔄 YENİ GÖRSELLER KONTROL EDİLİYOR...');
      const result = await driveScanner.checkNewImages();
      console.log('✅ Yeni görsel kontrolü tamamlandı');
      return result;
    } catch (error) {
      console.error('Yeni görsel kontrol hatası:', error);
      return { success: false, error: error.message };
    }
  });

  // get-scan-status handler'ı simple-ipc.js'de zaten var, burada kaldırıldı

  // Veritabanındaki tüm görselleri getir
  ipcMain.handle('get-database-images', async (event, { page = 1, pageSize = 20 }) => {
    try {
      await database.ensureDatabase();
      console.log('get-database-images isteği alındı');
      
      const images = await database.getAllImages();
      const total = images.length;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedImages = images.slice(startIndex, endIndex);
      
      console.log(`📊 Veritabanından ${total} görsel getirildi, sayfa ${page}: ${paginatedImages.length} gösteriliyor`);
      
      return {
        success: true,
        images: paginatedImages,
        total: total,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      console.error('get-database-images hatası:', error);
      return { success: false, error: error.message };
    }
  });

  // Veritabanı istatistiklerini getir
  ipcMain.handle('get-database-stats', async () => {
    try {
      await database.ensureDatabase();
      const stats = await database.getImageCounts();
      console.log('📊 Veritabanı istatistikleri:', stats);
      return { success: true, stats };
    } catch (error) {
      console.error('get-database-stats hatası:', error);
      return { success: false, error: error.message };
    }
  });

  // Optimize edilmiş hızlı arama
  ipcMain.handle('search-similar-fast', async (event, { imagePath, threshold, weights }) => {
    try {
      console.log('🚀 Hızlı arama başlatılıyor...');
      
      // 1. Görsel işle ve özelliklerini çıkar
      const imageData = await imageProcessor.processImage(imagePath);
      if (!imageData || !imageData.embedding) {
        console.error('Görsel işlenemedi veya embedding oluşturulamadı');
        return { success: false, error: 'Görsel işlenemedi', results: [] };
      }
      
      // 2. Hibrid arama yap
      const results = await database.searchSimilarHybrid(
        imageData.embedding,
        imageData.colorHist,
        threshold || 0.7,
        weights || { embedding: 0.8, color: 0.2 }
      );
      
      return {
        success: true,
        results: results,
        searchTime: results[0]?.searchTime || 0,
        totalResults: results.length
      };
      
    } catch (error) {
      console.error('Hızlı arama hatası:', error);
      return { 
        success: false, 
        error: error.message, 
        results: [] 
      };
    }
  });

  // get-statistics handler'ı simple-ipc.js'de zaten var, burada kaldırıldı

  // Renk bazlı arama
  ipcMain.handle('search-by-colors', async (event, searchParams) => {
    try {
      console.log('🎨 Renk bazlı arama başlatılıyor:', searchParams);
      
      const { colors, tolerance, mode } = searchParams;
      console.log('🔍 Arama parametreleri:', { colors, tolerance, mode });
      
      // Tüm görselleri al
      console.log('📁 Veritabanından görseller alınıyor...');
      const allImages = await database.getAllImages();
      console.log(`📊 Toplam ${allImages.length} görsel bulundu`);
      
      // Renk arama algoritması
      const results = [];
      let processedCount = 0;
      
      for (const image of allImages) {
        processedCount++;
        if (processedCount % 100 === 0) {
          console.log(`🔄 İşleniyor: ${processedCount}/${allImages.length}`);
        }
        
        if (!image.colorHist) {
          console.log(`⚠️ ${image.filename || image.filepath} için renk histogramı yok`);
          continue;
        }
        
        let matchScore = 0;
        let imageColors;
        
        try {
          imageColors = JSON.parse(image.colorHist);
        } catch (parseError) {
          console.log(`⚠️ ${image.filename || image.filepath} için renk histogramı parse edilemedi`);
          continue;
        }
        
        switch (mode) {
          case 'dominant':
            // Baskın renk arama
            const dominantColor = colors[0];
            if (imageColors.dominant) {
              const dominantScore = calculateColorSimilarity(dominantColor, imageColors.dominant);
              if (dominantScore >= tolerance) {
                matchScore = dominantScore;
              }
            }
            break;
            
          case 'palette':
            // Renk paleti arama
            let paletteScore = 0;
            let matchedColors = 0;
            
            if (imageColors.palette && Array.isArray(imageColors.palette)) {
              for (const searchColor of colors) {
                let bestMatch = 0;
                for (const imageColor of imageColors.palette) {
                  const similarity = calculateColorSimilarity(searchColor, imageColor);
                  if (similarity > bestMatch) {
                    bestMatch = similarity;
                  }
                }
                if (bestMatch >= tolerance) {
                  paletteScore += bestMatch;
                  matchedColors++;
                }
              }
              
              if (matchedColors > 0) {
                matchScore = paletteScore / matchedColors;
              }
            }
            break;
            
          case 'exact':
            // Tam eşleşme arama
            let exactMatches = 0;
            if (imageColors.palette && Array.isArray(imageColors.palette)) {
              for (const searchColor of colors) {
                for (const imageColor of imageColors.palette) {
                  if (calculateColorSimilarity(searchColor, imageColor) >= 0.9) {
                    exactMatches++;
                    break;
                  }
                }
              }
              matchScore = exactMatches / colors.length;
            }
            break;
        }
        
        if (matchScore > 0) {
          results.push({
            ...image,
            colorMatchScore: matchScore,
            similarity: Math.round(matchScore * 100)
          });
        }
      }
      
      // Sonuçları skora göre sırala
      results.sort((a, b) => b.colorMatchScore - a.colorMatchScore);
      
      console.log(`✅ Renk arama tamamlandı: ${results.length} sonuç bulundu`);
      return { success: true, results: results.slice(0, 50) }; // İlk 50 sonuç
      
    } catch (error) {
      console.error('❌ Renk arama hatası:', error);
      return { success: false, error: error.message };
    }
  });

  // Renk benzerliği hesaplama fonksiyonu
  function calculateColorSimilarity(color1, color2) {
    // Hex'i RGB'ye çevir
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    
    if (!rgb1 || !rgb2) return 0;
    
    // Euclidean distance hesapla
    const distance = Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) +
      Math.pow(rgb1.g - rgb2.g, 2) +
      Math.pow(rgb1.b - rgb2.b, 2)
    );
    
    // Maksimum mesafe 441.67 (255^2 + 255^2 + 255^2)^0.5
    const maxDistance = 441.67;
    return 1 - (distance / maxDistance);
  }

  // Hex'i RGB'ye çevirme
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  // search-similar-from-db handler'ı simple-ipc.js'de zaten var, burada kaldırıldı

  // Yeni handler: İstatistikleri getir
  ipcMain.handle('get-scan-statistics', async () => {
    try {
      const stats = enhancedDb.getStatistics();
      return { success: true, stats };
    } catch (error) {
      console.error('İstatistik hatası:', error);
      return { success: false, error: error.message };
    }
  });

  // Yeni handler: Tarama geçmişi
  ipcMain.handle('get-scan-history', async () => {
    try {
      const history = enhancedDb.db.prepare(`
        SELECT * FROM scan_history 
        ORDER BY started_at DESC 
        LIMIT 50
      `).all();
      return { success: true, history };
    } catch (error) {
      console.error('Tarama geçmişi hatası:', error);
      return { success: false, error: error.message };
    }
  });

  // Görsel ile benzerlik arama
  ipcMain.handle('searchSimilarImages', async (event, { imagePath, imageData }, options = {}) => {
    try {
      console.log('🔍 Görsel benzerlik araması başlatılıyor...');
      console.log('📁 imagePath:', imagePath);
      console.log('📊 imageData:', imageData ? { name: imageData.name, size: imageData.size } : 'null');
      console.log('💿 Seçilen diskler:', options.drives || 'Tümü');
      
      let targetPath = imagePath;
      
      // Eğer dosya yolu yoksa, base64'ten geçici dosya oluştur
      if (!targetPath && imageData && imageData.preview) {
        console.log('🔄 Base64\'ten geçici dosya oluşturuluyor...');
        const tempDir = path.join(require('electron').app.getPath('temp'), 'tekstil-ai');
        await fs.mkdir(tempDir, { recursive: true });
        
        const tempPath = path.join(tempDir, `temp-${Date.now()}.jpg`);
        const base64Data = imageData.preview.replace(/^data:image\/\w+;base64,/, '');
        await fs.writeFile(tempPath, base64Data, 'base64');
        
        targetPath = tempPath;
        console.log('✅ Geçici dosya oluşturuldu:', targetPath);
      }
      
      if (!targetPath) {
        console.error('❌ Hedef dosya yolu bulunamadı');
        return { success: false, error: 'Hedef dosya yolu bulunamadı' };
      }
      
      // Görsel işle ve benzerlik ara
      console.log('🔄 Görsel işleniyor:', targetPath);
      const targetImage = await imageProcessor.processImage(targetPath);
      if (!targetImage) {
        console.error('❌ Görsel işlenemedi');
        return { success: false, error: 'Görsel işlenemedi' };
      }
      
      console.log('✅ Görsel işlendi, hash\'ler:', {
        perceptual: targetImage.perceptual_hash?.substring(0, 10) + '...',
        color: targetImage.color_hash?.substring(0, 10) + '...',
        edge: targetImage.edge_hash?.substring(0, 10) + '...'
      });
      
      // Veritabanından benzer görselleri bul
      console.log('🔍 Veritabanında benzer görseller aranıyor...');
      
      // Seçilen disklerde arama yap
      let similarImages = [];
      if (options.drives && options.drives.length > 0) {
        // Belirli disklerde arama
        for (const drive of options.drives) {
          console.log(`🔍 ${drive}: diskinde arama yapılıyor...`);
          const driveResults = await database.searchSimilarImagesInDrive({
            perceptualHash: targetImage.perceptual_hash,
            colorHash: targetImage.color_hash,
            edgeHash: targetImage.edge_hash
          }, 0.7, drive);
          similarImages.push(...driveResults);
        }
      } else {
        // Tüm disklerde arama
        similarImages = await database.searchSimilarImages({
          perceptualHash: targetImage.perceptual_hash,
          colorHash: targetImage.color_hash,
          edgeHash: targetImage.edge_hash
        }, 0.7);
      }
      
      console.log(`📊 ${similarImages.length} benzer görsel bulundu`);
      
      // Thumbnail'leri ekle
      console.log('🖼️ Thumbnail\'ler oluşturuluyor...');
      const imagesWithThumbs = await Promise.all(
        similarImages.map(async (img) => {
          try {
            const thumbnail = await imageProcessor.createThumbnail(img.filepath, 200);
            return {
              ...img,
              thumbnail
            };
          } catch (thumbError) {
            console.warn(`⚠️ Thumbnail oluşturulamadı: ${img.filepath}`, thumbError.message);
            return {
              ...img,
              thumbnail: null
            };
          }
        })
      );
      
      console.log('✅ Görsel arama tamamlandı');
      return {
        success: true,
        images: imagesWithThumbs,
        count: imagesWithThumbs.length,
        searchedDrives: options.drives || []
      };
      
    } catch (error) {
      console.error('❌ Görsel arama hatası:', error);
      return { success: false, error: error.message };
    }
  });
}; 

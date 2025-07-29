const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const db = require('./enhanced-database');
const imageProcessor = require('./enhanced-image-processor');

class SmartDiskScanner extends EventEmitter {
  constructor() {
    super();
    this.isScanning = false;
    this.lastScanTime = null;
    this.scanInterval = 24 * 60 * 60 * 1000; // 24 saat
  }

  // İlk tarama kontrolü
  async checkFirstTimeSetup() {
    try {
      const stats = await db.getStatistics();
      const hasImages = stats.total_images > 0;
      
      if (!hasImages) {
        console.log('🆕 İlk kullanım tespit edildi, otomatik tarama başlatılıyor...');
        return { needsScan: true, reason: 'first_time' };
      }
      
      // Son tarama zamanını kontrol et
      const lastScan = await this.getLastScanTime();
      const timeSinceLastScan = Date.now() - lastScan;
      
      if (timeSinceLastScan > this.scanInterval) {
        console.log('⏰ Son taramadan bu yana 24 saat geçti, güncelleme taraması başlatılıyor...');
        return { needsScan: true, reason: 'time_based' };
      }
      
      console.log('✅ Veritabanı güncel, tarama gerekmiyor');
      return { needsScan: false, reason: 'up_to_date' };
      
    } catch (error) {
      console.error('❌ İlk kurulum kontrolü hatası:', error);
      return { needsScan: true, reason: 'error' };
    }
  }

  // Son tarama zamanını al
  async getLastScanTime() {
    try {
      const history = await db.db.prepare(`
        SELECT MAX(completed_at) as last_scan 
        FROM scan_history 
        WHERE status = 'completed'
      `).get();
      
      return history?.last_scan ? new Date(history.last_scan).getTime() : 0;
    } catch (error) {
      console.warn('⚠️ Son tarama zamanı alınamadı:', error.message);
      return 0;
    }
  }

  // Akıllı tarama - sadece değişiklikleri kontrol et
  async smartScan(drives, options = {}) {
    if (this.isScanning) {
      console.log('⚠️ Tarama zaten devam ediyor...');
      return { success: false, error: 'Scan already in progress' };
    }

    this.isScanning = true;
    
    try {
      // İlk kurulum kontrolü
      const setupCheck = await this.checkFirstTimeSetup();
      
      if (!setupCheck.needsScan && !options.force) {
        console.log('✅ Veritabanı güncel, tarama atlanıyor');
        return { 
          success: true, 
          skipped: true, 
          reason: setupCheck.reason,
          stats: await db.getStatistics()
        };
      }

      console.log('🚀 Akıllı tarama başlatılıyor...');
      
      const scanId = await db.startScanSession(drives[0], 'smart');
      const results = [];
      let totalStats = {
        totalScanned: 0,
        newFiles: 0,
        updatedFiles: 0,
        deletedFiles: 0,
        errors: 0
      };

      for (const disk of drives) {
        console.log(`🔍 ${disk} diski akıllı tarama...`);
        
        const diskResults = await this.scanDiskSmart(disk, options);
        results.push(diskResults);
        
        // İstatistikleri topla
        totalStats.totalScanned += diskResults.stats.totalScanned;
        totalStats.newFiles += diskResults.stats.newFiles;
        totalStats.updatedFiles += diskResults.stats.updatedFiles;
        totalStats.deletedFiles += diskResults.stats.deletedFiles;
        totalStats.errors += diskResults.stats.errors;
      }

      // Tarama oturumunu güncelle
      await db.updateScanSession(scanId, totalStats);
      
      console.log('✅ Akıllı tarama tamamlandı:', totalStats);
      
      return {
        success: true,
        results,
        totalStats,
        scanId
      };
      
    } catch (error) {
      console.error('❌ Akıllı tarama hatası:', error);
      return { success: false, error: error.message };
    } finally {
      this.isScanning = false;
    }
  }

  // Akıllı disk tarama - sadece değişiklikleri kontrol et
  async scanDiskSmart(diskLetter, options = {}) {
    if (!diskLetter) {
      console.error('❌ Disk harfi belirtilmedi');
      return { disk: 'unknown', stats: { totalScanned: 0, newFiles: 0, updatedFiles: 0, deletedFiles: 0, errors: 1 }, error: 'Disk harfi belirtilmedi' };
    }
    
    const diskPath = `${diskLetter}\\`;
    const stats = {
      totalScanned: 0,
      newFiles: 0,
      updatedFiles: 0,
      deletedFiles: 0,
      errors: 0
    };

    try {
      // Kullanıcı klasörlerini tara
      const userFolders = await this.getUserFolders(diskPath);
      
      for (const folder of userFolders) {
        try {
          const folderStats = await this.scanFolderSmart(folder, options);
          
          stats.totalScanned += folderStats.totalScanned;
          stats.newFiles += folderStats.newFiles;
          stats.updatedFiles += folderStats.updatedFiles;
          stats.deletedFiles += folderStats.deletedFiles;
          stats.errors += folderStats.errors;
          
          // Progress event'i gönder
          this.emit('progress', {
            disk: diskLetter,
            folder: path.basename(folder),
            stats: folderStats,
            totalStats: stats
          });
          
        } catch (error) {
          console.error(`❌ Klasör tarama hatası: ${folder}`, error.message);
          stats.errors++;
        }
      }

      // Silinen dosyaları tespit et
      const deletedCount = await this.detectDeletedFiles(diskLetter);
      stats.deletedFiles += deletedCount;

      return { disk: diskLetter, stats };
      
    } catch (error) {
      console.error(`❌ Disk tarama hatası: ${diskLetter}`, error);
      stats.errors++;
      return { disk: diskLetter, stats, error: error.message };
    }
  }

  // Akıllı klasör tarama - sadece değişiklikleri kontrol et
  async scanFolderSmart(folderPath, options = {}) {
    const stats = {
      totalScanned: 0,
      newFiles: 0,
      updatedFiles: 0,
      deletedFiles: 0,
      errors: 0
    };

    try {
      // Klasördeki görselleri bul
      const imageFiles = await this.findImageFiles(folderPath);
      stats.totalScanned = imageFiles.length;

      for (const imagePath of imageFiles) {
        try {
          // Dosya hash'ini hesapla
          const fileHash = await this.calculateFileHash(imagePath);
          
          // Veritabanında kontrol et
          const existing = await db.db.prepare(`
            SELECT * FROM images WHERE file_path = ?
          `).get(imagePath);

          if (!existing) {
            // Yeni dosya
            await this.processNewImage(imagePath, fileHash);
            stats.newFiles++;
          } else if (existing.file_hash !== fileHash) {
            // Dosya değişmiş
            await this.processUpdatedImage(imagePath, fileHash, existing);
            stats.updatedFiles++;
          }
          // Dosya değişmemişse hiçbir şey yapma
          
        } catch (error) {
          console.error(`❌ Dosya işleme hatası: ${imagePath}`, error.message);
          stats.errors++;
        }
      }

      return stats;
      
    } catch (error) {
      console.error(`❌ Klasör tarama hatası: ${folderPath}`, error);
      stats.errors++;
      return stats;
    }
  }

  // Görsel dosyalarını bul
  async findImageFiles(folderPath) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];
    const imageFiles = [];

    try {
      const files = await fs.readdir(folderPath, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile()) {
          const ext = path.extname(file.name).toLowerCase();
          if (imageExtensions.includes(ext)) {
            imageFiles.push(path.join(folderPath, file.name));
          }
        }
      }
    } catch (error) {
      // Klasör erişim hatası - normal
    }

    return imageFiles;
  }

  // Dosya hash'ini hesapla
  async calculateFileHash(filePath) {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  // Yeni görsel işle
  async processNewImage(imagePath, fileHash) {
    try {
      const imageData = await imageProcessor.processImage(imagePath);
      if (imageData) {
        await db.upsertImage({
          ...imageData,
          file_hash: fileHash
        });
        console.log(`✅ Yeni görsel eklendi: ${path.basename(imagePath)}`);
      }
    } catch (error) {
      console.error(`❌ Yeni görsel işleme hatası: ${imagePath}`, error.message);
    }
  }

  // Güncellenmiş görsel işle
  async processUpdatedImage(imagePath, fileHash, existing) {
    try {
      const imageData = await imageProcessor.processImage(imagePath);
      if (imageData) {
        await db.upsertImage({
          ...imageData,
          file_hash: fileHash
        });
        console.log(`🔄 Görsel güncellendi: ${path.basename(imagePath)}`);
      }
    } catch (error) {
      console.error(`❌ Görsel güncelleme hatası: ${imagePath}`, error.message);
    }
  }

  // Silinen dosyaları tespit et
  async detectDeletedFiles(diskLetter) {
    try {
      const activeFiles = await db.db.prepare(`
        SELECT file_path FROM images 
        WHERE file_path LIKE ? || '%' AND status = 'active'
      `).all(diskLetter);

      let deletedCount = 0;
      
      if (!activeFiles || !Array.isArray(activeFiles)) {
        console.warn('⚠️ Aktif dosya listesi alınamadı');
        return 0;
      }
      
      for (const file of activeFiles) {
        try {
          await fs.access(file.file_path);
          // Dosya mevcut, hiçbir şey yapma
        } catch (error) {
          // Dosya bulunamadı, silinmiş olarak işaretle
          await db.db.prepare(`
            UPDATE images SET status = 'deleted', updated_at = CURRENT_TIMESTAMP 
            WHERE file_path = ?
          `).run(file.file_path);
          
          deletedCount++;
          console.log(`🗑️ Silinen dosya tespit edildi: ${path.basename(file.file_path)}`);
        }
      }

      return deletedCount;
      
    } catch (error) {
      console.error('❌ Silinen dosya tespiti hatası:', error);
      return 0;
    }
  }

  // Kullanıcı klasörlerini al
  async getUserFolders(diskPath) {
    const folders = [];
    
    try {
      const usersDir = path.join(diskPath, 'Users');
      const users = await fs.readdir(usersDir, { withFileTypes: true });
      
      for (const user of users) {
        if (user.isDirectory() && 
            user.name !== 'Default' && 
            user.name !== 'Public' && 
            user.name !== 'All Users') {
          
          const userPath = path.join(usersDir, user.name);
          const userFolders = [
            path.join(userPath, 'Desktop'),
            path.join(userPath, 'Documents'),
            path.join(userPath, 'Pictures'),
            path.join(userPath, 'Downloads'),
            path.join(userPath, 'Videos')
          ];
          
          folders.push(...userFolders);
        }
      }
    } catch (error) {
      console.warn('⚠️ Kullanıcı klasörleri alınamadı:', error.message);
    }

    return folders;
  }
}

module.exports = new SmartDiskScanner(); 
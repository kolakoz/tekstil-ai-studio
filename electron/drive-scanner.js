const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const imageProcessor = require('./image-processor');
const database = require('./database');

class DriveScanner {
  constructor() {
    this.scanning = false;
    this.progress = 0;
    this.total = 0;
    this.scannedDrives = new Set();
    this.lastScanTime = null;
  }

  // Tüm diskleri tara
  async scanAllDrives() {
    if (this.scanning) {
      return { success: false, error: 'Tarama zaten devam ediyor' };
    }

    this.scanning = true;
    this.progress = 0;
    this.total = 0;
    this.scannedDrives.clear();

    try {
      console.log('🔍 Diskler tespit ediliyor...');
      
      // Windows'ta diskleri tespit et
      const drives = await this.getAvailableDrives();
      console.log(`📁 Bulunan diskler: ${drives.join(', ')}`);

      let totalImages = 0;
      let processedImages = 0;

      // Her disk için görsel sayısını hesapla
      console.log('📊 Disklerdeki görsel sayısı hesaplanıyor...');
      for (const drive of drives) {
        try {
          const imageCount = await this.countImagesInDrive(drive);
          totalImages += imageCount;
          console.log(`📊 ${drive}: ${imageCount} görsel`);
        } catch (error) {
          console.warn(`⚠️ ${drive} sayım hatası:`, error.message);
        }
      }

      this.total = totalImages;
      console.log(`🎯 Toplam ${totalImages} görsel işlenecek`);

      // Her diski tara
      for (const drive of drives) {
        if (!this.scanning) {
          console.log('❌ Tarama iptal edildi');
          break;
        }
        
        console.log(`🚀 ${drive} disk taranıyor...`);
        try {
          const result = await this.scanDrive(drive, (progress) => {
            this.progress = processedImages + progress;
          });
          
          processedImages += result.processed;
          this.scannedDrives.add(drive);
          
          console.log(`✅ ${drive} tamamlandı: ${result.processed} görsel işlendi, ${result.skipped} atlandı`);
        } catch (error) {
          console.error(`❌ ${drive} tarama hatası:`, error.message);
        }
      }

      this.lastScanTime = new Date();
      console.log(`🎉 TÜM TARAMA TAMAMLANDI! ${processedImages} görsel işlendi`);

      return {
        success: true,
        processed: processedImages,
        total: totalImages,
        drives: Array.from(this.scannedDrives)
      };

    } catch (error) {
      console.error('Disk tarama hatası:', error);
      return { success: false, error: error.message };
    } finally {
      this.scanning = false;
    }
  }

  // Yeni eklenen görselleri kontrol et
  async checkNewImages() {
    if (this.scanning) {
      return { success: false, error: 'Tarama devam ediyor' };
    }

    try {
      console.log('🔄 Yeni görseller kontrol ediliyor...');
      
      const drives = await this.getAvailableDrives();
      let newImages = 0;

      for (const drive of drives) {
        const result = await this.scanDrive(drive, null, true); // Sadece yeni dosyalar
        newImages += result.processed;
      }

      console.log(`✅ ${newImages} yeni görsel bulundu ve işlendi`);
      
      return {
        success: true,
        newImages: newImages
      };

    } catch (error) {
      console.error('Yeni görsel kontrol hatası:', error);
      return { success: false, error: error.message };
    }
  }

  // Seçili diskleri tara
  async scanSelectedDrives(selectedDrives, progressCallback = null) {
    if (this.scanning) {
      return { success: false, error: 'Tarama zaten devam ediyor' };
    }

    this.scanning = true;
    this.progress = 0;
    this.total = 0;
    this.scannedDrives.clear();

    try {
      console.log(`🔍 Seçili diskler taranıyor: ${selectedDrives.join(', ')}`);
      
      let totalImages = 0;
      let processedImages = 0;

      // Seçili disklerdeki görsel sayısını hesapla
      console.log('📊 Seçili disklerdeki görsel sayısı hesaplanıyor...');
      for (const drive of selectedDrives) {
        try {
          const imageCount = await this.countImagesInDrive(drive);
          totalImages += imageCount;
          console.log(`📊 ${drive}: ${imageCount} görsel`);
        } catch (error) {
          console.warn(`⚠️ ${drive} sayım hatası:`, error.message);
        }
      }

      this.total = totalImages;
      console.log(`🎯 Toplam ${totalImages} görsel işlenecek`);

      // Her seçili diski tara
      for (const drive of selectedDrives) {
        if (!this.scanning) {
          console.log('❌ Tarama iptal edildi');
          break;
        }
        
        console.log(`🚀 ${drive} disk taranıyor...`);
        try {
          const result = await this.scanDrive(drive, (progress) => {
            const currentProgress = processedImages + progress;
            this.progress = currentProgress;
            if (progressCallback) {
              progressCallback({
                current: currentProgress,
                total: totalImages,
                currentFile: result.currentFile || ''
              });
            }
          });
          
          processedImages += result.processed;
          this.scannedDrives.add(drive);
          
          console.log(`✅ ${drive} tamamlandı: ${result.processed} görsel işlendi, ${result.skipped} atlandı`);
        } catch (error) {
          console.error(`❌ ${drive} tarama hatası:`, error.message);
        }
      }

      this.lastScanTime = new Date();
      console.log(`🎉 SEÇİLİ DİSK TARAMA TAMAMLANDI! ${processedImages} görsel işlendi`);

      return {
        success: true,
        processed: processedImages,
        total: totalImages,
        drives: Array.from(this.scannedDrives)
      };

    } catch (error) {
      console.error('Seçili disk tarama hatası:', error);
      return { success: false, error: error.message };
    } finally {
      this.scanning = false;
    }
  }

  // Disk tara
  async scanDrive(drivePath, progressCallback = null, onlyNew = false) {
    let processed = 0;
    let skipped = 0;
    let currentFile = '';

    try {
      const imageFiles = await this.findImageFiles(drivePath, onlyNew);
      
      for (const imagePath of imageFiles) {
        if (!this.scanning) break; // İptal kontrolü

        currentFile = imagePath; // Şu anki dosyayı güncelle

        try {
          // Görsel zaten veritabanında mı kontrol et
          if (onlyNew) {
            const exists = await this.imageExistsInDatabase(imagePath);
            if (exists) {
              skipped++;
              continue;
            }
          }

          // Görseli işle ve veritabanına ekle
          const imageData = await imageProcessor.processImage(imagePath);
          if (imageData && imageData.embedding) {
            await database.addImageToDatabase(
              imagePath,
              imageData.filename,
              imageData.embedding,
              imageData.colorHist,
              imageData.hogVector
            );
            processed++;
            
            if (progressCallback) {
              progressCallback(processed);
            }
          }

        } catch (error) {
          console.warn(`Görsel işleme hatası ${imagePath}:`, error.message);
          skipped++;
        }
      }

      return { processed, skipped, currentFile };

    } catch (error) {
      console.error(`Disk tarama hatası ${drivePath}:`, error);
      return { processed: 0, skipped: 0, currentFile: '', error: error.message };
    }
  }

  // Görsel dosyalarını bul
  async findImageFiles(dirPath, onlyNew = false) {
    const imageFiles = [];
    
    try {
      await this.scanDirectory(dirPath, (filePath) => {
        if (imageProcessor.isImageFile(filePath)) {
          imageFiles.push(filePath);
        }
      });
    } catch (error) {
      console.warn(`Dizin tarama hatası ${dirPath}:`, error.message);
    }

    return imageFiles;
  }

  // Dizini recursive olarak tara
  async scanDirectory(dirPath, onFileFound) {
    try {
      // Dizin erişim kontrolü
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        return;
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        try {
          if (entry.isDirectory()) {
            // Sistem klasörlerini atla
            if (this.shouldSkipDirectory(entry.name)) {
              console.log(`⏭️ Atlanan dizin: ${fullPath}`);
              continue;
            }
            
            // Recursive tarama
            await this.scanDirectory(fullPath, onFileFound);
          } else if (entry.isFile()) {
            // Dosya boyutu kontrolü (çok büyük dosyaları atla)
            try {
              const fileStats = await fs.stat(fullPath);
              const fileSizeMB = fileStats.size / (1024 * 1024);
              
              // 100MB'dan büyük dosyaları atla
              if (fileSizeMB > 100) {
                console.log(`⏭️ Büyük dosya atlandı: ${fullPath} (${fileSizeMB.toFixed(1)}MB)`);
                continue;
              }
              
              onFileFound(fullPath);
            } catch (fileError) {
              // Dosya erişim hatası - sessizce geç
              console.log(`⚠️ Dosya erişim hatası: ${fullPath}`);
            }
          }
        } catch (entryError) {
          // Tek dosya/dizin hatası - devam et
          console.log(`⚠️ Dizin girişi hatası: ${fullPath}`);
        }
      }
    } catch (error) {
      // Dizin erişim hatası - sessizce geç
      console.log(`⚠️ Dizin erişim hatası: ${dirPath}`);
    }
  }

  // Atlanacak dizinler
  shouldSkipDirectory(dirName) {
    const skipDirs = [
      // Windows sistem dosyaları
      'windows', 'winnt', 'system32', 'syswow64', 'program files', 'program files (x86)',
      '$recycle.bin', 'system volume information', 'recovery', 'boot', 'efi',
      
      // Kullanıcı sistem dosyaları
      'appdata', 'programdata', 'users', 'default user', 'all users',
      'local settings', 'application data', 'start menu', 'desktop',
      
      // Geçici dosyalar
      'temp', 'tmp', 'cache', 'caches', 'logs', 'log',
      
      // Geliştirme dosyaları
      'node_modules', '.git', '.svn', 'vendor', '__pycache__', '.pytest_cache',
      'build', 'dist', 'target', 'bin', 'obj', '.vs', '.idea', '.vscode',
      
      // Uygulama dosyaları
      'programs', 'common files', 'microsoft shared', 'windows nt',
      
      // Diğer sistem dosyaları
      'pagefile.sys', 'hiberfil.sys', 'swapfile.sys', 'ntuser.dat',
      'ntuser.dat.log', 'ntuser.ini', 'desktop.ini', 'thumbs.db',
      
      // Güvenlik ve gizlilik
      'recycler', 'found.000', 'found.001', 'found.002',
      
      // Ağ ve paylaşım
      'network', 'netlogon', 'sysvol', 'dfsroot',
      
      // Yedekleme ve geri yükleme
      'backup', 'restore', 'restore point', 'system restore',
      
      // Sürücü dosyaları
      'drivers', 'driver', 'drv', 'inf', 'cat', 'sys',
      
      // Güncelleme dosyaları
      'windows.old', 'windows.old.000', 'windows.old.001',
      'software distribution', 'wuauserv', 'windows update',
      
      // Güvenlik yazılımları
      'antivirus', 'security', 'defender', 'firewall',
      
      // Sanal makine dosyaları
      'virtualbox vms', 'vmware', 'hyper-v', 'vhd', 'vmdk',
      
      // Sıkıştırılmış dosyalar
      'compressed', 'zipped', 'archive', 'backup',
      
      // İndirme ve geçici
      'downloads', 'download', 'temp', 'tmp', 'cache',
      
      // Uygulama özel
      'chrome', 'firefox', 'edge', 'opera', 'safari',
      'microsoft', 'office', 'adobe', 'autodesk', 'solidworks',
      'cad', 'cam', 'engineering', 'design', 'drafting'
    ];
    
    const dirNameLower = dirName.toLowerCase();
    
    // Tam eşleşme kontrolü
    if (skipDirs.some(skip => dirNameLower === skip.toLowerCase())) {
      return true;
    }
    
    // Kısmi eşleşme kontrolü (daha dikkatli)
    const partialMatches = [
      'windows', 'program', 'system', 'temp', 'cache', 'log',
      'backup', 'restore', 'update', 'security', 'antivirus',
      'virtual', 'vmware', 'virtualbox', 'download', 'compressed'
    ];
    
    return partialMatches.some(match => 
      dirNameLower.includes(match.toLowerCase())
    );
  }

  // Disk sayısını hesapla
  async countImagesInDrive(drivePath) {
    let count = 0;
    
    try {
      await this.scanDirectory(drivePath, (filePath) => {
        if (imageProcessor.isImageFile(filePath)) {
          count++;
        }
      });
    } catch (error) {
      console.warn(`Sayım hatası ${drivePath}:`, error.message);
    }

    return count;
  }

  // Görsel veritabanında mevcut mu
  async imageExistsInDatabase(imagePath) {
    try {
      await database.ensureDatabase();
      return new Promise((resolve, reject) => {
        database.db.get(
          'SELECT id FROM images WHERE filepath = ?',
          [imagePath],
          (err, row) => {
            if (err) reject(err);
            else resolve(!!row);
          }
        );
      });
    } catch (error) {
      return false;
    }
  }

  // Mevcut diskleri al
  async getAvailableDrives() {
    return new Promise((resolve, reject) => {
      // Önce wmic ile dene
      exec('wmic logicaldisk get deviceid', (error, stdout) => {
        if (error) {
          console.warn('⚠️ wmic komutu başarısız, alternatif yöntem deneniyor...');
          
          // Alternatif: fs ile disk kontrolü
          try {
            const fs = require('fs');
            const drives = [];
            const driveLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
            
            for (const letter of driveLetters) {
              const drivePath = `${letter}:\\`;
              try {
                if (fs.existsSync(drivePath)) {
                  const stats = fs.statSync(drivePath);
                  drives.push(drivePath);
                }
              } catch (err) {
                // Disk erişilemez, atla
              }
            }
            
            console.log(`✅ ${drives.length} disk bulundu: ${drives.join(', ')}`);
            resolve(drives);
          } catch (fallbackError) {
            console.error('❌ Alternatif disk bulma yöntemi de başarısız:', fallbackError);
            reject(fallbackError);
          }
          return;
        }

        const drives = stdout
          .split('\n')
          .slice(1) // İlk satırı atla (başlık)
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(drive => drive + '\\');

        console.log(`✅ ${drives.length} disk bulundu: ${drives.join(', ')}`);
        resolve(drives);
      });
    });
  }

  // Tarama durumunu al
  getScanStatus() {
    return {
      scanning: this.scanning,
      progress: this.progress,
      total: this.total,
      scannedDrives: Array.from(this.scannedDrives),
      lastScanTime: this.lastScanTime
    };
  }

  // Taramayı iptal et
  cancelScan() {
    this.scanning = false;
    console.log('❌ Tarama iptal edildi');
  }
}

module.exports = new DriveScanner();

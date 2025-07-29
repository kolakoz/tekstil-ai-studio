const fs = require('fs').promises;
const path = require('path');

class SimpleScanner {
  constructor() {
    this.supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
    this.cancelRequested = false;
    this.isScanning = false;
  }

  async scanFolder(folderPath, onProgress) {
    if (this.isScanning) {
      console.warn('⚠️ Zaten tarama yapılıyor');
      return [];
    }

    this.isScanning = true;
    this.cancelRequested = false;
    const images = [];
    
    console.log(`🚀 Tarama başlatılıyor: ${folderPath}`);
    
    try {
      async function* walk(dir, scanner) {
        const files = await fs.readdir(dir, { withFileTypes: true });
        
        for (const file of files) {
          if (scanner.cancelRequested) {
            console.log('⏹️ Tarama iptal edildi');
            break;
          }
          
          const filePath = path.join(dir, file.name);
          
          if (file.isDirectory()) {
            // Sistem klasörlerini atla (daha kapsamlı)
            const skipFolders = [
              'windows', 'program files', 'program files (x86)', 'programdata',
              '$recycle.bin', '$winreagent', 'system volume information',
              'recovery', 'perflogs', 'intel', 'amd', 'nvidia',
              'node_modules', '.git', '.vscode', '.idea',
              'local settings', 'application data', 'system32', 'syswow64',
              'config', 'drivers', 'logfiles', 'msdtc', 'networklist',
              'sru', 'tasks', 'wdi', 'sleepstudy', 'spool', 'printers',
              'driverdata', 'configuration', 'com', 'dmp', 'appmgmt',
              's-1-5-18', 'machine', 'perflogs', '$windows.~bt', '$windows.~ws',
              '$archivedata', '$temp', '$onedrive temp', '$git', '$svn',
              '$cache', '$venv', '$env', 'lib', 'tcl', 'vendor', '__pycache__',
              'build', 'dist', 'debug', 'release', 'logs', 'temp', 'tmp'
            ];
            
            const shouldSkip = skipFolders.some(folder => 
              file.name.toLowerCase() === folder.toLowerCase() ||
              file.name.toLowerCase().includes(folder.toLowerCase())
            );
            
            // Sistem dosyalarını ve gizli dosyaları atla
            if (!shouldSkip && 
                !file.name.startsWith('.') && 
                !file.name.startsWith('$') &&
                !file.name.toLowerCase().includes('system') &&
                !file.name.toLowerCase().includes('windows') &&
                !file.name.toLowerCase().includes('program')) {
              yield* walk.call(scanner, filePath, scanner);
            }
          } else if (file.isFile()) {
            const ext = path.extname(file.name).toLowerCase();
            if (scanner.supportedFormats.includes(ext)) {
              yield filePath;
            }
          }
        }
      }

      let count = 0;
      for await (const imagePath of walk.call(this, folderPath, this)) {
        images.push(imagePath);
        count++;
        
        if (onProgress && count % 10 === 0) {
          onProgress({ 
            found: count, 
            current: path.basename(imagePath),
            total: count 
          });
        }
      }
      
      console.log(`✅ Tarama tamamlandı: ${images.length} görsel bulundu`);
      return images;
      
    } catch (error) {
      console.error('❌ Tarama hatası:', error.message);
      return [];
    } finally {
      this.isScanning = false;
    }
  }

  async scanMultipleFolders(folderPaths, onProgress) {
    const allImages = [];
    let totalFound = 0;
    
    for (const folderPath of folderPaths) {
      if (this.cancelRequested) break;
      
      console.log(`📁 Taranıyor: ${folderPath}`);
      const images = await this.scanFolder(folderPath, (progress) => {
        totalFound += progress.found;
        if (onProgress) {
          onProgress({
            ...progress,
            found: totalFound,
            currentFolder: folderPath
          });
        }
      });
      
      allImages.push(...images);
    }
    
    return allImages;
  }

  cancelScan() {
    this.cancelRequested = true;
    console.log('⏹️ Tarama iptal isteği gönderildi');
  }

  isScanning() {
    return this.isScanning;
  }

  getSupportedFormats() {
    return this.supportedFormats;
  }

  // Dosya boyutu kontrolü
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  // Geçerli dosya kontrolü
  async isValidImageFile(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      if (!this.supportedFormats.includes(ext)) {
        return false;
      }
      
      const size = await this.getFileSize(filePath);
      if (size === 0 || size > 100 * 1024 * 1024) { // 100MB limit
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new SimpleScanner(); 
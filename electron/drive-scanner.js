const fs = require('fs');
const path = require('path');
const imageProcessor = require('./image-processor');
const fileScanner = require('./file-scanner');
const database = require('./database');

/**
 * Windows ortamında mevcut sürücü harflerini listeler.
 * Linux/Mac tarafında kök dizin (/) veya /Volumes altı dönecek.
 * @returns {Promise<string[]>}
 */
async function listDrives() {
  // Eğer Windows ise basit harf denemesi yap
  if (process.platform === 'win32') {
    const drives = [];
    for (let i = 65; i <= 90; i += 1) {
      const letter = String.fromCharCode(i);
      const drivePath = `${letter}:\\`;
      try {
        fs.accessSync(drivePath, fs.constants.R_OK);
        drives.push(drivePath);
      } catch (e) {
        // erişilemiyor -> yoksay
      }
    }
    return drives;
  }

  // macOS -> /Volumes altındaki bağlanan diskler
  if (process.platform === 'darwin') {
    try {
      const volumes = await fs.promises.readdir('/Volumes', { withFileTypes: true });
      return volumes.filter((v) => v.isDirectory()).map((v) => path.join('/Volumes', v.name));
    } catch (err) {
      console.warn('Volüm okunamadı:', err.message);
      return ['/'];
    }
  }

  // Linux ve diğerleri için kök dizini döndür
  return ['/'];
}

/**
 * Belirtilen sürücü(ler)i tarar ve bulunan tüm görselleri DB'ye kaydetmek üzere döndürür.
 * @param {string[]} drives Sürücü kök dizinleri (örn. ["C:\\", "D:\\"])
 * @param {(data:{drive:string,current:number,total?:number,currentFile?:string})=>void} onProgress
 * @returns {Promise<Array>} İşlenen görsel meta verileri
 */
async function scanDrives(drives, onProgress = () => {}) {
  const allProcessedImages = [];
  for (const drive of drives) {
    let processedCount = 0;
    onProgress({ drive, current: processedCount, total: 0 }); // Başlangıç ilerlemesi

    try {
      const discoveredFiles = await fileScanner.scanDirectory(drive, (p) => {
        // Genel ilerlemeyi burada yayabiliriz, ancak detaylı dosya bazlı ilerleme processImage içinde olacak
      });
      const totalFiles = discoveredFiles.length;

      for (const filePath of discoveredFiles) {
        try {
          const imageData = await imageProcessor.processImage(filePath);
          if (imageData) {
            await database.insertImage(imageData);
            allProcessedImages.push(imageData);
          }
          processedCount += 1;
          onProgress({ drive, current: processedCount, total: totalFiles, currentFile: filePath });
        } catch (imageErr) {
          console.error(`Görsel işleme başarısız oldu ${filePath}:`, imageErr.message);
        }
      }
    } catch (err) {
      console.error(`Drive scan error (${drive}):`, err.message);
    }
  }

  return allProcessedImages;
}

module.exports = {
  listDrives,
  scanDrives,
};
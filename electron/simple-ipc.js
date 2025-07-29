const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const SimpleImageDB = require('./simple-database');
const processor = require('./simple-processor');
const scanner = require('./simple-scanner');

const db = new SimpleImageDB();

module.exports = function() {
  // İstatistikler
  ipcMain.handle('get-statistics', async () => {
    try {
      const stats = await db.getStats();
      return {
        success: true,
        stats: {
          total_images: stats.totalImages || 0,
          active_images: stats.withHash || 0,
          inactive_images: stats.withoutHash || 0
        }
      };
    } catch (error) {
      console.error('❌ İstatistik alma hatası:', error);
      return {
        success: false,
        error: error.message,
        stats: {
          total_images: 0,
          active_images: 0,
          inactive_images: 0
        }
      };
    }
  });

  // Klasör tarama
  ipcMain.handle('scanFolder', async (event) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });

      if (!result.canceled) {
        const folderPath = result.filePaths[0];
        console.log('📁 Klasör taranıyor:', folderPath);
        
        const imageFiles = await scanner.scanFolder(folderPath, (progress) => {
          event.sender.send('scan-progress', progress);
        });
        
        console.log(`✅ ${imageFiles.length} görsel bulundu`);
        
        for (const imagePath of imageFiles) {
          try {
            const imageData = await processor.processImage(imagePath);
            if (imageData) {
              await db.addImage(imageData);
            }
          } catch (error) {
            console.error(`❌ Görsel işleme hatası: ${imagePath}`, error.message);
          }
        }
        
        return { success: true, count: imageFiles.length };
      }
      
      return { success: false, error: 'Klasör seçilmedi' };
    } catch (error) {
      console.error('❌ Klasör tarama hatası:', error);
      return { success: false, error: error.message };
    }
  });

  // Benzer görsel arama
  ipcMain.handle('search-similar', async (event, imagePath, similarityThreshold = 0.3) => {
    const searchStartTime = Date.now();
    
    try {
      console.log('🔍 Benzer görsel aranıyor:', imagePath);
      
      // Monitoring search event'i
      const monitoring = global.monitoring;
      if (monitoring) {
        monitoring.track('search_started', { imagePath, threshold: similarityThreshold });
        monitoring.increment('search_attempts', 1, { type: 'similar' });
      }
      
      const processedImage = await processor.processImage(imagePath);
      if (!processedImage || !processedImage.hash) {
        throw new Error('Görsel işlenemedi');
      }
      
      const similarImages = await db.searchSimilarImages(processedImage.hash, similarityThreshold);
      
      console.log(`✅ ${similarImages.length} benzer görsel bulundu`);
      
      // Monitoring completion event'i
      if (monitoring) {
        const searchDuration = Date.now() - searchStartTime;
        monitoring.track('search_completed', { 
          type: 'similar',
          duration: searchDuration,
          results: similarImages.length,
          threshold: similarityThreshold
        });
        monitoring.timing('search_duration', searchDuration, { type: 'similar' });
        monitoring.increment('searches_completed', 1, { type: 'similar' });
      }
      
      return {
        success: true,
        similarImages,
        count: similarImages.length
      };
    } catch (error) {
      console.error('❌ Benzer görsel arama hatası:', error);
      
      // Monitoring error event'i
      const monitoring = global.monitoring;
      if (monitoring) {
        monitoring.increment('search_errors', 1, { type: 'similar' });
        monitoring.track('search_error', { error: error.message, type: 'similar' });
      }
      
      return { success: false, error: error.message };
    }
  });

  // Benzer görsel bulma (alias)
  ipcMain.handle('find-similar', async (event, imagePath) => {
    return await ipcMain.handlers['search-similar'][0](event, imagePath);
  });

  // İstatistikler (alias)
  ipcMain.handle('get-stats', async () => {
    return await ipcMain.handlers['get-statistics'][0]();
  });

  // Veritabanını temizle
  ipcMain.handle('clear-db', async () => {
    try {
      await db.clearDatabase();
      console.log('✅ Veritabanı temizlendi');
      return { success: true };
    } catch (error) {
      console.error('❌ Veritabanı temizleme hatası:', error);
      return { success: false, error: error.message };
    }
  });

  // Görselleri getir - DEVRE DIŞI (sadece arama sonuçlarında kullanılacak)
  ipcMain.handle('get-images', async (event, page = 1, pageSize = 100) => {
    console.log('🚫 get-images handler devre dışı - sadece arama sonuçları gösterilecek');
    return {
      success: true,
      images: [],
      total: 0,
      page,
      pageSize
    };
  });

  // Tarama durumu
  ipcMain.handle('get-scan-status', async () => {
    return {
      success: true,
      scanning: false,
      progress: 0
    };
  });

  // Taramayı iptal et
  ipcMain.handle('cancel-scan', async () => {
    return {
      success: true,
      cancelled: true
    };
  });

  // Desteklenen formatlar
  ipcMain.handle('get-supported-formats', async () => {
    return {
      success: true,
      formats: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
    };
  });

  // Dosya açma
  ipcMain.handle('open-file', async (event, filePath) => {
    try {
      const { shell } = require('electron');
      await shell.openPath(filePath);
      return { success: true };
    } catch (error) {
      console.error('❌ Dosya açma hatası:', error);
      return { success: false, error: error.message };
    }
  });

  // Geçici dosya kaydetme
  ipcMain.handle('save-temp-file', async (event, fileInfo) => {
    try {
      const os = require('os');
      const tempDir = os.tmpdir();
      const fileName = fileInfo.name || `temp-${Date.now()}.jpg`;
      const filePath = path.join(tempDir, fileName);
      
      const buffer = Buffer.from(fileInfo.data, 'base64');
      fs.writeFileSync(filePath, buffer);
      
      console.log('💾 Geçici dosya kaydedildi:', filePath);
      
      return {
        success: true,
        path: filePath
      };
    } catch (error) {
      console.error('❌ Geçici dosya kaydetme hatası:', error);
      return { success: false, error: error.message };
    }
  });

  // Tek görsel işleme
  ipcMain.handle('process-single-image', async (event, imagePath, options = {}) => {
    try {
      console.log('🖼️ Tek görsel işleniyor:', imagePath);
      
      const originalPath = options.originalPath || imagePath;
      const imageData = await processor.processImage(imagePath);
      
      if (imageData) {
        // Orijinal yolu kullan
        imageData.filepath = originalPath;
        await db.addImage(imageData);
        
        console.log('✅ Görsel işlendi ve veritabanına eklendi:', originalPath);
        
        return {
          success: true,
          image: imageData
        };
      } else {
        throw new Error('Görsel işlenemedi');
      }
    } catch (error) {
      console.error('❌ Tek görsel işleme hatası:', error);
      return { success: false, error: error.message };
    }
  });





  // Veritabanından benzer görsel arama
  ipcMain.handle('search-similar-from-db', async (event, { imagePath, threshold = 0.8 }) => {
    try {
      console.log('🔍 Veritabanından benzer görsel arama başlatılıyor:', imagePath);
      
      if (!fs.existsSync(imagePath)) {
        console.error(`❌ Dosya bulunamadı: ${imagePath}`);
        return { success: false, error: 'Dosya bulunamadı' };
      }
      
      const processedImage = await processor.processImage(imagePath);
      
      if (!processedImage || !processedImage.phash) {
        console.error('❌ Görsel işlenemedi veya hash oluşturulamadı');
        return { success: false, error: 'Görsel işlenemedi' };
      }
      
      const similarImages = await db.searchSimilarImages(processedImage.phash, threshold);
      
      console.log(`✅ ${similarImages.length} benzer görsel bulundu (threshold: ${threshold})`);
      
      // Thumbnail oluşturmayı sınırla - sadece ilk 10 benzer görsel için
      const maxThumbnails = Math.min(10, similarImages.length);
      const imagesWithThumbnails = [];
      
      for (let i = 0; i < similarImages.length; i++) {
        const img = similarImages[i];
        try {
          if (!fs.existsSync(img.filepath)) {
            console.warn(`⚠️ Dosya bulunamadı: ${img.filepath}`);
            imagesWithThumbnails.push({ ...img, thumbnail: null });
            continue;
          }
          
          // Thumbnail zaten varsa kullan
          if (img.thumbnail) {
            imagesWithThumbnails.push(img);
            continue;
          }
          
          // Sadece ilk 10 görsel için thumbnail oluştur
          if (i < maxThumbnails) {
            console.log(`🖼️ Thumbnail oluşturuluyor (${i + 1}/${maxThumbnails}): ${img.filepath}`);
            const thumbnail = await processor.createThumbnailSmall(img.filepath);
            console.log(`✅ Thumbnail oluşturuldu: ${thumbnail ? 'Başarılı' : 'Başarısız'}`);
            imagesWithThumbnails.push({ ...img, thumbnail });
          } else {
            // Diğer görseller için thumbnail oluşturma
            imagesWithThumbnails.push({ ...img, thumbnail: null });
          }
        } catch (error) {
          console.error(`❌ Thumbnail oluşturma hatası: ${img.filepath}`, error.message);
          imagesWithThumbnails.push({ ...img, thumbnail: null });
        }
      }
      
      return {
        success: true,
        results: imagesWithThumbnails,
        total: imagesWithThumbnails.length
      };
      
    } catch (error) {
      console.error('❌ Görsel arama hatası:', error);
      return { success: false, error: error.message };
    }
  });

  // Metin araması
  ipcMain.handle('search-by-text', async (event, searchTerm) => {
    try {
      console.log('🔍 Metin araması başlatılıyor:', searchTerm);
      
      if (!searchTerm || searchTerm.trim() === '') {
        return { success: true, images: [] };
      }
      
      // Veritabanında dosya adına göre arama yap
      const searchResults = await db.searchByFilename(searchTerm);
      
      console.log(`✅ ${searchResults.length} sonuç bulundu`);
      console.log('🔍 Arama sonuçları:', searchResults.map(r => ({
        filename: r.filename,
        hasThumbnail: !!r.thumbnail,
        thumbnailLength: r.thumbnail ? r.thumbnail.length : 0
      })));
      
      // Thumbnail oluşturmayı sınırla
      const maxThumbnails = Math.min(20, searchResults.length);
      const resultsWithThumbnails = [];
      
      for (let i = 0; i < searchResults.length; i++) {
        const img = searchResults[i];
        try {
          if (!fs.existsSync(img.filepath)) {
            resultsWithThumbnails.push({ ...img, thumbnail: null });
            continue;
          }
          
          // Önce veritabanındaki thumbnail'ı kontrol et
          if (img.thumbnail) {
            console.log(`✅ Veritabanından thumbnail kullanılıyor: ${img.filename}`);
            resultsWithThumbnails.push(img);
            continue;
          }
          
          // Thumbnail yoksa oluştur
          if (i < maxThumbnails) {
            console.log(`🖼️ Thumbnail oluşturuluyor: ${img.filename}`);
            const thumbnail = await processor.createThumbnailSmall(img.filepath, 150);
            resultsWithThumbnails.push({ ...img, thumbnail });
          } else {
            resultsWithThumbnails.push({ ...img, thumbnail: null });
          }
        } catch (error) {
          console.warn(`⚠️ Thumbnail oluşturulamadı: ${img.filename}`, error.message);
          resultsWithThumbnails.push({ ...img, thumbnail: null });
        }
      }
      
      console.log('📊 Final sonuçlar:', resultsWithThumbnails.map(r => ({
        filename: r.filename,
        hasThumbnail: !!r.thumbnail,
        thumbnailLength: r.thumbnail ? r.thumbnail.length : 0
      })));
      
      return {
        success: true,
        images: resultsWithThumbnails,
        total: resultsWithThumbnails.length
      };
      
    } catch (error) {
      console.error('❌ Metin arama hatası:', error);
      return { success: false, error: error.message };
    }
  });

}; 
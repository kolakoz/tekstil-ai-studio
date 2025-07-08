const { ipcMain, dialog, shell } = require('electron');
const configStore = require('./config-store');
const fileScanner = require('./file-scanner');
const driveScanner = require('./drive-scanner');
const imageProcessor = require('./image-processor');
const internetSearcher = require('./internet-searcher');
const database = require('./database');

module.exports = (mainWindow) => {
  ipcMain.handle('ping', async () => {
    console.log('Renderer\'dan ping alındı, pong gönderiliyor.');
    return 'pong';
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
    const drives = await driveScanner.listDrives();
    return { success: true, drives };
  });

  ipcMain.handle('scan-drives', async (event, drives) => {
    console.log('scan-drives isteği alındı:', drives);
    const result = await driveScanner.scanDrives(drives, (progressData) => {
        mainWindow.webContents.send('drive-scan-progress', progressData);
    });
    mainWindow.webContents.send('drive-scan-complete', result);
    return result;
  });

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
            await database.insertImage(imageData);
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

  ipcMain.handle('search-similar', async (event, imagePath, threshold = 0.6, weights = {}) => {
    console.log('=== ARAMA DEBUG BAŞLADI ===');
    console.log('Aranan görsel:', imagePath);
    console.log('Threshold:', threshold);
    console.log('Weights:', weights);

    try {
      // Target embedding, HOG, ve Color Hist hesapla
      console.log('Target özellikler hesaplanıyor...');
      const processedImageData = await imageProcessor.processImage(imagePath); // Tüm özellikleri tek seferde al
      
      if (!processedImageData || !processedImageData.embedding) {
        console.warn('Target görsel işlenemedi veya embedding oluşturulamadı, arama iptal edildi.');
        return [];
      }

      const targetEmbedding = processedImageData.embedding;
      const targetHogVector = processedImageData.hogVector;
      const targetColorHist = processedImageData.colorHist;

      console.log('Target embedding boyutu:', targetEmbedding ? targetEmbedding.length : 'null');
      console.log('Target HOG boyutu:', targetHogVector ? targetHogVector.length : 'null');
      console.log('Target ColorHist boyutu:', targetColorHist ? targetColorHist.length : 'null');

      // Veritabanında ara
      console.log('Veritabanında aranıyor...');
      const results = await database.searchSimilarImagesML(targetEmbedding, targetHogVector, targetColorHist, threshold, weights);
      console.log('Bulunan sonuç sayısı:', results.length);

      if (results.length > 0) {
        console.log('İlk 3 sonuç:');
        results.slice(0, 3).forEach((r, i) => {
          console.log(`${i + 1}. ${r.filename} - Benzerlik: ${r.similarity}`);
        });
      }

      console.log('=== ARAMA DEBUG BİTTİ ===');
      return { success: true, results: results };
    } catch (error) {
      console.error('Arama hatası:', error);
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
    return imageProcessor.getImageBase64(filepath);
  });

  ipcMain.handle('get-image-counts', async () => {
    console.log('get-image-counts isteği alındı.');
    const totalCount = await database.getImageCount();
    const embeddingCount = (await database.getAllImagesWithEmbedding()).length;
    return { totalCount, embeddingCount };
  });

  ipcMain.handle('clear-database', async () => {
    console.log('clear-database isteği alındı.');
    await database.clearDatabase();
    return { success: true };
  });

  // IPC Renderer olayları (preload.js'de ipcRenderer.on ile dinlenenler)
  // Bu olaylar, ana süreçteki mantık tarafından tetiklenecek.
}; 
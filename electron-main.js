/*
 * Electron Ana Süreç Dosyası
 * - Uygulama penceresini oluşturur
 * - IPC kanalları ile backend fonksiyonları tetikler
 * - Güvenlik için contextIsolation + preload.js kullanır
 */

/* eslint-disable import/no-extraneous-dependencies */
// ACİL DÜZELTME 2: Electron Main Konfigürasyonu (CommonJS)
// ----------------------------------------------------------------
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const database = require('./electron/database');
const imageProcessor = require('./electron/image-processor');
const driveScanner = require('./electron/drive-scanner');
const internetSearcher = require('./electron/internet-searcher');
const settingsStore = require('./electron/config-store');
const vectorIndex = require('./electron/vector-index');

// Development mode kontrolü
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

let mainWindow;

function createWindow() {
  console.log('Creating window...');
  console.log('isDev:', isDev);
  console.log('NODE_ENV:', process.env.NODE_ENV);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });

  if (isDev) {
    console.log('Loading development URL: http://localhost:3001');
    mainWindow.loadURL('http://localhost:3001');
    mainWindow.webContents.openDevTools();
  } else {
    console.log('Loading production file');
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('DOM ready!');
  });
}

// IPC HANDLER'LAR
ipcMain.handle('ping', async () => {
  console.log('Ping received from renderer!');
  return 'pong';
});

ipcMain.handle('workspace-select', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Görsel Klasörünü Seçin',
    buttonLabel: 'Klasörü Seç',
  });
  if (!result.canceled) return result.filePaths[0];
  return null;
});

// Çalışma alanı tarama
ipcMain.handle('scan-workspace', async (event, workspacePath) => {
  console.log('Starting workspace scan:', workspacePath);

  try {
    // Veritabanını başlat (oluşturulmamışsa)
    await database.initDatabase();

    let totalProcessed = 0;

    // Klasörü tara
    const images = await imageProcessor.scanDirectory(workspacePath, (progress) => {
      event.sender.send('scan-progress', {
        current: progress.current,
        currentFile: progress.currentFile,
        status: 'processing',
      });
    });

    // Sonuçları DB'ye yaz
    for (const imageData of images) {
      await database.insertImage(imageData);
      totalProcessed += 1;

      event.sender.send('scan-progress', {
        current: totalProcessed,
        total: images.length,
        currentFile: imageData.filename,
        status: 'saving',
      });
    }

    // Tamamlandı – indeks oluştur/yenile
    try {
      const imgs = await database.getAllImages();
      await vectorIndex.createIndex(imgs);
    } catch (e) { console.warn('Index build error:', e.message); }

    event.sender.send('scan-complete', {
      success: true,
      totalImages: images.length,
    });

    return {
      success: true,
      totalFiles: images.length,
      message: `${images.length} görsel başarıyla işlendi`,
    };
  } catch (error) {
    console.error('Scan error:', error);
    return { success: false, error: error.message };
  }
});

// Benzer görsel arama
ipcMain.handle('search-similar', async (_event, imagePath, threshold = 0.6, weights = null) => {
  console.log('Searching similar images for:', imagePath);

  try {
    // Hedef görseli işle
    const targetImage = await imageProcessor.processImage(imagePath);

    const aspect = targetImage.width && targetImage.height ? targetImage.width / targetImage.height : 1;

    let similarImages = [];

    if (targetImage.embedding && vectorIndex.isReady()) {
      try {
        const res = vectorIndex.searchIndex(targetImage.embedding, 50);
        if (res && res.neighbors && res.neighbors.length) {
          const rows = await database.getImagesByIds(res.neighbors);
          // eşleşme sıralama ve skor hesaplama
          similarImages = rows.map((row, idx) => ({ ...row, similarity: Math.round((1 - res.distances[idx]) * 100) }));
        }
      } catch (err) {
        console.warn('Vector index search failed, fallback hash:', err.message);
      }
    }

    // Fallback veya ek sonuç için hash tabanlı arama
    if (similarImages.length <= 1) {
      similarImages = await database.searchSimilarImages(
        targetImage.phash,
        targetImage.dhash,
        targetImage.blockhash,
        targetImage.colorHist,
        targetImage.hogVector,
        aspect,
        Number(threshold),
        50,
        weights,
      );
    }

    // Eğer yalnızca 1 sonuç (sadece kendisi) geldiyse, bulunduğu klasörü hızlıca tarayıp DB'yi güncelle
    if (similarImages.length <= 1) {
      try {
        const dirPath = path.dirname(imagePath);
        const newlyProcessed = await imageProcessor.scanDirectory(dirPath);
        for (const imgData of newlyProcessed) {
          await database.insertImage(imgData);
        }
        // yeniden ara
        similarImages = await database.searchSimilarImages(
          targetImage.phash,
          targetImage.dhash,
          targetImage.blockhash,
          targetImage.colorHist,
          targetImage.hogVector,
          aspect,
          Number(threshold),
          50,
          weights,
        );
      } catch (scanErr) {
        console.error('Auto-folder-scan error:', scanErr);
      }
    }

    // Yalnızca mevcut dosyalar + sorgu dosyasını hariç tut
    const fsSync = require('fs');
    const filtered = similarImages.filter((img) => fsSync.existsSync(img.filepath) && img.filepath !== imagePath);

    return {
      success: true,
      results: filtered,
    };
  } catch (error) {
    console.error('Search error:', error);
    return { success: false, error: error.message, results: [] };
  }
});

// Yüklenen görseli işleme (isteğe bağlı önizleme vb.)
ipcMain.handle('process-uploaded-image', async (_event, imagePath) => {
  try {
    const imageData = await imageProcessor.processImage(imagePath);
    return { success: true, data: imageData };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Veritabanı istatistikleri
ipcMain.handle('get-db-stats', async () => {
  try {
    const count = await database.getImageCount();
    return { success: true, count };
  } catch (error) {
    return { success: false, count: 0 };
  }
});

ipcMain.handle('open-in-explorer', async (_event, filepath) => {
  shell.showItemInFolder(filepath);
  return { success: true };
});

// Base64 görsel döndürme handler'ı
ipcMain.handle('get-image-base64', async (_event, imagePath) => {
  try {
    const buffer = await fs.readFile(imagePath);
    const ext = path.extname(imagePath).toLowerCase().slice(1);
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    const base64 = buffer.toString('base64');
    return { success: true, dataUrl: `data:image/${mime};base64,${base64}` };
  } catch (error) {
    console.error('Image read error:', error);
    return { success: false, error: error.message };
  }
});

// Sürücü listesi
ipcMain.handle('list-drives', async () => {
  try {
    const drives = await driveScanner.listDrives();
    return { success: true, drives };
  } catch (error) {
    console.error('List drives error:', error);
    return { success: false, error: error.message, drives: [] };
  }
});

// Seçili sürücüleri tarama
ipcMain.handle('scan-drives', async (event, drives) => {
  if (!Array.isArray(drives) || drives.length === 0) {
    return { success: false, error: 'Sürücü listesi boş' };
  }

  try {
    // Veritabanını hazırla
    await database.initDatabase();

    let processedTotal = 0;

    // Tarama
    const results = await driveScanner.scanDrives(drives, (progress) => {
      event.sender.send('drive-scan-progress', progress);
    });

    // Sonuçları DB'ye yaz
    for (const imageData of results) {
      await database.insertImage(imageData);
      processedTotal += 1;
    }

    // indeks güncelle
    try {
      const imgs = await database.getAllImages();
      await vectorIndex.createIndex(imgs);
    } catch (e) { console.warn('Index rebuild error:', e.message); }

    event.sender.send('drive-scan-complete', { success: true, total: processedTotal });

    return { success: true, total: processedTotal };
  } catch (error) {
    console.error('Scan drives error:', error);
    return { success: false, error: error.message };
  }
});

// İnternetten benzer görsel arama
ipcMain.handle('search-internet', async (_event, imagePath) => {
  try {
    const results = await internetSearcher.searchImageOnline(imagePath);
    return { success: true, results };
  } catch (err) {
    console.error('Internet search error:', err);
    return { success: false, error: err.message, results: [] };
  }
});

// --------------------------------------------------------------------------
// CONFIG / SETTINGS IPC HANDLER'LARI
// --------------------------------------------------------------------------
ipcMain.handle('get-config', () => {
  return settingsStore.store;
});

ipcMain.handle('set-config', (_event, updates) => {
  try {
    if (updates && typeof updates === 'object') {
      settingsStore.set(updates);
    }
    return { success: true };
  } catch (err) {
    console.error('set-config error:', err);
    return { success: false, error: err.message };
  }
});

// Senkron API key kontrolü (renderer'dan bloklayan çağrı)
ipcMain.on('has-api-key-sync', (event) => {
  event.returnValue = !!settingsStore.get('bingApiKey');
});

app.whenReady().then(() => {
  // Development modunda CSP'yi gevşet
  if (isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src * 'unsafe-inline' 'unsafe-eval' data: blob: file: local-file: filesystem:; img-src * data: blob: file: local-file:;"]
        },
      });
    });
  }

  // HNSW vektör indeksi yükle
  try { vectorIndex.loadIndex(); } catch (e) { console.warn('Index load failed:', e.message); }

  // Yerel dosyalar için özel protocol
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const url = request.url.replace('local-file://', '');
    try {
      const decodedUrl = decodeURIComponent(url);
      callback({ path: decodedUrl });
    } catch (error) {
      console.error('Protocol error:', error);
      callback({ error: -2 });
    }
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
}); 
const { app, BrowserWindow, protocol, ipcMain, session } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;
const net = require('electron').net;
const simpleIpc = require('./simple-ipc');
const ipcHandlers = require('./ipc-handlers');

// Monitoring modülünü yükle
const TekstilMonitoring = require('./monitoring/index');
const monitoringConfig = require('./monitoring-config');

// Worker Pool modülünü yükle
const WorkerPool = require('./workers/worker-pool');

// Global instances
let monitoring = null;
let workerPool = null;

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      // Dosya erişimi için ek ayarlar
      enableRemoteModule: true,
      experimentalFeatures: true,
    },
    // Cache hatalarını önlemek için
    webSecurity: false,
    allowRunningInsecureContent: true,
  });

  // Dosya erişimi için ek güvenlik ayarları
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true); // Tüm izinleri ver
  });

  // Komut satırı argümanlarını kontrol et
  const appUrl = app.commandLine.getSwitchValue('url') || 'http://localhost:3002';
  
  // Development mode kontrolü
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // Geliştirme modunda React dev server'ı kullan
    console.log('🌐 React dev server URL:', appUrl);
    mainWindow.loadURL(appUrl);
    // Sadece development'ta DevTools aç
    mainWindow.webContents.openDevTools();
  } else {
    // Production modda build edilmiş dosyayı yükle
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    // Production'da DevTools'u kapat
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
  }

  // DevTools kısayolunu devre dışı bırak (production'da)
  if (!isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || 
          (input.control && input.shift && input.key === 'I') ||
          (input.meta && input.alt && input.key === 'I')) {
        event.preventDefault();
      }
    });
  }
  
  // Sayfa yükleme hatalarını yakala
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('❌ Sayfa yükleme hatası:', errorCode, errorDescription, validatedURL);
  });
  
  // Sayfa yüklendiğinde
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Sayfa başarıyla yüklendi');
  });

  // Simple IPC handler'larını yükle
  simpleIpc(mainWindow);
  
  // Gelişmiş IPC handler'larını yükle
  ipcHandlers(mainWindow);
}

app.whenReady().then(async () => {
  // Monitoring'i başlat
  try {
    monitoring = new TekstilMonitoring(monitoringConfig);
    await monitoring.start();
    console.log('✅ Monitoring başarıyla başlatıldı');

    // Monitoring event'lerini dinle
    monitoring.on('alert', (alert) => {
      console.log('🚨 Monitoring Alert:', alert.message);
    });

    monitoring.on('system-metrics', (metrics) => {
      console.log('📊 Sistem metrikleri:', {
        memory: `${metrics.memory.usage.toFixed(2)}%`,
        cpu: `${metrics.cpu.usage.toFixed(2)}%`
      });
    });

  } catch (error) {
    console.error('❌ Monitoring başlatma hatası:', error);
  }

  // Worker Pool'u başlat
  try {
    workerPool = new WorkerPool({
      minWorkers: 2,
      maxWorkers: 6,
      workerScript: path.join(__dirname, 'workers', 'image-worker.js')
    });
    
    global.workerPool = workerPool;
    console.log('✅ Worker Pool başarıyla başlatıldı');

    // Worker Pool event'lerini dinle
    workerPool.on('taskCompleted', (result) => {
      console.log('✅ Worker görevi tamamlandı:', result.taskType);
    });

    workerPool.on('workerError', (error) => {
      console.error('❌ Worker hatası:', error);
    });

  } catch (error) {
    console.error('❌ Worker Pool başlatma hatası:', error);
  }

  // CSP header'larını devre dışı bırak
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    delete responseHeaders['content-security-policy'];
    callback({ responseHeaders });
  });

  // Güvenlik uyarılarını sustur (sadece dev modunda)
  if (isDev) {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
  }

  // local-file:// protokolünü kaydet
  protocol.handle('local-file', (request) => {
    const filePath = path.normalize(decodeURIComponent(request.url.replace(/^local-file:\/\//, '')));
    return net.fetch(new URL('file://' + filePath));
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  // Monitoring'i durdur
  if (monitoring) {
    try {
      await monitoring.stop();
      console.log('✅ Monitoring durduruldu');
    } catch (error) {
      console.error('❌ Monitoring durdurma hatası:', error);
    }
  }

  // Worker Pool'u durdur
  if (workerPool) {
    try {
      await workerPool.shutdown();
      console.log('✅ Worker Pool durduruldu');
    } catch (error) {
      console.error('❌ Worker Pool durdurma hatası:', error);
    }
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Global monitoring instance'ını export et
global.monitoring = monitoring; 

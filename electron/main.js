const { app, BrowserWindow, protocol, ipcMain, session } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const setupIpcHandlers = require('./ipc-handlers');
const net = require('electron').net;

function createWindow() {
  const preloadPath = path.join(app.getAppPath(), 'electron', 'preload.js');
  console.log('Preload Script Path:', preloadPath);

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      contentSecurityPolicy: `
        default-src * data: blob: filesystem: file: local-file: 'unsafe-inline' 'unsafe-eval';
        img-src * data: blob: filesystem: file: local-file:;
        script-src 'self' ${isDev ? "'unsafe-inline' 'unsafe-eval'" : ''};
        style-src 'self' 'unsafe-inline';
        connect-src 'self' http://localhost:3001 ws://localhost:3001;
      `,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3001');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  setupIpcHandlers(mainWindow);
}

app.whenReady().then(() => {
  // session.defaultSession.webRequest.onHeadersReceived kullanarak CSP header'ını güncelle
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...
        details.responseHeaders,
        'Content-Security-Policy': [
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob: filesystem: about: ws: wss: 'self' http: https: file: local-file:;",
          "img-src * data: blob: 'unsafe-inline' file: local-file: filesystem:;",
          "connect-src * 'unsafe-inline';",
          "script-src * 'unsafe-inline' 'unsafe-eval';",
          "style-src * 'unsafe-inline';"
        ].join(' ')
      }
    })
  });

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Gerekirse özel protokoller veya diğer Electron API'leri burada tanımlanabilir. 
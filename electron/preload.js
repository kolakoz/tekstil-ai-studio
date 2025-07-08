const { ipcRenderer } = require('electron');

window.electronAPI = {
  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    receive: (channel, func) => {
      const subscription = (event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    },
    // Diğer ihtiyaç duyulan Electron API'leri buraya eklenebilir
  },
  // Yeni eklenenler:
  ping: () => ipcRenderer.invoke('ping'),
  onScanProgress: (callback) => ipcRenderer.on('scan-progress', (event, data) => callback(data)),
  onScanComplete: (callback) => ipcRenderer.on('scan-complete', (event, data) => callback(data)),
  onDriveScanProgress: (callback) => ipcRenderer.on('drive-scan-progress', (event, data) => callback(data)),
  onDriveScanComplete: (callback) => ipcRenderer.on('drive-scan-complete', (event, data) => callback(data)),
  getConfig: () => ipcRenderer.invoke('get-config'),
  scanDrives: (drives) => ipcRenderer.invoke('scan-drives', drives),
  selectWorkspace: () => ipcRenderer.invoke('select-workspace'),
  scanWorkspace: (path) => ipcRenderer.invoke('scan-workspace', path),
  searchSimilar: (imagePath, threshold, weights) => ipcRenderer.invoke('search-similar', imagePath, threshold, weights),
  searchInternet: (imagePath) => ipcRenderer.invoke('search-internet', imagePath),
  openInExplorer: (filepath) => ipcRenderer.invoke('open-in-explorer', filepath),
  listDrives: () => ipcRenderer.invoke('list-drives'),
  getImageBase64: (filepath) => ipcRenderer.invoke('get-image-base64', filepath),
  setConfig: (config) => ipcRenderer.invoke('set-config', config),
  getImageCounts: () => ipcRenderer.invoke('get-image-counts'),
  clearDatabase: () => ipcRenderer.invoke('clear-database'),
  // Diğer ihtiyaç duyulan API'ler buraya eklenebilir
}; 
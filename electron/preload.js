const { ipcRenderer } = require('electron');

window.electronAPI = {
  // Temel IPC işlemleri
  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    receive: (channel, func) => {
      const subscription = (event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    },
  },

  // Basit API'ler
  ping: () => ipcRenderer.invoke('ping'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config) => ipcRenderer.invoke('set-config', config),
  
  // Eksik IPC handler'ları ekle
  onPing: () => ipcRenderer.invoke('ping'),

  // Disk işlemleri
  listDrives: () => ipcRenderer.invoke('list-drives'),
  getDisks: () => ipcRenderer.invoke('get-disks'),
  checkScanStatus: () => ipcRenderer.invoke('check-scan-status'),
  
  // Klasör tarama
  scanFolder: () => ipcRenderer.invoke('scanFolder'),
  
  // Çoklu disk tarama
  scanMultipleDisks: (selectedDisks) => ipcRenderer.invoke('scanMultipleDisks', selectedDisks),
  
  // Akıllı disk tarama (yeni)
  scanDrives: (params) => ipcRenderer.invoke('scan-drives', params),
  
  // Tarama geçmişi (yeni)
  getScanHistory: () => ipcRenderer.invoke('get-scan-history'),
  
  // Tarama istatistikleri (yeni)
  getScanStatistics: () => ipcRenderer.invoke('get-scan-statistics'),
  
  // Veritabanından benzer görsel arama (yeni)
  searchSimilarFromDb: (params) => ipcRenderer.invoke('search-similar-from-db', params),
  
  // Gelişmiş görsel arama (yeni)
  searchSimilarImages: (params) => ipcRenderer.invoke('searchSimilarImages', params),
  
  // Görsel arama
  searchSimilar: (imagePath, similarityThreshold = 0.3) => ipcRenderer.invoke('search-similar', imagePath, similarityThreshold),
  findSimilar: (imagePath) => ipcRenderer.invoke('find-similar', imagePath),
  
  // Veritabanı işlemleri
  getStats: () => ipcRenderer.invoke('get-stats'),
  clearDb: () => ipcRenderer.invoke('clear-db'),
      getImages: (page, limit) => ipcRenderer.invoke('get-images', page, limit),
  getStatistics: () => ipcRenderer.invoke('get-statistics'),
  searchByText: (searchTerm) => ipcRenderer.invoke('search-by-text', searchTerm),
  searchByColors: (searchParams) => ipcRenderer.invoke('search-by-colors', searchParams),
  
  // Dosya işlemleri
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  getSupportedFormats: () => ipcRenderer.invoke('get-supported-formats'),
  saveTempFile: (fileInfo) => ipcRenderer.invoke('save-temp-file', fileInfo),
  processSingleImage: (imagePath, options) => ipcRenderer.invoke('process-single-image', imagePath, options),
  
  // Event listeners
  onScanProgress: (callback) => ipcRenderer.on('scan-progress', (event, data) => callback(data)),
  onProcessProgress: (callback) => ipcRenderer.on('process-progress', (event, data) => callback(data)),
  onImageAdded: (callback) => ipcRenderer.on('image-added', (event, data) => callback(data)),
  
  // Event removers
  removeScanProgress: (callback) => ipcRenderer.removeListener('scan-progress', callback),
  removeProcessProgress: (callback) => ipcRenderer.removeListener('process-progress', callback),
  removeImageAdded: (callback) => ipcRenderer.removeListener('image-added', callback),
  
  // Monitoring API'leri
  getMonitoringStats: () => ipcRenderer.invoke('get-monitoring-stats'),
  getMonitoringHealth: () => ipcRenderer.invoke('get-monitoring-health'),
  trackEvent: (eventName, data) => ipcRenderer.invoke('track-event', eventName, data),
  incrementMetric: (name, value, tags) => ipcRenderer.invoke('increment-metric', name, value, tags),
  gaugeMetric: (name, value, tags) => ipcRenderer.invoke('gauge-metric', name, value, tags),
  timingMetric: (name, value, tags) => ipcRenderer.invoke('timing-metric', name, value, tags),
  
  // Export API'leri
  exportMonitoringData: (format) => ipcRenderer.invoke('export-monitoring-data', format),
  getExportFormats: () => ipcRenderer.invoke('get-export-formats'),
  exportCustomData: (data, format, filename) => ipcRenderer.invoke('export-custom-data', data, format, filename),
  
  // Proje Yapısı API'leri
  saveProjectStructure: (structure) => ipcRenderer.invoke('save-project-structure', structure),
  updateProjectStructure: (structure) => ipcRenderer.invoke('update-project-structure', structure),
  testProjectStructure: (structure) => ipcRenderer.invoke('test-project-structure', structure),
  loadProjectStructure: () => ipcRenderer.invoke('load-project-structure'),
}; 

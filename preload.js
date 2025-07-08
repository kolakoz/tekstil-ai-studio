/*
 * Preload – Renderer <-> Main arasındaki güvenli köprü
 */

/* eslint-disable import/no-extraneous-dependencies */
// ACİL DÜZELTME 1: Preload Script (CommonJS)
// -------------------------------------------------------------
// ESM import kullanımı preload içinde sorun çıkardığı için
// require() tabanlı sürüme geçiyoruz.

const { contextBridge, ipcRenderer } = require('electron');

// @ts-nocheck

// Renderer tarafında kullanılacak güvenli API
contextBridge.exposeInMainWorld('electronAPI', {
  // Basit test fonksiyonu
  ping: () => ipcRenderer.invoke('ping'),

  // Workspace fonksiyonları
  selectWorkspace: () => ipcRenderer.invoke('workspace-select'),
  scanWorkspace: (workspacePath) => ipcRenderer.invoke('scan-workspace', workspacePath),
  searchSimilar: (imagePath, threshold, weights) => ipcRenderer.invoke('search-similar', imagePath, threshold, weights),
  getDbStats: () => ipcRenderer.invoke('get-db-stats'),
  processUploadedImage: (imagePath) => ipcRenderer.invoke('process-uploaded-image', imagePath),
  getImageBase64: (imagePath) => ipcRenderer.invoke('get-image-base64', imagePath),
  openInExplorer: (filePath) => ipcRenderer.invoke('open-in-explorer', filePath),
  listDrives: () => ipcRenderer.invoke('list-drives'),
  scanDrives: (drives) => ipcRenderer.invoke('scan-drives', drives),
  searchInternet: (imagePath) => ipcRenderer.invoke('search-internet', imagePath),

  // Event listeners
  onScanProgress: (callback) => {
    ipcRenderer.on('scan-progress', (event, data) => callback(data));
  },
  onScanComplete: (callback) => {
    ipcRenderer.on('scan-complete', (_event, data) => callback(data));
  },
  onDriveScanProgress: (callback) => {
    ipcRenderer.on('drive-scan-progress', (_event, data) => callback(data));
  },
  onDriveScanComplete: (callback) => {
    ipcRenderer.on('drive-scan-complete', (_event, data) => callback(data));
  },
  // Settings
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (updates) => ipcRenderer.invoke('set-config', updates),

  // Hızlı API key kontrolü (senkron)
  hasApiKey: () => ipcRenderer.sendSync('has-api-key-sync'),
});

console.log('Preload script loaded successfully!');

/*
 * file-scanner.js – Klasör tarama ve görsel dosyalarını listeleme
 * Desteklenen formatlar: jpg, jpeg, png, gif, bmp, webp
 */

const fs = require('fs/promises');
const path = require('path');

// Tarama sırasında atlanacak yaygın sistem klasörleri (küçük harf karşılaştırma)
const EXCLUDED_DIR_NAMES = [
  'windows',
  'program files',
  'program files (x86)',
  '$recycle.bin',
  'appdata',
  'programdata',
  'system volume information',
  'system32',
  'temp',
  'tmp',
  'config',
  'drivers',
  'logfiles',
  'nvidia',
  'amd',
  'intel',
  'msdtc',
  'networklist',
  'sru',
  'tasks',
  'wdi',
  'sleepstudy',
  'spool',
  'printers',
  'driverdata',
  'configuration',
  'com',
  'dmp',
  'appmgmt',
  's-1-5-18',
  'machine',
  'syswow64',
  'users\default',
  'perflogs',
  '$windows.~bt',
  '$windows.~ws',
  '$archivedata',
  '$temp',
  '$onedrive temp',
  '$git',
  '$svn',
  '$cache',
  '$node_modules',
  '$venv',
  '$env',
  'lib',
  'tcl',
  '.git',
  'node_modules',
  'vendor',
  '__pycache__',
  'build',
  'dist',
  '.vscode',
  'debug',
  'release',
  'logs',
];

// Desteklenen görsel uzantıları
exports.supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ps'];

/**
 * Dosya uzantısının desteklenip desteklenmediğini kontrol eder.
 */
function isSupported(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return exports.supportedFormats.includes(ext);
}

/**
 * Sadece desteklenen görselleri filtreler.
 * @param {string[]} files Tam dosya yolları
 * @returns {string[]}
 */
exports.filterImageFiles = (files) => {
  return files.filter(isSupported);
};

/**
 * Dosya istatistiklerini (boyut, oluşturma zamanı, vb.) döndürür.
 * @param {string} filePath
 * @returns {Promise<{size:number, birthtime:Date, mtime:Date}>}
 */
exports.getFileStats = async (filePath) => {
  const stats = await fs.stat(filePath);
  return {
    filesize: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
  };
};

/**
 * Recursive olarak bir dizini tarar ve desteklenen görselleri bulur.
 * @param {string} dirPath Tarama başlangıç dizini
 * @param {(data:{current:number,total:number,file?:string})=>void} onProgress İlerleme callback (isteğe bağlı)
 * @returns {Promise<string[]>} Bulunan dosya yolları
 */
exports.scanDirectory = async (dirPath, onProgress = () => {}) => {
  const discovered = [];
  const stack = [dirPath];
  let processed = 0;

  while (stack.length) {
    const currentDir = stack.pop();
    
    // Klasörü atlama kontrolü
    const lowerCurrentDir = currentDir.toLowerCase();
    const isExcluded = EXCLUDED_DIR_NAMES.some((excludedName) => {
        // Hem klasör adını hem de tam yolu kontrol et
        return path.basename(currentDir).toLowerCase() === excludedName || lowerCurrentDir.includes(excludedName + path.sep);
    });

    if (isExcluded) {
        if (onProgress) onProgress({ current: processed, currentFile: currentDir, status: 'skipped-excluded-name' });
        console.log(`Klasör atlandı (hariç tutuldu - ${currentDir})`);
        continue; 
    }

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile() && isSupported(fullPath)) {
          discovered.push(fullPath);
        }
      }
    } catch (err) {
      if (onProgress) {
        onProgress({ current: processed, currentFile: currentDir, status: 'skipped-permission-denied', error: err.message });
      }
      console.warn(`Klasör atlandı (izin hatası - ${currentDir}):`, err.message);
    }
  }

  const total = discovered.length;
  for (const file of discovered) {
    processed += 1;
    onProgress({ current: processed, total, file });
  }

  return discovered;
};

/**
 * Basit bir ilerleme yayıcı (IPC kullanımı dışı)
 */
exports.emitProgress = (sender, channel, data) => {
  if (sender && typeof sender.send === 'function') {
    sender.send(channel, data);
  }
};

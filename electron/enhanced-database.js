const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { app } = require('electron');

class EnhancedDatabase {
  constructor() {
    let dbPath;
    if (app && app.getPath) {
      dbPath = path.join(app.getPath('userData'), 'tekstil-ai-enhanced.db');
    } else {
      // Test ortamı için fallback
      dbPath = path.join(process.env.APPDATA || process.env.HOME, 'Tekstil AI Studio (Offline Edition)', 'tekstil-ai-enhanced.db');
    }
    this.db = new sqlite3.Database(dbPath);
    
    this.initDatabase();
  }

  initDatabase() {
    // Basit tablo oluştur
    const schema = `
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT UNIQUE,
        file_name TEXT,
        file_size INTEGER,
        file_hash TEXT,
        created_at_file TEXT,
        modified_at_file TEXT,
        width INTEGER,
        height INTEGER,
        format TEXT,
        perceptual_hash TEXT,
        color_hash TEXT,
        edge_hash TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS scan_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        disk_letter TEXT,
        scan_type TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        total_scanned INTEGER DEFAULT 0,
        new_files INTEGER DEFAULT 0,
        updated_files INTEGER DEFAULT 0,
        deleted_files INTEGER DEFAULT 0,
        errors INTEGER DEFAULT 0,
        status TEXT DEFAULT 'running'
      );
    `;
    
    this.db.exec(schema, (err) => {
      if (err) {
        console.error('Database schema error:', err);
      } else {
        console.log('✅ Enhanced database başlatıldı');
      }
    });
  }

  // Dosya hash'i hesapla
  async calculateFileHash(filePath) {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  // Görsel ekle veya güncelle
  async upsertImage(imageData) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM images WHERE file_path = ?', [imageData.file_path], (err, existing) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (existing) {
          // Güncelle
          const sql = `
            UPDATE images SET
              file_size = ?, file_hash = ?, modified_at_file = ?,
              width = ?, height = ?, format = ?,
              perceptual_hash = ?, color_hash = ?, edge_hash = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE file_path = ?
          `;
          
          this.db.run(sql, [
            imageData.file_size, imageData.file_hash, imageData.modified_at_file,
            imageData.width, imageData.height, imageData.format,
            imageData.perceptual_hash, imageData.color_hash, imageData.edge_hash,
            imageData.file_path
          ], (err) => {
            if (err) reject(err);
            else resolve({ updated: true });
          });
        } else {
          // Yeni ekle
          const sql = `
            INSERT INTO images (
              file_path, file_name, file_size, file_hash,
              created_at_file, modified_at_file,
              width, height, format,
              perceptual_hash, color_hash, edge_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          
          this.db.run(sql, [
            imageData.file_path, imageData.file_name, imageData.file_size, imageData.file_hash,
            imageData.created_at_file, imageData.modified_at_file,
            imageData.width, imageData.height, imageData.format,
            imageData.perceptual_hash, imageData.color_hash, imageData.edge_hash
          ], (err) => {
            if (err) reject(err);
            else resolve({ inserted: true });
          });
        }
      });
    });
  }

  // Tarama oturumu başlat
  startScanSession(diskLetter, scanType = 'full') {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO scan_history (disk_letter, scan_type) VALUES (?, ?)',
        [diskLetter, scanType],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  // Tarama oturumunu güncelle
  updateScanSession(sessionId, stats) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE scan_history SET
          completed_at = CURRENT_TIMESTAMP,
          total_scanned = ?, new_files = ?, updated_files = ?, 
          deleted_files = ?, errors = ?, status = ?
        WHERE id = ?`,
        [stats.totalScanned, stats.newFiles, stats.updatedFiles, 
         stats.deletedFiles, stats.errors, 'completed', sessionId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // İstatistikleri getir
  getStatistics() {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT 
          COUNT(*) as total_images,
          COUNT(CASE WHEN perceptual_hash IS NOT NULL THEN 1 END) as with_hash,
          COUNT(CASE WHEN perceptual_hash IS NULL THEN 1 END) as without_hash
        FROM images WHERE status = 'active'
      `, (err, result) => {
        if (err) reject(err);
        else resolve(result || { total_images: 0, with_hash: 0, without_hash: 0 });
      });
    });
  }

  // Benzer görselleri bul
  findSimilarImages(targetHashes, threshold = 0.8) {
    return new Promise((resolve, reject) => {
      // Basit hash karşılaştırması
      this.db.all(`
        SELECT * FROM images 
        WHERE status = 'active' 
        AND (perceptual_hash = ? OR color_hash = ? OR edge_hash = ?)
        ORDER BY file_path
      `, [targetHashes.perceptual_hash, targetHashes.color_hash, targetHashes.edge_hash], (err, results) => {
        if (err) reject(err);
        else resolve(results || []);
      });
    });
  }
}

module.exports = new EnhancedDatabase(); 
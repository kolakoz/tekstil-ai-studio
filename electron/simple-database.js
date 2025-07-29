const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

class SimpleImageDB {
  constructor() {
    // Electron app context'i kontrol et
    let dbPath;
    if (app && app.getPath) {
      dbPath = path.join(app.getPath('userData'), 'images.db');
    } else {
      // Test ortamı için fallback
      dbPath = path.join(__dirname, 'images.db');
    }
    
    this.db = new sqlite3.Database(dbPath);
    this.initTables();
    console.log('✅ Basit database başlatıldı:', dbPath);
  }

  initTables() {
    // Tek ve basit tablo
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filepath TEXT UNIQUE NOT NULL,
        filename TEXT NOT NULL,
        filesize INTEGER,
        width INTEGER,
        height INTEGER,
        phash TEXT,
        dhash TEXT,
        avg_color TEXT,
        thumbnail TEXT,
        last_scan INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_phash ON images(phash);
      CREATE INDEX IF NOT EXISTS idx_dhash ON images(dhash);
      CREATE INDEX IF NOT EXISTS idx_filename ON images(filename);
    `;
    
    this.db.exec(createTableSQL, (err) => {
      if (err) {
        console.error('❌ Tablo oluşturma hatası:', err);
      } else {
        console.log('✅ Tablolar oluşturuldu');
        // last_scan sütununu ekle (eğer yoksa)
        this.addLastScanColumn();
      }
    });
  }

  addLastScanColumn() {
    // last_scan sütununun var olup olmadığını kontrol et
    this.db.get("PRAGMA table_info(images)", (err, rows) => {
      if (err) {
        console.error('❌ Tablo bilgisi alınamadı:', err);
        return;
      }
      
      // Sütun listesini al
      this.db.all("PRAGMA table_info(images)", (err, columns) => {
        if (err) {
          console.error('❌ Sütun bilgisi alınamadı:', err);
          return;
        }
        
        // last_scan sütununun var olup olmadığını kontrol et
        const hasLastScan = columns.some(col => col.name === 'last_scan');
        
        if (!hasLastScan) {
          console.log('📝 last_scan sütunu ekleniyor...');
          this.db.run("ALTER TABLE images ADD COLUMN last_scan INTEGER", (err) => {
            if (err) {
              console.error('❌ last_scan sütunu eklenemedi:', err);
            } else {
              console.log('✅ last_scan sütunu eklendi');
            }
          });
        } else {
          console.log('✅ last_scan sütunu zaten mevcut');
        }
        
        // thumbnail sütununun var olup olmadığını kontrol et
        const hasThumbnail = columns.some(col => col.name === 'thumbnail');
        
        if (!hasThumbnail) {
          console.log('📝 thumbnail sütunu ekleniyor...');
          this.db.run("ALTER TABLE images ADD COLUMN thumbnail TEXT", (err) => {
            if (err) {
              console.error('❌ thumbnail sütunu eklenemedi:', err);
            } else {
              console.log('✅ thumbnail sütunu eklendi');
            }
          });
        } else {
          console.log('✅ thumbnail sütunu zaten mevcut');
        }
      });
    });
  }

  addImage(imageData) {
    return new Promise((resolve, reject) => {
      // filepath kontrolü
      if (!imageData.filepath) {
        console.error('❌ filepath eksik:', imageData);
        reject(new Error('filepath is required'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO images 
        (filepath, filename, filesize, width, height, phash, dhash, avg_color, thumbnail, last_scan)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      // Renk verilerini JSON string'e çevir
      const avgColor = imageData.colors && imageData.colors.length > 0 
        ? JSON.stringify(imageData.colors[0]) 
        : null;
      
      this.db.run(sql, [
        imageData.filepath,
        imageData.filename || path.basename(imageData.filepath),
        imageData.filesize || 0,
        imageData.width || 0,
        imageData.height || 0,
        imageData.phash || null,
        imageData.dhash || null,
        avgColor,
        imageData.thumbnail || null,
        Date.now()
      ], function(err) {
        if (err) {
          console.error('❌ Görsel ekleme hatası:', err.message);
          reject(err);
        } else {
          console.log(`✅ Görsel eklendi: ${imageData.filename || path.basename(imageData.filepath)}`);
          resolve({ lastInsertRowid: this.lastID, changes: this.changes });
        }
      });
    });
  }

  searchSimilar(targetHash, maxDistance = 10) {
    return new Promise((resolve, reject) => {
      // Basit hamming distance hesaplama
      const sql = `
        SELECT * FROM images
        WHERE phash IS NOT NULL
        ORDER BY phash ASC
        LIMIT 100
      `;
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('❌ Arama hatası:', err.message);
          reject(err);
          return;
        }
        
        // JavaScript'te hamming distance hesapla
        const imagesWithDistance = rows.map(img => {
          const distance = this.calculateHammingDistance(targetHash, img.phash);
          return { ...img, distance };
        });
        
        const filtered = imagesWithDistance
          .filter(img => img.distance <= maxDistance)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 50);
        
        console.log(`🔍 ${filtered.length} benzer görsel bulundu (max mesafe: ${maxDistance})`);
        resolve(filtered);
      });
    });
  }

  calculateHammingDistance(hash1, hash2) {
    if (!hash1 || !hash2) return 64; // Max distance
    
    let distance = 0;
    const maxLength = Math.max(hash1.length, hash2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const char1 = hash1[i] || '0';
      const char2 = hash2[i] || '0';
      if (char1 !== char2) distance++;
    }
    
    return distance;
  }

  // Gelişmiş benzer görsel arama (yeni)
  searchSimilarImages(targetHash, threshold = 0.8) {
    return new Promise((resolve, reject) => {
      if (!targetHash) {
        resolve([]);
        return;
      }

      // Threshold'u distance'a çevir (0.8 similarity = 12.8 distance)
      const maxDistance = Math.round((1 - threshold) * 64);

      const sql = `
        SELECT * FROM images
        WHERE phash IS NOT NULL
        AND filepath IS NOT NULL
        AND filepath != ''
        ORDER BY RANDOM()
        LIMIT 200
      `;
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('❌ Gelişmiş benzer görsel arama hatası:', err.message);
          reject(err);
          return;
        }
        
        // JavaScript'te hamming distance hesapla
        const imagesWithDistance = rows.map(img => {
          const distance = this.calculateHammingDistance(targetHash, img.phash);
          const similarity = 1 - (distance / 64); // 64-bit hash için
          return { 
            ...img, 
            distance,
            similarity,
            exists: true,
            path: img.filepath, // Frontend uyumluluğu için
            thumbnail: img.thumbnail || null
          };
        });
        
        const filtered = imagesWithDistance
          .filter(img => img.similarity >= threshold && img.filepath && img.filepath !== '')
          .sort((a, b) => b.similarity - a.similarity) // Benzerliğe göre sırala
          .slice(0, 20); // Daha az sonuç, daha kaliteli
        
        console.log(`🔍 ${filtered.length} benzer görsel bulundu (threshold: ${threshold})`);
        resolve(filtered);
      });
    });
  }

  getAllImages(limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM images 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      
      // Parametreleri sayıya çevir
      const limitNum = parseInt(limit) || 100;
      const offsetNum = parseInt(offset) || 0;
      
      this.db.all(sql, [limitNum, offsetNum], (err, rows) => {
        if (err) {
          console.error('❌ Görsel getirme hatası:', err.message);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  getImageCount() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM images', [], (err, row) => {
        if (err) {
          console.error('❌ Sayım hatası:', err.message);
          reject(err);
        } else {
          resolve(row ? row.count : 0);
        }
      });
    });
  }

  clearDatabase() {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM images', [], (err) => {
        if (err) {
          console.error('❌ Temizleme hatası:', err.message);
          reject(err);
        } else {
          console.log('🗑️ Veritabanı temizlendi');
          resolve(true);
        }
      });
    });
  }

  getStats() {
    return new Promise(async (resolve, reject) => {
      try {
        const total = await this.getImageCount();
        
        this.db.get('SELECT COUNT(*) as count FROM images WHERE phash IS NOT NULL', [], (err, row) => {
          if (err) {
            console.error('❌ İstatistik hatası:', err.message);
            reject(err);
          } else {
            const withHash = row ? row.count : 0;
            resolve({
              totalImages: total,
              withHash: withHash,
              withoutHash: total - withHash
            });
          }
        });
      } catch (error) {
        console.error('❌ İstatistik hatası:', error.message);
        resolve({ totalImages: 0, withHash: 0, withoutHash: 0 });
      }
    });
  }

  // Eksik fonksiyonlar
  getImages(page = 1, limit = 20) {
    return new Promise(async (resolve, reject) => {
      try {
        const offset = (page - 1) * limit;
        const images = await this.getAllImages(limit, offset);
        const total = await this.getImageCount();
        
        resolve({
          images,
          pagination: {
            current: page,
            total: Math.ceil(total / limit),
            totalImages: total
          }
        });
      } catch (error) {
        console.error('❌ Görsel listesi hatası:', error.message);
        reject(error);
      }
    });
  }

  clear() {
    return this.clearDatabase();
  }

  getCount() {
    return this.getImageCount();
  }

  getCountWithHash() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as count FROM images WHERE phash IS NOT NULL';
      this.db.get(sql, [], (err, row) => {
        if (err) {
          console.error('❌ Hash sayısı hatası:', err.message);
          reject(err);
        } else {
          resolve(row ? row.count : 0);
        }
      });
    });
  }

  getAllImagesForSearch() {
    return this.getAllImages(1000, 0); // Tüm görselleri al
  }

  // Akıllı tarama için yeni metodlar
  getImageByPath(filepath) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM images WHERE filepath = ?';
      this.db.get(sql, [filepath], (err, row) => {
        if (err) {
          console.error('❌ Görsel arama hatası:', err.message);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  getImagesByFolder(folderPath) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM images WHERE filepath LIKE ?';
      this.db.all(sql, [`${folderPath}%`], (err, rows) => {
        if (err) {
          console.error('❌ Klasör görsel arama hatası:', err.message);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  updateImageTimestamp(filepath) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE images SET last_scan = ? WHERE filepath = ?';
      this.db.run(sql, [Date.now(), filepath], (err) => {
        if (err) {
          console.error('❌ Timestamp güncelleme hatası:', err.message);
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }

  // Dosya varlığını kontrol et
  isImageExists(filepath) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT filepath, last_scan FROM images WHERE filepath = ?';
      
      this.db.get(sql, [filepath], (err, row) => {
        if (err) {
          console.error('❌ Dosya kontrol hatası:', err.message);
          reject(err);
        } else {
          resolve(row ? { exists: true, lastScan: row.last_scan } : { exists: false });
        }
      });
    });
  }

  // Klasördeki mevcut görselleri getir
  getImagesInFolder(folderPath) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT filepath, last_scan FROM images WHERE filepath LIKE ?';
      const folderPattern = folderPath.replace(/\\/g, '/') + '%';
      
      this.db.all(sql, [folderPattern], (err, rows) => {
        if (err) {
          console.error('❌ Klasör görselleri getirme hatası:', err.message);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Eski görselleri temizle (dosya sisteminde olmayan)
  cleanupMissingFiles(existingFiles) {
    return new Promise((resolve, reject) => {
      if (existingFiles.length === 0) {
        resolve({ deleted: 0 });
        return;
      }
      
      const placeholders = existingFiles.map(() => '?').join(',');
      const sql = `DELETE FROM images WHERE filepath NOT IN (${placeholders})`;
      
      this.db.run(sql, existingFiles, function(err) {
        if (err) {
          console.error('❌ Eski dosyaları temizleme hatası:', err.message);
          reject(err);
        } else {
          console.log(`🗑️ ${this.changes} eski dosya temizlendi`);
          resolve({ deleted: this.changes });
        }
      });
    });
  }

  // Akıllı görsel ekleme (sadece yeni veya değişen dosyalar)
  async addImageSmart(imageData) {
    try {
      // Dosya varlığını kontrol et
      const exists = await this.isImageExists(imageData.filepath);
      
      if (exists.exists) {
        // Dosya zaten var, timestamp güncelle
        await this.updateImageTimestamp(imageData.filepath);
        return { status: 'updated', changes: 0 };
      } else {
        // Yeni dosya, ekle
        const result = await this.addImage(imageData);
        return { status: 'added', changes: 1 };
      }
    } catch (error) {
      console.error('❌ Akıllı görsel ekleme hatası:', error);
      throw error;
    }
  }

  // Dosya adına göre arama
  searchByFilename(searchTerm) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM images 
        WHERE filename LIKE ? OR filepath LIKE ?
        ORDER BY filename ASC
        LIMIT 100
      `;
      
      const searchPattern = `%${searchTerm}%`;
      
      this.db.all(sql, [searchPattern, searchPattern], (err, rows) => {
        if (err) {
          console.error('❌ Dosya adı arama hatası:', err.message);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}

module.exports = SimpleImageDB; 
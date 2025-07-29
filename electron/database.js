const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const imageProcessor = require('./image-processor');

// Vector index import'u (lazy loading için)
let vectorIndex = null;
function getVectorIndex() {
  if (!vectorIndex) {
    vectorIndex = require('./vector-index');
  }
  return vectorIndex;
}

// Electron app context'i kontrol et
let dbPath;
if (app && app.getPath) {
  dbPath = path.join(app.getPath('userData'), 'tekstil-images.db');
} else {
  // Test ortamı için fallback
  dbPath = path.join(__dirname, 'tekstil-images.db');
}
let db = null;

function initDatabase() {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database bağlantı hatası:', err);
        reject(err);
        return;
      }
      
      // TEST AMAÇLI: Tabloyu tamamen sil ve yeniden oluştur (tüm kayıtlar silinir!)
      db.run('DROP TABLE IF EXISTS images', (err) => {
        if (err) console.error('Tablo silme hatası:', err);
        
        console.log('Database bağlandı ve tablo sıfırlandı:', dbPath);
        
        // Tabloyu oluştur (tüm kolonlar dahil)
        db.run(`
          CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            filepath TEXT UNIQUE NOT NULL,
            ml_embedding TEXT,
            color_histogram TEXT,
            hog_vector TEXT,
            phash TEXT,
            dhash TEXT,
            width INTEGER,
            height INTEGER,
            filesize INTEGER,
            dominant_colors TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            console.error('Tablo oluşturma hatası:', err);
            reject(err);
            return;
          }
          
          // İndeksleri oluştur
          db.run('CREATE INDEX IF NOT EXISTS idx_filepath ON images(filepath)', (err) => {
            if (err) console.error('filepath indeks hatası:', err);
          });
          db.run('CREATE INDEX IF NOT EXISTS idx_ml_embedding ON images(ml_embedding) WHERE ml_embedding IS NOT NULL', (err) => {
            if (err) console.error('ml_embedding indeks hatası:', err);
          });
          
          console.log('Database başarıyla başlatıldı:', dbPath);
          resolve(db);
        });
      });
    });
  });
}

function getImageCounts() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    
    db.get('SELECT COUNT(*) as count FROM images', (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      const totalImages = row ? row.count : 0;
      
      db.get('SELECT COUNT(*) as count FROM images WHERE ml_embedding IS NOT NULL', (err2, row2) => {
        if (err2) {
          reject(err2);
          return;
        }
        
        const totalEmbeddings = row2 ? row2.count : 0;
        resolve({ totalImages, totalEmbeddings });
      });
    });
  });
}

function insertImage(filepath, filename, mlEmbedding, hogFeatures, colorHistogram) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    
    const stmt = db.prepare(`
      INSERT INTO images (filepath, filename, ml_embedding, hog_features, color_histogram, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    
    stmt.run([filepath, filename, JSON.stringify(mlEmbedding), JSON.stringify(hogFeatures), JSON.stringify(colorHistogram)], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.lastID);
    });
    
    stmt.finalize();
  });
}

/**
 * Benzer görselleri arar – ML embedding, HOG ve renk histogramı dahil tüm özellikleri kullanır.
 * @param {Buffer} targetEmbedding ML embedding (Float32Array veya Buffer)
 * @param {Array<number>} targetHogVector Hedef görselin HOG vektörü
 * @param {Array<number>} targetColorHist Hedef görselin renk histogramı
 * @param {number} threshold Benzerlik eşiği (0-1 arası)
 * @param {object} weights Benzerlik hesaplamaları için ağırlıklar
 * @returns {Promise<Array<object>>}
 */


// Yeni, kısa hammingDistance – metreye değil yüzdeye döndürmede kullanıyoruz.
function hammingDistance(hex1, hex2) {
  if (!hex1 || !hex2 || hex1.length !== hex2.length) return Infinity;
  const toBits = (hex) => [...hex].map((c) => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
  const b1 = toBits(hex1);
  const b2 = toBits(hex2);
  let diff = 0;
  for (let i = 0; i < b1.length; i += 1) if (b1[i] !== b2[i]) diff += 1;
  return diff;
}

function getAllImages() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    
    db.all('SELECT * FROM images ORDER BY created_at DESC', (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function getImageCount() {
  const dbConn = initDatabase();
  const row = dbConn.prepare('SELECT COUNT(*) as count FROM images').get();
  return row.count;
}

function clearDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    
    db.run('DELETE FROM images', (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function compareHogVectors(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) return 0;
  
  const len = Math.min(vecA.length, vecB.length);
  let sumSq = 0;
  
  for (let i = 0; i < len; i += 1) {
    const diff = (vecA[i] - vecB[i]);
    sumSq += diff * diff;
  }
  
  // Öklid uzaklığını hesapla
  const euclideanDistance = Math.sqrt(sumSq);
  
  // HOG vektörleri için daha gerçekçi normalizasyon
  // HOG değerleri genellikle 0-1 aralığında olur
  const maxPossibleDistance = Math.sqrt(len);
  
  // Uzaklığı benzerlik skoruna dönüştür (0-1 aralığı)
  let similarity = 1 - (euclideanDistance / maxPossibleDistance);
  
  // Skoru 0-1 aralığında tut (sınırlama kaldırıldı)
  similarity = Math.max(0, Math.min(1, similarity));
  
  return similarity;
}

/**
 * İki vektör arasındaki kosinüs benzerliğini hesaplar.
 * @param {Float32Array|Array<number>} vecA
 * @param {Float32Array|Array<number>} vecB
 * @returns {number}
 */
function calculateCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0; // Vektörler boşsa veya uzunlukları farklıysa benzerlik yok
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const valA = Number(vecA[i]) || 0;
    const valB = Number(vecB[i]) || 0;
    
    dotProduct += valA * valB;
    magnitudeA += valA * valA;
    magnitudeB += valB * valB;
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0; // Sıfır vektörler için benzerlik yok
  }

  const similarity = dotProduct / (magnitudeA * magnitudeB);
  
  // Kosinüs benzerliği -1 ile 1 arasında olur, biz 0-1 aralığına normalize ediyoruz
  const normalizedSimilarity = (similarity + 1) / 2;
  
  // Skoru 0-1 aralığında tut (sınırlama kaldırıldı)
  return Math.max(0, Math.min(1, normalizedSimilarity));
}

function getImagesByIds(ids) {
  const dbConn = initDatabase();
  if (!ids || ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  return dbConn.prepare(`SELECT * FROM images WHERE id IN (${placeholders})`).all(ids);
}

function updateImagePath(id, newPath) {
  const dbConn = initDatabase();
  try {
    dbConn.prepare('UPDATE images SET filepath = ? WHERE id = ?').run(newPath, id);
    return { success: true };
  } catch (error) {
    console.error('updateImagePath hatası:', error);
    return { success: false, error: error.message };
  }
}

// Performans optimizasyonu için önbellek
const searchCache = new Map();
const CACHE_SIZE_LIMIT = 1000; // Maksimum önbellek boyutu

// İndeksleme için yardımcı fonksiyonlar




// Sayfalama ile arama (büyük sonuç setleri için)
function searchSimilarImagesPaginated(targetEmbedding, page = 1, pageSize = 20, threshold = 0.0001, weights = { embedding: 0.8, color: 0.2 }) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const startTime = Date.now();
    console.log('=== SAYFALI ARAMA BAŞLADI ===');
    console.log(`Sayfa: ${page} Sayfa boyutu: ${pageSize}`);
    
    console.log('🚀 HIZLI ARAMA BAŞLATILIYOR...');
    console.log(`🎯 Threshold: ${threshold} (${Math.round(threshold * 100)}%), Limit: ${pageSize * 2}`);
    console.log(`⚖️ Ağırlıklar: Embedding=${weights.embedding}, Color=${weights.color}`);
    console.log(`🔍 Threshold detayı: ${threshold} = ${(threshold * 100).toFixed(4)}%`);

    // Tüm görselleri al
    db.all('SELECT * FROM images ORDER BY created_at DESC', (err, images) => {
      if (err) {
        console.error('Database sorgu hatası:', err);
        reject(err);
        return;
      }

      console.log(`📊 Toplam görsel sayısı: ${images.length}`);
      
      if (images.length === 0) {
        console.log('⚠️ Veritabanında hiç görsel bulunamadı!');
        resolve({
          results: [],
          total: 0,
          page: page,
          pageSize: pageSize,
          totalPages: 0
        });
        return;
      }

      // Target embedding'i parse et
      let targetEmbeddingArray = null;
      if (targetEmbedding) {
        try {
          targetEmbeddingArray = Array.from(new Float32Array(targetEmbedding.buffer));
          console.log(`🎯 Target embedding boyutu: ${targetEmbeddingArray.length}`);
        } catch (e) {
          console.error('Target embedding parse hatası:', e);
          reject(e);
          return;
        }
      }

      const results = [];
      let processedCount = 0;

      // Her görsel için benzerlik hesapla
      images.forEach((img) => {
        processedCount++;
        
        // Embedding benzerliği
        let embeddingSimilarity = 0;
        if (img.ml_embedding && targetEmbeddingArray && weights.embedding > 0) {
          try {
            // Base64 formatındaki embedding'i parse et
            const imgEmbeddingBuffer = Buffer.from(img.ml_embedding, 'base64');
            const imgEmbedding = Array.from(new Float32Array(imgEmbeddingBuffer.buffer));
            
            // Debug: Embedding boyutlarını kontrol et
            console.log(`🔍 Embedding boyutları: Target=${targetEmbeddingArray.length}, Image=${imgEmbedding.length}`);
            
            embeddingSimilarity = calculateCosineSimilarity(targetEmbeddingArray, imgEmbedding);
            
            // Debug: Tüm benzerlik skorlarını logla
            console.log(`🔍 Benzerlik: ${img.filename} = ${(embeddingSimilarity * 100).toFixed(4)}% (threshold: ${(threshold * 100).toFixed(4)}%)`);
            
            // Threshold kontrolü (doğrudan karşılaştırma)
            if (embeddingSimilarity >= threshold) {
              console.log(`✅ EŞLEŞME BULUNDU: ${img.filename} = ${(embeddingSimilarity * 100).toFixed(4)}% >= ${(threshold * 100).toFixed(4)}%`);
            } else {
              console.log(`❌ Eşleşme yok: ${img.filename} = ${(embeddingSimilarity * 100).toFixed(4)}% < ${(threshold * 100).toFixed(4)}%`);
            }
          } catch (e) {
            console.error(`Embedding hesaplama hatası ${img.filename}:`, e.message);
          }
        }

        // Final benzerlik hesaplama (sadece embedding için şimdilik)
        let finalSimilarity = embeddingSimilarity; // 0-1 arası bırak
        
        // Threshold kontrolü (doğrudan karşılaştırma)
        if (finalSimilarity >= threshold) {
          console.log(`✅ Eşleşme bulundu: ${img.filename} = ${(finalSimilarity * 100).toFixed(4)}% (threshold: ${(threshold * 100).toFixed(4)}%)`);
          results.push({ 
            ...img, 
            similarity: Math.round(finalSimilarity * 100), // UI için yüzde
            rawSimilarity: finalSimilarity
          });
        } else {
          console.log(`❌ Threshold altında: ${img.filename} = ${(finalSimilarity * 100).toFixed(4)}% < ${(threshold * 100).toFixed(4)}%`);
        }
      });

      // Sonuçları benzerlik skoruna göre sırala
      const sortedResults = results.sort((a, b) => b.similarity - a.similarity);
      
      // Sayfalama
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedResults = sortedResults.slice(startIndex, endIndex);
      
      console.log(`✅ ARAMA TAMAMLANDI!`);
      console.log(`📈 Bulunan sonuç: ${results.length} (${paginatedResults.length} gösteriliyor)`);
      console.log(`⏱️ Arama süresi: ${Date.now() - startTime}ms`);
      console.log(`🚀 Saniyede işlenen görsel: ${Math.round(processedCount / ((Date.now() - startTime) / 1000))}`);
      
      console.log(`Sayfa ${page}: ${paginatedResults.length} sonuç`);
      console.log('=== SAYFALI ARAMA TAMAMLANDI ===');

      resolve({
        results: paginatedResults,
        total: results.length,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil(results.length / pageSize)
      });
    });
  });
}

// Önbellek temizleme
function clearSearchCache() {
  searchCache.clear();
  return Promise.resolve();
}

// Performans istatistikleri
function getPerformanceStats() {
  return Promise.resolve({
    cacheSize: searchCache.size,
    cacheHits: cacheHits,
    cacheMisses: cacheMisses
  });
}

// Database'i başlatma fonksiyonu
async function ensureDatabase() {
  if (db) return db;
  return await initDatabase();
}

// Ekleme fonksiyonu zaten uyumlu, sadece color_histogram ve hog_vector isimlerini kullanıyor.
function addImageToDatabase(filepath, filename, embedding, colorHistogram = null, hogFeatures = null) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    console.log(`📥 Görsel veritabanına ekleniyor: ${filename}`);
    console.log(`📥 Embedding boyutu: ${embedding ? embedding.length : 0}`);
    console.log(`📥 Renk histogramı: ${colorHistogram ? 'Mevcut' : 'Yok'}`);
    console.log(`📥 HOG vektörü: ${hogFeatures ? 'Mevcut' : 'Yok'}`);

    // Embedding'i base64'e çevir
    const embeddingBase64 = embedding ? embedding.toString('base64') : null;
    
    // Renk histogramını JSON string'e çevir
    const colorHistJson = colorHistogram ? JSON.stringify(colorHistogram) : null;
    
    // HOG vektörünü JSON string'e çevir
    const hogFeaturesJson = hogFeatures ? JSON.stringify(hogFeatures) : null;

    const sql = `
      INSERT INTO images (
        filename, filepath, ml_embedding, color_histogram, hog_vector, 
        width, height, filesize, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    // Dosya bilgilerini al
    const fs = require('fs');
    const stats = fs.statSync(filepath);
    
    db.run(sql, [
      filename,
      filepath,
      embeddingBase64,
      colorHistJson,
      hogFeaturesJson,
      0, // width - şimdilik 0
      0, // height - şimdilik 0
      stats.size
    ], function(err) {
      if (err) {
        console.error('Görsel ekleme hatası:', err);
        reject(err);
        return;
      }
      
      console.log(`✅ Görsel başarıyla eklendi: ${filename} (ID: ${this.lastID})`);
      resolve({ success: true, id: this.lastID });
    });
  });
}

// Toplu görsel ekleme fonksiyonu
function addImagesToDatabase(imageDataArray) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    
    console.log(`📥 Toplu görsel ekleme başlatılıyor: ${imageDataArray.length} görsel`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    const processNext = (index) => {
      if (index >= imageDataArray.length) {
        console.log(`✅ Toplu ekleme tamamlandı: ${successCount} başarılı, ${errorCount} hatalı`);
        resolve({ success: true, successCount, errorCount, errors });
        return;
      }
      
      const imageData = imageDataArray[index];
      
      addImageToDatabase(
        imageData.filepath,
        imageData.filename,
        imageData.embedding,
        imageData.colorHistogram,
        imageData.hogFeatures
      )
      .then(() => {
        successCount++;
        processNext(index + 1);
      })
      .catch((error) => {
        errorCount++;
        errors.push({ filename: imageData.filename, error: error.message });
        processNext(index + 1);
      });
    };
    
    processNext(0);
  });
}

// Vector index için gerekli fonksiyon
function getAllImagesWithEmbedding() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    
    const query = `
      SELECT id, filename, filepath, ml_embedding, color_histogram, hog_vector
      FROM images 
      WHERE ml_embedding IS NOT NULL
    `;
    
    db.all(query, (err, rows) => {
      if (err) {
        console.error('Embeddingli görselleri getirme hatası:', err);
        reject(err);
        return;
      }
      
      console.log(`📊 ${rows.length} embeddingli görsel bulundu`);
      resolve(rows);
    });
  });
}

/**
 * HNSW index kullanan hızlı hibrid arama
 */
async function searchSimilarHybrid(targetEmbedding, targetColorHist, threshold = 0.7, weights = { embedding: 0.8, color: 0.2 }) {
  const startTime = Date.now();
  console.log('🚀 Hibrid arama başlatılıyor...');
  
  try {
    // 1. HNSW ile hızlı embedding araması (ilk 100 aday)
    const vectorIdx = getVectorIndex();
    const candidates = await vectorIdx.searchSimilar(targetEmbedding, 100, threshold * 0.8);
    
    if (candidates.length === 0) {
      console.log('⚠️ HNSW\'den aday bulunamadı');
      return [];
    }
    
    console.log(`📊 HNSW'den ${candidates.length} aday bulundu`);
    
    // 2. Aday ID'leri ile veritabanından detayları çek
    const candidateIds = candidates.map(c => c.id);
    const placeholders = candidateIds.map(() => '?').join(',');
    
    const query = `
      SELECT id, filename, filepath, color_histogram, hog_vector, 
             phash, dhash, width, height, filesize, dominant_colors
      FROM images 
      WHERE id IN (${placeholders})
    `;
    
    const images = await new Promise((resolve, reject) => {
      db.all(query, candidateIds, (err, rows) => {
        if (err) {
          console.error('Database sorgu hatası:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
    
    console.log(`📊 Veritabanından ${images.length} görsel detayı alındı`);
    
    // 3. Detaylı skorlama ve filtreleme
    const results = [];
    
    for (const img of images) {
      const candidate = candidates.find(c => c.id === img.id);
      if (!candidate) continue;
      
      // Embedding skoru (HNSW'den gelen)
      let finalScore = candidate.similarity * weights.embedding;
      
      // Renk histogramı benzerliği
      if (targetColorHist && img.color_histogram && weights.color > 0) {
        try {
          const colorHist = JSON.parse(img.color_histogram);
          const colorSim = calculateHistogramSimilarity(targetColorHist, colorHist);
          finalScore += colorSim * weights.color;
        } catch (e) {
          console.warn(`Renk histogramı parse hatası (${img.filename}):`, e.message);
        }
      }
      
      // Normalize et (ağırlıklar toplamı 1 olmalı)
      const totalWeight = weights.embedding + weights.color;
      finalScore = finalScore / totalWeight;
      
      // Threshold kontrolü
      if (finalScore >= threshold) {
        results.push({
          ...img,
          similarity: Math.round(finalScore * 100),
          embeddingSim: Math.round(candidate.similarity * 100),
          colorSim: targetColorHist ? Math.round((finalScore - candidate.similarity * weights.embedding) / weights.color * 100) : 0,
          searchTime: Date.now() - startTime
        });
      }
    }
    
    // Benzerliğe göre sırala
    results.sort((a, b) => b.similarity - a.similarity);
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Hibrid arama tamamlandı: ${results.length} sonuç, ${elapsed}ms`);
    console.log(`⚡ Performans: ${Math.round(candidateIds.length / (elapsed / 1000))} görsel/saniye`);
    
    return results;
  } catch (error) {
    console.error('Hibrid arama hatası:', error);
    throw error;
  }
}

/**
 * Görsel benzerlik arama (sadece veritabanındaki ayak izlerini ara)
 */
async function searchSimilarImages(hashData, threshold = 0.7) {
  try {
    console.log('🔍 Veritabanında görsel benzerlik araması başlatılıyor...');
    
    const { perceptualHash, colorHash, edgeHash } = hashData;
    
    // Veritabanındaki tüm görselleri al (ayak izi olanlar)
    const query = `
      SELECT * FROM images 
      WHERE phash IS NOT NULL 
      AND filepath IS NOT NULL
      ORDER BY RANDOM() 
      LIMIT 100
    `;
    
    const images = await new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) {
          console.error('Database sorgu hatası:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
    
    console.log(`📊 Veritabanında ${images.length} görsel bulundu, benzerlik hesaplanıyor...`);
    
    // Benzerlik hesapla
    const results = [];
    for (const img of images) {
      let similarity = 0;
      
      // Perceptual hash benzerliği
      if (perceptualHash && img.phash) {
        const phashSim = 1 - (hammingDistance(perceptualHash, img.phash) / 64);
        similarity += phashSim * 0.6; // %60 ağırlık
      }
      
      // Color hash benzerliği
      if (colorHash && img.color_hash) {
        const colorSim = 1 - (hammingDistance(colorHash, img.color_hash) / 64);
        similarity += colorSim * 0.3; // %30 ağırlık
      }
      
      // Edge hash benzerliği
      if (edgeHash && img.edge_hash) {
        const edgeSim = 1 - (hammingDistance(edgeHash, img.edge_hash) / 64);
        similarity += edgeSim * 0.1; // %10 ağırlık
      }
      
      if (similarity >= threshold) {
        results.push({
          id: img.id,
          filename: img.filename,
          filepath: img.filepath,
          width: img.width,
          height: img.height,
          filesize: img.filesize,
          similarity: Math.round(similarity * 100) / 100,
          exists: true,
          path: img.filepath, // Dosya konumu
          thumbnail: img.thumbnail || null
        });
      }
    }
    
    // Benzerliğe göre sırala
    results.sort((a, b) => b.similarity - a.similarity);
    
    console.log(`✅ ${results.length} benzer görsel bulundu (threshold: ${threshold})`);
    return results;
    
  } catch (error) {
    console.error('❌ Görsel benzerlik arama hatası:', error);
    return [];
  }
}

/**
 * Belirli diskte görsel benzerlik arama (sadece veritabanındaki ayak izlerini ara)
 */
async function searchSimilarImagesInDrive(hashData, threshold = 0.7, driveLetter) {
  try {
    console.log(`🔍 ${driveLetter}: diskinde veritabanı araması başlatılıyor...`);
    
    const { perceptualHash, colorHash, edgeHash } = hashData;
    
    // Belirli diskteki veritabanı kayıtlarını ara
    const query = `
      SELECT * FROM images 
      WHERE phash IS NOT NULL 
      AND filepath IS NOT NULL
      AND filepath LIKE ? || '%'
      ORDER BY RANDOM() 
      LIMIT 100
    `;
    
    const images = await new Promise((resolve, reject) => {
      db.all(query, [driveLetter + ':'], (err, rows) => {
        if (err) {
          console.error('Database sorgu hatası:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
    
    console.log(`📊 ${driveLetter}: diskinde veritabanında ${images.length} görsel bulundu`);
    
    // Benzerlik hesapla
    const results = [];
    for (const img of images) {
      let similarity = 0;
      
      // Perceptual hash benzerliği
      if (perceptualHash && img.phash) {
        const phashSim = 1 - (hammingDistance(perceptualHash, img.phash) / 64);
        similarity += phashSim * 0.6; // %60 ağırlık
      }
      
      // Color hash benzerliği
      if (colorHash && img.color_hash) {
        const colorSim = 1 - (hammingDistance(colorHash, img.color_hash) / 64);
        similarity += colorSim * 0.3; // %30 ağırlık
      }
      
      // Edge hash benzerliği
      if (edgeHash && img.edge_hash) {
        const edgeSim = 1 - (hammingDistance(edgeHash, img.edge_hash) / 64);
        similarity += edgeSim * 0.1; // %10 ağırlık
      }
      
      if (similarity >= threshold) {
        results.push({
          id: img.id,
          filename: img.filename,
          filepath: img.filepath,
          width: img.width,
          height: img.height,
          filesize: img.filesize,
          similarity: Math.round(similarity * 100) / 100,
          exists: true,
          path: img.filepath, // Dosya konumu
          thumbnail: img.thumbnail || null
        });
      }
    }
    
    // Benzerliğe göre sırala
    results.sort((a, b) => b.similarity - a.similarity);
    
    console.log(`✅ ${driveLetter}: diskinde ${results.length} benzer görsel bulundu (threshold: ${threshold})`);
    return results;
    
  } catch (error) {
    console.error(`❌ ${driveLetter}: diskinde görsel benzerlik arama hatası:`, error);
    return [];
  }
}

/**
 * İki histogram arasındaki benzerliği hesapla (Bhattacharyya distance)
 */
function calculateHistogramSimilarity(hist1, hist2) {
  if (!hist1 || !hist2 || hist1.length !== hist2.length) {
    return 0;
  }
  
  let sum = 0;
  for (let i = 0; i < hist1.length; i++) {
    sum += Math.sqrt(hist1[i] * hist2[i]);
  }
  
  // Bhattacharyya coefficient (0-1 arası, 1 = tam eşleşme)
  return Math.min(1, Math.max(0, sum));
}

module.exports = {
  initDatabase,
  ensureDatabase,
  getImageCounts,
  insertImage,
  searchSimilarImagesPaginated,
  searchSimilarImages,
  searchSimilarImagesInDrive,
  clearDatabase,
  clearSearchCache,
  getPerformanceStats,
  getAllImages,
  getImageCount,
  getImagesByIds,
  updateImagePath,
  addImageToDatabase,
  addImagesToDatabase,
  getAllImagesWithEmbedding,
  searchSimilarHybrid
};

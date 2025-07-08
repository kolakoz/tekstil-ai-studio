const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const { app } = require('electron');
const imageProcessor = require('./image-processor');

const dbPath = path.join(app.getPath('userData'), 'tekstil-images.db');
let db = null;

async function initDatabase() {
  if (db) return db;
  db = await open({ filename: dbPath, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      filepath TEXT UNIQUE NOT NULL,
      phash TEXT NOT NULL,
      dhash TEXT,
      width INTEGER,
      height INTEGER,
      filesize INTEGER,
      dominant_colors TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_phash ON images(phash);
    CREATE INDEX IF NOT EXISTS idx_filepath ON images(filepath);
  `);
  // V2 kolonları (blockhash, color_hist) ekle – varsa hata yoksay
  try { await db.exec('ALTER TABLE images ADD COLUMN blockhash TEXT'); } catch (e) {}
  try { await db.exec('ALTER TABLE images ADD COLUMN color_hist TEXT'); } catch (e) {}
  try { await db.exec('ALTER TABLE images ADD COLUMN hog_vector TEXT'); } catch (e) {}

  // ML embedding kolonu var mı kontrol et (ADIM 5)
  const columns = await db.all(`PRAGMA table_info(images)`);
  const hasMLEmbedding = columns.some(col => col.name === 'ml_embedding');
  
  if (!hasMLEmbedding) {
    console.log('ml_embedding kolonu ekleniyor...');
    await db.run(`ALTER TABLE images ADD COLUMN ml_embedding BLOB`);
  }
  
  // İndeks ekle
  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_ml_embedding 
    ON images(ml_embedding) 
    WHERE ml_embedding IS NOT NULL
  `);

  console.log('Database initialized at:', dbPath);
  return db;
}

async function insertImage(imageData) {
  const dbConn = await initDatabase();
  try {
    const res = await dbConn.run(
      `INSERT OR REPLACE INTO images 
      (filename, filepath, phash, dhash, blockhash, color_hist, hog_vector, width, height, filesize, dominant_colors, ml_embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        imageData.filename,
        imageData.filepath,
        imageData.phash,
        imageData.dhash,
        imageData.blockhash || null,
        imageData.colorHist ? JSON.stringify(imageData.colorHist) : null,
        imageData.hogVector ? JSON.stringify(imageData.hogVector) : null,
        imageData.width,
        imageData.height,
        imageData.filesize,
        JSON.stringify(imageData.colors || []),
        imageData.embedding || null,
      ],
    );
    console.log(`Görsel ${imageData.filepath} için embedding durumu:`, imageData.embedding ? 'VAR' : 'YOK', `Boyut: ${imageData.embedding?.length || 0}`);
    return { success: true, id: res.lastID };
  } catch (e) {
    console.error('Insert error:', e);
    return { success: false, error: e.message };
  }
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
async function searchSimilarImagesML(targetEmbedding, targetHogVector, targetColorHist, threshold = 0.6, weights = {}) {
  const dbConn = await initDatabase();

  // Varsayılan ağırlıklar - TOPLAM 1.0 olmalı
  const defaultWeights = {
    embedding: 0.7, // ONNX embedding ağırlığı
    hog: 0.2, // HOG feature ağırlığı
    color: 0.1 // Renk histogram ağırlığı
  };

  // Eksik ağırlıkları tamamla
  weights = { ...defaultWeights, ...weights };

  // Ağırlık toplamını kontrol et ve normalize et
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    console.warn(`Ağırlık toplamı 1.0 değil: ${totalWeight}. Normalleştiriliyor...`);
    Object.keys(weights).forEach(key => {
      weights[key] = weights[key] / totalWeight;
    });
  }

  console.log('Kullanılan ağırlıklar:', weights);

  // Tüm görselleri ML embedding veya diğer özelliklerle çek
  const candidates = await dbConn.all('SELECT * FROM images WHERE ml_embedding IS NOT NULL OR hog_vector IS NOT NULL OR color_hist IS NOT NULL');
  const results = [];

  for (const img of candidates) {
    let totalWeightedSimilarity = 0;
    let currentTotalWeight = 0;

    // ML Embedding benzerliği
    if (img.ml_embedding && targetEmbedding && weights.embedding > 0) {
      const embeddingSimilarity = calculateCosineSimilarity(targetEmbedding, img.ml_embedding);
      totalWeightedSimilarity += embeddingSimilarity * weights.embedding;
      currentTotalWeight += weights.embedding;
    }

    // HOG benzerliği
    if (img.hog_vector && targetHogVector && weights.hog > 0) {
      try {
        const imgHog = JSON.parse(img.hog_vector);
        const hogSimilarity = compareHogVectors(targetHogVector, imgHog); // Doğru parametreler kullanıldı
        totalWeightedSimilarity += hogSimilarity * weights.hog;
        currentTotalWeight += weights.hog;
      } catch (e) {
        console.warn('HOG vektör parsing veya karşılaştırma hatası:', e.message);
      }
    }

    // Renk histogramı benzerliği
    if (img.color_hist && targetColorHist && weights.color > 0) {
      try {
        const imgColorHist = JSON.parse(img.color_hist);
        const colorSimilarity = calculateCosineSimilarity(targetColorHist, imgColorHist);
        totalWeightedSimilarity += colorSimilarity * weights.color;
        currentTotalWeight += weights.color;
      } catch (e) {
        console.warn('Renk histogramı parsing veya karşılaştırma hatası:', e.message);
      }
    }

    const finalSimilarity = currentTotalWeight > 0 ? (totalWeightedSimilarity / currentTotalWeight) : 0;

    if (finalSimilarity >= threshold) {
      results.push({ ...img, similarity: Math.round(finalSimilarity * 100) });
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}

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

async function getAllImages() {
  const dbConn = await initDatabase();
  return dbConn.all('SELECT * FROM images ORDER BY created_at DESC');
}

async function getImageCount() {
  const dbConn = await initDatabase();
  const row = await dbConn.get('SELECT COUNT(*) as count FROM images');
  return row.count;
}

async function clearDatabase() {
  const dbConn = await initDatabase();
  await dbConn.run('DELETE FROM images');
  return { success: true };
}

function compareHogVectors(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) return 0;
  const len = Math.min(vecA.length, vecB.length);
  let sumSq = 0;
  for (let i = 0; i < len; i += 1) {
    sumSq += (vecA[i] - vecB[i]) ** 2;
  }
  // Öklid uzaklığını benzerlik skoruna dönüştür (0-1 aralığına normalize)
  const euclideanDistance = Math.sqrt(sumSq);
  // Max mesafe teorik olarak 2 * sqrt(boyut * (max_val^2)) olabilir
  // HOG için pratik bir normalizasyon faktörü bulmak zor olabilir.
  // Şimdilik basit bir ters orantı kullanıyoruz.
  // Bu kısım iyileştirilebilir.
  const maxPossibleDistance = Math.sqrt(len * 2 * 2); // varsayım: değerler -1 ile 1 arasında
  return 1 - (euclideanDistance / maxPossibleDistance);
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
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0; // Sıfır vektörler için benzerlik yok
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

async function getImagesByIds(ids) {
  const dbConn = await initDatabase();
  if (!ids || ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  return dbConn.all(`SELECT * FROM images WHERE id IN (${placeholders})`, ids);
}

module.exports = {
  initDatabase,
  insertImage,
  getAllImages,
  getImageCount,
  clearDatabase,
  getAllImagesWithEmbedding: async () => {
    const dbConn = await initDatabase();
    return dbConn.all('SELECT * FROM images WHERE ml_embedding IS NOT NULL');
  },
  getImagesByIds,
  searchSimilarImagesML,
};
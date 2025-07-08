const database = require('./database');
const { similarity } = require('./hash-calculator');
const hnswlib = require('hnswlib-node'); // npm install hnswlib-node

// Index in memory
let globalIndex = null;
const INDEX_DIM = 512; // Example for MobileNetV2 embedding dimension

/**
 * Veritabanından tüm embeddingleri yükler ve HNSW indeksini oluşturur.
 * @returns {Promise<void>}
 */
async function loadIndexFromDatabase() {
  // TODO: Use actual embedding dimension from model or config
  globalIndex = new hnswlib.HierarchicalNSW('l2', INDEX_DIM);
  globalIndex.initIndex(10000, 16, 200, 100);

  const images = await database.getAllImagesWithEmbedding();
  if (images && images.length > 0) {
    const embeddings = images.map(img => img.embedding);
    const ids = images.map(img => img.id);
    // Add data to index in batches to avoid memory issues with very large datasets
    // For simplicity, directly add here
    for(let i = 0; i < embeddings.length; i++){
      globalIndex.addPoint(embeddings[i], ids[i]);
    }
    console.log(`Loaded ${images.length} embeddings into HNSW index.`);
  }
}

/**
 * İndeksi günceller (yeni görseller eklendiğinde çağrılabilir)
 * @param {Array<object>} newImages Yeni görseller (embedding ve id ile)
 * @returns {void}
 */
function updateIndex(newImages) {
  if (!globalIndex) {
    console.warn('Index not initialized. Call loadIndexFromDatabase first.');
    return;
  }
  for (const img of newImages) {
    globalIndex.addPoint(img.embedding, img.id);
  }
  console.log(`Added ${newImages.length} new embeddings to HNSW index.`);
}

/**
 * Belirli bir görselin embeddingini kullanarak benzer görselleri arar.
 * @param {string} imagePath Sorgu görselinin yolu
 * @param {number} threshold Benzerlik eşiği (0-1 arası)
 * @param {object} weights Benzerlik hesaplaması için ağırlıklar
 * @returns {Promise<Array<object>>} Benzer görsellerin listesi
 */
async function searchSimilar(imagePath, threshold, weights) {
  if (!globalIndex) {
    await loadIndexFromDatabase();
    if (!globalIndex) {
      console.error('HNSW index yüklenemedi veya boş.');
      return [];
    }
  }

  // TODO: Verilen imagePath için embeddingi yeniden hesapla
  // Şimdilik yer tutucu olarak boş bir array döndürüyorum.
  console.log(`Searching for similar images to ${imagePath} with threshold ${threshold} and weights ${JSON.stringify(weights)}`);
  return [];
}

module.exports = {
  loadIndexFromDatabase,
  updateIndex,
  searchSimilar,
}; 
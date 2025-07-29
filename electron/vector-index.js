const database = require('./database');
const hnswlib = require('hnswlib-node');
const path = require('path');
const fs = require('fs').promises;

class VectorIndex {
  constructor() {
    this.index = null;
    this.idMapping = new Map();
    this.reverseMapping = new Map();
    this.nextId = 0;
    this.indexDim = 1000; // MobileNetV2 output dimension
    this.maxElements = 100000;
    this.indexPath = path.join(__dirname, 'vector-index.bin');
    this.mappingPath = path.join(__dirname, 'vector-mapping.json');
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🚀 HNSW Index başlatılıyor...');
    const startTime = Date.now();
    
    // Index'i diskten yüklemeyi dene
    const indexExists = await this.loadFromDisk();
    
    if (!indexExists) {
      // Yeni index oluştur
      this.index = new hnswlib.HierarchicalNSW('l2', this.indexDim);
      this.index.initIndex(this.maxElements, 16, 200, 100);
      
      // Veritabanından tüm embeddingleri yükle
      await this.loadAllEmbeddings();
      
      // Index'i diske kaydet
      await this.saveToDisk();
    }
    
    this.isInitialized = true;
    console.log(`✅ HNSW Index hazır! (${Date.now() - startTime}ms)`);
  }

  async loadAllEmbeddings() {
    const images = await database.getAllImagesWithEmbedding();
    console.log(`📊 ${images.length} embedding yüklenecek...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const img of images) {
      try {
        await this.addImage(img);
        successCount++;
        
        if (successCount % 1000 === 0) {
          console.log(`📈 İlerleme: ${successCount}/${images.length}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Hata (${img.filename}):`, error.message);
      }
    }
    
    console.log(`✅ Yükleme tamamlandı: ${successCount} başarılı, ${errorCount} hatalı`);
  }

  async addImage(imageData) {
    if (!imageData.ml_embedding) {
      throw new Error('Embedding bulunamadı');
    }
    
    try {
      // Base64'ten Float32Array'e dönüştür
      const buffer = Buffer.from(imageData.ml_embedding, 'base64');
      const embedding = new Float32Array(buffer.buffer);
      
      // Boyut kontrolü
      if (embedding.length !== this.indexDim) {
        throw new Error(`Yanlış embedding boyutu: ${embedding.length} (beklenen: ${this.indexDim})`);
      }
      
      // HNSW'ye ekle
      const hnswId = this.nextId++;
      this.index.addPoint(embedding, hnswId);
      
      // ID eşleştirmelerini kaydet
      this.idMapping.set(hnswId, imageData.id);
      this.reverseMapping.set(imageData.id, hnswId);
      
      return hnswId;
    } catch (error) {
      throw new Error(`Embedding ekleme hatası: ${error.message}`);
    }
  }

  async searchSimilar(targetEmbedding, k = 50, threshold = 0.7) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    try {
      // Embedding'i Float32Array'e dönüştür
      let embedding;
      if (targetEmbedding instanceof Float32Array) {
        embedding = targetEmbedding;
      } else if (Buffer.isBuffer(targetEmbedding)) {
        embedding = new Float32Array(targetEmbedding.buffer);
      } else {
        throw new Error('Geçersiz embedding formatı');
      }
      
      // Boyut kontrolü
      if (embedding.length !== this.indexDim) {
        throw new Error(`Yanlış embedding boyutu: ${embedding.length}`);
      }

      // HNSW araması yap
      const result = this.index.searchKnn(embedding, Math.min(k, this.idMapping.size));
      
      // Sonuçları database ID'leri ile eşleştir ve filtrele
      const matches = [];
      for (let i = 0; i < result.neighbors.length; i++) {
        const hnswId = result.neighbors[i];
        const dbId = this.idMapping.get(hnswId);
        
        if (dbId !== undefined) {
          // L2 mesafeyi kosinüs benzerliğine dönüştür
          const distance = result.distances[i];
          const similarity = 1 / (1 + distance);
          
          if (similarity >= threshold) {
            matches.push({
              id: dbId,
              distance: distance,
              similarity: similarity,
              similarityPercent: Math.round(similarity * 100)
            });
          }
        }
      }
      
      console.log(`⚡ HNSW arama: ${matches.length} sonuç, ${Date.now() - startTime}ms`);
      return matches;
    } catch (error) {
      console.error('HNSW arama hatası:', error);
      throw error;
    }
  }

  async updateImage(dbId, newEmbedding) {
    if (!this.reverseMapping.has(dbId)) {
      // Yeni görsel, ekle
      return await this.addImage({ id: dbId, ml_embedding: newEmbedding });
    }
    
    // Mevcut görseli güncelle
    const hnswId = this.reverseMapping.get(dbId);
    const buffer = Buffer.from(newEmbedding, 'base64');
    const embedding = new Float32Array(buffer.buffer);
    
    // HNSW'de güncelleme desteklenmez, sil ve yeniden ekle
    // Not: Bu işlem pahalı olabilir, batch update tercih edilmeli
    console.warn('HNSW güncelleme: Henüz implementе edilmedi');
  }

  async removeImage(dbId) {
    if (!this.reverseMapping.has(dbId)) {
      return false;
    }
    
    const hnswId = this.reverseMapping.get(dbId);
    // HNSW'de silme işlemi karmaşık, mark as deleted yaklaşımı kullanılabilir
    this.idMapping.delete(hnswId);
    this.reverseMapping.delete(dbId);
    
    return true;
  }

  async saveToDisk() {
    try {
      // Index'i kaydet
      await this.index.writeIndex(this.indexPath);
      
      // Mapping'leri kaydet
      const mappingData = {
        idMapping: Array.from(this.idMapping.entries()),
        reverseMapping: Array.from(this.reverseMapping.entries()),
        nextId: this.nextId
      };
      
      await fs.writeFile(
        this.mappingPath, 
        JSON.stringify(mappingData), 
        'utf8'
      );
      
      console.log('💾 Index diske kaydedildi');
      return true;
    } catch (error) {
      console.error('Index kaydetme hatası:', error);
      return false;
    }
  }

  async loadFromDisk() {
    try {
      // Dosyaların varlığını kontrol et
      await fs.access(this.indexPath);
      await fs.access(this.mappingPath);
      
      // Index'i yükle
      this.index = new hnswlib.HierarchicalNSW('l2', this.indexDim);
      this.index.readIndex(this.indexPath, this.maxElements);
      
      // Mapping'leri yükle
      const mappingData = JSON.parse(
        await fs.readFile(this.mappingPath, 'utf8')
      );
      
      this.idMapping = new Map(mappingData.idMapping);
      this.reverseMapping = new Map(mappingData.reverseMapping);
      this.nextId = mappingData.nextId;
      
      console.log('💾 Index diskten yüklendi');
      return true;
    } catch (error) {
      console.log('Index diskten yüklenemedi, yeni oluşturulacak');
      return false;
    }
  }

  getStats() {
    return {
      initialized: this.isInitialized,
      totalImages: this.idMapping.size,
      indexDimension: this.indexDim,
      maxCapacity: this.maxElements,
      utilizationPercent: Math.round((this.idMapping.size / this.maxElements) * 100)
    };
  }
}

// Singleton instance
const vectorIndex = new VectorIndex();

// Auto-initialize on first use
(async () => {
  try {
    await vectorIndex.initialize();
  } catch (error) {
    console.error('Vector index auto-init hatası:', error);
  }
})();

module.exports = vectorIndex; 

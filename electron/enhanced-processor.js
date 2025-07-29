const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs').promises;

class EnhancedImageProcessor {
  constructor() {
    this.supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tga'];
  }

  // Gelişmiş görsel parmak izi oluştur
  async createFingerprint(imagePath) {
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      // Temel bilgiler
      const stats = await fs.stat(imagePath);
      const fileHash = await this.calculateFileHash(imagePath);
      
      // Çoklu hash hesaplama
      const [colorHash, structureHash, edgeHash] = await Promise.all([
        this.calculateColorHash(image),
        this.calculateStructureHash(image),
        this.calculateEdgeHash(image)
      ]);
      
      // Thumbnail oluştur
      const thumbnail = await this.createThumbnail(image);
      
      // Benzersiz parmak izi
      const fingerprint = this.generateFingerprint({
        colorHash,
        structureHash,
        edgeHash,
        fileHash,
        metadata
      });
      
      return {
        path: imagePath,
        name: metadata.format,
        width: metadata.width,
        height: metadata.height,
        size: stats.size,
        modified: stats.mtime,
        hashes: {
          color: colorHash,
          structure: structureHash,
          edge: edgeHash,
          file: fileHash,
          fingerprint
        },
        metadata: {
          format: metadata.format,
          channels: metadata.channels,
          depth: metadata.depth,
          density: metadata.density,
          orientation: metadata.orientation,
          hasProfile: metadata.hasProfile,
          hasAlpha: metadata.hasAlpha
        },
        thumbnail: thumbnail.toString('base64'),
        averageColor: await this.calculateAverageColor(image)
      };
      
    } catch (error) {
      console.error(`❌ Görsel işleme hatası (${imagePath}):`, error.message);
      throw error;
    }
  }

  // Renk hash'i hesapla
  async calculateColorHash(image) {
    try {
      // 8x8 boyutuna küçült
      const resized = await image
        .resize(8, 8, { fit: 'fill' })
        .raw()
        .toBuffer();
      
      // Ortalama renk değerini hesapla
      let total = 0;
      for (let i = 0; i < resized.length; i += 3) {
        total += (resized[i] + resized[i + 1] + resized[i + 2]) / 3;
      }
      const average = total / (resized.length / 3);
      
      // Hash oluştur
      let hash = '';
      for (let i = 0; i < resized.length; i += 3) {
        const pixel = (resized[i] + resized[i + 1] + resized[i + 2]) / 3;
        hash += pixel > average ? '1' : '0';
      }
      
      return hash;
    } catch (error) {
      console.error('❌ Renk hash hesaplama hatası:', error);
      return '0'.repeat(64);
    }
  }

  // Yapısal hash hesapla
  async calculateStructureHash(image) {
    try {
      // 16x16 boyutuna küçült
      const resized = await image
        .resize(16, 16, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer();
      
      // Gradient hesapla
      let hash = '';
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 15; x++) {
          const current = resized[y * 16 + x];
          const next = resized[y * 16 + x + 1];
          hash += current > next ? '1' : '0';
        }
      }
      
      return hash;
    } catch (error) {
      console.error('❌ Yapısal hash hesaplama hatası:', error);
      return '0'.repeat(240);
    }
  }

  // Kenar hash hesapla
  async calculateEdgeHash(image) {
    try {
      // 32x32 boyutuna küçült
      const resized = await image
        .resize(32, 32, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer();
      
      // Kenar tespiti (basit gradient)
      let hash = '';
      for (let y = 1; y < 31; y++) {
        for (let x = 1; x < 31; x++) {
          const current = resized[y * 32 + x];
          const left = resized[y * 32 + x - 1];
          const right = resized[y * 32 + x + 1];
          const top = resized[(y - 1) * 32 + x];
          const bottom = resized[(y + 1) * 32 + x];
          
          const gradient = Math.abs(current - left) + Math.abs(current - right) + 
                          Math.abs(current - top) + Math.abs(current - bottom);
          
          hash += gradient > 30 ? '1' : '0';
        }
      }
      
      return hash;
    } catch (error) {
      console.error('❌ Kenar hash hesaplama hatası:', error);
      return '0'.repeat(900);
    }
  }

  // Dosya hash'i hesapla
  async calculateFileHash(imagePath) {
    try {
      const buffer = await fs.readFile(imagePath);
      return crypto.createHash('md5').update(buffer).digest('hex');
    } catch (error) {
      console.error('❌ Dosya hash hesaplama hatası:', error);
      return '';
    }
  }

  // Ortalama renk hesapla
  async calculateAverageColor(image) {
    try {
      const resized = await image
        .resize(1, 1, { fit: 'fill' })
        .raw()
        .toBuffer();
      
      return {
        r: resized[0],
        g: resized[1],
        b: resized[2]
      };
    } catch (error) {
      console.error('❌ Ortalama renk hesaplama hatası:', error);
      return { r: 0, g: 0, b: 0 };
    }
  }

  // Thumbnail oluştur
  async createThumbnail(image) {
    try {
      return await image
        .resize(150, 150, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (error) {
      console.error('❌ Thumbnail oluşturma hatası:', error);
      // Boş thumbnail
      return Buffer.from('');
    }
  }

  // Benzersiz parmak izi oluştur
  generateFingerprint(data) {
    const combined = `${data.colorHash}-${data.structureHash}-${data.edgeHash}-${data.fileHash}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  // Hamming mesafesi hesapla
  calculateHammingDistance(hash1, hash2) {
    if (hash1.length !== hash2.length) {
      return Math.max(hash1.length, hash2.length);
    }
    
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }
    return distance;
  }

  // Benzerlik skoru hesapla
  calculateSimilarity(image1, image2) {
    try {
      const weights = {
        color: 0.4,      // Renk ağırlığı
        structure: 0.3,  // Yapı ağırlığı
        edge: 0.2,       // Kenar ağırlığı
        file: 0.1        // Dosya ağırlığı
      };
      
      let totalScore = 0;
      let totalWeight = 0;
      
      // Renk benzerliği
      if (image1.hashes.color && image2.hashes.color) {
        const colorDistance = this.calculateHammingDistance(
          image1.hashes.color, 
          image2.hashes.color
        );
        const colorSimilarity = 1 - (colorDistance / image1.hashes.color.length);
        totalScore += colorSimilarity * weights.color;
        totalWeight += weights.color;
      }
      
      // Yapı benzerliği
      if (image1.hashes.structure && image2.hashes.structure) {
        const structureDistance = this.calculateHammingDistance(
          image1.hashes.structure, 
          image2.hashes.structure
        );
        const structureSimilarity = 1 - (structureDistance / image1.hashes.structure.length);
        totalScore += structureSimilarity * weights.structure;
        totalWeight += weights.structure;
      }
      
      // Kenar benzerliği
      if (image1.hashes.edge && image2.hashes.edge) {
        const edgeDistance = this.calculateHammingDistance(
          image1.hashes.edge, 
          image2.hashes.edge
        );
        const edgeSimilarity = 1 - (edgeDistance / image1.hashes.edge.length);
        totalScore += edgeSimilarity * weights.edge;
        totalWeight += weights.edge;
      }
      
      // Dosya benzerliği (aynı dosya mı?)
      if (image1.hashes.file && image2.hashes.file) {
        const fileSimilarity = image1.hashes.file === image2.hashes.file ? 1 : 0;
        totalScore += fileSimilarity * weights.file;
        totalWeight += weights.file;
      }
      
      return totalWeight > 0 ? totalScore / totalWeight : 0;
      
    } catch (error) {
      console.error('❌ Benzerlik hesaplama hatası:', error);
      return 0;
    }
  }

  // Toplu işleme
  async processBatch(images, progressCallback) {
    const results = [];
    const total = images.length;
    
    for (let i = 0; i < total; i++) {
      try {
        const result = await this.createFingerprint(images[i].path);
        results.push(result);
        
        if (progressCallback) {
          progressCallback({
            current: i + 1,
            total,
            message: `İşleniyor: ${images[i].name}`,
            result
          });
        }
      } catch (error) {
        console.error(`❌ Görsel işleme hatası (${images[i].path}):`, error.message);
        // Hatalı dosyayı atla
        continue;
      }
    }
    
    return results;
  }
}

module.exports = EnhancedImageProcessor; 
const sharp = require('sharp');
const { hash } = require('imghash');
const path = require('path');
const fs = require('fs').promises;

class SimpleImageProcessor {
  constructor() {
    this.supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
  }

  async processImage(imagePath) {
    try {
      console.log(`🔄 İşleniyor: ${path.basename(imagePath)}`);
      
      const stats = await fs.stat(imagePath);
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      // Format kontrolü
      const ext = path.extname(imagePath).toLowerCase();
      if (!this.supportedFormats.includes(ext)) {
        console.warn(`⚠️ Desteklenmeyen format: ${ext}`);
        return null;
      }
      
      // Basit hash hesaplama
      const phash = await hash(imagePath, 8, 'hex');
      const dhash = await this.calculateDHash(imagePath);
      
      // Ortalama renk
      const { dominant } = await image.stats();
      const avgColor = `rgb(${dominant.r},${dominant.g},${dominant.b})`;
      
      // Thumbnail oluştur
      const thumbnail = await this.createThumbnailSmall(imagePath, 150);
      
      const result = {
        filepath: imagePath,
        filename: path.basename(imagePath),
        filesize: stats.size,
        width: metadata.width,
        height: metadata.height,
        phash,
        dhash,
        avgColor,
        thumbnail // Thumbnail eklendi
      };
      
      console.log(`✅ İşlendi: ${result.filename} (${result.width}x${result.height}) - Thumbnail: ${thumbnail ? 'Başarılı' : 'Başarısız'}`);
      return result;
      
    } catch (error) {
      console.error(`❌ İşleme hatası ${path.basename(imagePath)}:`, error.message);
      return null;
    }
  }

  async calculateDHash(imagePath) {
    try {
      const data = await sharp(imagePath)
        .resize(9, 8, { fit: 'fill' })
        .greyscale()
        .raw()
        .toBuffer();
      
      let hash = '';
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const left = data[y * 9 + x];
          const right = data[y * 9 + x + 1];
          hash += left > right ? '1' : '0';
        }
      }
      
      return parseInt(hash, 2).toString(16).padStart(16, '0');
    } catch (error) {
      console.warn('⚠️ DHash hesaplama hatası:', error.message);
      return null;
    }
  }

  async createThumbnail(imagePath, size = 200) {
    try {
      const thumbnail = await sharp(imagePath)
        .resize(size, size, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      return `data:image/jpeg;base64,${thumbnail.toString('base64')}`;
    } catch (error) {
      console.warn('⚠️ Thumbnail oluşturma hatası:', error.message);
      return null;
    }
  }

  async createThumbnailSmall(imagePath, size = 150) {
    try {
      const thumbnail = await sharp(imagePath)
        .resize(size, size, { fit: 'cover' })
        .jpeg({ quality: 70 })
        .toBuffer();
      
      return `data:image/jpeg;base64,${thumbnail.toString('base64')}`;
    } catch (error) {
      console.warn('⚠️ Küçük thumbnail oluşturma hatası:', error.message);
      return null;
    }
  }

  isSupportedFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedFormats.includes(ext);
  }

  getSupportedFormats() {
    return this.supportedFormats;
  }
}

module.exports = new SimpleImageProcessor(); 
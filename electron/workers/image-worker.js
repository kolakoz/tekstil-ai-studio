const { parentPort, workerData } = require('worker_threads');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Worker ID'sini al
const workerId = workerData.workerId;

// Worker başlatma mesajı
console.log(`👷 Worker ${workerId} başlatıldı`);

// Ana thread'den mesajları dinle
parentPort.on('message', async (task) => {
  try {
    console.log(`🔄 Worker ${workerId} görev alıyor:`, task.type);
    
    let result;
    
    switch (task.type) {
      case 'processImage':
        result = await processImage(task.data);
        break;
        
      case 'generateThumbnail':
        result = await generateThumbnail(task.data);
        break;
        
      case 'extractMetadata':
        result = await extractMetadata(task.data);
        break;
        
      case 'calculateHash':
        result = await calculateHash(task.data);
        break;
        
      default:
        throw new Error(`Bilinmeyen görev türü: ${task.type}`);
    }
    
    // Sonucu ana thread'e gönder
    parentPort.postMessage({
      success: true,
      workerId,
      taskType: task.type,
      result
    });
    
  } catch (error) {
    console.error(`❌ Worker ${workerId} hatası:`, error);
    
    // Hatayı ana thread'e gönder
    parentPort.postMessage({
      success: false,
      workerId,
      taskType: task.type,
      error: error.message
    });
  }
});

// Görsel işleme
async function processImage(data) {
  const { imagePath, options = {} } = data;
  
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    // Thumbnail oluştur
    const thumbnail = await image
      .resize(225, 225, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    // Renk histogramı hesapla
    const { data: pixels } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const histogram = calculateColorHistogram(pixels.data, metadata.channels);
    
    return {
      thumbnail: thumbnail.toString('base64'),
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
        channels: metadata.channels
      },
      histogram,
      processedAt: new Date().toISOString()
    };
    
  } catch (error) {
    throw new Error(`Görsel işleme hatası: ${error.message}`);
  }
}

// Thumbnail oluşturma
async function generateThumbnail(data) {
  const { imagePath, width = 225, height = 225, quality = 80 } = data;
  
  try {
    const thumbnail = await sharp(imagePath)
      .resize(width, height, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality })
      .toBuffer();
    
    return {
      thumbnail: thumbnail.toString('base64'),
      dimensions: { width, height },
      size: thumbnail.length
    };
    
  } catch (error) {
    throw new Error(`Thumbnail oluşturma hatası: ${error.message}`);
  }
}

// Metadata çıkarma
async function extractMetadata(data) {
  const { imagePath } = data;
  
  try {
    const metadata = await sharp(imagePath).metadata();
    
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size,
      channels: metadata.channels,
      hasAlpha: metadata.hasAlpha,
      isOpaque: metadata.isOpaque,
      density: metadata.density,
      orientation: metadata.orientation
    };
    
  } catch (error) {
    throw new Error(`Metadata çıkarma hatası: ${error.message}`);
  }
}

// Hash hesaplama
async function calculateHash(data) {
  const { imagePath, method = 'phash' } = data;
  
  try {
    // Basit hash hesaplama (gerçek uygulamada daha gelişmiş algoritmalar kullanılır)
    const image = sharp(imagePath);
    const { data: pixels } = await image
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    let hash = '';
    let average = 0;
    
    // Ortalama değeri hesapla
    for (let i = 0; i < pixels.data.length; i++) {
      average += pixels.data[i];
    }
    average /= pixels.data.length;
    
    // Hash oluştur
    for (let i = 0; i < pixels.data.length; i++) {
      hash += pixels.data[i] > average ? '1' : '0';
    }
    
    return {
      hash,
      method,
      length: hash.length,
      average
    };
    
  } catch (error) {
    throw new Error(`Hash hesaplama hatası: ${error.message}`);
  }
}

// Renk histogramı hesaplama
function calculateColorHistogram(pixelData, channels) {
  const histogram = new Array(256).fill(0);
  
  for (let i = 0; i < pixelData.length; i += channels) {
    const r = pixelData[i];
    const g = pixelData[i + 1];
    const b = pixelData[i + 2];
    
    // Gri ton hesapla
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    histogram[gray]++;
  }
  
  // Normalize et
  const total = histogram.reduce((sum, count) => sum + count, 0);
  return histogram.map(count => count / total);
}

// Worker çıkış işlemi
process.on('exit', (code) => {
  console.log(`🔚 Worker ${workerId} çıkıyor (kod: ${code})`);
});

// Hata yakalama
process.on('uncaughtException', (error) => {
  console.error(`💥 Worker ${workerId} yakalanmamış hata:`, error);
  parentPort.postMessage({
    success: false,
    workerId,
    error: error.message
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`💥 Worker ${workerId} yakalanmamış promise reddi:`, reason);
  parentPort.postMessage({
    success: false,
    workerId,
    error: reason.message || 'Promise reddi'
  });
}); 
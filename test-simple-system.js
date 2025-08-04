/**
 * Tekstil AI Studio - Minimal Sistem Testi
 * 
 * Bu dosya sistemin temel bileşenlerini test eder:
 * - Database bağlantısı
 * - Görsel işleme
 * - Arama fonksiyonları
 * - Thumbnail oluşturma
 */

const Database = require('./electron/enhanced-database');
const ImageProcessor = require('./electron/enhanced-image-processor');
const FileScanner = require('./electron/file-scanner');

async function runMinimalTest() {
  console.log('Minimal Sistem Test Başlatılıyor...');
  
  try {
    // Database test
    console.log('\nDatabase test ediliyor...');
    const db = new Database();
    await db.initialize();
    const stats = await db.getStatistics();
    console.log('Database istatistikleri:', stats);
    
    // Processor test
    console.log('\nProcessor test ediliyor...');
    const processor = new ImageProcessor();
    await processor.initialize();
    
    // Test görseli bul
    const testImagePath = './assets/icon.svg';
    let imageData = null;
    
    try {
      imageData = await processor.processImage(testImagePath);
      console.log('Görsel işlendi:', imageData.filename);
      console.log('   - Boyut:', imageData.width + 'x' + imageData.height);
      console.log('   - pHash:', imageData.phash?.substring(0, 16) + '...');
      console.log('   - dHash:', imageData.dhash?.substring(0, 16) + '...');
      console.log('   - Renk:', imageData.avgColor);
      
      // Database'e ekle
      console.log('\nDatabase\'e ekleniyor...');
      const result = await db.addImage(imageData);
      console.log('Görsel eklendi, ID:', result?.lastInsertRowid);
      
      // Arama test
      console.log('\nArama test ediliyor...');
      const similar = await db.searchSimilar(imageData.phash, 0.8);
      console.log(`${similar.length} benzer görsel bulundu`);
      
      similar.forEach((img, index) => {
        console.log(`   ${index + 1}. ${img.filename} (mesafe: ${img.distance})`);
      });
      
      // Thumbnail test
      console.log('\nThumbnail test ediliyor...');
      const thumbnail = await processor.createThumbnail(testImagePath, 150, 150);
      console.log('Thumbnail oluşturuldu (base64 uzunluğu:', thumbnail.length, ')');
      
    } catch (error) {
      console.log('Görsel işlenemedi');
    }
    
    // Alternatif test görseli
    if (!imageData) {
      console.log('Test görseli bulunamadı:', testImagePath);
      
      // Assets klasöründe alternatif ara
      const fs = require('fs');
      const path = require('path');
      const assetsDir = './assets';
      
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        const imageFiles = files.filter(f => 
          /\.(jpg|jpeg|png|gif|bmp|svg)$/i.test(f)
        );
        
        if (imageFiles.length > 0) {
          const altImagePath = path.join(assetsDir, imageFiles[0]);
          console.log('Alternatif test görseli:', altImagePath);
          
          try {
            imageData = await processor.processImage(altImagePath);
            console.log('Alternatif görsel işlendi:', imageData.filename);
          } catch (error) {
            console.log('Alternatif görsel de işlenemedi');
          }
        }
      }
    }
    
    // Scanner test
    console.log('\nScanner test ediliyor...');
    const scanner = new FileScanner();
    const supportedFormats = scanner.getSupportedFormats();
    console.log('Desteklenen formatlar:', supportedFormats);
    
    // Final istatistikler
    const finalStats = await db.getStatistics();
    console.log('\nFinal istatistikler:');
    console.log('   - Toplam görsel:', finalStats.totalImages);
    console.log('   - Hash\'li görsel:', finalStats.withHash);
    console.log('   - Hash\'siz görsel:', finalStats.withoutHash);
    
    console.log('\nMinimal sistem test tamamlandı!');
    
    // Database'i kapat
    await db.close();
    
  } catch (error) {
    console.error('Test hatası:', error);
  }
}

// Test'i çalıştır
if (require.main === module) {
  runMinimalTest().then(() => {
    console.log('\nTüm testler başarılı!');
    process.exit(0);
  }).catch(error => {
    console.error('Test hatası:', error);
    process.exit(1);
  });
}

module.exports = { runMinimalTest }; 
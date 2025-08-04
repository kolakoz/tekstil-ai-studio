/**
 * Tekstil AI Studio - Hızlı Arama Testi
 * 
 * Bu dosya hızlı arama fonksiyonlarını test eder:
 * - Vector index arama
 * - Hibrid arama (metin + görsel)
 * - Performans testleri
 */

const Database = require('./electron/enhanced-database');
const ImageProcessor = require('./electron/enhanced-image-processor');
const VectorIndex = require('./electron/vector-index');

async function runFastSearchTest() {
  console.log('Hızlı Arama Test Başlatılıyor...');
  
  try {
    // Database başlat
    const db = new Database();
    await db.initialize();
    console.log('Database başlatıldı');
    
    // Vector index başlat
    const vectorIndex = new VectorIndex();
    await vectorIndex.initialize();
    
    // Test görseli bul
    const testImagePath = './assets/icon.svg';
    console.log('Test görseli:', testImagePath);
    
    let imageData = null;
    
    try {
      const processor = new ImageProcessor();
      await processor.initialize();
      
      imageData = await processor.processImage(testImagePath);
      console.log('Görsel işlendi, embedding boyutu:', imageData.embedding.length);
      
      // Hibrid arama test
      console.log('Hibrid arama test ediliyor...');
      const results = await vectorIndex.hybridSearch({
        text: 'tekstil',
        imageEmbedding: imageData.embedding,
        limit: 10
      });
      
      console.log('Arama sonuçları:');
      console.log(`- Toplam sonuç: ${results.length}`);
      
      if (results.length > 0) {
        results.slice(0, 5).forEach((result, index) => {
          console.log(`${index + 1}. ${result.filename}: %${result.similarity} benzerlik`);
        });
      } else {
        console.log('Benzer görsel bulunamadı');
      }
      
      // Vector index istatistikleri
      const stats = await vectorIndex.getStatistics();
      console.log('Vector Index İstatistikleri:', stats);
      
    } catch (error) {
      console.log('Test görseli bulunamadı, alternatif arıyor...');
      
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
            const processor = new ImageProcessor();
            await processor.initialize();
            
            imageData = await processor.processImage(altImagePath);
            console.log('Görsel işlendi, embedding boyutu:', imageData.embedding.length);
            
            // Hibrid arama test
            console.log('Hibrid arama test ediliyor...');
            const results = await vectorIndex.hybridSearch({
              text: 'tekstil',
              imageEmbedding: imageData.embedding,
              limit: 10
            });
            
            console.log('Arama sonuçları:');
            console.log(`- Toplam sonuç: ${results.length}`);
            
            if (results.length > 0) {
              results.slice(0, 5).forEach((result, index) => {
                console.log(`${index + 1}. ${result.filename}: %${result.similarity} benzerlik`);
              });
            } else {
              console.log('Benzer görsel bulunamadı');
            }
            
            // Vector index istatistikleri
            const stats = await vectorIndex.getStatistics();
            console.log('Vector Index İstatistikleri:', stats);
            
          } catch (error) {
            console.log('Alternatif görsel de işlenemedi');
          }
        } else {
          console.log('Assets klasöründe test görseli bulunamadı');
        }
      } else {
        console.log('Assets klasörü bulunamadı');
      }
    }
    
    // Database'i kapat
    await db.close();
    
  } catch (error) {
    console.error('Test hatası:', error);
  }
}

// Test'i çalıştır
if (require.main === module) {
  runFastSearchTest().then(() => {
    console.log('Test tamamlandı');
    process.exit(0);
  }).catch(error => {
    console.error('Test hatası:', error);
    process.exit(1);
  });
}

module.exports = { runFastSearchTest }; 
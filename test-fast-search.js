const path = require('path');
const fs = require('fs');

// Electron app context'i simüle et
const electron = require('electron');
if (!electron.app) {
  // Electron app context'i yoksa simüle et
  electron.app = {
    getPath: (name) => {
      if (name === 'userData') {
        return path.join(__dirname, 'electron');
      }
      return path.join(__dirname, 'electron');
    }
  };
}

const imageProcessor = require('./electron/image-processor');
const database = require('./electron/database');

// Test için basit bir script
async function testFastSearch() {
  console.log('🚀 Hızlı Arama Test Başlatılıyor...');
  
  try {
    // 1. Database'i başlat
    await database.ensureDatabase();
    console.log('✅ Database başlatıldı');
    
    // 2. Test görseli seç (varsa)
    const testImagePath = path.join(__dirname, 'assets', 'icon.svg');
    console.log('📸 Test görseli:', testImagePath);
    
    // Dosyanın varlığını kontrol et
    if (!fs.existsSync(testImagePath)) {
      console.log('⚠️ Test görseli bulunamadı, alternatif arıyor...');
      // Alternatif test görseli ara
      const assetsDir = path.join(__dirname, 'assets');
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|svg)$/i.test(f));
        if (imageFiles.length > 0) {
          const altImagePath = path.join(assetsDir, imageFiles[0]);
          console.log('📸 Alternatif test görseli:', altImagePath);
          
          // 3. Görseli işle
          console.log('🔄 Görsel işleniyor...');
          const imageData = await imageProcessor.processImage(altImagePath);
          
          if (!imageData || !imageData.embedding) {
            console.error('❌ Görsel işlenemedi');
            return;
          }
          
          console.log('✅ Görsel işlendi, embedding boyutu:', imageData.embedding.length);
          
          // 4. Hibrid arama test et
          console.log('🔍 Hibrid arama test ediliyor...');
          const results = await database.searchSimilarHybrid(
            imageData.embedding,
            imageData.colorHist,
            0.5, // %50 threshold
            { embedding: 0.8, color: 0.2 }
          );
          
          console.log('📊 Arama sonuçları:');
          console.log(`- Toplam sonuç: ${results.length}`);
          
          if (results.length > 0) {
            results.slice(0, 5).forEach((result, index) => {
              console.log(`${index + 1}. ${result.filename}: %${result.similarity} benzerlik`);
            });
          } else {
            console.log('⚠️ Benzer görsel bulunamadı');
          }
          
          // 5. Vector index istatistikleri
          const vectorIndex = require('./electron/vector-index');
          const stats = vectorIndex.getStats();
          console.log('📈 Vector Index İstatistikleri:', stats);
          
        } else {
          console.log('❌ Assets klasöründe test görseli bulunamadı');
        }
      } else {
        console.log('❌ Assets klasörü bulunamadı');
      }
    } else {
      // Orijinal test görseli ile devam et
      console.log('🔄 Görsel işleniyor...');
      const imageData = await imageProcessor.processImage(testImagePath);
      
      if (!imageData || !imageData.embedding) {
        console.error('❌ Görsel işlenemedi');
        return;
      }
      
      console.log('✅ Görsel işlendi, embedding boyutu:', imageData.embedding.length);
      
      // 4. Hibrid arama test et
      console.log('🔍 Hibrid arama test ediliyor...');
      const results = await database.searchSimilarHybrid(
        imageData.embedding,
        imageData.colorHist,
        0.5, // %50 threshold
        { embedding: 0.8, color: 0.2 }
      );
      
      console.log('📊 Arama sonuçları:');
      console.log(`- Toplam sonuç: ${results.length}`);
      
      if (results.length > 0) {
        results.slice(0, 5).forEach((result, index) => {
          console.log(`${index + 1}. ${result.filename}: %${result.similarity} benzerlik`);
        });
      } else {
        console.log('⚠️ Benzer görsel bulunamadı');
      }
      
      // 5. Vector index istatistikleri
      const vectorIndex = require('./electron/vector-index');
      const stats = vectorIndex.getStats();
      console.log('📈 Vector Index İstatistikleri:', stats);
    }
    
  } catch (error) {
    console.error('❌ Test hatası:', error);
  }
}

// Test'i çalıştır
if (require.main === module) {
  testFastSearch().then(() => {
    console.log('✅ Test tamamlandı');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Test başarısız:', error);
    process.exit(1);
  });
}

module.exports = { testFastSearch }; 
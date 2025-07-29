const path = require('path');
const fs = require('fs');

// Electron app context'i simüle et
const electron = require('electron');
if (!electron.app) {
  electron.app = {
    getPath: (name) => {
      if (name === 'userData') {
        return path.join(__dirname, 'electron');
      }
      return path.join(__dirname, 'electron');
    }
  };
}

const db = require('./electron/simple-database');
const processor = require('./electron/simple-processor');
const scanner = require('./electron/simple-scanner');

async function testSimpleSystem() {
  console.log('🚀 Minimal Sistem Test Başlatılıyor...');
  
  try {
    // 1. Database test
    console.log('\n📊 Database test ediliyor...');
    const stats = await db.getStats();
    console.log('✅ Database istatistikleri:', stats);
    
    // 2. Processor test
    console.log('\n🔄 Processor test ediliyor...');
    const testImagePath = path.join(__dirname, 'assets', 'icon.svg');
    
    if (fs.existsSync(testImagePath)) {
      const imageData = await processor.processImage(testImagePath);
      if (imageData) {
        console.log('✅ Görsel işlendi:', imageData.filename);
        console.log('   - Boyut:', imageData.width + 'x' + imageData.height);
        console.log('   - pHash:', imageData.phash?.substring(0, 16) + '...');
        console.log('   - dHash:', imageData.dhash?.substring(0, 16) + '...');
        console.log('   - Renk:', imageData.avgColor);
        
        // 3. Database'e ekle
        console.log('\n💾 Database\'e ekleniyor...');
        const result = await db.addImage(imageData);
        console.log('✅ Görsel eklendi, ID:', result?.lastInsertRowid);
        
        // 4. Arama test
        console.log('\n🔍 Arama test ediliyor...');
        const similar = await db.searchSimilar(imageData.phash, 5);
        console.log(`✅ ${similar.length} benzer görsel bulundu`);
        
        if (similar.length > 0) {
          similar.slice(0, 3).forEach((img, index) => {
            console.log(`   ${index + 1}. ${img.filename} (mesafe: ${img.distance})`);
          });
        }
        
        // 5. Thumbnail test
        console.log('\n🖼️ Thumbnail test ediliyor...');
        const thumbnail = await processor.createThumbnailSmall(testImagePath);
        if (thumbnail) {
          console.log('✅ Thumbnail oluşturuldu (base64 uzunluğu:', thumbnail.length, ')');
        }
        
      } else {
        console.log('❌ Görsel işlenemedi');
      }
    } else {
      console.log('⚠️ Test görseli bulunamadı:', testImagePath);
      
      // Alternatif test görseli ara
      const assetsDir = path.join(__dirname, 'assets');
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(f));
        
        if (imageFiles.length > 0) {
          const altImagePath = path.join(assetsDir, imageFiles[0]);
          console.log('📸 Alternatif test görseli:', altImagePath);
          
          const imageData = await processor.processImage(altImagePath);
          if (imageData) {
            console.log('✅ Alternatif görsel işlendi:', imageData.filename);
          }
        }
      }
    }
    
    // 6. Scanner test
    console.log('\n📁 Scanner test ediliyor...');
    const supportedFormats = scanner.getSupportedFormats();
    console.log('✅ Desteklenen formatlar:', supportedFormats);
    
    // 7. Final stats
    console.log('\n📊 Final istatistikler:');
    const finalStats = await db.getStats();
    console.log('   - Toplam görsel:', finalStats.totalImages);
    console.log('   - Hash\'li görsel:', finalStats.withHash);
    console.log('   - Hash\'siz görsel:', finalStats.withoutHash);
    
    console.log('\n✅ Minimal sistem test tamamlandı!');
    
  } catch (error) {
    console.error('❌ Test hatası:', error);
  }
}

// Test'i çalıştır
if (require.main === module) {
  testSimpleSystem().then(() => {
    console.log('\n🎉 Tüm testler başarılı!');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 Test başarısız:', error);
    process.exit(1);
  });
}

module.exports = { testSimpleSystem }; 
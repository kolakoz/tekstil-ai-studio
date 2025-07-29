const path = require('path');
const Database = require('./electron/simple-database');

async function debugDatabase() {
  console.log('🔍 Veritabanı debug başlatılıyor...');
  
  const dbPath = path.join(process.env.APPDATA || process.env.HOME, 'Tekstil AI Studio (Offline Edition)', 'images.db');
  console.log('📁 Veritabanı yolu:', dbPath);
  
  try {
    const db = new Database();
    
    console.log('✅ Veritabanı bağlantısı başarılı');
    
    // Toplam görsel sayısı
    const totalCount = await db.getImageCount();
    console.log(`📊 Toplam görsel sayısı: ${totalCount}`);
    
    if (totalCount > 0) {
      // İlk 5 görseli getir
      const images = await db.getImages(1, 5);
      console.log('📸 İlk 5 görsel:');
      images.images.forEach((img, i) => {
        console.log(`  ${i + 1}. ${img.filename} - ${img.filepath}`);
      });
    } else {
      console.log('⚠️ Veritabanında görsel yok!');
    }
    
    await db.close();
    
  } catch (error) {
    console.error('❌ Veritabanı hatası:', error);
  }
}

debugDatabase(); 
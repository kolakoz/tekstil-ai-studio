const path = require('path');
const EnhancedDatabase = require('./electron/enhanced-database');

async function debugEnhancedDatabase() {
  console.log('🔍 Enhanced Database debug başlatılıyor...');
  
  try {
    const db = EnhancedDatabase;
    
    console.log('✅ Enhanced Database bağlantısı başarılı');
    
    // İstatistikleri getir
    const stats = await db.getStatistics();
    console.log(`📊 İstatistikler:`, stats);
    
    if (stats.total_images > 0) {
      console.log(`✅ Enhanced Database'de ${stats.total_images} görsel var`);
    } else {
      console.log('⚠️ Enhanced Database\'de görsel yok!');
    }
    
    await db.close();
    
  } catch (error) {
    console.error('❌ Enhanced Database hatası:', error);
  }
}

debugEnhancedDatabase(); 
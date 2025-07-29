const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Veritabanı yolunu belirle
const dbPath = path.join(process.env.APPDATA || process.env.HOME, 'Tekstil AI Studio (Offline Edition)', 'tekstil-images.db');
console.log('Veritabanı yolu:', dbPath);

try {
  const db = new Database(dbPath);
  
  // Tüm kayıtları al
  const allImages = db.prepare('SELECT id, filepath FROM images').all();
  console.log(`Toplam ${allImages.length} kayıt bulundu`);
  
  let fixedCount = 0;
  let deletedCount = 0;
  
  for (const img of allImages) {
    const originalPath = img.filepath;
    
    // Boşluk karakterini düzelt
    const fixedPath = originalPath.replace(/Akay Adem/g, 'AkayAdem');
    
    if (originalPath !== fixedPath) {
      console.log(`\nDüzeltme ${img.id}:`);
      console.log(`  Eski: ${originalPath}`);
      console.log(`  Yeni: ${fixedPath}`);
      
      // Yeni yolun var olup olmadığını kontrol et
      if (fs.existsSync(fixedPath)) {
        // Dosya varsa yolu güncelle
        db.prepare('UPDATE images SET filepath = ? WHERE id = ?').run(fixedPath, img.id);
        console.log(`  ✅ Güncellendi`);
        fixedCount++;
      } else {
        // Dosya yoksa kaydı sil
        db.prepare('DELETE FROM images WHERE id = ?').run(img.id);
        console.log(`  ❌ Dosya bulunamadı, kayıt silindi`);
        deletedCount++;
      }
    }
  }
  
  console.log(`\n=== SONUÇ ===`);
  console.log(`Düzeltilen kayıt: ${fixedCount}`);
  console.log(`Silinen kayıt: ${deletedCount}`);
  console.log(`Kalan kayıt: ${db.prepare('SELECT COUNT(*) as count FROM images').get().count}`);
  
  db.close();
  
} catch (error) {
  console.error('Hata:', error.message);
} 
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Veritabanı yolunu belirle
const dbPath = path.join(process.env.APPDATA || process.env.HOME, 'Tekstil AI Studio (Offline Edition)', 'tekstil-images.db');

console.log('Veritabanı yolu:', dbPath);

// Veritabanını aç
const db = new Database(dbPath);

try {
  console.log('Veritabanı bağlantısı başarılı ✓');
  
  // Tüm görselleri al
  const images = db.prepare('SELECT id, filename, filepath FROM images').all();
  console.log(`Toplam ${images.length} görsel bulundu`);
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const image of images) {
    try {
      const originalPath = image.filepath;
      
      // Dosya yolunu normalize et
      const normalizedPath = path.resolve(originalPath);
      
      // Dosyanın varlığını kontrol et
      if (fs.existsSync(normalizedPath)) {
        // Dosya mevcut, yolu güncelle
        if (normalizedPath !== originalPath) {
          db.prepare('UPDATE images SET filepath = ? WHERE id = ?').run(normalizedPath, image.id);
          console.log(`✓ Düzeltildi: ${image.filename}`);
          console.log(`  Eski: ${originalPath}`);
          console.log(`  Yeni: ${normalizedPath}`);
          fixedCount++;
        }
      } else {
        // Dosya bulunamadı, alternatif yolları dene
        const alternativePaths = [
          originalPath.replace(/\\/g, '/'),
          originalPath.replace(/\s+/g, ' '),
          path.normalize(originalPath),
          originalPath.replace(/Akay Adem/g, 'AkayAdem'), // Kullanıcı adı düzeltmesi
        ];
        
        let found = false;
        for (const altPath of alternativePaths) {
          const altNormalized = path.resolve(altPath);
          if (fs.existsSync(altNormalized)) {
            db.prepare('UPDATE images SET filepath = ? WHERE id = ?').run(altNormalized, image.id);
            console.log(`✓ Alternatif yol bulundu: ${image.filename}`);
            console.log(`  Eski: ${originalPath}`);
            console.log(`  Yeni: ${altNormalized}`);
            fixedCount++;
            found = true;
            break;
          }
        }
        
        if (!found) {
          console.log(`✗ Dosya bulunamadı: ${image.filename}`);
          console.log(`  Yol: ${originalPath}`);
          errorCount++;
        }
      }
    } catch (error) {
      console.error(`Hata (${image.filename}):`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n=== ÖZET ===');
  console.log(`Toplam görsel: ${images.length}`);
  console.log(`Düzeltilen: ${fixedCount}`);
  console.log(`Hata: ${errorCount}`);
  
  // Değişiklikleri kaydet
  db.close();
  console.log('Veritabanı kapatıldı ✓');
  
} catch (error) {
  console.error('Veritabanı hatası:', error.message);
  process.exit(1);
} 
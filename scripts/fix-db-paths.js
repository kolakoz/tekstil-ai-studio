const path = require('path');
const fs = require('fs');

// Veritabanı yolunu belirle
const dbPath = path.join(process.env.APPDATA || process.env.HOME, 'Tekstil AI Studio (Offline Edition)', 'tekstil-images.db');

console.log('Veritabanı yolu:', dbPath);

// SQLite3'ü dinamik olarak yükle
let Database;
try {
  Database = require('better-sqlite3');
} catch (error) {
  console.error('better-sqlite3 yüklenemedi:', error.message);
  console.log('Alternatif yöntem deneniyor...');
  
  // Basit dosya yolu düzeltme
  const fixPathsInFile = () => {
    console.log('Dosya yolu düzeltme işlemi başlatılıyor...');
    
    // Kullanıcı adı düzeltmesi
    const userPathFix = 'Akay Adem';
    const userPathCorrect = 'AkayAdem';
    
    console.log(`Kullanıcı yolu düzeltmesi: "${userPathFix}" -> "${userPathCorrect}"`);
    
    // Veritabanı dosyasının varlığını kontrol et
    if (fs.existsSync(dbPath)) {
      console.log('Veritabanı dosyası bulundu ✓');
      
      // Veritabanı dosyasını yedekle
      const backupPath = dbPath + '.backup';
      fs.copyFileSync(dbPath, backupPath);
      console.log('Veritabanı yedeklendi:', backupPath);
      
      // SQLite3'ü tekrar dene
      try {
        Database = require('better-sqlite3');
        const db = new Database(dbPath);
        
        // Tüm görselleri al
        const images = db.prepare('SELECT id, filename, filepath FROM images').all();
        console.log(`Toplam ${images.length} görsel bulundu`);
        
        let fixedCount = 0;
        let errorCount = 0;
        
        for (const image of images) {
          try {
            const originalPath = image.filepath;
            
            // Kullanıcı adı düzeltmesi
            let correctedPath = originalPath.replace(new RegExp(userPathFix, 'g'), userPathCorrect);
            
            // Dosya yolunu normalize et
            const normalizedPath = path.resolve(correctedPath);
            
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
              console.log(`✗ Dosya bulunamadı: ${image.filename}`);
              console.log(`  Yol: ${normalizedPath}`);
              errorCount++;
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
        
      } catch (dbError) {
        console.error('Veritabanı işlemi başarısız:', dbError.message);
        console.log('Yedek dosyadan geri yükleniyor...');
        fs.copyFileSync(backupPath, dbPath);
        console.log('Veritabanı geri yüklendi');
      }
    } else {
      console.log('Veritabanı dosyası bulunamadı');
    }
  };
  
  fixPathsInFile();
  return;
}

// Normal akış
try {
  console.log('Veritabanı bağlantısı başarılı ✓');
  
  // Tüm görselleri al
  const db = new Database(dbPath);
  const images = db.prepare('SELECT id, filename, filepath FROM images').all();
  console.log(`Toplam ${images.length} görsel bulundu`);
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const image of images) {
    try {
      const originalPath = image.filepath;
      
      // Kullanıcı adı düzeltmesi
      let correctedPath = originalPath.replace(/Akay Adem/g, 'AkayAdem');
      
      // Dosya yolunu normalize et
      const normalizedPath = path.resolve(correctedPath);
      
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
        console.log(`✗ Dosya bulunamadı: ${image.filename}`);
        console.log(`  Yol: ${normalizedPath}`);
        errorCount++;
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
const path = require('path');
const fs = require('fs');

console.log('=== VERİTABANI DEBUG BAŞLADI ===');

// Veritabanı yolunu belirle
const dbPath = path.join(process.env.APPDATA || process.env.HOME, 'Tekstil AI Studio (Offline Edition)', 'tekstil-images.db');

console.log('APPDATA:', process.env.APPDATA);
console.log('HOME:', process.env.HOME);
console.log('Veritabanı yolu:', dbPath);

// Veritabanı dosyasının varlığını kontrol et
if (fs.existsSync(dbPath)) {
  console.log('✓ Veritabanı dosyası mevcut');
  
  const stats = fs.statSync(dbPath);
  console.log('Dosya boyutu:', stats.size, 'bytes');
  console.log('Son değişiklik:', stats.mtime);
  
  // Dosyanın ilk birkaç satırını oku
  try {
    const content = fs.readFileSync(dbPath, 'utf8').substring(0, 200);
    console.log('Dosya içeriği (ilk 200 karakter):', content);
  } catch (error) {
    console.log('Dosya okunamadı (binary):', error.message);
  }
  
} else {
  console.log('✗ Veritabanı dosyası bulunamadı');
  
  // Klasörü kontrol et
  const dbDir = path.dirname(dbPath);
  console.log('Veritabanı klasörü:', dbDir);
  
  if (fs.existsSync(dbDir)) {
    console.log('✓ Klasör mevcut');
    const files = fs.readdirSync(dbDir);
    console.log('Klasördeki dosyalar:', files);
  } else {
    console.log('✗ Klasör bulunamadı');
  }
}

// Native modül durumunu kontrol et
console.log('\n=== NATIVE MODÜL DURUMU ===');

try {
  console.log('better-sqlite3 yüklenmeye çalışılıyor...');
  const Database = require('better-sqlite3');
  console.log('✓ better-sqlite3 başarıyla yüklendi');
  
  // Veritabanını açmayı dene
  try {
    const db = new Database(dbPath);
    console.log('✓ Veritabanı bağlantısı başarılı');
    
    // Tablo listesini al
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tablolar:', tables.map(t => t.name));
    
    // Images tablosunu kontrol et
    if (tables.some(t => t.name === 'images')) {
      const imageCount = db.prepare('SELECT COUNT(*) as count FROM images').get();
      console.log('Toplam görsel sayısı:', imageCount.count);
      
      // İlk birkaç kaydı al
      const sampleImages = db.prepare('SELECT id, filename, filepath FROM images LIMIT 3').all();
      console.log('Örnek kayıtlar:');
      sampleImages.forEach((img, i) => {
        console.log(`${i + 1}. ID: ${img.id}, Dosya: ${img.filename}`);
        console.log(`   Yol: ${img.filepath}`);
        console.log(`   Mevcut: ${fs.existsSync(img.filepath) ? '✓' : '✗'}`);
      });
    }
    
    db.close();
    console.log('Veritabanı kapatıldı');
    
  } catch (dbError) {
    console.error('Veritabanı açma hatası:', dbError.message);
  }
  
} catch (error) {
  console.error('✗ better-sqlite3 yüklenemedi:', error.message);
  console.error('Hata detayı:', error);
}

console.log('\n=== DEBUG TAMAMLANDI ==='); 
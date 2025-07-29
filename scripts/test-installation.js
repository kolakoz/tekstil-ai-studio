const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Tekstil AI Studio Kurulum Testi');
console.log('==================================');

// Test adımları
const tests = [
  {
    name: 'Node.js Versiyon Kontrolü',
    test: () => {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
      
      if (majorVersion < 18 || majorVersion >= 21) {
        throw new Error(`Node.js versiyonu uygun değil. Gerekli: 18.x-20.x, Mevcut: ${nodeVersion}`);
      }
      
      return `✅ Node.js ${nodeVersion} (Uygun)`;
    }
  },
  {
    name: 'npm Versiyon Kontrolü',
    test: () => {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      return `✅ npm ${npmVersion}`;
    }
  },
  {
    name: 'Bağımlılık Kontrolü',
    test: () => {
      if (!fs.existsSync('node_modules')) {
        throw new Error('node_modules bulunamadı. Önce npm install çalıştırın.');
      }
      
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const requiredDeps = ['electron', 'react', 'better-sqlite3', 'onnxruntime-node'];
      
      for (const dep of requiredDeps) {
        if (!packageJson.dependencies[dep] && !packageJson.devDependencies[dep]) {
          throw new Error(`Gerekli bağımlılık eksik: ${dep}`);
        }
      }
      
      return '✅ Tüm bağımlılıklar mevcut';
    }
  },
  {
    name: 'ONNX Model Kontrolü',
    test: () => {
      const modelPath = path.join('electron', 'models', 'mobilenetv2.onnx');
      if (!fs.existsSync(modelPath)) {
        throw new Error('ONNX modeli bulunamadı. npm run dl-model çalıştırın.');
      }
      
      const stats = fs.statSync(modelPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      if (stats.size < 1000000) { // 1MB'dan küçükse
        throw new Error(`ONNX modeli çok küçük (${sizeMB}MB). Yeniden indirin.`);
      }
      
      return `✅ ONNX Model (${sizeMB}MB)`;
    }
  },
  {
    name: 'Electron Kontrolü',
    test: () => {
      try {
        const electronVersion = execSync('npx electron --version', { encoding: 'utf8' }).trim();
        return `✅ Electron ${electronVersion}`;
      } catch (error) {
        throw new Error('Electron çalıştırılamadı. electron-rebuild gerekli.');
      }
    }
  },
  {
    name: 'Build Kontrolü',
    test: () => {
      if (!fs.existsSync('dist')) {
        throw new Error('dist klasörü bulunamadı. npm run build çalıştırın.');
      }
      
      const distFiles = fs.readdirSync('dist');
      if (distFiles.length === 0) {
        throw new Error('dist klasörü boş. Build başarısız.');
      }
      
      return `✅ Build dosyaları (${distFiles.length} dosya)`;
    }
  },
  {
    name: 'Veritabanı Kontrolü',
    test: () => {
      try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(process.env.APPDATA || process.env.HOME, 'Tekstil AI Studio (Offline Edition)', 'tekstil-images.db');
        
        if (fs.existsSync(dbPath)) {
          const db = new Database(dbPath);
          const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
          db.close();
          
          return `✅ Veritabanı (${tables.length} tablo)`;
        } else {
          return '✅ Veritabanı (İlk çalıştırmada oluşturulacak)';
        }
      } catch (error) {
        throw new Error(`Veritabanı hatası: ${error.message}`);
      }
    }
  }
];

// Test işlemi
async function runTests() {
  let passed = 0;
  let failed = 0;
  
  console.log('\n🔍 Testler başlatılıyor...\n');
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`${i + 1}/${tests.length} ${test.name}...`);
    
    try {
      const result = await test.test();
      console.log(`  ${result}\n`);
      passed++;
    } catch (error) {
      console.log(`  ❌ ${error.message}\n`);
      failed++;
    }
  }
  
  // Sonuç raporu
  console.log('📊 Test Sonuçları');
  console.log('==================');
  console.log(`✅ Başarılı: ${passed}`);
  console.log(`❌ Başarısız: ${failed}`);
  console.log(`📈 Başarı Oranı: ${((passed / tests.length) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 Tüm testler başarılı! Uygulama kullanıma hazır.');
    console.log('\n🚀 Uygulamayı başlatmak için: npm run dev-win');
  } else {
    console.log('\n⚠️  Bazı testler başarısız. Lütfen sorunları çözün.');
    console.log('\n🔧 Önerilen çözümler:');
    console.log('1. npm run install');
    console.log('2. npm run electron-rebuild');
    console.log('3. npm run dl-model');
  }
  
  return failed === 0;
}

// Ana işlem
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runTests }; 
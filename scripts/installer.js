const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Tekstil AI Studio Kurulum Sistemi');
console.log('=====================================');

// Kurulum adımları
const steps = [
  {
    name: 'Bağımlılıkları kontrol et',
    command: () => {
      console.log('📦 Node.js ve npm versiyonları kontrol ediliyor...');
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      console.log(`✅ Node.js: ${nodeVersion}`);
      console.log(`✅ npm: ${npmVersion}`);
      
      // Node.js versiyon kontrolü
      const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
      if (majorVersion < 18 || majorVersion >= 21) {
        throw new Error(`Node.js versiyonu uygun değil. Gerekli: 18.x-20.x, Mevcut: ${nodeVersion}`);
      }
    }
  },
  {
    name: 'Bağımlılıkları yükle',
    command: () => {
      console.log('📦 Bağımlılıklar yükleniyor...');
      execSync('npm install', { stdio: 'inherit' });
    }
  },
  {
    name: 'ONNX modelini indir',
    command: () => {
      console.log('🤖 ONNX modeli indiriliyor...');
      execSync('npm run dl-model', { stdio: 'inherit' });
    }
  },
  {
    name: 'Native modülleri yeniden derle',
    command: () => {
      console.log('🔧 Native modüller derleniyor...');
      execSync('npm run electron-rebuild', { stdio: 'inherit' });
    }
  },
  {
    name: 'Uygulamayı test et',
    command: () => {
      console.log('🧪 Uygulama test ediliyor...');
      console.log('⚠️  Test modunda başlatılıyor (Ctrl+C ile durdurun)');
      execSync('npm run dev-win', { stdio: 'inherit' });
    }
  }
];

// Kurulum işlemi
async function install() {
  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`\n${i + 1}/${steps.length} ${step.name}...`);
      
      try {
        await step.command();
        console.log(`✅ ${step.name} tamamlandı`);
      } catch (error) {
        console.error(`❌ ${step.name} başarısız:`, error.message);
        throw error;
      }
    }
    
    console.log('\n🎉 Kurulum başarıyla tamamlandı!');
    console.log('\n📋 Sonraki adımlar:');
    console.log('1. Uygulamayı başlatmak için: npm run dev-win');
    console.log('2. Dağıtım paketi oluşturmak için: npm run dist-win');
    console.log('3. Portable sürüm için: npm run dist-portable');
    
  } catch (error) {
    console.error('\n💥 Kurulum başarısız:', error.message);
    process.exit(1);
  }
}

// Kaldırma işlemi
function uninstall() {
  console.log('🗑️  Tekstil AI Studio Kaldırma');
  console.log('==============================');
  
  const dirsToRemove = [
    'node_modules',
    'dist',
    'build'
  ];
  
  const filesToRemove = [
    'package-lock.json',
    'automation.log',
    'debug-test.js',
    'fix-filepaths.js'
  ];
  
  console.log('📁 Kaldırılacak dizinler:');
  dirsToRemove.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`  - ${dir}`);
    }
  });
  
  console.log('📄 Kaldırılacak dosyalar:');
  filesToRemove.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`  - ${file}`);
    }
  });
  
  console.log('\n⚠️  Bu işlem geri alınamaz!');
  console.log('Devam etmek için: npm run uninstall -- --force');
}

// Ana işlem
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'install':
    install();
    break;
  case 'uninstall':
    uninstall();
    break;
  default:
    console.log('Kullanım:');
    console.log('  npm run installer install    - Kurulum');
    console.log('  npm run installer uninstall  - Kaldırma');
    break;
} 
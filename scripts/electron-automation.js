// electron-automation.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ElectronBackgroundAgent {
  constructor() {
    this.processes = new Map();
    this.logFile = 'automation.log';
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(logEntry.trim());
    fs.appendFileSync(this.logFile, logEntry);
  }

  // 1. Paketleme işlemini başlat
  startBuild() {
    this.log('🚀 Build işlemi başlatılıyor...');
    
    const buildProcess = spawn('npm', ['run', 'build'], {
      stdio: 'pipe'
    });

    buildProcess.stdout.on('data', (data) => {
      this.log(`BUILD: ${data.toString()}`);
    });

    buildProcess.stderr.on('data', (data) => {
      this.log(`BUILD ERROR: ${data.toString()}`);
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        this.log('✅ Build başarıyla tamamlandı');
        this.checkBuildOutput();
      } else {
        this.log(`❌ Build hata ile tamamlandı (kod: ${code})`);
      }
    });

    this.processes.set('build', buildProcess);
  }

  // 2. Build çıktısını kontrol et
  checkBuildOutput() {
    this.log('🔍 Build çıktısı kontrol ediliyor...');
    
    const distPath = 'dist';
    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(distPath);
      this.log(`📁 Dist klasöründe ${files.length} dosya bulundu`);
      
      files.forEach(file => {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);
        this.log(`  - ${file}: ${(stats.size / 1024).toFixed(2)} KB`);
      });
    } else {
      this.log('❌ Dist klasörü bulunamadı!');
    }
  }

  // 3. Elektron uygulamasını test et
  testElectronApp() {
    this.log('🧪 Electron uygulaması test ediliyor...');
    
    const testProcess = spawn('npm', ['run', 'electron'], {
      stdio: 'pipe'
    });

    // 10 saniye sonra kapat
    setTimeout(() => {
      testProcess.kill();
      this.log('✅ Electron test tamamlandı');
    }, 10000);

    this.processes.set('test', testProcess);
  }

  // 4. Dosya sistemi testleri
  runFileSystemTests() {
    this.log('📂 Dosya sistemi testleri başlatılıyor...');
    
    const requiredFiles = [
      'package.json',
      'main.js',
      'renderer.js',
      'index.html'
    ];

    const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
    
    if (missingFiles.length === 0) {
      this.log('✅ Tüm gerekli dosyalar mevcut');
    } else {
      this.log(`❌ Eksik dosyalar: ${missingFiles.join(', ')}`);
    }

    // Dosya boyutlarını kontrol et
    requiredFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        this.log(`  ${file}: ${stats.size} bytes`);
      }
    });
  }

  // 5. Sürekli monitoring başlat
  startMonitoring() {
    this.log('👀 Sürekli monitoring başlatılıyor...');
    
    setInterval(() => {
      this.runFileSystemTests();
      this.checkMemoryUsage();
    }, 30000); // 30 saniyede bir
  }

  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    this.log(`💾 Memory: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  }

  // 6. Tam otomasyonu başlat
  runFullAutomation() {
    this.log('🎬 Tam otomasyon başlatılıyor...');
    
    // Sıralı işlemler
    this.startBuild();
    
    setTimeout(() => {
      this.testElectronApp();
    }, 5000);
    
    setTimeout(() => {
      this.startMonitoring();
    }, 15000);
  }

  // Tüm işlemleri durdur
  stopAll() {
    this.log('⏹️ Tüm işlemler durduruluyor...');
    
    this.processes.forEach((process, name) => {
      process.kill();
      this.log(`Stopped: ${name}`);
    });
    
    this.processes.clear();
  }
}

// Kullanım
const agent = new ElectronBackgroundAgent();

// Komut satırı argümanlarına göre çalıştır
const command = process.argv[2];

switch (command) {
  case 'build':
    agent.startBuild();
    break;
  case 'test':
    agent.testElectronApp();
    break;
  case 'monitor':
    agent.startMonitoring();
    break;
  case 'full':
    agent.runFullAutomation();
    break;
  default:
    console.log('Kullanım: node electron-automation.js [build|test|monitor|full]');
}

// Graceful shutdown
process.on('SIGINT', () => {
  agent.stopAll();
  process.exit();
});
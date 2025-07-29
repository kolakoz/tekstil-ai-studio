// Uygulama Test Dosyası
// Bu dosya uygulamanın temel işlevlerini test etmek için kullanılır

console.log('🧪 Tekstil AI Studio Test Sistemi Başlatılıyor...');

// Test fonksiyonları
const testFunctions = {
  // Electron API testi
  testElectronAPI: () => {
    console.log('\n🔌 Electron API Testi');
    
    if (window.electronAPI) {
      console.log('✅ Electron API mevcut');
      
      // Ping testi
      window.electronAPI.ping().then(response => {
        console.log('✅ Ping başarılı:', response);
      }).catch(error => {
        console.log('❌ Ping hatası:', error);
      });
      
      // Config testi
      window.electronAPI.getConfig().then(config => {
        console.log('✅ Config alındı:', config ? 'Mevcut' : 'Boş');
      }).catch(error => {
        console.log('❌ Config hatası:', error);
      });
      
    } else {
      console.log('❌ Electron API bulunamadı');
    }
  },

  // Performans testi
  testPerformance: () => {
    console.log('\n⚡ Performans Testi');
    
    if (window.performanceTester) {
      console.log('✅ Performans test sistemi mevcut');
      console.log('Test başlatılıyor...');
      window.performanceTester.runTest();
    } else {
      console.log('❌ Performans test sistemi bulunamadı');
    }
  },

  // Arama testi
  testSearch: () => {
    console.log('\n🔍 Arama Testi');
    
    if (window.tekstilTest) {
      console.log('✅ Arama test sistemi mevcut');
      console.log('Komutlar:');
      console.log('- window.tekstilTest.status() - Sistem durumu');
      console.log('- window.tekstilTest.quickSearch() - Hızlı arama');
      console.log('- window.tekstilTest.runFullTest() - Tam test');
    } else {
      console.log('❌ Arama test sistemi bulunamadı');
    }
  },

  // UI testi
  testUI: () => {
    console.log('\n🎨 UI Testi');
    
    // DOM elementlerini kontrol et
    const elements = {
      'App Header': document.querySelector('.app-header'),
      'Control Panel': document.querySelector('.control-panel'),
      'Search Options': document.querySelector('.search-options-compact'),
      'Image Uploader': document.querySelector('.image-uploader'),
      'Search Results': document.querySelector('.search-results')
    };
    
    Object.entries(elements).forEach(([name, element]) => {
      if (element) {
        console.log(`✅ ${name}: Mevcut`);
      } else {
        console.log(`❌ ${name}: Bulunamadı`);
      }
    });
  },

  // Responsive testi
  testResponsive: () => {
    console.log('\n📱 Responsive Testi');
    
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    console.log(`✅ Viewport: ${viewport.width}x${viewport.height}`);
    
    // Farklı ekran boyutları için test
    const testSizes = [
      { name: 'Mobil', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1920, height: 1080 }
    ];
    
    testSizes.forEach(size => {
      const isCurrent = viewport.width <= size.width;
      console.log(`${isCurrent ? '📱' : '💻'} ${size.name}: ${size.width}x${size.height}`);
    });
  },

  // Tüm testleri çalıştır
  runAllTests: () => {
    console.log('\n🚀 TÜM TESTLER BAŞLATILIYOR');
    console.log('='.repeat(50));
    
    testFunctions.testElectronAPI();
    setTimeout(() => testFunctions.testPerformance(), 1000);
    setTimeout(() => testFunctions.testSearch(), 2000);
    setTimeout(() => testFunctions.testUI(), 3000);
    setTimeout(() => testFunctions.testResponsive(), 4000);
    
    setTimeout(() => {
      console.log('\n' + '='.repeat(50));
      console.log('✅ TÜM TESTLER TAMAMLANDI');
      console.log('='.repeat(50));
    }, 5000);
  }
};

// Global olarak erişilebilir yap
window.appTester = testFunctions;

console.log('✅ Test sistemi hazır!');
console.log('Kullanım:');
console.log('- window.appTester.testElectronAPI() - API testi');
console.log('- window.appTester.testPerformance() - Performans testi');
console.log('- window.appTester.testSearch() - Arama testi');
console.log('- window.appTester.testUI() - UI testi');
console.log('- window.appTester.testResponsive() - Responsive testi');
console.log('- window.appTester.runAllTests() - Tüm testler');

// Otomatik test başlatma (opsiyonel)
if (window.location.search.includes('autotest=true')) {
  console.log('🔄 Otomatik test başlatılıyor...');
  setTimeout(() => testFunctions.runAllTests(), 2000);
} 
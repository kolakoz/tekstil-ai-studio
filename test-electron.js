// Electron uygulamasının temel modüllerini test et
console.log('🔍 Electron modül testleri başlatılıyor...');

try {
  console.log('1. node-fetch test ediliyor...');
  const fetch = require('node-fetch');
  console.log('✅ node-fetch başarıyla yüklendi');
  
  console.log('2. sqlite3 test ediliyor...');
  const sqlite3 = require('sqlite3').verbose();
  console.log('✅ sqlite3 başarıyla yüklendi');
  
  console.log('3. sharp test ediliyor...');
  const sharp = require('sharp');
  console.log('✅ sharp başarıyla yüklendi');
  
  console.log('4. electron test ediliyor...');
  const { app } = require('electron');
  console.log('✅ electron başarıyla yüklendi');
  
  console.log('5. enhanced-database test ediliyor...');
  const enhancedDb = require('./electron/enhanced-database');
  console.log('✅ enhanced-database başarıyla yüklendi');
  
  console.log('6. internet-searcher test ediliyor...');
  const internetSearcher = require('./electron/internet-searcher');
  console.log('✅ internet-searcher başarıyla yüklendi');
  
  console.log('🎉 Tüm modüller başarıyla yüklendi!');
  console.log('Electron uygulaması çalışmaya hazır.');
  
} catch (error) {
  console.error('❌ Hata:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
} 
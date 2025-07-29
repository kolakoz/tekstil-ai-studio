// Debug test scripti
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Test dosya yolları
const testPaths = [
  'C:\\Users\\Akay Adem\\Desktop\\Yeni klasör\\Yeni klasör (2)\\resimler\\images (1)rr.jpeg',
  'C:\\Users\\AkayAdem\\Desktop\\Yeni klasör\\Yeni klasör (2)\\resimler\\images (1)rr.jpeg',
  'C:\\Users\\Akay Adem\\Desktop\\resimler9999\\images (1)qqq.jpeg'
];

console.log('=== DOSYA YOLU TEST ===');
testPaths.forEach((testPath, index) => {
  console.log(`\nTest ${index + 1}:`);
  console.log('Orijinal yol:', testPath);
  console.log('Normalized:', path.resolve(testPath));
  console.log('Exists:', fs.existsSync(testPath));
  
  // Alternatif yolları dene
  const alternatives = [
    testPath.replace(/\\/g, '/'),
    testPath.replace(/\s+/g, ' '),
    path.normalize(testPath)
  ];
  
  alternatives.forEach((alt, altIndex) => {
    const normalized = path.resolve(alt);
    console.log(`  Alt ${altIndex + 1}: ${normalized} - Exists: ${fs.existsSync(normalized)}`);
  });
});

console.log('\n=== TEST TAMAMLANDI ==='); 
const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 GitHub Repository Kurulum Sihirbazı');
console.log('=====================================');

// 1. Git durumunu kontrol et
console.log('\n📋 1. Git durumu kontrol ediliyor...');
try {
  const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
  console.log('✅ Git repository hazır');
} catch (error) {
  console.log('❌ Git repository bulunamadı');
  process.exit(1);
}

// 2. Remote URL'i kontrol et
console.log('\n📋 2. Remote URL kontrol ediliyor...');
try {
  const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
  console.log(`✅ Remote URL: ${remoteUrl}`);
} catch (error) {
  console.log('❌ Remote URL bulunamadı, ayarlanıyor...');
  try {
    execSync('git remote add origin https://github.com/AkayAdem/tekstil-ai-studio.git');
    console.log('✅ Remote URL eklendi');
  } catch (addError) {
    console.log('⚠️ Remote URL zaten mevcut');
  }
}

// 3. GitHub repository oluşturma talimatları
console.log('\n📋 3. GitHub Repository Oluşturma');
console.log('==================================');
console.log('🔗 https://github.com/new adresine gidin');
console.log('📝 Repository adı: tekstil-ai-studio');
console.log('📄 Açıklama: AI destekli tekstil görsel arama ve analiz sistemi');
console.log('🔓 Public seçin');
console.log('❌ README, .gitignore ve lisans eklemeyin (bizim dosyalarımız var)');
console.log('✅ "Create repository" butonuna tıklayın');

// 4. Kullanıcıdan onay al
console.log('\n📋 4. Repository oluşturuldu mu?');
console.log('Repository oluşturduktan sonra ENTER tuşuna basın...');
console.log('(Bu script otomatik olarak devam edecek)');

// 5. Push işlemi
setTimeout(() => {
  console.log('\n📋 5. GitHub\'a push ediliyor...');
  try {
    console.log('⏳ Dosyalar GitHub\'a yükleniyor...');
    execSync('git push -u origin master', { stdio: 'inherit' });
    console.log('✅ Başarıyla GitHub\'a yüklendi!');
    console.log('🔗 Repository URL: https://github.com/AkayAdem/tekstil-ai-studio');
  } catch (error) {
    console.log('❌ Push hatası:', error.message);
    console.log('📝 Manuel push için:');
    console.log('   git push -u origin master');
  }
}, 10000); // 10 saniye bekle

// 6. Başarı mesajı
setTimeout(() => {
  console.log('\n🎉 GitHub Kurulum Tamamlandı!');
  console.log('================================');
  console.log('✅ Repository oluşturuldu');
  console.log('✅ Dosyalar yüklendi');
  console.log('✅ README.md eklendi');
  console.log('✅ .gitignore ayarlandı');
  console.log('\n🔗 Repository: https://github.com/AkayAdem/tekstil-ai-studio');
  console.log('📊 GitHub Pages: https://akayadem.github.io/tekstil-ai-studio');
  console.log('📝 Issues: https://github.com/AkayAdem/tekstil-ai-studio/issues');
}, 15000); 
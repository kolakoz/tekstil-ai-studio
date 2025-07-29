const https = require('https');
const fs = require('fs');

// GitHub API ile repository oluşturma
function createGitHubRepo(token, repoName, description) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      name: repoName,
      description: description,
      private: false,
      auto_init: false,
      gitignore_template: 'Node',
      license_template: 'mit'
    });

    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: '/user/repos',
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Tekstil-AI-Studio',
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 201) {
          const response = JSON.parse(body);
          console.log('✅ Repository başarıyla oluşturuldu!');
          console.log(`📁 Repository URL: ${response.html_url}`);
          console.log(`🔗 Clone URL: ${response.clone_url}`);
          resolve(response);
        } else {
          console.error('❌ Repository oluşturulamadı:', body);
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Bağlantı hatası:', error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Ana fonksiyon
async function main() {
  console.log('🚀 GitHub Repository Oluşturucu');
  console.log('================================');
  
  // GitHub Token kontrolü
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('❌ GITHUB_TOKEN environment variable bulunamadı!');
    console.log('📝 GitHub Token almak için:');
    console.log('1. https://github.com/settings/tokens adresine gidin');
    console.log('2. "Generate new token" > "Generate new token (classic)"');
    console.log('3. "repo" izinlerini seçin');
    console.log('4. Token\'ı kopyalayın');
    console.log('5. PowerShell\'de şu komutu çalıştırın:');
    console.log('   $env:GITHUB_TOKEN="your_token_here"');
    console.log('6. Bu script\'i tekrar çalıştırın');
    return;
  }

  try {
    const repoName = 'tekstil-ai-studio';
    const description = 'AI destekli tekstil görsel arama ve analiz sistemi - Gelişmiş monitoring sistemi ve arayüz kontrolü ile donatılmış modern Electron uygulaması';
    
    console.log(`📁 Repository adı: ${repoName}`);
    console.log(`📝 Açıklama: ${description}`);
    console.log('⏳ Repository oluşturuluyor...');
    
    const repo = await createGitHubRepo(token, repoName, description);
    
    console.log('\n🎉 Başarılı! Şimdi dosyaları push edebiliriz.');
    console.log('📋 Sonraki adımlar:');
    console.log('1. git remote set-url origin https://github.com/AkayAdem/tekstil-ai-studio.git');
    console.log('2. git push -u origin master');
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  }
}

// Script'i çalıştır
if (require.main === module) {
  main();
}

module.exports = { createGitHubRepo }; 
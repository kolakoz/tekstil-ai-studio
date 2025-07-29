#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

class CustomerPackageCreator {
    constructor() {
        this.packageName = 'Tekstil-AI-Studio-Customer-Package';
        this.version = '1.0.0';
        this.outputDir = 'customer-packages';
        this.productName = 'Tekstil AI Studio (Offline Edition)'; // Added for consistency with new_code
    }

    async createPackage() {
        console.log('📦 Müşteri Paketi Oluşturuluyor...');
        
        try {
            // 1. Çıktı dizinini oluştur
            this.createOutputDirectory();
            
            // 2. Uygulamayı derle
            await this.buildApplication();
            
            // 3. Kurulum dosyalarını hazırla
            this.prepareInstallationFiles();
            
            // 4. Müşteri paketini oluştur
            await this.createCustomerPackage();
            
            // 5. Kurulum talimatlarını oluştur
            this.createInstallationInstructions();
            
            console.log('✅ Müşteri paketi başarıyla oluşturuldu!');
            console.log(`📁 Paket konumu: ${path.resolve(this.outputDir)}`);
            
        } catch (error) {
            console.error('❌ Paket oluşturma hatası:', error.message);
            process.exit(1);
        }
    }

    // Çıktı dizinini oluştur
    createOutputDirectory() {
        console.log('📁 Çıktı dizini oluşturuluyor...');
        
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    // Uygulamayı derle
    async buildApplication() {
        console.log('🔨 Uygulama derleniyor...');
        
        try {
            // Webpack ile derle
            execSync('npm run build', { stdio: 'inherit' });
            
            // Electron builder ile paketle
            execSync('npm run dist-win', { stdio: 'inherit' });
            
        } catch (error) {
            throw new Error(`Derleme hatası: ${error.message}`);
        }
    }

    // Kurulum dosyalarını hazırla
    prepareInstallationFiles() {
        console.log('📋 Kurulum dosyaları hazırlanıyor...');
        
        const packageDir = path.join(this.outputDir, this.packageName);
        
        if (!fs.existsSync(packageDir)) {
            fs.mkdirSync(packageDir, { recursive: true });
        }
        
        // Kurulum dosyalarını kopyala
        const filesToCopy = [
            { src: `dist/${this.productName} Setup ${this.version}.exe`, dest: `${this.productName}-Setup.exe` },
            { src: 'LICENSE', dest: 'LICENSE.txt' }
        ];
        
        filesToCopy.forEach(({ src, dest }) => {
            const destPath = path.join(packageDir, dest);
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, destPath);
                console.log(`✅ ${dest} kopyalandı`);
            } else {
                console.warn(`⚠️  ${src} bulunamadı`);
            }
        });
        // Kaldırılan kısım: .bat dosyalarının oluşturulması
    }

    // Müşteri paketini oluştur
    async createCustomerPackage() {
        console.log('📦 Müşteri paketi sıkıştırılıyor...');
        
        const sourceDir = path.join('dist'); // Doğrudan dist klasörünü hedef al
        const zipPath = path.join(this.outputDir, `${this.packageName}-v${this.version}.zip`);
        
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Maksimum sıkıştırma
            });
            
            output.on('close', () => {
                console.log(`✅ Paket oluşturuldu: ${zipPath}`);
                console.log(`📊 Paket boyutu: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
                resolve();
            });
            
            archive.on('error', (err) => {
                reject(err);
            });
            
            archive.pipe(output);
            // Sadece .exe dosyasını ekle
            archive.file(path.join(sourceDir, `${this.productName} Setup ${this.version}.exe`), { name: `${this.productName}-Setup.exe` });
            archive.file('LICENSE', { name: 'LICENSE.txt' }); // LICENSE dosyasını da ekle
            archive.file('MUSTERI-README.md', { name: 'KURULUM-TALIMATLARI.md' }); // Güncellenmiş kurulum talimatlarını ekle

            archive.finalize();
        });
    }

    // Kurulum talimatlarını oluştur
    createInstallationInstructions() {
        console.log('📝 Kurulum talimatları oluşturuluyor...');
        
        const instructionsPath = path.join(this.outputDir, 'MUSTERI-KURULUM-TALIMATLARI.md');
        const instructions = `# Tekstil AI Studio (Offline Edition) - Müşteri Kurulum Talimatları

## 🚀 Hızlı Kurulum

### 1. Yükleyiciyi Çalıştırın
- ZIP dosyasından çıkarttığınız \`${this.productName}-Setup.exe\` dosyasını bulun.
- Dosyaya **çift tıklayarak** kurulumu başlatın.
- Kurulum sihirbazındaki adımları takip edin.

### 2. Yönetici Onayı (Gerekliyse)
- Kurulum sırasında Windows tarafından yönetici onayı istenirse, **"Evet"** veya **"Allow"** seçeneğini tıklayarak izni verin. Bu, uygulamanın doğru şekilde yüklenebilmesi için gereklidir.

### 3. Kurulumu Tamamlayın
- Kurulum sihirbazı tamamlandığında, uygulama otomatik olarak başlatılacaktır.
- Masaüstünüzde ve Başlangıç Menünüzde "Tekstil AI Studio" kısayolu oluşturulacaktır.

## 🗑️ Kaldırma

Tekstil AI Studio'yu kaldırmak için:

1.  Windows Başlat Menüsü'nden "Denetim Masası"nı açın.
2.  "Programlar" veya "Program Ekle/Kaldır" seçeneğine tıklayın.
3.  Listeden "Tekstil AI Studio"yu bulun ve sağ tıklayarak "Kaldır" seçeneğini seçin.
4.  Kaldırma sihirbazındaki adımları takip edin.

## 📞 Destek

Herhangi bir sorunla karşılaşırsanız veya yardıma ihtiyacınız olursa, lütfen bizimle iletişime geçmekten çekinmeyin.

---
**Tekstil AI Studio Takımı**
`;
        
        fs.writeFileSync(instructionsPath, instructions);
    }
}

// Script'i çalıştır
const creator = new CustomerPackageCreator();

if (require.main === module) {
    creator.createPackage().catch(console.error);
}

module.exports = CustomerPackageCreator; 
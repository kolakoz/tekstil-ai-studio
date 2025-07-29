#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SimpleCustomerPackageCreator {
    constructor() {
        this.packageName = 'Tekstil-AI-Studio-Customer-Package';
        this.version = '1.0.0';
        this.outputDir = 'customer-packages';
    }

    async createPackage() {
        console.log('📦 Müşteri Paketi Oluşturuluyor...');
        
        try {
            // 1. Çıktı dizinini oluştur
            this.createOutputDirectory();
            
            // 2. Kurulum dosyalarını hazırla
            this.prepareInstallationFiles();
            
            // 3. Kurulum talimatlarını oluştur
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

    // Kurulum dosyalarını hazırla
    prepareInstallationFiles() {
        console.log('📋 Kurulum dosyaları hazırlanıyor...');
        
        const packageDir = path.join(this.outputDir, this.packageName);
        
        if (!fs.existsSync(packageDir)) {
            fs.mkdirSync(packageDir, { recursive: true });
        }
        
        // Kurulum dosyalarını kopyala
        const filesToCopy = [
            { src: 'LICENSE', dest: 'LICENSE.txt' },
            { src: 'MUSTERI-README.md', dest: 'KURULUM-TALIMATLARI.md' }
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
        
        // Müşteri kurulum script'ini oluştur
        const customerInstallerPath = path.join(packageDir, 'Kurulum.bat');
        const customerInstallerContent = `@echo off
echo ========================================
echo    Tekstil AI Studio Kurulum Aracı
echo ========================================
echo.
echo Bu araç, Tekstil AI Studio uygulamasını
echo bilgisayarınıza kuracaktır.
echo.
echo Kurulum başlatılıyor...
echo.

REM Yönetici hakları kontrolü
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Yönetici hakları tespit edildi.
) else (
    echo Yönetici hakları gerekli!
    echo Lütfen bu dosyayı yönetici olarak çalıştırın.
    pause
    exit /b 1
)

REM Kurulum dosyasını çalıştır
if exist "Tekstil-AI-Studio-Setup.exe" (
    echo Kurulum dosyası bulundu, başlatılıyor...
    start /wait "Tekstil AI Studio Kurulum" "Tekstil-AI-Studio-Setup.exe"
    echo.
    echo Kurulum tamamlandı!
    echo Masaüstünde Tekstil AI Studio kısayolu oluşturuldu.
    echo.
) else (
    echo HATA: Kurulum dosyası bulunamadı!
    echo Lütfen tüm dosyaların aynı klasörde olduğundan emin olun.
    echo.
    echo Kurulum dosyasını manuel olarak çalıştırmak için:
    echo 1. Tekstil-AI-Studio-Setup.exe dosyasını bulun
    echo 2. Sağ tıklayın ve "Yönetici olarak çalıştır" seçin
)

echo Kurulum tamamlandı. Herhangi bir tuşa basın...
pause >nul
`;
        
        fs.writeFileSync(customerInstallerPath, customerInstallerContent);
        
        // Kaldırma script'ini oluştur
        const uninstallerPath = path.join(packageDir, 'Kaldır.bat');
        const uninstallerContent = `@echo off
echo ========================================
echo    Tekstil AI Studio Kaldırma Aracı
echo ========================================
echo.
echo Bu araç, Tekstil AI Studio uygulamasını
echo bilgisayarınızdan kaldıracaktır.
echo.
echo DİKKAT: Bu işlem geri alınamaz!
echo.

set /p confirm="Devam etmek istiyor musunuz? (E/H): "
if /i not "%confirm%"=="E" (
    echo İşlem iptal edildi.
    pause
    exit /b 0
)

echo.
echo Kaldırma başlatılıyor...

REM Uygulamayı durdur
taskkill /f /im "Tekstil AI Studio (Offline Edition).exe" >nul 2>&1

REM Kısayolları kaldır
if exist "%USERPROFILE%\\Desktop\\Tekstil AI Studio.lnk" (
    del "%USERPROFILE%\\Desktop\\Tekstil AI Studio.lnk"
    echo Masaüstü kısayolu kaldırıldı.
)

REM Başlangıç menüsü kısayollarını kaldır
if exist "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Tekstil AI Studio" (
    rmdir /s /q "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Tekstil AI Studio"
    echo Başlangıç menüsü kısayolları kaldırıldı.
)

REM Uygulama dosyalarını kaldır
if exist "C:\\Program Files\\Tekstil AI Studio" (
    rmdir /s /q "C:\\Program Files\\Tekstil AI Studio"
    echo Uygulama dosyaları kaldırıldı.
)

REM Kayıt defteri girdilerini kaldır
reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Tekstil AI Studio" /f >nul 2>&1

REM Kullanıcı verilerini kaldır (isteğe bağlı)
set /p deleteData="Kullanıcı verilerini de silmek istiyor musunuz? (Arama geçmişi, ayarlar vb.) (E/H): "
if /i "%deleteData%"=="E" (
    if exist "%APPDATA%\\Tekstil AI Studio (Offline Edition)" (
        rmdir /s /q "%APPDATA%\\Tekstil AI Studio (Offline Edition)"
        echo Kullanıcı verileri kaldırıldı.
    )
)

echo.
echo ✅ Tekstil AI Studio başarıyla kaldırıldı!
echo.
pause
`;
        
        fs.writeFileSync(uninstallerPath, uninstallerContent);
        
        // Manuel kurulum talimatları
        const manualInstructionsPath = path.join(packageDir, 'MANUEL-KURULUM.txt');
        const manualInstructions = `TEKSTİL AI STUDIO - MANUEL KURULUM TALİMATLARI
=====================================================

Eğer otomatik kurulum çalışmazsa, aşağıdaki adımları takip edin:

1. KURULUM:
   - Tekstil-AI-Studio-Setup.exe dosyasını bulun
   - Sağ tıklayın
   - "Yönetici olarak çalıştır" seçin
   - Kurulum sihirbazını takip edin

2. UYGULAMAYI BAŞLATMA:
   - Masaüstünde "Tekstil AI Studio" kısayoluna tıklayın
   - Veya Başlangıç menüsünden "Tekstil AI Studio" seçin

3. KALDIRMA:
   - Windows Ayarlar > Uygulamalar > Uygulamalar ve özellikler
   - "Tekstil AI Studio" bulun ve "Kaldır" tıklayın

SORUN GİDERME:
- Windows Defender'ı geçici kapatın
- Antivirüs yazılımını kontrol edin
- Yönetici hakları ile çalıştırdığınızdan emin olun

TEKNİK DESTEK:
Herhangi bir sorun yaşarsanız teknik destekle iletişime geçin.
`;
        
        fs.writeFileSync(manualInstructionsPath, manualInstructions);
        
        console.log('✅ Kurulum dosyaları hazırlandı');
    }

    // Kurulum talimatlarını oluştur
    createInstallationInstructions() {
        console.log('📝 Kurulum talimatları oluşturuluyor...');
        
        const instructionsPath = path.join(this.outputDir, 'MUSTERI-KURULUM-TALIMATLARI.md');
        const instructions = `# Tekstil AI Studio - Müşteri Kurulum Talimatları

## 🚀 Hızlı Kurulum

### 1. Paketi İndirin
- \`Tekstil-AI-Studio-Customer-Package\` klasörünü indirin
- Klasörü çıkartın

### 2. Kurulum Yapın
**Seçenek A: Otomatik Kurulum (Önerilen)**
- \`Kurulum.bat\` dosyasına **sağ tıklayın**
- **"Yönetici olarak çalıştır"** seçeneğini seçin
- Kurulum otomatik olarak tamamlanacaktır

**Seçenek B: Manuel Kurulum**
- \`Tekstil-AI-Studio-Setup.exe\` dosyasına **sağ tıklayın**
- **"Yönetici olarak çalıştır"** seçeneğini seçin
- Kurulum sihirbazını takip edin

### 3. Uygulamayı Başlatın
- Masaüstünde **"Tekstil AI Studio"** kısayoluna tıklayın
- Veya Başlangıç menüsünden **"Tekstil AI Studio"** seçin

## 🗑️ Kaldırma

### Otomatik Kaldırma
- \`Kaldır.bat\` dosyasına **sağ tıklayın**
- **"Yönetici olarak çalıştır"** seçeneğini seçin
- Onay verin ve kaldırma işlemi tamamlanacaktır

### Manuel Kaldırma
- Windows Ayarlar > Uygulamalar > Uygulamalar ve özellikler
- "Tekstil AI Studio" bulun ve "Kaldır" tıklayın

## 📋 Sistem Gereksinimleri

- **İşletim Sistemi:** Windows 10 veya üzeri (64-bit)
- **RAM:** En az 4 GB
- **Disk Alanı:** En az 500 MB boş alan
- **İnternet:** Kurulum için gerekli değil (tamamen offline)

## 🔧 Sorun Giderme

### Kurulum Hatası
- Windows Defender veya antivirüs yazılımını geçici olarak devre dışı bırakın
- Yönetici hakları ile çalıştırdığınızdan emin olun
- Windows güncellemelerini kontrol edin

### Uygulama Açılmıyor
- Bilgisayarı yeniden başlatın
- Windows Event Viewer'da hata mesajlarını kontrol edin
- Antivirüs yazılımının uygulamayı engellemediğinden emin olun

### Performans Sorunları
- Diğer uygulamaları kapatın
- Disk alanını kontrol edin
- RAM kullanımını kontrol edin

## 📞 Destek

Herhangi bir sorun yaşarsanız:
- Hata mesajlarını not edin
- Ekran görüntüsü alın
- Teknik destek ekibimizle iletişime geçin

## 📄 Lisans

Bu yazılım MIT lisansı altında dağıtılmaktadır.
Detaylar için \`LICENSE.txt\` dosyasını inceleyin.

---

**Tekstil AI Studio v1.0.0**
*Tamamen Offline Görsel Arama ve Font Tanıma Uygulaması*
`;
        
        fs.writeFileSync(instructionsPath, instructions);
        console.log(`✅ Kurulum talimatları oluşturuldu: ${instructionsPath}`);
    }
}

// Script'i çalıştır
const creator = new SimpleCustomerPackageCreator();

if (require.main === module) {
    creator.createPackage().catch(console.error);
}

module.exports = SimpleCustomerPackageCreator; 
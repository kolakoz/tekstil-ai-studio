#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

class CustomerInstaller {
    constructor() {
        this.appName = 'Tekstil AI Studio (Offline Edition)';
        this.appExe = 'Tekstil AI Studio (Offline Edition).exe';
        this.installDir = path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Tekstil AI Studio');
        this.userDataDir = path.join(process.env.APPDATA, 'Tekstil AI Studio (Offline Edition)');
        this.desktopShortcut = path.join(process.env.USERPROFILE, 'Desktop', 'Tekstil AI Studio.lnk');
        this.startMenuDir = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Tekstil AI Studio');
    }

    // Ana kurulum fonksiyonu
    async install() {
        console.log('🚀 Tekstil AI Studio Kurulum Başlatılıyor...');
        
        try {
            // 1. Gerekli dizinleri oluştur
            this.createDirectories();
            
            // 2. Uygulama dosyalarını kopyala
            this.copyApplicationFiles();
            
            // 3. Kısayolları oluştur
            this.createShortcuts();
            
            // 4. Kayıt defteri girdilerini ekle
            this.addRegistryEntries();
            
            // 5. Kaldırma bilgilerini yaz
            this.createUninstaller();
            
            console.log('✅ Kurulum başarıyla tamamlandı!');
            console.log(`📁 Kurulum dizini: ${this.installDir}`);
            console.log(`🖥️  Masaüstü kısayolu: ${this.desktopShortcut}`);
            
            // Kurulum sonrası uygulamayı başlat
            this.launchApplication();
            
        } catch (error) {
            console.error('❌ Kurulum hatası:', error.message);
            this.cleanup();
            process.exit(1);
        }
    }

    // Kaldırma fonksiyonu
    async uninstall() {
        console.log('🗑️  Tekstil AI Studio Kaldırılıyor...');
        
        try {
            // 1. Uygulamayı durdur
            this.stopApplication();
            
            // 2. Kısayolları kaldır
            this.removeShortcuts();
            
            // 3. Kayıt defteri girdilerini sil
            this.removeRegistryEntries();
            
            // 4. Uygulama dosyalarını sil
            this.removeApplicationFiles();
            
            // 5. Kullanıcı verilerini sil (isteğe bağlı)
            await this.removeUserData();
            
            console.log('✅ Kaldırma başarıyla tamamlandı!');
            
        } catch (error) {
            console.error('❌ Kaldırma hatası:', error.message);
            process.exit(1);
        }
    }

    // Dizinleri oluştur
    createDirectories() {
        console.log('📁 Dizinler oluşturuluyor...');
        
        const dirs = [
            this.installDir,
            this.startMenuDir,
            path.join(this.installDir, 'models'),
            path.join(this.installDir, 'assets')
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // Uygulama dosyalarını kopyala
    copyApplicationFiles() {
        console.log('📋 Uygulama dosyaları kopyalanıyor...');
        
        const sourceDirs = [
            { src: 'dist', dest: this.installDir },
            { src: 'electron', dest: this.installDir },
            { src: 'assets', dest: path.join(this.installDir, 'assets') }
        ];
        
        sourceDirs.forEach(({ src, dest }) => {
            if (fs.existsSync(src)) {
                this.copyDirectory(src, dest);
            }
        });
    }

    // Dizin kopyalama yardımcı fonksiyonu
    copyDirectory(src, dest) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        const items = fs.readdirSync(src);
        
        items.forEach(item => {
            const srcPath = path.join(src, item);
            const destPath = path.join(dest, item);
            
            if (fs.statSync(srcPath).isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        });
    }

    // Kısayolları oluştur
    createShortcuts() {
        console.log('🔗 Kısayollar oluşturuluyor...');
        
        const appPath = path.join(this.installDir, this.appExe);
        
        // Masaüstü kısayolu
        if (!fs.existsSync(this.desktopShortcut)) {
            this.createShortcut(appPath, this.desktopShortcut);
        }
        
        // Başlangıç menüsü kısayolları
        const startMenuShortcuts = [
            { name: 'Tekstil AI Studio.lnk', target: appPath },
            { name: 'Kaldır.lnk', target: path.join(this.installDir, 'Uninstall.exe') }
        ];
        
        startMenuShortcuts.forEach(({ name, target }) => {
            const shortcutPath = path.join(this.startMenuDir, name);
            this.createShortcut(target, shortcutPath);
        });
    }

    // Windows kısayolu oluştur
    createShortcut(target, shortcutPath) {
        const vbsScript = `
Set WshShell = WScript.CreateObject("WScript.Shell")
Set oShellLink = WshShell.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
oShellLink.TargetPath = "${target.replace(/\\/g, '\\\\')}"
oShellLink.WorkingDirectory = "${path.dirname(target).replace(/\\/g, '\\\\')}"
oShellLink.Description = "Tekstil AI Studio"
oShellLink.IconLocation = "${target.replace(/\\/g, '\\\\')},0"
oShellLink.Save
`;
        
        const vbsFile = path.join(os.tmpdir(), 'create_shortcut.vbs');
        fs.writeFileSync(vbsFile, vbsScript);
        
        try {
            execSync(`cscript //nologo "${vbsFile}"`, { stdio: 'ignore' });
            fs.unlinkSync(vbsFile);
        } catch (error) {
            console.warn('Kısayol oluşturulamadı:', error.message);
        }
    }

    // Kayıt defteri girdilerini ekle
    addRegistryEntries() {
        console.log('🔧 Kayıt defteri girdileri ekleniyor...');
        
        const regEntries = [
            `Windows Registry Editor Version 5.00`,
            ``,
            `[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Tekstil AI Studio]`,
            `"DisplayName"="${this.appName}"`,
            `"UninstallString"="${path.join(this.installDir, 'Uninstall.exe').replace(/\\/g, '\\\\')}"`,
            `"DisplayIcon"="${path.join(this.installDir, this.appExe).replace(/\\/g, '\\\\')}"`,
            `"Publisher"="Tekstil AI Studio"`,
            `"DisplayVersion"="1.0.0"`,
            `"NoModify"=dword:00000001`,
            `"NoRepair"=dword:00000001`
        ];
        
        const regFile = path.join(os.tmpdir(), 'add_registry.reg');
        fs.writeFileSync(regFile, regEntries.join('\n'));
        
        try {
            execSync(`regedit /s "${regFile}"`, { stdio: 'ignore' });
            fs.unlinkSync(regFile);
        } catch (error) {
            console.warn('Kayıt defteri girdileri eklenemedi:', error.message);
        }
    }

    // Kaldırıcı oluştur
    createUninstaller() {
        console.log('🗑️  Kaldırıcı oluşturuluyor...');
        
        const uninstallerScript = `
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const installer = require('./customer-installer.js');
const customerInstaller = new installer();

customerInstaller.uninstall();
`;
        
        const uninstallerPath = path.join(this.installDir, 'Uninstall.exe');
        const uninstallerScriptPath = path.join(this.installDir, 'uninstall.js');
        
        fs.writeFileSync(uninstallerScriptPath, uninstallerScript);
        
        // Uninstaller'ı exe olarak paketle
        try {
            execSync(`pkg "${uninstallerScriptPath}" --target node18-win-x64 --output "${uninstallerPath}"`, { stdio: 'ignore' });
            fs.unlinkSync(uninstallerScriptPath);
        } catch (error) {
            console.warn('Kaldırıcı exe oluşturulamadı, script olarak kopyalandı');
            fs.copyFileSync(uninstallerScriptPath, path.join(this.installDir, 'uninstall.js'));
        }
    }

    // Uygulamayı başlat
    launchApplication() {
        console.log('🚀 Uygulama başlatılıyor...');
        
        const appPath = path.join(this.installDir, this.appExe);
        
        if (fs.existsSync(appPath)) {
            try {
                spawn(appPath, [], { 
                    detached: true, 
                    stdio: 'ignore' 
                }).unref();
            } catch (error) {
                console.warn('Uygulama başlatılamadı:', error.message);
            }
        }
    }

    // Uygulamayı durdur
    stopApplication() {
        console.log('⏹️  Uygulama durduruluyor...');
        
        try {
            execSync(`taskkill /f /im "${this.appExe}"`, { stdio: 'ignore' });
        } catch (error) {
            // Uygulama zaten kapalı olabilir
        }
    }

    // Kısayolları kaldır
    removeShortcuts() {
        console.log('🔗 Kısayollar kaldırılıyor...');
        
        const shortcuts = [
            this.desktopShortcut,
            path.join(this.startMenuDir, 'Tekstil AI Studio.lnk'),
            path.join(this.startMenuDir, 'Kaldır.lnk')
        ];
        
        shortcuts.forEach(shortcut => {
            if (fs.existsSync(shortcut)) {
                fs.unlinkSync(shortcut);
            }
        });
        
        // Başlangıç menüsü dizinini kaldır
        if (fs.existsSync(this.startMenuDir)) {
            fs.rmdirSync(this.startMenuDir);
        }
    }

    // Kayıt defteri girdilerini sil
    removeRegistryEntries() {
        console.log('🔧 Kayıt defteri girdileri siliniyor...');
        
        const regEntries = [
            `Windows Registry Editor Version 5.00`,
            ``,
            `[-HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Tekstil AI Studio]`
        ];
        
        const regFile = path.join(os.tmpdir(), 'remove_registry.reg');
        fs.writeFileSync(regFile, regEntries.join('\n'));
        
        try {
            execSync(`regedit /s "${regFile}"`, { stdio: 'ignore' });
            fs.unlinkSync(regFile);
        } catch (error) {
            console.warn('Kayıt defteri girdileri silinemedi:', error.message);
        }
    }

    // Uygulama dosyalarını sil
    removeApplicationFiles() {
        console.log('📋 Uygulama dosyaları siliniyor...');
        
        if (fs.existsSync(this.installDir)) {
            this.removeDirectory(this.installDir);
        }
    }

    // Dizin silme yardımcı fonksiyonu
    removeDirectory(dir) {
        if (fs.existsSync(dir)) {
            const items = fs.readdirSync(dir);
            
            items.forEach(item => {
                const itemPath = path.join(dir, item);
                
                if (fs.statSync(itemPath).isDirectory()) {
                    this.removeDirectory(itemPath);
                } else {
                    fs.unlinkSync(itemPath);
                }
            });
            
            fs.rmdirSync(dir);
        }
    }

    // Kullanıcı verilerini sil
    async removeUserData() {
        console.log('📊 Kullanıcı verileri siliniyor...');
        
        if (fs.existsSync(this.userDataDir)) {
            this.removeDirectory(this.userDataDir);
        }
    }

    // Temizlik
    cleanup() {
        console.log('🧹 Temizlik yapılıyor...');
        
        if (fs.existsSync(this.installDir)) {
            this.removeDirectory(this.installDir);
        }
    }
}

// Komut satırı argümanlarını işle
const args = process.argv.slice(2);
const installer = new CustomerInstaller();

if (args.includes('--install') || args.includes('-i')) {
    installer.install();
} else if (args.includes('--uninstall') || args.includes('-u')) {
    installer.uninstall();
} else {
    console.log('Tekstil AI Studio Müşteri Kurulum Aracı');
    console.log('');
    console.log('Kullanım:');
    console.log('  node customer-installer.js --install   Kurulum yap');
    console.log('  node customer-installer.js --uninstall Kaldır');
    console.log('');
    console.log('Örnek:');
    console.log('  node customer-installer.js -i');
    console.log('  node customer-installer.js -u');
}

module.exports = CustomerInstaller; 
# Tekstil AI Studio (Offline Edition)

Yerel disk üzerinde görsel arama ve font tanıma yapabilen tamamen offline Electron uygulaması.

## 🚀 Özellikler

- 🔍 **Görsel Arama**: Yerel disk üzerinde benzer görselleri bulma
- 🎨 **Font Tanıma**: Görsellerdeki yazıları tanıma ve font önerileri
- 💾 **Offline Çalışma**: İnternet bağlantısı gerektirmez
- ⚡ **Hızlı Arama**: Optimize edilmiş arama algoritmaları
- 🖼️ **Çoklu Format**: JPEG, PNG, GIF, WebP, BMP desteği
- 🤖 **AI Destekli**: ONNX tabanlı görsel analiz
- 📊 **Detaylı Sonuçlar**: Benzerlik skorları ve meta veriler

## 📋 Sistem Gereksinimleri

- **İşletim Sistemi**: Windows 10/11, macOS 10.15+, Linux
- **Node.js**: 18.x - 20.x (21+ desteklenmez)
- **RAM**: Minimum 4GB, Önerilen 8GB+
- **Disk Alanı**: Minimum 2GB boş alan
- **İşlemci**: x64 mimarisi

## 🛠️ Kurulum

### Otomatik Kurulum (Önerilen)

```bash
# Kurulum script'ini çalıştır
npm run install

# Veya manuel olarak
npm run installer install
```

### Manuel Kurulum

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. ONNX modelini indir
npm run dl-model

# 3. Native modülleri derle
npm run electron-rebuild

# 4. Uygulamayı başlat
npm run dev-win
```

## 🎯 Kullanım

1. **Uygulamayı Başlatın**: `npm run dev-win`
2. **Görsel Yükleyin**: Sürükle-bırak veya dosya seçici
3. **Arama Ayarları**: Benzerlik eşiği ve ağırlıkları ayarlayın
4. **Arama Yapın**: "Ara" butonuna tıklayın
5. **Sonuçları İnceleyin**: Bulunan görselleri görüntüleyin

## 📦 Dağıtım

### Windows Installer
```bash
npm run dist-win
```

### Portable Sürüm
```bash
npm run dist-portable
```

### Diğer Platformlar
```bash
npm run dist-mac    # macOS
npm run dist-linux  # Linux
```

## 🗑️ Kaldırma

### Otomatik Kaldırma
```bash
npm run uninstall
```

### Manuel Kaldırma
1. Windows: "Program Ekle/Kaldır" > "Tekstil AI Studio"
2. macOS: Applications klasöründen çöp kutusuna sürükle
3. Linux: Paket yöneticisinden kaldır

## 🔧 Geliştirme

```bash
# Geliştirme modu
npm run dev-win

# Production build
npm run build

# Dağıtım paketi
npm run dist

# Test
npm run auto-test

# Otomasyon
npm run automation
```

## 📁 Proje Yapısı

```
tekstil-ai-studio/
├── src/                 # React uygulaması
├── electron/           # Electron ana süreç
├── assets/            # İkonlar ve kaynaklar
├── scripts/           # Yardımcı script'ler
├── dist/              # Build çıktıları
└── installer.nsh      # NSIS kurulum script'i
```

## 🐛 Sorun Giderme

### Yaygın Sorunlar

1. **Node.js Versiyon Hatası**
   ```bash
   # Node.js versiyonunu kontrol et
   node --version
   # 18.x-20.x olmalı
   ```

2. **Native Modül Hatası**
   ```bash
   # Modülleri yeniden derle
   npm run electron-rebuild
   ```

3. **ONNX Model Hatası**
   ```bash
   # Modeli yeniden indir
   npm run dl-model
   ```

### Log Dosyaları
- Uygulama logları: `%APPDATA%\Tekstil AI Studio (Offline Edition)\`
- Build logları: `automation.log`

## 📄 Lisans

MIT License - Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📞 Destek

- **GitHub Issues**: [Sorun bildir](https://github.com/tekstil-ai-studio/issues)
- **Dokümantasyon**: [Wiki](https://github.com/tekstil-ai-studio/wiki)
- **E-posta**: support@tekstilai.studio

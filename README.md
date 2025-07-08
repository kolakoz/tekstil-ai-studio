# Tekstil AI Studio (Offline Edition)

Bu proje, **Yerel Görsel Arama** ve **Font Tanıma** özelliklerini tamamen internetsiz (offline) olarak sağlayan bir Electron masaüstü uygulamasıdır.

## Özellikler
- 📂 **Yerel Disk Taraması**: Seçilen çalışma alanındaki (workspace) tüm görselleri indeksler.
- 🔍 **Benzer Görsel Arama**: Görsel hash (ImgHash) algoritması ile benzerlik skoru hesaplar.
- 🔤 **Font Tanıma**: Tesseract.js + özel font veritabanı ile resimdeki yazı tipini tanımlar.
- 🗄 **SQLite**: Hash ve meta-verileri yerel veritabanında saklar, hızlı sorgu sağlar.

## Çalıştırma
```bash
# Bağımlılıkları kur
npm install

# Geliştirme (Hot-Reload)
npm run start

# Üretim (.exe oluşturma – Windows için)
npm run build:desktop
```

> Not: İlk pakette örnek / boş fonksiyonlar bulunmaktadır. Gerçek iş mantığını kademeli olarak doldurabilirsiniz.

## Klasör Yapısı
```
tekstil-ai-studio/
├─ electron-main.js      # Ana (main) süreç
├─ preload.js            # Renderer ile güvenli köprü
├─ electron/             # Backend yardımcı modüller
│   ├─ database.js
│   ├─ image-processor.js
│   ├─ hash-calculator.js
│   ├─ font-recognizer.js
│   └─ file-scanner.js
└─ src/                  # React arayüzü
```

## Lisans
MIT

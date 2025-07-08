# 🖼️ İframe Görsel Gösterimi Düzeltme Talimatları

## 🐛 SORUN
Bulunan görsele tıklandığında açılan iframe/modal'da görsel görünmüyor.

---

## 📝 CURSOR İÇİN ADIM ADIM TALİMATLAR

### ADIM 1: İlgili Component'i Bul

```
@src/components klasöründe görsel detay modal/iframe component'ini bul.
Muhtemel dosya isimleri:
- ImageDetailModal.js
- ImagePreviewModal.js
- SearchResultDetail.js
- veya SearchResults.js içinde modal kodu
```

---

### ADIM 2: Modal/İframe Component'ini Kontrol Et

**Aranacak kod yapısı:**
```javascript
// YANLIŞ: file:// protokolü kullanımı
<img src={`file://${selectedImage.filepath}`} />

// YANLIŞ: Doğrudan path kullanımı
<img src={selectedImage.filepath} />

// DOĞRU: SafeImage veya base64 kullanımı
<SafeImage filepath={selectedImage.filepath} />
```

---

### ADIM 3: SafeImage Import Kontrolü

**Dosya başında kontrol et:**
```javascript
import SafeImage from './SafeImage';
```

**Eğer yoksa ekle:**
```javascript
import SafeImage from './SafeImage';
```

---

### ADIM 4: Modal İçindeki Görsel Gösterimini Güncelle

**Mevcut kodu bul (muhtemelen böyle):**
```javascript
// Modal içeriği
<div className="modal-content">
  <img 
    src={selectedImage.filepath} 
    alt={selectedImage.filename}
    className="modal-image"
  />
</div>
```

**Şu şekilde değiştir:**
```javascript
// Modal içeriği
<div className="modal-content">
  <SafeImage 
    filepath={selectedImage.filepath} 
    alt={selectedImage.filename}
    className="modal-image"
    style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
  />
</div>
```

---

### ADIM 5: SearchResults.js Güncellemesi

**Eğer modal SearchResults.js içindeyse:**

```javascript
// Dosya: src/components/SearchResults.js

import React, { useState } from 'react';
import SafeImage from './SafeImage';

function SearchResults({ results, onOpenInExplorer }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const handleImageClick = (image) => {
    setSelectedImage(image);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedImage(null);
  };

  return (
    <>
      {/* Sonuç listesi */}
      <div className="results-grid">
        {results.map((item, index) => (
          <div 
            key={index} 
            className="result-card"
            onClick={() => handleImageClick(item)}
          >
            <SafeImage filepath={item.filepath} alt={item.filename} />
            {/* ... diğer bilgiler ... */}
          </div>
        ))}
      </div>

      {/* Modal/İframe */}
      {showModal && selectedImage && (
        <div className="image-modal-overlay" onClick={closeModal}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>×</button>
            
            {/* ÖNEMLİ: Burada SafeImage kullan */}
            <SafeImage 
              filepath={selectedImage.filepath}
              alt={selectedImage.filename}
              className="modal-image"
              style={{ 
                maxWidth: '90vw', 
                maxHeight: '80vh', 
                objectFit: 'contain' 
              }}
            />
            
            <div className="modal-info">
              <h3>{selectedImage.filename}</h3>
              <p>Benzerlik: %{selectedImage.similarity}</p>
              <p>Boyut: {selectedImage.width}x{selectedImage.height}</p>
              <button onClick={() => onOpenInExplorer(selectedImage.filepath)}>
                📂 Klasörde Göster
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SearchResults;
```

---

### ADIM 6: CSS Güncellemesi

**Dosya: src/components/SearchResults.css (veya ilgili CSS dosyası)**

```css
/* Modal Overlay */
.image-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* Modal Content */
.image-modal-content {
  background: white;
  border-radius: 8px;
  padding: 20px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  position: relative;
}

/* Modal Image */
.modal-image {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  height: auto;
}

/* Close Button */
.modal-close {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 20px;
  cursor: pointer;
  z-index: 1001;
}

.modal-close:hover {
  background: #cc0000;
}

/* Modal Info */
.modal-info {
  margin-top: 20px;
  text-align: center;
}

.modal-info h3 {
  margin: 10px 0;
}

.modal-info button {
  margin-top: 10px;
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.modal-info button:hover {
  background: #0056b3;
}
```

---

### ADIM 7: Debug için Console Log Ekle

**Modal açılırken debug bilgisi ekle:**
```javascript
const handleImageClick = (image) => {
  console.log('=== Modal Debug ===');
  console.log('Selected image:', image);
  console.log('Filepath:', image.filepath);
  console.log('Has SafeImage:', typeof SafeImage !== 'undefined');
  
  setSelectedImage(image);
  setShowModal(true);
};
```

---

## 🧪 TEST ADIMLARI

1. **Console'u aç** (F12)
2. **Bir görsele tıkla**
3. **Console'da debug loglarını kontrol et**
4. **Modal açıldığında görsel görünüyor mu?**

---

## 🚨 MUHTEMEL SORUNLAR VE ÇÖZÜMLERİ

### Sorun 1: SafeImage import edilmemiş
**Çözüm:** `import SafeImage from './SafeImage';` ekle

### Sorun 2: Modal component'i bulunamıyor
**Çözüm:** SearchResults.js içine yukarıdaki modal kodunu ekle

### Sorun 3: CSS eksik
**Çözüm:** Modal CSS'lerini ekle

### Sorun 4: File path hatalı
**Çözüm:** Console'da filepath'i kontrol et, dosya gerçekten var mı?

---

## 📋 KONTROL LİSTESİ

- [ ] Modal/iframe component'i bulundu
- [ ] SafeImage import edildi
- [ ] img tag'i SafeImage ile değiştirildi
- [ ] CSS stilleri eklendi
- [ ] Debug logları eklendi
- [ ] Test edildi ve çalışıyor

---

## 🎯 ÖZET KOMUT

```
1. src/components klasöründe modal/iframe kodunu bul
2. SafeImage import et
3. <img> tag'ini <SafeImage> ile değiştir
4. CSS stillerini kontrol et
5. Test et ve sonucu bildir
```
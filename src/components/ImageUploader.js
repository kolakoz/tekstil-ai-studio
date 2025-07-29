import React, { useState, useRef, useCallback } from 'react';
import './ImageUploader.css';

const ImageUploader = ({ onImagesAdded, onClose }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => 
      file.type.startsWith('image/')
    );
    
    if (imageFiles.length > 0) {
      await processImages(imageFiles);
    }
  }, []);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      await processImages(files);
    }
  };

  const processImages = async (files) => {
    console.log('🔄 Görsel işleme başlatılıyor...', files.length, 'dosya');
    setUploading(true);
    setUploadProgress(0);
    
    const processedImages = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`📁 İşleniyor: ${file.name} (${file.size} bytes)`);
      
      try {
        // Dosyayı base64'e çevir
        console.log('🔄 Base64 dönüşümü...');
        const base64 = await fileToBase64(file);
        console.log('✅ Base64 dönüşümü tamamlandı');
        
        // Electron'a gönder
        console.log('🔄 Geçici dosya kaydediliyor...');
        // Dosya bilgilerini hazırla
        const fileInfo = {
          name: file.name,
          data: base64,
          size: file.size,
          type: file.type,
          originalPath: file.path || null // Orijinal dosya yolu (varsa)
        };
        
        const result = await window.electronAPI.saveTempFile(fileInfo);
        
        console.log('📁 saveTempFile sonucu:', result);
        
        if (result.success) {
          // Görseli işle (orijinal yolu da gönder)
          console.log('🔄 Görsel işleniyor...');
          const processResult = await window.electronAPI.processSingleImage(result.path, {
            originalPath: fileInfo.originalPath
          });
          console.log('🖼️ processSingleImage sonucu:', processResult);
          
          if (processResult.success) {
            processedImages.push(processResult.image);
            console.log('✅ Görsel başarıyla işlendi');
          } else {
            console.error('❌ Görsel işleme başarısız:', processResult.error);
          }
        } else {
          console.error('❌ Geçici dosya kaydetme başarısız:', result.error);
        }
        
        setUploadProgress(((i + 1) / files.length) * 100);
      } catch (error) {
        console.error(`❌ Görsel işleme hatası: ${file.name}`, error);
      }
    }
    
    console.log('📊 İşlenen görseller:', processedImages.length);
    setUploading(false);
    setUploadProgress(0);
    
    if (processedImages.length > 0) {
      console.log('✅ Görseller eklendi, modal kapatılıyor');
      onImagesAdded(processedImages);
      onClose();
    } else {
      console.log('⚠️ Hiç görsel işlenemedi');
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="image-uploader-overlay" onClick={onClose}>
      <div className="image-uploader-modal" onClick={(e) => e.stopPropagation()}>
        <div className="uploader-header">
          <h3>🖼️ Görsel Ekle</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div 
          className={`upload-area ${isDragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          {uploading ? (
            <div className="upload-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p>Görseller işleniyor... {Math.round(uploadProgress)}%</p>
            </div>
          ) : (
            <>
              <div className="upload-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </div>
              <h4>Görselleri buraya sürükleyin</h4>
              <p>veya tıklayarak seçin</p>
              <div className="supported-formats">
                <span>Desteklenen: JPG, PNG, GIF, WebP</span>
              </div>
            </>
          )}
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        <div className="uploader-footer">
          <button className="cancel-btn" onClick={onClose}>
            İptal
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageUploader; 

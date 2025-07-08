import React, { useState, useRef } from 'react';
import './ImageUploader.css';

/**
 * ImageUploader
 * Drag & Drop + Dosya Seç alternatifi
 * Seçilen görsel önizlenir ve "Benzer Görselleri Bul" işlemi tetiklenir
 */
function ImageUploader({ onImageSelected, onSearch, onClear }) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedFilePath, setSelectedFilePath] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Lütfen bir görsel dosyası seçin!');
      return;
    }

    console.log('ImageUploader - handleFile: file objesi:', file);
    console.log('ImageUploader - handleFile: file.path:', file.path);
    console.log('ImageUploader - handleFile: file.name:', file.name);

    // Electron ortamında base64 önizleme al
    if (window.electronAPI && file.path) {
      try {
        const result = await window.electronAPI.getImageBase64(file.path);
        if (result.success) {
          setPreview(result.dataUrl);
        }
      } catch (err) {
        console.error('Base64 conversion error:', err);
      }
    } else {
      // Tarayıcı ortamı – FileReader
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(file);
    }

    setSelectedFilePath(file.path || file.name);

    console.log('ImageUploader - onImageSelected çağrılıyor. file.path durumu:', file.path);
    if (onImageSelected && file.path) onImageSelected(file.path);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
  };

  const handleBrowse = (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
  };

  const handleSearchClick = () => {
    if (onSearch && selectedFilePath) onSearch(selectedFilePath);
  };

  const clearSelection = () => {
    setPreview(null);
    setSelectedFilePath(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onClear) onClear();
  };

  return (
    <div className="image-uploader">
      <h2>Görsel Yükle</h2>

      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !preview && fileInputRef.current?.click()}
      >
        {preview ? (
          <div className="preview-container">
            <img src={preview} alt="Önizleme" className="preview-image" />
            {selectedFilePath && <p className="file-path">{selectedFilePath}</p>}
          </div>
        ) : (
          <div className="drop-zone-content">
            <span className="drop-icon">📷</span>
            <p>Görsel sürükle veya tıkla</p>
            <p className="supported-formats">Desteklenen: JPG, PNG, GIF, WEBP</p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleBrowse}
        style={{ display: 'none' }}
      />

      <div className="uploader-actions">
        <button className="primary-button ara-button" disabled={!selectedFilePath} onClick={handleSearchClick}>ARA</button>
        <button className="clear-button" onClick={clearSelection} disabled={!selectedFilePath}>Temizle</button>
      </div>
    </div>
  );
}

export default ImageUploader; 
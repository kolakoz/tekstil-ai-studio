import React, { useState, useRef, useEffect } from 'react';
import './SearchBar.css';

function SearchBar({ onSearch, onScan, viewMode, onViewModeChange, onImageSearch, searchTerm: externalSearchTerm, onMonitoringToggle, onProjectMonitoringToggle }) {
  const [exportLoading, setExportLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const searchRef = useRef(null);
  const fileInputRef = useRef(null);

  // Dışarıdan gelen searchTerm'i kullan
  const currentSearchTerm = externalSearchTerm !== undefined ? externalSearchTerm : searchTerm;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (selectedImage) {
          handleClearImage();
        } else {
          searchRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (onSearch) {
      onSearch(value);
    }
  };

  // Dışarıdan gelen searchTerm değiştiğinde local state'i güncelle
  useEffect(() => {
    if (externalSearchTerm !== undefined) {
      setSearchTerm(externalSearchTerm);
    }
  }, [externalSearchTerm]);

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📷 Dosya seçildi:', file.name, file.type, file.size);

    if (!file.type.startsWith('image/')) {
      alert('Lütfen bir görsel dosyası seçin');
      return;
    }

    setImagePreviewError(false);

    // FileReader ile base64 önizleme oluştur
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const base64Result = e.target.result;
      console.log('✅ Base64 oluşturuldu, uzunluk:', base64Result.length);
      
      const imageData = {
        file: file,
        preview: base64Result,
        name: file.name,
        size: file.size,
        type: file.type
      };
      
      setSelectedImage(imageData);
      
      // Parent component'e bildir
      if (onImageSearch) {
        onImageSearch(imageData);
      }
    };

    reader.onerror = (error) => {
      console.error('❌ FileReader hatası:', error);
      setImagePreviewError(true);
      alert('Görsel yüklenirken hata oluştu');
    };

    // Base64'e çevir
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setImagePreviewError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Parent'a temizleme bildirimi
    if (onImageSearch) {
      onImageSearch(null);
    }
  };

  const handleImageSearchClick = () => {
    fileInputRef.current?.click();
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      
      // Export formatlarını al
      const formats = await window.electronAPI.getExportFormats();
      console.log('📊 Export formatları:', formats);
      
      // JSON formatında export yap
      const result = await window.electronAPI.exportMonitoringData('json');
      
      if (result.success) {
        alert(`✅ Monitoring verileri başarıyla export edildi!\nDosya: ${result.filePath}`);
      } else {
        alert(`❌ Export hatası: ${result.error}`);
      }
      
    } catch (error) {
      console.error('❌ Export hatası:', error);
      alert('Export işlemi sırasında hata oluştu');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="search-bar">
      <div className={`search-container ${isFocused ? 'focused' : ''} ${selectedImage ? 'has-image' : ''}`}>
        {/* Resim önizleme alanı */}
        {selectedImage && (
          <div className="image-preview-container">
            {!imagePreviewError ? (
              <img 
                src={selectedImage.preview}
                alt={selectedImage.name}
                className="image-preview-thumb"
                onError={() => {
                  console.error('❌ Görsel yüklenemedi');
                  setImagePreviewError(true);
                }}
              />
            ) : (
              <div className="image-preview-error">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9V13M12 17H12.01M21 21L3 3M4.857 4.857C3.714 6.486 3 8.514 3 10.657C3 15.886 7.029 20.143 12 20.143C14.143 20.143 16.171 19.429 17.8 18.286M9 5.043C9.943 4.657 10.971 4.457 12 4.457C16.971 4.457 21 8.714 21 13.943C21 14.971 20.8 16 20.414 16.943" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            )}
            <button 
              className="remove-image-btn"
              onClick={handleClearImage}
              title="Görseli kaldır"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}

        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" 
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        
        <input
          ref={searchRef}
          type="text"
          placeholder={selectedImage ? "Benzer görselleri ara..." : "Görsel ara... (⌘K)"}
          value={currentSearchTerm}
          onChange={handleSearchChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="search-input"
        />

        {/* Gizli file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />

        {searchTerm && !selectedImage && (
          <button 
            onClick={() => {
              setSearchTerm('');
              onSearch('');
            }}
            className="clear-button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      <div className="search-actions">
        {/* Görsel arama butonu */}
        <button 
          className="image-search-btn"
          onClick={handleImageSearchClick}
          title="Görsel ile ara"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
            <path d="M21 15L16 10L11 15L8 12L3 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="view-mode-toggle">
          <button 
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => onViewModeChange('grid')}
            title="Grid görünümü"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2"/>
              <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
          
          <button 
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onViewModeChange('list')}
            title="Liste görünümü"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <button className="scan-button" onClick={onScan}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L12 9M12 9L15 6M12 9L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12Z" 
              stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span>Tara</span>
        </button>

        {/* Monitoring Dashboard butonu */}
        {onMonitoringToggle && (
          <button 
            className="monitoring-button" 
            onClick={onMonitoringToggle}
            title="Sistem Monitoring Dashboard"
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M3 3H21V21H3V3Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M9 9H15V15H9V9Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M3 9H9V15H3V9Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M15 9H21V15H15V9Z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>Monitoring</span>
          </button>
        )}

        {/* Proje Monitoring Dashboard butonu */}
        {onProjectMonitoringToggle && (
          <button 
            className="project-monitoring-button" 
            onClick={onProjectMonitoringToggle}
            title="Proje Monitoring Dashboard"
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>Proje</span>
          </button>
        )}

        {/* Export butonu */}
        <button 
          className="export-button" 
          onClick={handleExport}
          disabled={exportLoading}
          title="Monitoring verilerini export et"
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            padding: '8px 12px',
            cursor: exportLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '12px',
            opacity: exportLoading ? 0.6 : 1
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{exportLoading ? 'Export...' : 'Export'}</span>
        </button>
      </div>
    </div>
  );
}

export default SearchBar; 
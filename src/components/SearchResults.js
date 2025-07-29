import React, { useState, useEffect } from 'react';
import './SearchResults.css';

const SearchResults = ({ searchResults, selectedImage, onClose, onImageClick, similarityThreshold, onSimilarityChange }) => {

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatSimilarity = (similarity) => {
    return Math.round(similarity * 100);
  };

  // Sadece benzerlik eşiğine göre filtrele
  const filteredResults = (searchResults || []).filter(img => {
    return (img.similarity || 0) >= similarityThreshold;
  });

  const handleOpenFile = async (filePath) => {
    try {
      await window.electronAPI.openFile(filePath);
    } catch (error) {
      console.error('❌ Dosya açma hatası:', error);
    }
  };

  const getSimilarityColor = (similarity) => {
    const percent = similarity * 100;
    if (percent > 80) return '#10b981'; // Yeşil
    if (percent > 60) return '#f59e0b'; // Turuncu
    if (percent > 40) return '#ef4444'; // Kırmızı
    return '#6b7280'; // Gri
  };

  if (!searchResults || searchResults.length === 0) {
    return (
      <div className="search-results empty">
        <div className="empty-content">
          <div className="empty-icon">🔍</div>
          <h3>Benzer Görsel Bulunamadı</h3>
          <p>Seçilen disklerde benzer görsel bulunamadı.</p>
          <button onClick={onClose} className="btn-primary">
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="search-results">
      {/* Header */}
      <div className="search-header">
        <div className="search-info">
          <h2>🔍 Arama Sonuçları</h2>
          <p>
            <strong>{selectedImage?.filename}</strong> için 
            <strong> {filteredResults.length} </strong> 
            benzer görsel bulundu
          </p>
        </div>
        
        <div className="search-controls">
          <div className="control-group">
            <label>🔍 Benzerlik: %{Math.round(similarityThreshold * 100)}</label>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.1"
              value={similarityThreshold}
              onChange={(e) => onSimilarityChange && onSimilarityChange(parseFloat(e.target.value))}
              className="similarity-slider"
            />
          </div>
        </div>
        
        <button onClick={onClose} className="close-button">
          ✕
        </button>
      </div>

      {/* Selected Image */}
      {selectedImage && (
        <div className="selected-image-preview">
          <div className="preview-image">
            <img 
                              src={selectedImage.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg=='} 
              alt={selectedImage.filename} 
            />
          </div>
          <div className="preview-info">
            <h3>{selectedImage.filename}</h3>
            <p>{selectedImage.width}×{selectedImage.height} • {formatFileSize(selectedImage.filesize)}</p>
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div className="results-container grid">
        {filteredResults.map((img, index) => (
          <div 
            key={img.id || index} 
            className="result-item grid"
            onClick={() => onImageClick && onImageClick(img)}
          >
            <div className="result-image">
              <img 
                                  src={img.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg=='} 
                alt={img.filename} 
              />
              <div 
                className="similarity-badge"
                style={{ backgroundColor: getSimilarityColor(img.similarity || 0) }}
              >
                %{formatSimilarity(img.similarity || 0)}
              </div>
            </div>
            
            <div className="result-info">
              <div className="result-filename" title={img.filename}>
                {img.filename}
              </div>
              
              <div className="result-meta">
                <span className="meta-size">{formatFileSize(img.filesize || 0)}</span>
                {img.width && img.height && (
                  <span className="meta-dimensions">{img.width}×{img.height}</span>
                )}
                {img.disk && (
                  <span className="meta-disk">💾 {img.disk}</span>
                )}
              </div>
              
              <div className="result-actions">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    // Burada yeni arama başlatılabilir
                  }}
                  title="Bu Görselle Ara"
                >
                  🔍
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="search-summary">
        <div className="summary-stats">
          <span>📊 Toplam: {searchResults.length}</span>
          <span>✅ Filtrelenmiş: {filteredResults.length}</span>
        </div>
        
        <div className="summary-actions">
          <button onClick={onClose} className="btn-primary">
            ✕ Kapat
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchResults; 


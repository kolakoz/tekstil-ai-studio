import React, { useState } from 'react';
import './SearchOptions.css';

const SearchOptions = ({ 
  similarityThreshold, 
  setSimilarityThreshold, 
  weights, 
  setWeights,
  onSearch,
  pendingImagePath,
  compact = false
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const handleSearch = () => {
    const filters = {
      fileType: fileTypeFilter,
      size: sizeFilter,
      date: dateFilter
    };
    onSearch(filters);
  };

  // Kompakt mod için sadece arama butonu
  if (compact) {
    return (
      <div className="search-options-compact">
        <div className="compact-search-row">
          <button 
            className="compact-search-btn primary-button"
            onClick={handleSearch}
            disabled={!pendingImagePath}
          >
            {pendingImagePath ? '🔍 Arama Yap' : '📁 Görsel Seçin'}
          </button>
          
          <button 
            className="compact-toggle-btn"
            onClick={() => setShowAdvanced(!showAdvanced)}
            title={showAdvanced ? 'Basit Mod' : 'Gelişmiş Mod'}
          >
            {showAdvanced ? '⚙️' : '🔧'}
          </button>
        </div>

        {showAdvanced && (
          <div className="compact-advanced-options">
            <div className="compact-filter-row">
              <select 
                value={fileTypeFilter} 
                onChange={(e) => setFileTypeFilter(e.target.value)}
                className="compact-select"
              >
                <option value="all">Tüm Dosyalar</option>
                <option value="jpg">JPG</option>
                <option value="png">PNG</option>
                <option value="gif">GIF</option>
              </select>

              <select 
                value={sizeFilter} 
                onChange={(e) => setSizeFilter(e.target.value)}
                className="compact-select"
              >
                <option value="all">Tüm Boyutlar</option>
                <option value="small">Küçük</option>
                <option value="medium">Orta</option>
                <option value="large">Büyük</option>
              </select>
            </div>
          </div>
        )}

        {pendingImagePath && (
          <div className="compact-image-info">
            <span>✅ {pendingImagePath.split('\\').pop()}</span>
          </div>
        )}
      </div>
    );
  }

  // Normal mod için mevcut tasarım
  return (
    <div className="search-options fade-in">
      <div className="options-header">
        <h3>🔍 Arama Seçenekleri</h3>
        <button 
          className="toggle-advanced"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? 'Basit' : 'Gelişmiş'} Mod
        </button>
      </div>

      <div className="basic-options">
        <div className="option-group">
          <label>Benzerlik Eşiği: {Math.round(similarityThreshold * 100)}%</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={similarityThreshold}
            onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
            className="slider"
          />
        </div>

        <div className="option-group">
          <label>Ağırlıklar:</label>
          <div className="weights-container">
            <div className="weight-item">
              <label>AI Model: {Math.round((weights.embedding || 0.6) * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={weights.embedding || 0.6}
                onChange={(e) => setWeights({...weights, embedding: parseFloat(e.target.value)})}
                className="slider"
              />
            </div>
            <div className="weight-item">
              <label>HOG: {Math.round((weights.hog || 0.3) * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={weights.hog || 0.3}
                onChange={(e) => setWeights({...weights, hog: parseFloat(e.target.value)})}
                className="slider"
              />
            </div>
            <div className="weight-item">
              <label>Renk: {Math.round((weights.color || 0.1) * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={weights.color || 0.1}
                onChange={(e) => setWeights({...weights, color: parseFloat(e.target.value)})}
                className="slider"
              />
            </div>
          </div>
        </div>
      </div>

      {showAdvanced && (
        <div className="advanced-options fade-in">
          <h4>🎯 Gelişmiş Filtreler</h4>
          
          <div className="filter-group">
            <label>Dosya Türü:</label>
            <select 
              value={fileTypeFilter} 
              onChange={(e) => setFileTypeFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tümü</option>
              <option value="jpg">JPG/JPEG</option>
              <option value="png">PNG</option>
              <option value="gif">GIF</option>
              <option value="bmp">BMP</option>
              <option value="webp">WebP</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Dosya Boyutu:</label>
            <select 
              value={sizeFilter} 
              onChange={(e) => setSizeFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tümü</option>
              <option value="small">Küçük (&lt; 1MB)</option>
              <option value="medium">Orta (1-5MB)</option>
              <option value="large">Büyük (&gt; 5MB)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Tarih Filtresi:</label>
            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tümü</option>
              <option value="today">Bugün</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
              <option value="year">Bu Yıl</option>
            </select>
          </div>
        </div>
      )}

      <div className="search-actions">
        <button 
          className="search-button primary-button"
          onClick={handleSearch}
          disabled={!pendingImagePath}
        >
          {pendingImagePath ? '🔍 Arama Yap' : '📁 Önce Görsel Seçin'}
        </button>
        
        {showAdvanced && (
          <button 
            className="reset-button secondary-button"
            onClick={() => {
              setFileTypeFilter('all');
              setSizeFilter('all');
              setDateFilter('all');
            }}
          >
            🔄 Filtreleri Sıfırla
          </button>
        )}
      </div>

      {pendingImagePath && (
        <div className="selected-image-info">
          <span>✅ Seçili Görsel: {pendingImagePath.split('\\').pop()}</span>
        </div>
      )}
    </div>
  );
};

export default SearchOptions; 

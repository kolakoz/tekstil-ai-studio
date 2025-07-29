import React, { useState, useEffect } from 'react';
import './ColorSearch.css';

const ColorSearch = ({ onSearch }) => {
  const [selectedColors, setSelectedColors] = useState([]);
  const [colorTolerance, setColorTolerance] = useState(0.3);
  const [searchMode, setSearchMode] = useState('dominant'); // dominant, palette, exact
  const [isSearching, setIsSearching] = useState(false);

  // Önceden tanımlanmış renk paletleri
  const predefinedPalettes = {
    warm: ['#FF6B6B', '#FF8E53', '#FFA726', '#FFB74D', '#FFCC02'],
    cool: ['#4FC3F7', '#29B6F6', '#03A9F4', '#039BE5', '#0288D1'],
    earth: ['#8D6E63', '#A1887F', '#BCAAA4', '#D7CCC8', '#EFEBE9'],
    vibrant: ['#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3'],
    pastel: ['#FFCDD2', '#F8BBD9', '#E1BEE7', '#C5CAE9', '#BBDEFB'],
    monochrome: ['#000000', '#333333', '#666666', '#999999', '#CCCCCC']
  };

  const addColor = (color) => {
    if (selectedColors.length < 5) {
      setSelectedColors([...selectedColors, color]);
    }
  };

  const removeColor = (index) => {
    setSelectedColors(selectedColors.filter((_, i) => i !== index));
  };

  const clearColors = () => {
    setSelectedColors([]);
  };

  const applyPalette = (paletteName) => {
    setSelectedColors(predefinedPalettes[paletteName]);
  };

  const handleSearch = async () => {
    if (selectedColors.length === 0) {
      alert('Lütfen en az bir renk seçin');
      return;
    }

    setIsSearching(true);
    try {
      const searchParams = {
        colors: selectedColors,
        tolerance: colorTolerance,
        mode: searchMode
      };

      const result = await window.electronAPI.searchByColors(searchParams);
      
      if (result.success) {
        onSearch(result.results, searchParams);
      } else {
        alert('Arama sırasında hata oluştu: ' + result.error);
      }
    } catch (error) {
      console.error('Renk arama hatası:', error);
      alert('Arama sırasında hata oluştu');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="color-search">
      <div className="color-search-header">
        <h3>🎨 Renk Bazlı Arama</h3>
        <p>Renk paleti ile görsel arayın</p>
      </div>

      {/* Arama Modu Seçimi */}
      <div className="search-mode-section">
        <h4>Arama Modu</h4>
        <div className="mode-buttons">
          <button 
            className={`mode-btn ${searchMode === 'dominant' ? 'active' : ''}`}
            onClick={() => setSearchMode('dominant')}
          >
            🎯 Baskın Renk
          </button>
          <button 
            className={`mode-btn ${searchMode === 'palette' ? 'active' : ''}`}
            onClick={() => setSearchMode('palette')}
          >
            🎨 Renk Paleti
          </button>
          <button 
            className={`mode-btn ${searchMode === 'exact' ? 'active' : ''}`}
            onClick={() => setSearchMode('exact')}
          >
            🔍 Tam Eşleşme
          </button>
        </div>
      </div>

      {/* Renk Toleransı */}
      <div className="tolerance-section">
        <h4>Renk Toleransı: %{Math.round(colorTolerance * 100)}</h4>
        <input
          type="range"
          min="0.1"
          max="0.8"
          step="0.1"
          value={colorTolerance}
          onChange={(e) => setColorTolerance(parseFloat(e.target.value))}
          className="tolerance-slider"
        />
        <div className="tolerance-labels">
          <span>Düşük</span>
          <span>Yüksek</span>
        </div>
      </div>

      {/* Seçili Renkler */}
      <div className="selected-colors-section">
        <div className="section-header">
          <h4>Seçili Renkler ({selectedColors.length}/5)</h4>
          <button onClick={clearColors} className="clear-btn">
            🗑️ Temizle
          </button>
        </div>
        
        <div className="selected-colors">
          {selectedColors.map((color, index) => (
            <div key={index} className="color-item">
              <div 
                className="color-preview" 
                style={{ backgroundColor: color }}
              ></div>
              <span className="color-hex">{color}</span>
              <button 
                onClick={() => removeColor(index)}
                className="remove-color-btn"
              >
                ✕
              </button>
            </div>
          ))}
          
          {selectedColors.length < 5 && (
            <div className="add-color-placeholder">
              <span>+ Renk Ekle</span>
            </div>
          )}
        </div>
      </div>

      {/* Önceden Tanımlanmış Paletler */}
      <div className="predefined-palettes">
        <h4>Hazır Paletler</h4>
        <div className="palette-grid">
          {Object.entries(predefinedPalettes).map(([name, colors]) => (
            <button
              key={name}
              onClick={() => applyPalette(name)}
              className="palette-btn"
              title={name.charAt(0).toUpperCase() + name.slice(1)}
            >
              <div className="palette-preview">
                {colors.map((color, index) => (
                  <div
                    key={index}
                    className="palette-color"
                    style={{ backgroundColor: color }}
                  ></div>
                ))}
              </div>
              <span className="palette-name">{name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Renk Seçici */}
      <div className="color-picker-section">
        <h4>Manuel Renk Seçimi</h4>
        <div className="color-picker-grid">
          {[
            '#FF0000', '#FF4500', '#FF8C00', '#FFD700', '#FFFF00',
            '#ADFF2F', '#00FF00', '#00FA9A', '#00FFFF', '#00BFFF',
            '#0000FF', '#8A2BE2', '#FF00FF', '#FF1493', '#FF69B4',
            '#F5F5DC', '#A0522D', '#808080', '#000000', '#FFFFFF'
          ].map((color) => (
            <button
              key={color}
              onClick={() => addColor(color)}
              className="color-option"
              style={{ backgroundColor: color }}
              disabled={selectedColors.length >= 5}
              title={color}
            ></button>
          ))}
        </div>
      </div>

      {/* Arama Butonu */}
      <div className="search-actions">
        <button
          onClick={handleSearch}
          disabled={selectedColors.length === 0 || isSearching}
          className="search-btn"
        >
          {isSearching ? '🔍 Aranıyor...' : '🔍 Renk Ara'}
        </button>
      </div>
    </div>
  );
};

export default ColorSearch; 
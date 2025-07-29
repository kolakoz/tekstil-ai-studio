import React, { useState } from 'react';
import './SidePanel.css';
import DiskSelector from './DiskSelector';

function SidePanel({ isOpen, onClose, selectedImage, onScanComplete, onImageUpdate }) {
  const [activeTab, setActiveTab] = useState('details'); // scan, details, similar
  const [similarityThreshold, setSimilarityThreshold] = useState(0.8);
  const [searchingSimilar, setSearchingSimilar] = useState(false);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleScanComplete = (result) => {
    onScanComplete();
    if (result.success) {
      setActiveTab('details');
    }
  };

  const handleSimilaritySearch = async () => {
    if (!selectedImage || !selectedImage.filepath) {
      console.error('❌ Seçili görsel bulunamadı');
      return;
    }

    setSearchingSimilar(true);
    try {
      console.log(`🔍 Benzerlik araması başlatılıyor (threshold: ${similarityThreshold})`);
      
      const similar = await window.electronAPI.searchSimilarFromDb({
        imagePath: selectedImage.filepath,
        threshold: similarityThreshold
      });
      
      if (similar.success) {
        console.log(`✅ ${similar.results.length} benzer görsel bulundu`);
        const updatedImage = { ...selectedImage, similar: similar.results };
        if (onImageUpdate) {
          onImageUpdate(updatedImage);
        }
      } else {
        console.error('❌ Benzer görsel arama hatası:', similar.error);
        alert('Benzer görsel arama sırasında hata oluştu: ' + similar.error);
      }
    } catch (error) {
      console.error('❌ Benzer görsel arama hatası:', error);
      alert('Benzer görsel arama sırasında hata oluştu: ' + error.message);
    } finally {
      setSearchingSimilar(false);
    }
  };

  return (
    <div className={`side-panel ${isOpen ? 'open' : ''}`}>
      <div className="panel-header">
        <h2 className="panel-title">
          {activeTab === 'scan' && '🔍 Disk Tarama'}
          {activeTab === 'details' && '📷 Görsel Detayları'}
          {activeTab === 'similar' && '🔍 Benzer Görseller'}
        </h2>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="panel-tabs">
        <button 
          className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          📷 Detaylar
        </button>
        <button 
          className={`tab-btn ${activeTab === 'similar' ? 'active' : ''}`}
          onClick={() => setActiveTab('similar')}
        >
          🔍 Benzerler
        </button>
        <button 
          className={`tab-btn ${activeTab === 'scan' ? 'active' : ''}`}
          onClick={() => setActiveTab('scan')}
        >
          💾 Tarama
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'scan' && (
          <div className="scan-tab">
            <DiskSelector
              onScanComplete={handleScanComplete}
              onClose={onClose}
              compact={true}
            />
          </div>
        )}

        {activeTab === 'details' && selectedImage && (
          <div className="details-tab">
            <div className="selected-image-preview">
              <img
                src={selectedImage.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg=='}
                alt={selectedImage.filename}
                className="preview-image"
              />
            </div>

            <div className="image-details">
              <h3>{selectedImage.filename}</h3>
              
              <div className="detail-item">
                <span className="detail-label">Boyut:</span>
                <span className="detail-value">{formatFileSize(selectedImage.filesize || 0)}</span>
              </div>
              
              {selectedImage.width && selectedImage.height && (
                <div className="detail-item">
                  <span className="detail-label">Çözünürlük:</span>
                  <span className="detail-value">{selectedImage.width} × {selectedImage.height}</span>
                </div>
              )}
              
              <div className="detail-item">
                <span className="detail-label">Konum:</span>
                <span className="detail-value filepath">{selectedImage.filepath}</span>
              </div>

              <div className="detail-actions">
                <button
                  className="action-btn primary"
                  onClick={() => {
                    window.electronAPI.openFile(selectedImage.filepath);
                  }}
                >
                  📁 Klasörde Aç
                </button>
                
                <button
                  className="action-btn secondary"
                  onClick={() => setActiveTab('similar')}
                >
                  🔍 Benzerleri Göster
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'similar' && selectedImage && (
          <div className="similar-tab">
            <div className="similar-header">
              <h3>Benzer Görseller</h3>
              <p>{selectedImage.filename} için benzer görseller</p>
              
              <div className="similarity-controls">
                <div className="similarity-slider-container">
                  <label htmlFor="similarity-slider">Benzerlik Oranı: %{Math.round((similarityThreshold || 0.8) * 100)}</label>
                  <input
                    id="similarity-slider"
                    type="range"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    value={similarityThreshold || 0.8}
                    onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                    className="similarity-slider"
                  />
                  <div className="slider-labels">
                    <span>%50</span>
                    <span>%75</span>
                    <span>%100</span>
                  </div>
                </div>
                
                <button
                  className="action-btn primary"
                  onClick={handleSimilaritySearch}
                  disabled={searchingSimilar}
                >
                  {searchingSimilar ? '🔍 Aranıyor...' : '🔍 Yeniden Ara'}
                </button>
              </div>
            </div>

            {selectedImage.similar && selectedImage.similar.length > 0 ? (
              <div className="similar-grid">
                {selectedImage.similar.map((img, index) => (
                  <div key={index} className="similar-item">
                    <div className="similar-image">
                      <img
                        src={img.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg=='}
                        alt={img.filename}
                      />
                      <div className="similarity-badge">
                        %{Math.round((img.similarity || 0) * 100)}
                      </div>
                    </div>
                    <div className="similar-info">
                      <div className="similar-filename">{img.filename}</div>
                      <div className="similar-filepath">{img.filepath}</div>
                      <button
                        className="similar-action-btn"
                        onClick={() => {
                          window.electronAPI.openFile(img.filepath);
                        }}
                      >
                        📁 Aç
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-similar">
                <div className="no-similar-icon">🔍</div>
                <p>Benzer görsel bulunamadı</p>
                <p className="no-similar-hint">Benzerlik oranını düşürerek daha fazla sonuç bulabilirsiniz</p>
                <button
                  className="action-btn primary"
                  onClick={handleSimilaritySearch}
                  disabled={searchingSimilar}
                >
                  {searchingSimilar ? '🔍 Aranıyor...' : '🔍 Yeniden Ara'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SidePanel; 
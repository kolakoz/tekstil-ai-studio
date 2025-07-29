import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './SearchScopeDialog.css';

/**
 * SearchScopeDialog
 * Görsel arama için disk seçme modalı
 */
function SearchScopeDialog({ isOpen, onClose, onConfirm, searchImage }) {
  const [drives, setDrives] = useState([]);
  const [selectedDrives, setSelectedDrives] = useState([]);
  const [loading, setLoading] = useState(false);

  // Diskleri yükle
  useEffect(() => {
    if (!isOpen) return;
    
    async function loadDrives() {
      try {
        setLoading(true);
        const result = await window.electronAPI.getDisks();
        if (result.success) {
          setDrives(result.drives);
          // Varsayılan olarak tüm diskleri seç
          setSelectedDrives(result.drives.map(d => d.letter));
        }
      } catch (error) {
        console.error('❌ Disk yükleme hatası:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDrives();
  }, [isOpen]);

  const toggleDrive = (driveLetter) => {
    setSelectedDrives((prev) => {
      if (prev.includes(driveLetter)) {
        return prev.filter((d) => d !== driveLetter);
      }
      return [...prev, driveLetter];
    });
  };

  const selectAllDrives = () => {
    setSelectedDrives(drives.map(d => d.letter));
  };

  const deselectAllDrives = () => {
    setSelectedDrives([]);
  };

  const handleConfirm = async () => {
    if (selectedDrives.length === 0) {
      alert('Lütfen en az bir disk seçin');
      return;
    }

    try {
      setLoading(true);
      
      // Direkt arama yap (sadece veritabanındaki ayak izlerini ara)
      console.log('🔍 Arama başlatılıyor...');
      const result = await window.electronAPI.searchSimilarImages({
        imagePath: searchImage?.path,
        imageData: searchImage
      }, {
        drives: selectedDrives
      });

      if (result.success) {
        console.log('✅ Arama tamamlandı:', result.count, 'sonuç');
        console.log('🔍 Aranan diskler:', selectedDrives);
        onConfirm({
          success: true,
          images: result.images,
          count: result.count,
          searchedDrives: selectedDrives
        });
      } else {
        alert('Arama sırasında hata oluştu: ' + result.error);
      }
      
    } catch (error) {
      console.error('❌ Arama hatası:', error);
      alert('Arama sırasında hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal search-scope-modal">
        <div className="modal-header">
          <h2>🔍 Görsel Arama - Disk Seçimi</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {searchImage && (
          <div className="search-image-preview">
            <h3>Aranacak Görsel:</h3>
            <img 
              src={searchImage.preview || searchImage.thumbnail} 
              alt="Arama görseli"
              className="preview-image"
            />
            <p className="image-name">{searchImage.name}</p>
          </div>
        )}

        <div className="modal-content">
          <p className="instruction">
            🔍 <strong>Görsel Arama</strong><br/>
            Arama yapılacak diskleri seçin. Seçilen disklerdeki veritabanı ayak izleri aranacaktır.
          </p>
          
          <div className="search-info">
            <p>🎯 <strong>Arama Hedefi:</strong> Benzer görseller</p>
            <p>⚡ <strong>Arama Yöntemi:</strong> Veritabanı ayak izi karşılaştırması</p>
            <p>💾 <strong>Veri Kaynağı:</strong> Daha önce taranmış görseller</p>
          </div>

          <div className="drive-selection">
            <div className="drive-actions">
              <button 
                type="button" 
                className="btn-secondary"
                onClick={selectAllDrives}
                disabled={loading}
              >
                Tümünü Seç
              </button>
              <button 
                type="button" 
                className="btn-secondary"
                onClick={deselectAllDrives}
                disabled={loading}
              >
                Seçimi Temizle
              </button>
            </div>

            <div className="drive-list">
              {loading ? (
                <p>Diskler yükleniyor...</p>
              ) : drives.length === 0 ? (
                <p>Disk bulunamadı</p>
              ) : (
                drives.map((drive) => (
                  <label key={drive.letter} className="drive-item">
                    <input 
                      type="checkbox" 
                      checked={selectedDrives.includes(drive.letter)} 
                      onChange={() => toggleDrive(drive.letter)}
                      disabled={loading}
                    />
                    <span className="drive-icon">💿</span>
                    <span className="drive-letter">{drive.letter}:</span>
                    <span className="drive-path">{drive.path}</span>
                  </label>
                ))
              )}
            </div>

            <div className="selection-summary">
              <p>
                <strong>Seçilen diskler:</strong> {selectedDrives.length} / {drives.length}
              </p>
              {selectedDrives.length > 0 && (
                <p className="selected-drives">
                  {selectedDrives.join(', ')}:
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={onClose}
            disabled={loading}
          >
            İptal
          </button>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={handleConfirm}
            disabled={loading || selectedDrives.length === 0}
          >
            {loading ? '🔍 Aranıyor...' : '🔍 Aramayı Başlat'}
          </button>
        </div>
      </div>
    </div>
  );
}

SearchScopeDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  searchImage: PropTypes.object
};

export default SearchScopeDialog; 

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './DiskSelectionDialog.css';

/**
 * DiskSelectionDialog
 * Kullanıcıya bilgisayardaki tüm diskleri gösterir ve seçilen diskleri tarar
 */
function DiskSelectionDialog({ isOpen, onClose, onScanComplete }) {
  const [drives, setDrives] = useState([]);
  const [selectedDrives, setSelectedDrives] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, currentFile: '' });
  const [loading, setLoading] = useState(false);

  // Diskleri yükle
  useEffect(() => {
    if (!isOpen) return;
    
    async function loadDrives() {
      setLoading(true);
      try {
        if (window.electronAPI?.listDrives) {
          const result = await window.electronAPI.listDrives();
          if (result.success) {
            setDrives(result.drives);
            // Varsayılan olarak tüm diskleri seç
            setSelectedDrives(result.drives);
          }
        }
      } catch (error) {
        console.error('Disk listesi yüklenemedi:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDrives();
  }, [isOpen]);

  // Tarama ilerlemesini dinle
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleScanProgress = (progress) => {
      setScanProgress(progress);
    };

    const handleScanComplete = (results) => {
      setScanning(false);
      console.log('✅ Disk tarama tamamlandı, şimdi arama yapılacak:', results);
      
      // Tarama sonuçlarını göster ve arama yap
      if (results && results.processed > 0) {
        // Önce tarama tamamlandı mesajını göster
        alert(`🎉 Tarama tamamlandı!\n\n${results.processed} görsel işlendi ve veritabanına eklendi.\n\nŞimdi benzer görseller aranacak...`);
        
        // Sonra arama yap
        setTimeout(() => {
          onScanComplete(results);
        }, 1000);
      } else {
        alert('⚠️ Tarama tamamlandı ancak işlenen görsel bulunamadı.');
        onClose();
      }
    };

    window.electronAPI.onScanProgress(handleScanProgress);
    window.electronAPI.onScanComplete(handleScanComplete);

    return () => {
      window.electronAPI.removeScanProgress(handleScanProgress);
      window.electronAPI.removeScanComplete(handleScanComplete);
    };
  }, [onScanComplete, onClose]);

  const toggleDrive = (drive) => {
    setSelectedDrives((prev) => {
      if (prev.includes(drive)) {
        return prev.filter((d) => d !== drive);
      }
      return [...prev, drive];
    });
  };

  const toggleAllDrives = () => {
    if (selectedDrives.length === drives.length) {
      setSelectedDrives([]);
    } else {
      setSelectedDrives([...drives]);
    }
  };

  const handleStartScan = async () => {
    if (selectedDrives.length === 0) {
      alert('Lütfen en az bir disk seçin!');
      return;
    }

    setScanning(true);
    try {
      if (window.electronAPI?.scanDrives) {
        await window.electronAPI.scanDrives(selectedDrives);
      }
    } catch (error) {
      console.error('Tarama başlatılamadı:', error);
      setScanning(false);
      alert('Tarama başlatılamadı: ' + error.message);
    }
  };

  const handleCancel = () => {
    if (scanning) {
      if (window.electronAPI?.cancelScan) {
        window.electronAPI.cancelScan();
      }
      setScanning(false);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="disk-selection-backdrop">
      <div className="disk-selection-modal">
        <div className="disk-selection-header">
          <h2>🔍 Arama Kapsamı</h2>
          <button className="close-btn" onClick={handleCancel} disabled={scanning}>
            ✕
          </button>
        </div>

        {loading ? (
          <div className="loading-section">
            <div className="loading-spinner"></div>
            <p>Diskler yükleniyor...</p>
          </div>
        ) : scanning ? (
          <div className="scanning-section">
            <div className="scan-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: scanProgress.total > 0 ? `${(scanProgress.current / scanProgress.total) * 100}%` : '0%' 
                  }}
                ></div>
              </div>
              <div className="progress-text">
                {scanProgress.current} / {scanProgress.total} görsel işlendi
              </div>
              {scanProgress.currentFile && (
                <div className="current-file">
                  Şu an: {scanProgress.currentFile.split('\\').pop() || scanProgress.currentFile.split('/').pop()}
                </div>
              )}
            </div>
            <button className="cancel-scan-btn" onClick={handleCancel}>
              ❌ Taramayı İptal Et
            </button>
          </div>
        ) : (
          <>
            <div className="disk-selection-content">
              <p className="disk-selection-description">
                Benzer görselleri bulmak için taranacak diskleri seçin. 
                Seçilen disklerdeki tüm görseller otomatik olarak işlenecek, veritabanına eklenecek ve ardından arama yapılacak.
              </p>

              <div className="disk-selection-controls">
                <button 
                  className="select-all-btn" 
                  onClick={toggleAllDrives}
                  disabled={drives.length === 0}
                >
                  {selectedDrives.length === drives.length ? '❌ Tümünü Kaldır' : '✅ Tümünü Seç'}
                </button>
              </div>

              <div className="disk-list">
                {drives.map((drive) => (
                  <label key={drive} className="disk-item">
                    <input 
                      type="checkbox" 
                      checked={selectedDrives.includes(drive)} 
                      onChange={() => toggleDrive(drive)}
                      disabled={scanning}
                    />
                    <span className="disk-icon">💾</span>
                    <span className="disk-name">{drive}</span>
                    <span className="disk-info">Yerel Disk</span>
                  </label>
                ))}
                {drives.length === 0 && (
                  <p className="no-drives">Disk bulunamadı...</p>
                )}
              </div>

              <div className="disk-selection-summary">
                <p>
                  <strong>{selectedDrives.length}</strong> disk seçildi
                  {selectedDrives.length > 0 && (
                    <span>: {selectedDrives.join(', ')}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="disk-selection-actions">
              <button 
                className="start-scan-btn" 
                onClick={handleStartScan}
                disabled={selectedDrives.length === 0}
              >
                🚀 Taramayı Başlat ve Ara
              </button>
              <button className="cancel-btn" onClick={handleCancel}>
                İptal
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

DiskSelectionDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onScanComplete: PropTypes.func.isRequired
};

export default DiskSelectionDialog; 
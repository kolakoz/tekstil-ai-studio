import React, { useState, useEffect } from 'react';
import './DiskSelector.css';

const DiskSelector = ({ onScanComplete, onClose, compact = false }) => {
  const [disks, setDisks] = useState([]);
  const [selectedDisks, setSelectedDisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(null);


  useEffect(() => {
    loadDisks();
    
    // Tarama ilerlemesini dinle
    const handleScanProgress = (progress) => {
      setScanProgress(progress);
    };
    
    window.electronAPI.onScanProgress(handleScanProgress);
    
    return () => {
      // Cleanup
    };
  }, []);

  const loadDisks = async () => {
    try {
      // Gerçek disk listesini al
      const result = await window.electronAPI.getDisks();
      
      if (result.success) {
        setDisks(result.disks);
      } else {
        console.error('❌ Disk listesi alınamadı:', result.error);
        // Fallback: Mock data
        setDisks([
          {
            letter: 'C:',
            name: 'System Disk',
            totalSpace: 500 * 1024 * 1024 * 1024,
            freeSpace: 200 * 1024 * 1024 * 1024,
            type: 'NTFS'
          },
          {
            letter: 'D:',
            name: 'Data Disk',
            totalSpace: 1000 * 1024 * 1024 * 1024,
            freeSpace: 800 * 1024 * 1024 * 1024,
            type: 'NTFS'
          },
          {
            letter: 'E:',
            name: 'External Disk',
            totalSpace: 2000 * 1024 * 1024 * 1024,
            freeSpace: 1500 * 1024 * 1024 * 1024,
            type: 'exFAT'
          }
        ]);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('❌ Disk yükleme hatası:', error);
      setLoading(false);
    }
  };

  const toggleDisk = (diskLetter) => {
    setSelectedDisks(prev => 
      prev.includes(diskLetter)
        ? prev.filter(d => d !== diskLetter)
        : [...prev, diskLetter]
    );
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getDiskIcon = (diskType) => {
    switch (diskType) {
      case 'NTFS':
        return '💾';
      case 'exFAT':
        return '🔗';
      case 'FAT32':
        return '💿';
      default:
        return '💽';
    }
  };

  const [scanHistory, setScanHistory] = useState([]);
  const [isFirstScan, setIsFirstScan] = useState(true);

  // Component mount olduğunda tarama geçmişini kontrol et
  useEffect(() => {
    checkScanHistory();
  }, []);

  const checkScanHistory = async () => {
    try {
      const { success, history } = await window.electronAPI.getScanHistory();
      if (success && history.length > 0) {
        setScanHistory(history);
        setIsFirstScan(false);
      }
    } catch (error) {
      console.error('Tarama geçmişi kontrol hatası:', error);
    }
  };

  const handleScan = async () => {
    if (selectedDisks.length === 0) {
      alert('Lütfen en az bir disk seçin');
      return;
    }

    // Tarama modunu belirle
    const scanMode = isFirstScan ? 'full' : 'quick';
    
    setScanning(true);
    
    try {
      // Seçili diskleri tara
      console.log('🔍 Seçili diskler:', selectedDisks);
      console.log('📋 Tarama modu:', scanMode);
      
      const result = await window.electronAPI.scanDrives({
        drives: selectedDisks,
        scanMode: scanMode
      });
      
      if (result.success) {
        console.log('✅ Akıllı disk tarama tamamlandı:', result);
        onScanComplete && onScanComplete(selectedDisks, result);
      } else {
        console.error('❌ Disk tarama hatası:', result.error);
        alert(`Tarama hatası: ${result.error}`);
      }
      
    } catch (error) {
      console.error('❌ Tarama hatası:', error);
      alert('Tarama sırasında hata oluştu');
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="disk-selector loading">
        <div>💾 Diskler yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className={`disk-selector ${compact ? 'compact' : ''}`}>
      {!compact && <h2>💾 Disk Seçin</h2>}
      
      <div className="disk-list">
        {loading ? (
          <div className="loading-disks">💾 Diskler yükleniyor...</div>
        ) : disks && disks.length > 0 ? (
          disks.map((disk) => {
          const isSelected = selectedDisks.includes(disk.letter);
          const usedSpace = disk.totalSpace - disk.freeSpace;
          const usedPercentage = (usedSpace / disk.totalSpace) * 100;
          
          return (
            <div
              key={disk.letter}
              className={`disk-item ${isSelected ? 'selected' : ''}`}
              onClick={() => toggleDisk(disk.letter)}
            >
              <div className="disk-icon">
                {getDiskIcon(disk.type)}
              </div>
              
              <div className="disk-info">
                <div className="disk-name">{disk.name}</div>
                <div className="disk-letter">{disk.letter} ({disk.type})</div>
                
                {!compact && (
                  <div className="disk-space">
                    <div className="space-text">
                      {formatBytes(usedSpace)} / {formatBytes(disk.totalSpace)} kullanılıyor
                    </div>
                    <div className="space-bar">
                      <div 
                        className="space-used" 
                        style={{ width: `${usedPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="disk-checkbox">
                {isSelected ? '✓' : ''}
              </div>
            </div>
          );
        })
        ) : (
          <div className="no-disks">💾 Disk bulunamadı</div>
        )}
      </div>
      
      {/* İlerleme Göstergesi */}
      {scanning && scanProgress && (
        <div className="scan-progress">
          <div className="progress-header">
            <h3>🔄 Akıllı Tarama Yapılıyor</h3>
            <div className="progress-stats">
              <span>📁 {scanProgress.currentDisk}</span>
              <span>📄 {scanProgress.currentFile}</span>
            </div>
          </div>
          
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
            ></div>
          </div>
          
          <div className="progress-details">
            <div className="progress-item">
              <span className="label">📥 Yeni:</span>
              <span className="value">{scanProgress.found || 0}</span>
            </div>
            <div className="progress-item">
              <span className="label">🔄 Güncellenen:</span>
              <span className="value">{scanProgress.updated || 0}</span>
            </div>
            <div className="progress-item">
              <span className="label">🗑️ Temizlenen:</span>
              <span className="value">{scanProgress.cleaned || 0}</span>
            </div>
          </div>
          
          <div className="progress-mode">
            {scanProgress.mode === 'scanning' ? '🔍 Dosyalar taranıyor...' : '⚙️ Görseller işleniyor...'}
          </div>
        </div>
      )}



      {/* Tarama Seçenekleri */}
      <div className="scan-options">
        <div className="scan-mode-indicator">
          <span className={`mode-badge ${isFirstScan ? 'full' : 'quick'}`}>
            {isFirstScan ? '🔍 İlk Tarama' : '⚡ Hızlı Güncelleme'}
          </span>
          {!isFirstScan && scanHistory.length > 0 && (
            <span className="last-scan">
              Son tarama: {new Date(scanHistory[0]?.completed_at).toLocaleDateString('tr-TR')}
            </span>
          )}
        </div>
        
        <div className="scan-info">
          <div className="info-item">
            <span className="info-icon">💾</span>
            <span className="info-text">Sistem dosyaları hariç tüm diskler taranır</span>
          </div>
          <div className="info-item">
            <span className="info-icon">👥</span>
            <span className="info-text">Tüm kullanıcıların klasörleri dahil</span>
          </div>
          <div className="info-item">
            <span className="info-icon">⚡</span>
            <span className="info-text">Akıllı tarama ile hızlı işlem</span>
          </div>
        </div>
      </div>

      {!compact && (
        <div className="disk-actions">
          <button
            className="scan-button"
            onClick={handleScan}
            disabled={scanning || selectedDisks.length === 0}
          >
            {scanning ? '🔄 Taranıyor...' : '🔍 Akıllı Tarama Başlat'}
          </button>
          
          <button
            className="scan-button"
            onClick={onClose}
            style={{ 
              marginLeft: '1rem', 
              background: '#666',
              fontSize: '0.9rem',
              padding: '0.5rem 1rem'
            }}
          >
            İptal
          </button>
        </div>
      )}
      
      {compact && (
        <div className="compact-actions">
          <button
            className="compact-scan-button"
            onClick={handleScan}
            disabled={scanning || selectedDisks.length === 0}
          >
            {scanning ? '🔄 Taranıyor...' : '🔍 Tara'}
          </button>
        </div>
      )}
    </div>
  );
};

export default DiskSelector; 
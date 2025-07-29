import React, { useState, useEffect } from 'react';
import './AutoScan.css';

const AutoScan = ({ onScanComplete }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [scanInterval, setScanInterval] = useState(30); // dakika
  const [selectedDrives, setSelectedDrives] = useState([]);
  const [availableDrives, setAvailableDrives] = useState([]);
  const [lastScan, setLastScan] = useState(null);
  const [nextScan, setNextScan] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStats, setScanStats] = useState({
    totalScans: 0,
    totalImages: 0,
    lastScanTime: null,
    averageScanTime: 0
  });

  useEffect(() => {
    loadDrives();
    loadAutoScanConfig();
    loadScanStats();
  }, []);

  useEffect(() => {
    if (isEnabled && selectedDrives.length > 0) {
      scheduleNextScan();
    }
  }, [isEnabled, scanInterval, selectedDrives]);

  const loadDrives = async () => {
    try {
      const result = await window.electronAPI.listDrives();
      if (result.success) {
        setAvailableDrives(result.drives);
      }
    } catch (error) {
      console.error('Disk listesi yükleme hatası:', error);
    }
  };

  const loadAutoScanConfig = async () => {
    try {
      const config = await window.electronAPI.getAutoScanConfig();
      if (config) {
        setIsEnabled(config.enabled || false);
        setScanInterval(config.interval || 30);
        setSelectedDrives(config.drives || []);
        setLastScan(config.lastScan ? new Date(config.lastScan) : null);
      }
    } catch (error) {
      console.error('Otomatik tarama konfigürasyonu yükleme hatası:', error);
    }
  };

  const loadScanStats = async () => {
    try {
      const stats = await window.electronAPI.getAutoScanStats();
      if (stats) {
        setScanStats(stats);
      }
    } catch (error) {
      console.error('Tarama istatistikleri yükleme hatası:', error);
    }
  };

  const saveConfig = async () => {
    try {
      const config = {
        enabled: isEnabled,
        interval: scanInterval,
        drives: selectedDrives,
        lastScan: lastScan ? lastScan.toISOString() : null
      };
      
      await window.electronAPI.setAutoScanConfig(config);
      console.log('✅ Otomatik tarama konfigürasyonu kaydedildi');
    } catch (error) {
      console.error('❌ Konfigürasyon kaydetme hatası:', error);
    }
  };

  const scheduleNextScan = () => {
    if (isEnabled && selectedDrives.length > 0) {
      const next = new Date();
      next.setMinutes(next.getMinutes() + scanInterval);
      setNextScan(next);
    } else {
      setNextScan(null);
    }
  };

  const toggleAutoScan = async () => {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    
    if (newEnabled && selectedDrives.length === 0) {
      alert('Lütfen en az bir disk seçin');
      setIsEnabled(false);
      return;
    }
    
    await saveConfig();
    
    if (newEnabled) {
      scheduleNextScan();
    }
  };

  const handleDriveToggle = (driveLetter) => {
    const newDrives = selectedDrives.includes(driveLetter)
      ? selectedDrives.filter(d => d !== driveLetter)
      : [...selectedDrives, driveLetter];
    
    setSelectedDrives(newDrives);
    saveConfig();
  };

  const handleIntervalChange = (newInterval) => {
    setScanInterval(newInterval);
    saveConfig();
  };

  const startManualScan = async () => {
    if (selectedDrives.length === 0) {
      alert('Lütfen en az bir disk seçin');
      return;
    }

    setIsScanning(true);
    try {
      const result = await window.electronAPI.startAutoScan(selectedDrives);
      if (result.success) {
        setLastScan(new Date());
        setScanStats(prev => ({
          ...prev,
          totalScans: prev.totalScans + 1,
          totalImages: prev.totalImages + (result.processed || 0),
          lastScanTime: new Date().toISOString()
        }));
        
        if (onScanComplete) {
          onScanComplete(result);
        }
      }
    } catch (error) {
      console.error('Manuel tarama hatası:', error);
      alert('Tarama sırasında hata oluştu');
    } finally {
      setIsScanning(false);
    }
  };

  const formatTime = (date) => {
    if (!date) return 'Henüz yok';
    return date.toLocaleString('tr-TR');
  };

  const formatTimeUntil = (date) => {
    if (!date) return '';
    const now = new Date();
    const diff = date - now;
    if (diff <= 0) return 'Şimdi';
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} gün ${hours % 24} saat`;
    if (hours > 0) return `${hours} saat ${minutes % 60} dakika`;
    return `${minutes} dakika`;
  };

  return (
    <div className="auto-scan">
      <div className="auto-scan-header">
        <h3>🔄 Otomatik Tarama</h3>
        <p>Belirli aralıklarla diskleri otomatik tarayın</p>
      </div>

      {/* Ana Kontrol */}
      <div className="main-control">
        <div className="control-row">
          <div className="control-label">
            <h4>Otomatik Tarama</h4>
            <p>Düzenli aralıklarla seçili diskleri tara</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={toggleAutoScan}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      {/* Tarama Aralığı */}
      <div className="interval-section">
        <h4>Tarama Aralığı: {scanInterval} dakika</h4>
        <input
          type="range"
          min="15"
          max="1440"
          step="15"
          value={scanInterval}
          onChange={(e) => handleIntervalChange(parseInt(e.target.value))}
          className="interval-slider"
          disabled={!isEnabled}
        />
        <div className="interval-labels">
          <span>15 dk</span>
          <span>1 saat</span>
          <span>6 saat</span>
          <span>24 saat</span>
        </div>
      </div>

      {/* Disk Seçimi */}
      <div className="drives-section">
        <h4>Seçili Diskler ({selectedDrives.length})</h4>
        <div className="drives-grid">
          {availableDrives.map((drive) => (
            <div
              key={drive.letter}
              className={`drive-option ${selectedDrives.includes(drive.letter) ? 'selected' : ''}`}
              onClick={() => handleDriveToggle(drive.letter)}
            >
              <div className="drive-icon">💾</div>
              <div className="drive-info">
                <span className="drive-letter">{drive.letter}:</span>
                <span className="drive-name">{drive.name}</span>
                <span className="drive-space">
                  {Math.round(drive.freeSpace / (1024 * 1024 * 1024))} GB boş
                </span>
              </div>
              <div className="drive-checkbox">
                {selectedDrives.includes(drive.letter) && '✓'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Durum Bilgisi */}
      <div className="status-section">
        <h4>Durum Bilgisi</h4>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">Son Tarama:</span>
            <span className="status-value">{formatTime(lastScan)}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Sonraki Tarama:</span>
            <span className="status-value">
              {isEnabled && nextScan ? formatTimeUntil(nextScan) : 'Devre dışı'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Toplam Tarama:</span>
            <span className="status-value">{scanStats.totalScans}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Toplam Görsel:</span>
            <span className="status-value">{scanStats.totalImages.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Manuel Tarama */}
      <div className="manual-scan-section">
        <h4>Manuel Tarama</h4>
        <p>Hemen tarama başlatın</p>
        <button
          onClick={startManualScan}
          disabled={isScanning || selectedDrives.length === 0}
          className="manual-scan-btn"
        >
          {isScanning ? '🔄 Tara...' : '🚀 Taramayı Başlat'}
        </button>
      </div>

      {/* İstatistikler */}
      <div className="stats-section">
        <h4>Tarama İstatistikleri</h4>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <span className="stat-value">{scanStats.totalScans}</span>
              <span className="stat-label">Toplam Tarama</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🖼️</div>
            <div className="stat-content">
              <span className="stat-value">{scanStats.totalImages.toLocaleString()}</span>
              <span className="stat-label">Toplam Görsel</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-content">
              <span className="stat-value">{Math.round(scanStats.averageScanTime)}s</span>
              <span className="stat-label">Ortalama Süre</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoScan; 
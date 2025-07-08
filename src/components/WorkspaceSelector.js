import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * WorkspaceSelector
 * - "Klasör Seç" butonu
 * - Seçilen klasör yolu gösterir
 * - "Taramayı Başlat" butonu
 * - İlerleme çubuğu ve toplam bulunan görsel sayısı
 */
const WorkspaceSelector = ({ onScanComplete }) => {
  const [selectedPath, setSelectedPath] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [found, setFound] = useState(0);

  useEffect(() => {
    // Progress listener
    window.electronAPI.onScanProgress((data) => {
      setProgress({ current: data.current, total: data.total });
    });
    window.electronAPI.onScanComplete((data) => {
      setIsScanning(false);
      setFound(data.total);
      if (onScanComplete) onScanComplete(data.total);
    });
  }, []);

  const handleSelectFolder = async () => {
    const path = await window.electronAPI.selectWorkspace();
    if (path) setSelectedPath(path);
  };

  const handleScan = async () => {
    if (!selectedPath) return;
    setFound(0);
    setProgress({ current: 0, total: 0 });
    setIsScanning(true);
    await window.electronAPI.scanWorkspace(selectedPath);
  };

  return (
    <div className="workspace-selector">
      <button className="primary" onClick={handleSelectFolder}>
        Klasör Seç
      </button>

      {selectedPath && (
        <div className="selected-path">{selectedPath}</div>
      )}

      {selectedPath && !isScanning && (
        <button className="accent" onClick={handleScan}>
          Taramayı Başlat
        </button>
      )}

      {isScanning && (
        <div className="progress-wrapper">
          <progress
            max={progress.total || 1}
            value={progress.current}
          />
          <span>{progress.current} / {progress.total}</span>
        </div>
      )}

      {found > 0 && !isScanning && (
        <div className="found-count">{found} görsel bulundu</div>
      )}
    </div>
  );
};

WorkspaceSelector.propTypes = {
  onScanComplete: PropTypes.func,
};

export default WorkspaceSelector; 
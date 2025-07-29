import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import './SettingsDialog.css';

/**
 * SettingsDialog
 * Bing API anahtarı ve internet arama modu için basit ayarlar penceresi
 */
function SettingsDialog({ isOpen, onClose }) {
  const [bingKey, setBingKey] = useState('');
  const [searchMode, setSearchMode] = useState('bing'); // 'bing' | 'scrape'
  const [saving, setSaving] = useState(false);
  const [threshold, setThreshold] = useState(60);
  const [fixingDb, setFixingDb] = useState(false);
  const [dbStatus, setDbStatus] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    // Ayarları yükle
    async function fetchConfig() {
      try {
        const cfg = await window.electronAPI.getConfig();
        setBingKey(cfg.bingApiKey || '');
        setSearchMode(cfg.internetSearchMode || 'bing');
        setThreshold(typeof cfg.similarityThreshold === 'number' ? cfg.similarityThreshold : 60);
      } catch (err) {
        console.error('getConfig error:', err);
      }
    }

    fetchConfig();
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    await window.electronAPI.setConfig({
      bingApiKey: bingKey.trim(),
      internetSearchMode: searchMode,
      similarityThreshold: Number(threshold),
    });
    setSaving(false);
    onClose();
  };

  const handleFixDatabase = async () => {
    setFixingDb(true);
    setDbStatus('Veritabanı düzeltiliyor...');
    
    try {
      const result = await window.electronAPI.fixDatabasePaths();
      if (result.success) {
        setDbStatus(`✓ Düzeltildi: ${result.fixedCount} dosya, Hata: ${result.errorCount}`);
      } else {
        setDbStatus(`✗ Hata: ${result.error}`);
      }
    } catch (error) {
      setDbStatus(`✗ Hata: ${error.message}`);
    }
    
    setFixingDb(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal settings-modal">
        <h2>Ayarlar</h2>

        <div className="form-group">
          <label htmlFor="bingKey">Bing API Anahtarı</label>
          <input
            id="bingKey"
            type="text"
            value={bingKey}
            onChange={(e) => setBingKey(e.target.value)}
            placeholder="xxx..."
          />
        </div>

        <div className="form-group">
          <label>İnternet Arama Modu</label>
          <select value={searchMode} onChange={(e) => setSearchMode(e.target.value)}>
            <option value="bing">Bing Visual Search (API)</option>
            <option value="scrape">Python Scraper (deneysel)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Benzerlik Eşiği (%)</label>
          <input
            type="number"
            min="10"
            max="100"
            value={threshold}
            onChange={(e)=>setThreshold(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Veritabanı Yönetimi</label>
          <div className="db-actions">
            <button 
              className="warning-button" 
              onClick={handleFixDatabase} 
              disabled={fixingDb}
            >
              {fixingDb ? 'Düzeltiliyor...' : 'Dosya Yollarını Düzelt'}
            </button>
            {dbStatus && (
              <div className="db-status">
                {dbStatus}
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} disabled={saving}>İptal</button>
          <button className="primary-button" onClick={handleSave} disabled={saving}>Kaydet</button>
        </div>
      </div>
    </div>
  );
}

SettingsDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default SettingsDialog; 

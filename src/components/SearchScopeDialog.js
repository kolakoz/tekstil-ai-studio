import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './SearchScopeDialog.css';

/**
 * SearchScopeDialog
 * Kullanıcıya arama kapsamını (yerel sürücüler veya internet) seçtiren basit modal
 */
function SearchScopeDialog({ isOpen, onClose, onConfirm }) {
  const [drives, setDrives] = useState([]);
  const [selectedDrives, setSelectedDrives] = useState([]);
  const [scope, setScope] = useState(() => localStorage.getItem('searchScope') || 'local'); // 'local' | 'internet'
  const [hasInternetOption, setHasInternetOption] = useState(false);

  // Config yükle ve internet seçeneğini belirle
  useEffect(() => {
    async function checkInternetOption() {
      if (!window.electronAPI?.getConfig) return;
      try {
        const cfg = await window.electronAPI.getConfig();
        const mode = cfg.internetSearchMode;
        const keyAvailable = cfg.bingApiKey && cfg.bingApiKey !== '';
        if (mode === 'scrape') {
          setHasInternetOption(true);
        } else if (mode === 'bing' && keyAvailable) {
          setHasInternetOption(true);
        } else {
          setHasInternetOption(false);
        }
      } catch (err) {
        console.error('getConfig error:', err);
      }
    }

    checkInternetOption();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (scope === 'local') {
      // Sürücü listesini al
      window.electronAPI?.listDrives().then((res) => {
        if (res.success) setDrives(res.drives);
      });
    }
  }, [isOpen, scope]);

  const toggleDrive = (drive) => {
    setSelectedDrives((prev) => {
      if (prev.includes(drive)) return prev.filter((d) => d !== drive);
      return [...prev, drive];
    });
  };

  const handleConfirm = () => {
    if (scope === 'local' && selectedDrives.length === 0) {
      alert('Lütfen en az bir sürücü seçin');
      return;
    }
    // Seçilen scope'u kaydet
    localStorage.setItem('searchScope', scope);
    if (scope === 'local') {
      localStorage.setItem('searchDrives', JSON.stringify(selectedDrives));
    }

    onConfirm({ scope, drives: selectedDrives });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Arama Kapsamı</h2>

        <div className="scope-options">
          <label>
            <input type="radio" name="scope" value="local" checked={scope === 'local'} onChange={() => setScope('local')} />
            Yerel Disk(ler)
          </label>
          {hasInternetOption && (
            <label>
              <input type="radio" name="scope" value="internet" checked={scope === 'internet'} onChange={() => setScope('internet')} />
              İnternet
            </label>
          )}
        </div>

        {scope === 'local' && (
          <div className="drive-list">
            {drives.map((d) => (
              <label key={d} className="drive-item">
                <input type="checkbox" checked={selectedDrives.includes(d)} onChange={() => toggleDrive(d)} />
                {d}
              </label>
            ))}
            {drives.length === 0 && <p>Sürücüler yükleniyor...</p>}
          </div>
        )}

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>İptal</button>
          <button className="primary-button" onClick={handleConfirm}>Kaydet ve Ara</button>
        </div>
      </div>
    </div>
  );
}

SearchScopeDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

export default SearchScopeDialog; 
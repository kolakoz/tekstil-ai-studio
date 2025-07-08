import React, { useState, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import SearchResults from './components/SearchResults';
import SearchScopeDialog from './components/SearchScopeDialog';
import SettingsDialog from './components/SettingsDialog';
import SearchOptions from './components/SearchOptions';
import './App.css';

function App() {
  const [isElectron, setIsElectron] = useState(false);
  const [selectedPath, setSelectedPath] = useState('');
  const [scanProgress, setScanProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [pendingImagePath, setPendingImagePath] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.6); // 0 - 1 arası
  const [weights, setWeights] = useState({ hog: 0.2, color: 0.1 });
  const [totalImageCount, setTotalImageCount] = useState(0);
  const [embeddingCount, setEmbeddingCount] = useState(0);

  /* ------------------------------- EFFECTS ------------------------------- */
  useEffect(() => {
    if (!window.electronAPI) return;

    setIsElectron(true);

    // Ping
    window.electronAPI.ping().then((res) => console.log('ping:', res));

    // Event listeners
    window.electronAPI.onScanProgress((data) => setScanProgress(data));
    window.electronAPI.onScanComplete(() => {
      setLoading(false);
      setScanProgress(null);
      updateImageCounts(); // Tarama bitince sayıları güncelle
    });

    // Drive scan event listeners (opsiyonel)
    window.electronAPI.onDriveScanProgress((data) => setScanProgress(data));
    window.electronAPI.onDriveScanComplete(() => {
      setLoading(false);
      setScanProgress(null);
      updateImageCounts(); // Sürücü taraması bitince sayıları güncelle
    });

    // Config'ten eşiği al
    window.electronAPI.getConfig().then((cfg) => {
      if (cfg && typeof cfg.similarityThreshold === 'number') {
        setSimilarityThreshold(cfg.similarityThreshold / 100); // eski config % cinsinden saklıysa dönüştür
      }
    });

    // Uygulama açıldığında – kayıtlı sürücü(ler) otomatik taransın
    // (async () => {
    //   const savedDrivesJson = localStorage.getItem('searchDrives');
    //   const savedScope = localStorage.getItem('searchScope');
    //   if (savedScope === 'local' && savedDrivesJson) {
    //     try {
    //       const savedDrives = JSON.parse(savedDrivesJson);
    //       if (Array.isArray(savedDrives) && savedDrives.length > 0) {
    //         setLoading(true);
    //         await window.electronAPI.scanDrives(savedDrives);
    //         setLoading(false);
    //       }
    //     } catch (err) {
    //       console.warn('Otomatik sürücü tarama hatası:', err);
    //     }
    //   }
    //   updateImageCounts(); // İlk açılışta da sayıları al
    // })();
    updateImageCounts(); // İlk açılışta da sayıları al
  }, []);

  // Global test sistemi - her zaman erişilebilir
  useEffect(() => {
    window.tekstilTest = {
      status: () => {
        console.log('=== TEST SİSTEMİ DURUMU ===');
        console.log('SearchResults yüklendi:', !!document.querySelector('.results-grid'));
        console.log('Arama sonuçları var:', !!document.querySelector('.result-card'));
        console.log('Modal sistemi hazır:', !!document.querySelector('.image-modal-overlay'));
        console.log('Pending Image Path:', pendingImagePath);
        console.log('Current SearchResults state length:', searchResults ? searchResults.length : 0);
        return {
          searchResultsLoaded: !!document.querySelector('.results-grid'),
          hasResults: !!searchResults && searchResults.length > 0,
          pendingImagePath: pendingImagePath
        };
      },
      
      quickSearch: async () => {
        console.log('🔍 Hızlı arama başlatılıyor...');
        
        if (!pendingImagePath) {
          console.error('❌ Önce bir görsel yükleyin!');
          return;
        }
        
        handleSearchRequest();
        console.log('✅ Arama başlatıldı (pendingImagePath ile)');
        
        // Otomatik olarak kapsamı onayla (test amaçlı)
        await window.tekstilTest.confirmScopeForTest();
      },
      
      runFullTest: async () => {
        const status = window.tekstilTest.status();
        
        // Eğer arama sonuçları yoksa veya pendingImagePath ayarlı değilse, quickSearch'i çalıştır
        if (!status.hasResults && !status.pendingImagePath) {
          console.error('❌ Önce bir arama yapın veya window.tekstilTest.quickSearch() çalıştırın (veya görsel yükleyin)');
          console.log('Otomatik olarak quickSearch başlatılıyor...');
          await window.tekstilTest.quickSearch();
          // quickSearch'in tamamlanması için bekle
          await new Promise(resolve => setTimeout(resolve, 2000)); 
          const newStatus = window.tekstilTest.status();
          if (!newStatus.hasResults) {
            console.error('❌ quickSearch sonrası arama sonuçları hala yok. Lütfen elle kontrol edin.');
            return;
          }
        } else if (!status.hasResults && status.pendingImagePath) {
          // pendingImagePath ayarlı ama sonuç yoksa, quickSearch'i çalıştır
          console.log('pendingImagePath ayarlı ancak sonuç yok. quickSearch başlatılıyor...');
          await window.tekstilTest.quickSearch();
          await new Promise(resolve => setTimeout(resolve, 2000)); 
          const newStatus = window.tekstilTest.status();
          if (!newStatus.hasResults) {
            console.error('❌ quickSearch sonrası arama sonuçları hala yok. Lütfen elle kontrol edin.');
            return;
          }
        }

        if (window.searchResultsTest) {
          return window.searchResultsTest.runTest();
        } else {
          console.error('❌ SearchResults test sistemi yüklenmemiş');
        }
      },
      
      setPendingImageForTest: (path) => {
        setPendingImagePath(path);
        console.log(`✅ Test için görsel yolu ayarlandı: ${path}`);
      },

      triggerSearchRequestForTest: () => {
        handleSearchRequest();
        console.log('✅ Test için handleSearchRequest tetiklendi.');
      },

      // Yeni: Arama kapsamını test amaçlı otomatik onayla
      confirmScopeForTest: async () => {
        console.log('✅ Test için arama kapsamı otomatik onaylanıyor...');
        // handleScopeConfirm fonksiyonunu doğrudan çağır
        await handleScopeConfirm({ scope: 'local', drives: [] }); 
        console.log('✅ Arama kapsamı onaylandı.');
      }

    };
    
    console.log('✅ Global test sistemi hazır!');
    console.log('Komutlar:');
    console.log('- window.tekstilTest.status() - Sistem durumunu kontrol et');
    console.log('- window.tekstilTest.quickSearch() - Hızlı arama yap (otomatik kapsam onayı ile)');
    console.log('- window.tekstilTest.runFullTest() - Tam test çalıştır');
    console.log('- window.tekstilTest.setPendingImageForTest(\'C:\\path\\to\\your\\image.jpg\') - Test için görsel yolu ayarla');
    console.log('- window.tekstilTest.triggerSearchRequestForTest() - Test için arama isteğini tetikle');
    console.log('- window.tekstilTest.confirmScopeForTest() - Test için arama kapsamını onayla');
  }, [pendingImagePath, handleSearchRequest, handleScopeConfirm]); // handleScopeConfirm bağımlılığını ekle

  const updateImageCounts = async () => {
    if (window.electronAPI?.getImageCounts) {
      const { totalCount, embeddingCount } = await window.electronAPI.getImageCounts();
      setTotalImageCount(totalCount);
      setEmbeddingCount(embeddingCount);
    }
  };

  /* ------------------------------ CALLBACKS ------------------------------ */
  const handleSelectWorkspace = async () => {
    const p = await window.electronAPI.selectWorkspace();
    if (p) setSelectedPath(p);
  };

  const handleScanWorkspace = async () => {
    if (!selectedPath) return;
    setLoading(true);
    await window.electronAPI.scanWorkspace(selectedPath);
    // tarama bittiğinde scan-complete event'i yakalanacak
  };

  const handleImageSelected = (imagePath) => {
    console.log('App.js - handleImageSelected: Gelen imagePath:', imagePath);
    if (imagePath) {
      setPendingImagePath(imagePath);
      setSearchResults(null);
      console.log('App.js - handleImageSelected: pendingImagePath ayarlandı:', imagePath);
    } else {
      console.log('App.js - handleImageSelected: imagePath boş veya tanımsız.');
    }
  };

  const handleSearchRequest = () => {
    if (!pendingImagePath) {
      alert('Lütfen önce bir görsel seçin');
      return;
    }
    setScopeDialogOpen(true);
  };

  // Scope diyalogundan gelen onay
  const handleScopeConfirm = async ({ scope, drives }) => {
    setScopeDialogOpen(false);

    if (!pendingImagePath) return;

    if (scope === 'local') {
      setLoading(true);
      // Daha önce taranmamış sürücüleri bul
      const toScan = drives.filter((d)=>!localStorage.getItem(`driveScanned:${d}`));
      if (toScan.length>0) {
        await window.electronAPI.scanDrives(toScan);
        toScan.forEach((d)=>localStorage.setItem(`driveScanned:${d}`, '1'));
      }
      const res = await window.electronAPI.searchSimilar(pendingImagePath, similarityThreshold, weights);
      const list = (res.success ? res.results : []).slice(0, 20);
      setSearchResults(list);
      setLoading(false);
    } else if (scope === 'internet') {
      const cfg = await window.electronAPI.getConfig();
      const mode = cfg.internetSearchMode || 'bing';

      if (mode === 'bing') {
        if (!cfg.bingApiKey || cfg.bingApiKey === '') {
          alert('Bing API anahtarı tanımlı değil. Ayarlardan ekleyin.');
          return;
        }
        setLoading(true);
        const res = await window.electronAPI.searchInternet(pendingImagePath);
        setSearchResults(res.success ? res.results : []);
        setLoading(false);
      } else if (mode === 'scrape') {
        alert('Python scraper entegrasyonu henüz uygulanmadı.');
      }
    }
  };

  const handleScopeCancel = () => {
    setScopeDialogOpen(false);
    setPendingImagePath(null);
  };

  const openInExplorer = (filepath) => {
    window.electronAPI.openInExplorer(filepath);
  };

  const handleClearDatabase = async () => {
    if (window.confirm('Tüm veritabanını temizlemek istediğinizden emin misiniz?')) {
      setLoading(true);
      await window.electronAPI.clearDatabase();
      localStorage.clear(); // Tüm localStorage verilerini de temizle
      setSearchResults(null);
      setPendingImagePath(null);
      setSelectedPath('');
      setScanProgress(null);
      updateImageCounts();
      setLoading(false);
      alert('Veritabanı temizlendi.');
    }
  };

  // Görsel yolu helper'ı – local-file protocol kullan
  const getImageUrl = (filepath) => {
    if (!filepath) return '';
    const normalized = filepath.replace(/\\/g, '/');
    if (window.electronAPI) {
      return `local-file://${encodeURIComponent(normalized)}`;
    }
    return filepath;
  };

  /* --------------------------- SETTINGS HANDLERS --------------------------- */
  const openSettings = () => setSettingsOpen(true);
  const closeSettings = () => setSettingsOpen(false);

  /* ------------------------------- RENDER ------------------------------- */
  return (
    <div className="App">
      <header className="app-header">
        <h1>🎯 Tekstil AI Studio</h1>
        <button className="settings-btn" onClick={openSettings} title="Ayarlar">⚙️</button>
      </header>

      {!isElectron ? (
        <p className="error-box">❌ Electron API bulunamadı</p>
      ) : (
        <>
          {/* Veritabanı Bilgileri ve Temizleme */} 
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <p>Veritabanında: {totalImageCount} Görsel, {embeddingCount} Embedding</p>
            <button className="secondary-button" onClick={handleClearDatabase}>Veritabanını Temizle</button>
          </div>

          {/* Benzerlik Eşiği & Arama Öncelikleri */}
          <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
            <label htmlFor="th-slider">Benzerlik Eşiği: {Math.round(similarityThreshold * 100)}%</label>
            <input
              id="th-slider"
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Search Options sliders */}
          <SearchOptions weights={weights} onChange={setWeights} />

          {/* Drive / workspace tarama ilerleme çubuğu */}
          {scanProgress && (
            <div className="progress-wrapper">
              <div className="progress-bar" style={{ width: `${scanProgress.total ? Math.min(100, (scanProgress.current / scanProgress.total) * 100) : 100}%` }} />
              <span className="progress-text">
                {scanProgress.status === 'skipped-dir' ? 'Klasör atlandı' : 'Tarama'}: {scanProgress.current}{scanProgress.total ? ` / ${scanProgress.total}` : ''} – {scanProgress.currentFile || ''}
              </span>
            </div>
          )}

          <div className="uploader-wrapper">
            <ImageUploader
              onImageSelected={handleImageSelected}
              onSearch={handleSearchRequest}
              onClear={() => {
                setSearchResults(null);
                setPendingImagePath(null);
              }}
            />
          </div>

          {/* Arama Sonuçları */}
          <SearchResults data={searchResults || []} getImageUrl={getImageUrl} onOpenInExplorer={openInExplorer} />

          <SearchScopeDialog
            isOpen={scopeDialogOpen}
            onClose={handleScopeCancel}
            onConfirm={handleScopeConfirm}
          />

          <SettingsDialog
            isOpen={settingsOpen}
            onClose={closeSettings}
          />
        </>
      )}
    </div>
  );
}

export default App; 
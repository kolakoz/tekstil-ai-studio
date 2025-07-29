import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import ImageGrid from './components/ImageGrid';
import SearchBar from './components/SearchBar';
import SidePanel from './components/SidePanel';
import StatusBar from './components/StatusBar';
import ImageUploader from './components/ImageUploader';
import SearchScopeDialog from './components/SearchScopeDialog';
import MonitoringDashboard from './components/MonitoringDashboard';
import ProjectMonitoringDashboard from './components/ProjectMonitoringDashboard';

function App() {
  const [images, setImages] = useState([]);
  const [filteredImages, setFilteredImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(true); // true olarak başlat
  const [stats, setStats] = useState({ total: 0, indexed: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // grid, list, masonry
  const [showUploader, setShowUploader] = useState(false);
  const [searchScopeOpen, setSearchScopeOpen] = useState(false);
  const [searchImage, setSearchImage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [imagesPerPage] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [monitoringMode, setMonitoringMode] = useState('system'); // 'system' veya 'project'
  
  useEffect(() => {
    // Component mount olduğunda verileri yükle
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setLoading(true);
      
      // Sadece istatistikleri yükle, görselleri yükleme
      const statsResult = await window.electronAPI.getStatistics();
      if (statsResult.success) {
        setStats({
          total: statsResult.stats.total_images || 0,
          indexed: statsResult.stats.active_images || 0,
          active: statsResult.stats.active_images || 0
        });
      }
      
      // Görselleri boş bırak - sadece arama sonuçlarında göster
      setImages([]);
      setFilteredImages([]);
      
      console.log('✅ Uygulama başlatıldı - Görseller sadece arama sonuçlarında gösterilecek');
      
    } catch (error) {
      console.error('Uygulama başlatma hatası:', error);
    } finally {
      setLoading(false);
    }
  };



  const handleSearch = async (searchTerm) => {
    console.log('🔄 handleSearch çağrıldı, searchTerm:', searchTerm);
    setSearchTerm(searchTerm); // State'i güncelle
    
    if (!searchTerm || searchTerm.trim() === '') {
      console.log('⚠️ Boş arama terimi, görselleri temizliyorum');
      // Arama temizlendi - görselleri temizle
      setFilteredImages([]);
      return;
    }
    
    try {
      console.log('🔄 Loading state true yapılıyor');
      setLoading(true);
      console.log('🔍 Metin araması başlatılıyor:', searchTerm);
      
      // Veritabanında arama yap
      console.log('🔄 window.electronAPI.searchByText çağrılıyor...');
      const searchResult = await window.electronAPI.searchByText(searchTerm);
      console.log('📊 searchByText sonucu:', searchResult);
      
      if (searchResult.success) {
        console.log(`✅ ${searchResult.images.length} sonuç bulundu`);
        console.log('🔍 Bulunan görseller:', searchResult.images.map(img => ({
          filename: img.filename,
          hasThumbnail: !!img.thumbnail,
          thumbnailLength: img.thumbnail ? img.thumbnail.length : 0
        })));
        setFilteredImages(searchResult.images);
        console.log('✅ filteredImages state güncellendi');
      } else {
        console.error('❌ Arama hatası:', searchResult.error);
        setFilteredImages([]);
      }
      
    } catch (error) {
      console.error('❌ Arama hatası:', error);
      setFilteredImages([]);
    } finally {
      console.log('🔄 Loading state false yapılıyor');
      setLoading(false);
    }
  };

  const handleImageSearch = async (imageData) => {
    if (!imageData) {
      // Görsel temizlendi
      setSelectedImage(null);
      setFilteredImages(images);
      return;
    }

    try {
      console.log('🔍 Görsel arama başlatılıyor...', imageData);
      
      // Direkt disk seçme modalını aç
      setSearchImage(imageData);
      setSearchScopeOpen(true);
      
    } catch (error) {
      console.error('❌ Görsel arama hatası:', error);
      alert('Arama sırasında hata oluştu: ' + error.message);
    }
  };

  const handleSearchScopeConfirm = async (result) => {
    try {
      setLoading(true);
      setSearchScopeOpen(false);
      
      if (result.success) {
        console.log('✅ Arama tamamlandı:', result.count, 'sonuç');
        console.log('🔍 Aranan diskler:', result.searchedDrives);
        setFilteredImages(result.images);
        setCurrentPage(1);
        setTotalPages(Math.ceil(result.count / imagesPerPage));
      } else {
        console.error('❌ Arama hatası:', result.error);
        alert('Arama sırasında hata oluştu: ' + result.error);
      }
    } catch (error) {
      console.error('❌ Arama sonucu işleme hatası:', error);
      alert('Arama sonucu işlenirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = async (image) => {
    setSelectedImage(image);
    setSidebarOpen(true);
    
    // Benzer görselleri bul (varsayılan threshold: 0.8)
    try {
      const similar = await window.electronAPI.searchSimilarFromDb({
        imagePath: image.filepath,
        threshold: 0.8
      });
      if (similar.success) {
        setSelectedImage({ ...image, similar: similar.results });
      }
    } catch (error) {
      console.error('Benzer görsel arama hatası:', error);
    }
  };

  const handleScan = async () => {
    setLoading(true);
    setSidebarOpen(true);
    
    try {
      console.log('🔍 Akıllı tarama başlatılıyor...');
      
      // Mevcut diskleri al
      const drivesResult = await window.electronAPI.listDrives();
      if (!drivesResult.success) {
        throw new Error('Diskler alınamadı');
      }
      
      const drives = drivesResult.drives.map(d => d.letter);
      console.log('💿 Taranacak diskler:', drives);
      
      // Akıllı taramayı başlat
      const result = await window.electronAPI.scanDrives({
        drives,
        scanMode: 'smart' // Akıllı tarama modu
      });
      
      if (result.success) {
        if (result.skipped) {
          console.log('✅ Tarama atlandı:', result.reason);
          alert(`Tarama atlandı: ${result.reason === 'up_to_date' ? 'Veritabanı güncel' : result.reason}`);
        } else {
          console.log('✅ Tarama tamamlandı:', result.totalStats);
          alert(`Tarama tamamlandı!\nYeni: ${result.totalStats.newFiles}\nGüncellenen: ${result.totalStats.updatedFiles}\nSilinen: ${result.totalStats.deletedFiles}`);
        }
        
        // Görselleri yeniden yükle
        await initializeApp();
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('❌ Tarama hatası:', error);
      alert('Tarama sırasında hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImagesAdded = (newImages) => {
    console.log('🔄 handleImagesAdded çağrıldı:', newImages);
    
    if (newImages && Array.isArray(newImages) && newImages.length > 0) {
      console.log('✅ Geçerli görseller alındı, sayı:', newImages.length);
      
      // Eklenen ilk görselin adını otomatik olarak arama çubuğuna yaz ve arama fonksiyonunu tetikle
      const firstImage = newImages[0];
      console.log('🔍 İlk görsel:', firstImage);
      
      if (firstImage && firstImage.filename) {
        console.log('🔍 Eklenen görsel için otomatik arama başlatılıyor:', firstImage.filename);
        setSearchTerm(firstImage.filename); // State'i güncelle
        console.log('✅ searchTerm state güncellendi:', firstImage.filename);
        
        // Arama fonksiyonunu çağır
        console.log('🔄 handleSearch fonksiyonu çağrılıyor...');
        handleSearch(firstImage.filename); // Arama fonksiyonunu çağır
        console.log('✅ handleSearch fonksiyonu çağrıldı');
      } else {
        console.warn('⚠️ İlk görselde filename yok:', firstImage);
      }
      
      setImages(prev => [...newImages, ...prev]);
      setFilteredImages(prev => [...newImages, ...prev]);
      console.log('✅ State güncellemeleri tamamlandı');
      
      // İstatistikleri güncelle
      initializeApp();
    } else {
      console.warn('⚠️ Geçersiz görsel verisi:', newImages);
    }
  };

  return (
    <div className="app">
      {showMonitoring ? (
        monitoringMode === 'project' ? (
          <ProjectMonitoringDashboard />
        ) : (
          <MonitoringDashboard />
        )
      ) : (
        <>
          <div className="main-content">
            <SearchBar 
              onSearch={handleSearch}
              onScan={handleScan}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onImageSearch={handleImageSearch}
              searchTerm={searchTerm}
              onMonitoringToggle={() => setShowMonitoring(true)}
              onProjectMonitoringToggle={() => {
                setMonitoringMode('project');
                setShowMonitoring(true);
              }}
            />
            
            <ImageGrid 
              images={filteredImages}
              onImageSelect={handleImageSelect}
              viewMode={viewMode}
              loading={loading}
              onUpload={() => setShowUploader(true)}
            />
          </div>

          <SidePanel 
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            selectedImage={selectedImage}
            onScanComplete={() => {
              initializeApp();
            }}
            onImageUpdate={(updatedImage) => {
              setSelectedImage(updatedImage);
            }}
          />

          <StatusBar stats={stats} />

          {showUploader && (
            <ImageUploader
              onImagesAdded={handleImagesAdded}
              onClose={() => setShowUploader(false)}
            />
          )}

          <SearchScopeDialog
            isOpen={searchScopeOpen}
            onClose={() => setSearchScopeOpen(false)}
            onConfirm={handleSearchScopeConfirm}
            searchImage={searchImage}
          />
        </>
      )}
      
      {/* Monitoring Dashboard'dan geri dönüş butonu */}
      {showMonitoring && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          gap: '10px'
        }}>
          <button 
            className="monitoring-back-btn"
            onClick={() => {
              setShowMonitoring(false);
              setMonitoringMode('system');
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Ana Sayfaya Dön
          </button>
          
          <button 
            className="monitoring-switch-btn"
            onClick={() => setMonitoringMode(monitoringMode === 'system' ? 'project' : 'system')}
            style={{
              padding: '10px 20px',
              backgroundColor: monitoringMode === 'system' ? '#28a745' : '#ffc107',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {monitoringMode === 'system' ? '🏗️ Proje Modu' : '📊 Sistem Modu'}
          </button>
        </div>
      )}
    </div>
  );
}

export default App; 

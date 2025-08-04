/**
 * Tekstil AI Studio - Ana Uygulama Bileşeni
 * 
 * Bu bileşen uygulamanın ana mantığını yönetir:
 * - Görsel arama ve filtreleme
 * - Disk tarama işlemleri
 * - Monitoring dashboard entegrasyonu
 * - State yönetimi
 */

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
  // State tanımlamaları
  const [images, setImages] = useState([]);
  const [filteredImages, setFilteredImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(true);
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
  
  // Component mount olduğunda uygulamayı başlat
  useEffect(() => {
    initializeApp();
  }, []);

  /**
   * Uygulamayı başlatır ve temel verileri yükler
   */
  const initializeApp = async () => {
    try {
      setLoading(true);
      
      // İstatistikleri yükle
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
      
    } catch (error) {
      console.error('Uygulama başlatma hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Metin tabanlı arama işlemini gerçekleştirir
   * @param {string} searchTerm - Aranacak metin
   */
  const handleSearch = async (searchTerm) => {
    setSearchTerm(searchTerm);
    
    if (!searchTerm || searchTerm.trim() === '') {
      // Arama temizlendi - görselleri temizle
      setFilteredImages([]);
      return;
    }
    
    try {
      setLoading(true);
      
      // Veritabanında arama yap
      const searchResult = await window.electronAPI.searchByText(searchTerm);
      
      if (searchResult.success) {
        setFilteredImages(searchResult.images);
      } else {
        console.error('Arama hatası:', searchResult.error);
        setFilteredImages([]);
      }
      
    } catch (error) {
      console.error('Arama hatası:', error);
      setFilteredImages([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Görsel tabanlı arama işlemini başlatır
   * @param {Object} imageData - Aranacak görsel verisi
   */
  const handleImageSearch = async (imageData) => {
    if (!imageData) {
      // Görsel temizlendi
      setSelectedImage(null);
      setFilteredImages(images);
      return;
    }

    try {
      // Disk seçme modalını aç
      setSearchImage(imageData);
      setSearchScopeOpen(true);
      
    } catch (error) {
      console.error('Görsel arama hatası:', error);
      alert('Arama sırasında hata oluştu: ' + error.message);
    }
  };

  /**
   * Arama kapsamı onaylandığında sonuçları işler
   * @param {Object} result - Arama sonucu
   */
  const handleSearchScopeConfirm = async (result) => {
    try {
      setLoading(true);
      setSearchScopeOpen(false);
      
      if (result.success) {
        setFilteredImages(result.images);
        setCurrentPage(1);
        setTotalPages(Math.ceil(result.count / imagesPerPage));
      } else {
        console.error('Arama hatası:', result.error);
        alert('Arama sırasında hata oluştu: ' + result.error);
      }
    } catch (error) {
      console.error('Arama sonucu işleme hatası:', error);
      alert('Arama sonucu işlenirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Görsel seçildiğinde benzer görselleri bulur
   * @param {Object} image - Seçilen görsel
   */
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

  /**
   * Akıllı disk tarama işlemini başlatır
   */
  const handleScan = async () => {
    setLoading(true);
    setSidebarOpen(true);
    
    try {
      // Mevcut diskleri al
      const drivesResult = await window.electronAPI.listDrives();
      if (!drivesResult.success) {
        throw new Error('Diskler alınamadı');
      }
      
      const drives = drivesResult.drives.map(d => d.letter);
      
      // Akıllı taramayı başlat
      const result = await window.electronAPI.scanDrives({
        drives,
        scanMode: 'smart' // Akıllı tarama modu
      });
      
      if (result.success) {
        if (result.skipped) {
          alert(`Tarama atlandı: ${result.reason === 'up_to_date' ? 'Veritabanı güncel' : result.reason}`);
        } else {
          alert(`Tarama tamamlandı!\nYeni: ${result.totalStats.newFiles}\nGüncellenen: ${result.totalStats.updatedFiles}\nSilinen: ${result.totalStats.deletedFiles}`);
        }
        
        // Görselleri yeniden yükle
        await initializeApp();
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('Tarama hatası:', error);
      alert('Tarama sırasında hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Yeni görseller eklendiğinde otomatik arama başlatır
   * @param {Array} newImages - Eklenen görseller
   */
  const handleImagesAdded = (newImages) => {
    if (newImages && Array.isArray(newImages) && newImages.length > 0) {
      // Eklenen ilk görselin adını otomatik olarak arama çubuğuna yaz
      const firstImage = newImages[0];
      
      if (firstImage && firstImage.filename) {
        setSearchTerm(firstImage.filename);
        handleSearch(firstImage.filename);
      }
      
      setImages(prev => [...newImages, ...prev]);
      setFilteredImages(prev => [...newImages, ...prev]);
      
      // İstatistikleri güncelle
      initializeApp();
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

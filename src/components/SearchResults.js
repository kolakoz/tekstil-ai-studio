import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import SafeImage from './SafeImage';
import './SearchResults.css';

/**
 * SearchResults
 * Görsel sonuçlarını grid şeklinde gösterir
 */
const SearchResults = ({ data = [], onOpenInExplorer, getImageUrl }) => {
  const [menu, setMenu] = useState(null); // {x,y,item}
  const [selectedImage, setSelectedImage] = useState(null); // Yeni state
  const [showModal, setShowModal] = useState(false);

  // Test için global değişkenler - güncelleme
  useEffect(() => {
    // SearchResults test fonksiyonlarını ayrı objeye kaydet
    window.searchResultsTest = {
      clickFirstImage: () => {
        const firstImage = document.querySelector('.result-card');
        if (firstImage) {
          firstImage.click();
          console.log('✅ İlk görsele otomatik tıklandı');
          return true;
        } else {
          console.error('❌ Görsel bulunamadı');
          return false;
        }
      },
      
      checkModal: () => {
        const modal = document.querySelector('.image-modal-overlay');
        const modalImage = document.querySelector('.modal-image img, .modal-image');
        
        let modalVisible = false;
        if (modal) {
          const computedStyle = window.getComputedStyle(modal);
          console.log('Modal computed style - display:', computedStyle.display);
          console.log('Modal computed style - visibility:', computedStyle.visibility);
          console.log('Modal computed style - opacity:', computedStyle.opacity);
          if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden' && computedStyle.opacity !== '0') {
            modalVisible = true;
          }
        }

        console.log('=== MODAL TEST RAPORU ===');
        console.log('Modal açık mı?', modalVisible ? '✅ Evet' : '❌ Hayır');
        console.log('Görsel elementi var mı?', modalImage ? '✅ Evet' : '❌ Hayır');
        
        if (modalImage) {
          console.log('Görsel src:', modalImage.src || 'SafeImage component');
          console.log('Görsel protokolü:', modalImage.src ? modalImage.src.substring(0, 20) : 'N/A');
          
          // Base64 mi kontrol et
          if (modalImage.src && modalImage.src.startsWith('data:image')) {
            console.log('✅ Base64 görsel kullanılıyor (CSP güvenli)');
          }
        }
        
        return {
          modalOpen: modalVisible,
          imageVisible: !!modalImage
        };
      },
      
      runTest: async () => {
        console.log('🚀 SearchResults test başlatılıyor...');
        
        // 1. İlk görsele tıkla
        const clicked = window.searchResultsTest.clickFirstImage();
        if (!clicked) return;
        
        // 2. Modal'ın açılmasını bekle (setShowModal sonrası render için biraz zaman tanı)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 3. Modal durumunu kontrol et
        const result = window.searchResultsTest.checkModal();
        
        // 4. Sonuç raporu
        console.log('\n📊 TEST SONUCU:');
        console.log('- Modal açıldı:', result.modalOpen ? '✅' : '❌');
        console.log('- Görsel görünüyor:', result.imageVisible ? '✅' : '❌');
        
        return result;
      }
    };
    
    console.log('✅ SearchResults test sistemi yüklendi!');
  }, []);

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, item });
  };

  const handleImageClick = (item) => {
    console.log('=== Modal Debug ===');
    console.log('Selected image:', item);
    console.log('Filepath:', item.filepath);
    console.log('Has SafeImage:', typeof SafeImage !== 'undefined');
    console.log('Current showModal state (before update):', showModal); // Güncel log
    setSelectedImage(item);
    setShowModal(true); // showModal'ı true yap
    console.log('Setting showModal to true'); // Güncel log
    // setTimeout bloğu kaldırıldı, showModal izlemesi için yeni useEffect kullanılacak
  };

  // Yeni: Büyük görseli kapat
  const handleCloseImageViewer = () => {
    setSelectedImage(null);
    setShowModal(false); // showModal'ı false yap
  };

  // showModal state değişimini izle
  useEffect(() => {
    console.log('➡️ showModal state değişti:', showModal);
    if (showModal) {
      console.log('Modal açıldı. Element var mı?', !!document.querySelector('.image-modal-overlay'));
    } else {
      console.log('Modal kapandı.');
    }
  }, [showModal]);

  useEffect(() => {
    const listener = () => setMenu(null);
    if (menu) {
      window.addEventListener('click', listener);
    }
    return () => window.removeEventListener('click', listener);
  }, [menu]);

  // Görsel yükleme hatalarını yakala
  useEffect(() => {
    const handleImageError = (e) => {
      if (e.target && e.target.tagName === 'IMG') {
        console.error('🖼️ Görsel yükleme hatası:', {
          src: e.target.src,
          alt: e.target.alt,
          protocol: e.target.src.substring(0, 10)
        });
      }
    };
    
    document.addEventListener('error', handleImageError, true);
    
    return () => {
      document.removeEventListener('error', handleImageError, true);
    };
  }, []);

  const handleShowInFolder = () => {
    if (menu?.item && onOpenInExplorer) onOpenInExplorer(menu.item.filepath);
    setMenu(null);
  };

  return (
    <div className="results-grid">
      {data.map((item) => (
        <div
          key={item.id || item.filepath}
          className="result-card"
          onContextMenu={(e) => handleContextMenu(e, item)}
          onClick={() => handleImageClick(item)} // Tıklama olayını ekle
        >
          <SafeImage filepath={item.filepath} alt={item.filename} className="thumb" style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
          <div className="info">
            <span className="score" style={{ visibility: (item.similarity||item.score)?'visible':'hidden' }}>%{(item.similarity ?? item.score)?.toFixed?.(0)}</span>
            <span className="name" title={item.filename}>{item.filename}</span>
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <p className="no-results">Henüz sonuç yok</p>
      )}

      {menu && (
        <ul className="context-menu" style={{ top: menu.y, left: menu.x }}>
          <li onClick={handleShowInFolder}>📂 Klasörde Göster</li>
          <li className="disabled">✏️ Düzenle (yakında)</li>
        </ul>
      )}

      {/* Yeni: Büyük görsel görüntüleyici */}
      {selectedImage && showModal && (
        <div 
          className="image-modal-overlay" 
          onClick={handleCloseImageViewer}
        > {/* Overlay'e tıklanınca kapat */}
          <div 
            className="image-modal-content" 
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={handleCloseImageViewer}>×</button>
            
            <SafeImage 
              filepath={selectedImage.filepath}
              alt={selectedImage.filename}
              className="modal-image"
              style={{ 
                maxWidth: '90vw', 
                maxHeight: '80vh', 
                objectFit: 'contain'
              }}
            />
            
            <div className="modal-info">
              <h3>{selectedImage.filename}</h3>
              <p>Benzerlik: %{selectedImage.similarity}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

SearchResults.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object),
  onOpenInExplorer: PropTypes.func,
  getImageUrl: PropTypes.func.isRequired, // Yeni prop tipi
};

export default SearchResults; 
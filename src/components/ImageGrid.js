import React from 'react';
import './ImageGrid.css';

function ImageGrid({ images, onImageSelect, viewMode, loading, onUpload }) {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="image-grid">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="image-card skeleton">
            <div className="image-container skeleton"></div>
            <div className="image-info">
              <div className="image-name skeleton"></div>
              <div className="image-meta skeleton"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!images || images.length === 0) {
    return (
      <div className="empty-state" onClick={onUpload}>
        <div className="empty-icon">📁</div>
        <h2>Henüz görsel yok</h2>
        <p>Dosya resmine tıklayarak görsel ekleyin</p>
        <div className="upload-hint">💡 Tıklayın</div>
      </div>
    );
  }

  return (
    <div className={`image-grid ${viewMode}`}>
      {images.filter(image => image && typeof image === 'object').map((image, index) => (
        <div
          key={image.id || index}
          className={`image-card ${viewMode}`}
          onClick={() => onImageSelect(image)}
        >
          {/* Benzerlik Skoru */}
          {image.similarity && (
            <div className="similarity-score">
              <span className="score-text">{Math.round(image.similarity * 100)}%</span>
              <span className="score-label">Benzer</span>
            </div>
          )}
          <div className="image-container">
            {image.thumbnail ? (
              <img
                src={image.thumbnail}
                alt={image.filename}
                loading="lazy"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div className="image-placeholder" style={{ display: image.thumbnail ? 'none' : 'flex' }}>
              <span className="placeholder-icon">🖼️</span>
            </div>
            
            <div className="image-overlay">
              <div className="overlay-buttons">
                <button
                  className="overlay-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageSelect(image);
                  }}
                  title="Görüntüle"
                >
                  👁️
                </button>
                <button
                  className="overlay-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Benzer görselleri ara
                    onImageSelect(image);
                  }}
                  title="Benzer Ara"
                >
                  🔍
                </button>
              </div>
            </div>
          </div>
          
          <div className="image-info">
            <div className="image-name" title={image.filename}>
              {image.filename}
            </div>
            <div className="image-meta">
              <span className="meta-size">{formatFileSize(image.filesize || 0)}</span>
              {image.width && image.height && (
                <span className="meta-dimensions">{image.width}×{image.height}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ImageGrid; 
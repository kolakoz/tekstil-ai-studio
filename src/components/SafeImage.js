import React, { useState, useEffect } from 'react';

function SafeImage({ filepath, alt = '', className = '', style = {} }) {
  const [src, setSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!filepath || !window.electronAPI) {
      setLoading(false);
      return;
    }

    // Önce base64'e çevirmeyi dene
    window.electronAPI.getImageBase64(filepath)
      .then(result => {
        if (!isMounted) return;
        if (result.success) {
          setSrc(result.dataUrl);
        } else {
          console.warn('Base64 conversion failed for:', filepath);
          setError(true);
        }
      })
      .catch(err => {
        console.error('Image load error:', err);
        if (!isMounted) return;
        setError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [filepath]);

  if (loading) {
    return (
      <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }}>Yükleniyor...</div>
    );
  }

  if (error || !src) {
    return (
      <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', color: '#999' }}>Görsel yüklenemedi</div>
    );
  }

  return (
    <img src={src} alt={alt} className={className} style={style} />
  );
}

export default SafeImage; 
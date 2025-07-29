import React, { useState } from 'react';

/**
 * FontRecognizer
 * Tesseract.js ile basit OCR yaparak font tahmin eden bileşen
 * Henüz demo – gerçek model entegrasyonu sonra yapılacak
 */
const FontRecognizer = ({ image }) => {
  const [status, setStatus] = useState('Hazır');
  const [fonts, setFonts] = useState([]);

  const handleDetect = async () => {
    setStatus('Analiz ediliyor...');
    // TODO: Tesseract + font veritabanı entegrasyonu
    setTimeout(() => {
      setFonts(['Arial', 'Roboto']);
      setStatus('Bitti');
    }, 2000);
  };

  return (
    <div className="font-recognizer">
      <button onClick={handleDetect}>Fontları Tanı</button>
      <p>{status}</p>
      <ul>
        {fonts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
};

export default FontRecognizer;

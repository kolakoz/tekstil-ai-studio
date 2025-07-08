import React from 'react';
import './SearchOptions.css';

function SearchOptions({ weights, onChange }) {
  const handleChange = (key) => (e) => {
    const val = parseFloat(e.target.value);
    onChange({ ...weights, [key]: val });
  };

  return (
    <div className="search-options">
      <h3>Arama Öncelikleri</h3>
      <label htmlFor="hog-slider">Desen (HOG): {Math.round(weights.hog * 100)}%</label>
      <input id="hog-slider" type="range" min="0" max="1" step="0.05" value={weights.hog} onChange={handleChange('hog')} />

      <label htmlFor="color-slider">Renk (HSV): {Math.round(weights.color * 100)}%</label>
      <input id="color-slider" type="range" min="0" max="1" step="0.05" value={weights.color} onChange={handleChange('color')} />

      <p className="note">Diğer metrikler otomatik olarak dengelenir.</p>
    </div>
  );
}

export default SearchOptions; 
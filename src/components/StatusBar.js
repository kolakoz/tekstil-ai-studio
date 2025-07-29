import React from 'react';
import './StatusBar.css';

function StatusBar({ stats }) {
  return (
    <div className="status-bar">
      <div className="status-item">
        <span className="status-icon">📊</span>
        <span className="status-text">{stats.total || 0} toplam</span>
      </div>
      
      <div className="status-item">
        <span className="status-icon">🔍</span>
        <span className="status-text">{stats.indexed || 0} taranmış</span>
      </div>
      
      <div className="status-item">
        <span className="status-icon">👣</span>
        <span className="status-text">{stats.active || 0} ayak izi</span>
      </div>
      
      <div className="status-item">
        <span className="status-icon">💾</span>
        <span className="status-text">
          {stats.total > 0 ? Math.round((stats.indexed / stats.total) * 100) : 0}% tamamlandı
        </span>
      </div>
      
      <div className="status-item status-time">
        <span className="status-icon">🕒</span>
        <span className="status-text">
          {new Date().toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      </div>
    </div>
  );
}

export default StatusBar; 
import React, { useState, useEffect } from 'react';
import './StatisticsDashboard.css';

const StatisticsDashboard = () => {
  const [stats, setStats] = useState({
    totalImages: 0,
    formatDistribution: {},
    diskUsage: {},
    recentScans: [],
    duplicates: 0,
    averageSize: 0
  });

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      const result = await window.electronAPI.getStatistics();
      if (result.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('❌ İstatistik yükleme hatası:', error);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFormatIcon = (format) => {
    switch (format.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return '🖼️';
      case 'png':
        return '🖼️';
      case 'gif':
        return '🎬';
      case 'bmp':
        return '🖼️';
      default:
        return '📄';
    }
  };

  return (
    <div className="statistics-dashboard">
      <div className="dashboard-header">
        <h2>📊 Sistem İstatistikleri</h2>
        <button onClick={loadStatistics} className="refresh-btn">
          🔄 Yenile
        </button>
      </div>

      <div className="stats-grid">
        {/* Ana İstatistikler */}
        <div className="stat-card primary">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>Toplam Görsel</h3>
            <span className="stat-value">{stats.totalImages.toLocaleString()}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔄</div>
          <div className="stat-content">
            <h3>Tekrarlanan</h3>
            <span className="stat-value">{stats.duplicates}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💾</div>
          <div className="stat-content">
            <h3>Ortalama Boyut</h3>
            <span className="stat-value">{formatBytes(stats.averageSize)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📁</div>
          <div className="stat-content">
            <h3>Son Tarama</h3>
            <span className="stat-value">
              {stats.recentScans.length > 0 
                ? new Date(stats.recentScans[0].date).toLocaleDateString('tr-TR')
                : 'Henüz yok'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Format Dağılımı */}
      <div className="stats-section">
        <h3>🎨 Format Dağılımı</h3>
        <div className="format-distribution">
          {Object.entries(stats.formatDistribution).map(([format, count]) => (
            <div key={format} className="format-item">
              <div className="format-icon">{getFormatIcon(format)}</div>
              <div className="format-info">
                <span className="format-name">{format.toUpperCase()}</span>
                <span className="format-count">{count}</span>
              </div>
              <div className="format-bar">
                <div 
                  className="format-fill" 
                  style={{ 
                    width: `${(count / stats.totalImages) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disk Kullanımı */}
      <div className="stats-section">
        <h3>💾 Disk Kullanımı</h3>
        <div className="disk-usage">
          {Object.entries(stats.diskUsage).map(([disk, usage]) => (
            <div key={disk} className="disk-item">
              <div className="disk-info">
                <span className="disk-name">{disk}</span>
                <span className="disk-space">
                  {formatBytes(usage.used)} / {formatBytes(usage.total)}
                </span>
              </div>
              <div className="disk-bar">
                <div 
                  className="disk-fill" 
                  style={{ 
                    width: `${(usage.used / usage.total) * 100}%`,
                    backgroundColor: (usage.used / usage.total) > 0.8 ? '#e74c3c' : '#3498db'
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Son Taramalar */}
      <div className="stats-section">
        <h3>📋 Son Taramalar</h3>
        <div className="recent-scans">
          {stats.recentScans.slice(0, 5).map((scan, index) => (
            <div key={index} className="scan-item">
              <div className="scan-date">
                {new Date(scan.date).toLocaleDateString('tr-TR')}
              </div>
              <div className="scan-stats">
                <span>📥 {scan.new}</span>
                <span>🔄 {scan.updated}</span>
                <span>🗑️ {scan.cleaned}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatisticsDashboard; 
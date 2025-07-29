import React, { useState, useEffect } from 'react';
import './MonitoringDashboard.css';

const MonitoringDashboard = () => {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Monitoring verilerini al
  const fetchMonitoringData = async () => {
    try {
      const [statsData, healthData] = await Promise.all([
        window.electronAPI.getMonitoringStats(),
        window.electronAPI.getMonitoringHealth()
      ]);

      if (statsData.error) {
        setError(statsData.error);
      } else {
        setStats(statsData);
      }

      if (healthData.error) {
        setError(healthData.error);
      } else {
        setHealth(healthData);
      }

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Periyodik olarak verileri güncelle
  useEffect(() => {
    fetchMonitoringData();
    
    const interval = setInterval(fetchMonitoringData, 5000); // 5 saniyede bir güncelle
    
    return () => clearInterval(interval);
  }, []);

  // Bellek kullanımını formatla
  const formatMemory = (bytes) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // Yüzde formatla
  const formatPercentage = (value) => {
    return `${value.toFixed(2)}%`;
  };

  // Süre formatla
  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}s ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (loading) {
    return (
      <div className="monitoring-dashboard">
        <div className="dashboard-header">
          <h2>📊 Monitoring Dashboard</h2>
        </div>
        <div className="loading">Yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="monitoring-dashboard">
        <div className="dashboard-header">
          <h2>📊 Monitoring Dashboard</h2>
        </div>
        <div className="error">Hata: {error}</div>
      </div>
    );
  }

  return (
    <div className="monitoring-dashboard">
      <div className="dashboard-header">
        <h2>📊 Monitoring Dashboard</h2>
        <div className={`status-indicator ${health?.status || 'unknown'}`}>
          {health?.status || 'Bilinmiyor'}
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Sistem Metrikleri */}
        <div className="metric-card system-metrics">
          <h3>🖥️ Sistem Metrikleri</h3>
          {stats?.system && (
            <div className="metrics-content">
              <div className="metric-item">
                <span className="metric-label">Bellek Kullanımı:</span>
                <span className={`metric-value ${stats.system.memory?.usage > 80 ? 'warning' : ''}`}>
                  {formatPercentage(stats.system.memory?.usage || 0)}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">CPU Kullanımı:</span>
                <span className={`metric-value ${stats.system.cpu?.usage > 90 ? 'critical' : ''}`}>
                  {formatPercentage(stats.system.cpu?.usage || 0)}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Toplam Bellek:</span>
                <span className="metric-value">
                  {formatMemory(stats.system.memory?.total || 0)}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Kullanılan Bellek:</span>
                <span className="metric-value">
                  {formatMemory(stats.system.memory?.used || 0)}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Çalışma Süresi:</span>
                <span className="metric-value">
                  {formatDuration((stats.system.uptime || 0) * 1000)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Uygulama Metrikleri */}
        <div className="metric-card app-metrics">
          <h3>⚡ Uygulama Metrikleri</h3>
          {stats?.application && (
            <div className="metrics-content">
              <div className="metric-item">
                <span className="metric-label">RSS Bellek:</span>
                <span className="metric-value">
                  {formatMemory(stats.application.memory?.rss || 0)}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Heap Kullanılan:</span>
                <span className="metric-value">
                  {formatMemory(stats.application.memory?.heapUsed || 0)}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Heap Toplam:</span>
                <span className="metric-value">
                  {formatMemory(stats.application.memory?.heapTotal || 0)}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Uygulama Çalışma Süresi:</span>
                <span className="metric-value">
                  {formatDuration((stats.application.uptime || 0) * 1000)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Özel Metrikler */}
        <div className="metric-card custom-metrics">
          <h3>🎯 Özel Metrikler</h3>
          {stats?.custom && (
            <div className="metrics-content">
              <div className="metric-item">
                <span className="metric-label">Tarama Denemeleri:</span>
                <span className="metric-value">
                  {stats.custom.scan_attempts || 0}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Tamamlanan Taramalar:</span>
                <span className="metric-value">
                  {stats.custom.scans_completed || 0}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Tarama Hataları:</span>
                <span className={`metric-value ${(stats.custom.scan_errors || 0) > 0 ? 'error' : ''}`}>
                  {stats.custom.scan_errors || 0}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Arama Denemeleri:</span>
                <span className="metric-value">
                  {stats.custom.search_attempts || 0}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Tamamlanan Aramalar:</span>
                <span className="metric-value">
                  {stats.custom.searches_completed || 0}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Arama Hataları:</span>
                <span className={`metric-value ${(stats.custom.search_errors || 0) > 0 ? 'error' : ''}`}>
                  {stats.custom.search_errors || 0}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sağlık Durumu */}
        <div className="metric-card health-status">
          <h3>🏥 Sağlık Durumu</h3>
          {health && (
            <div className="metrics-content">
              <div className="metric-item">
                <span className="metric-label">Durum:</span>
                <span className={`metric-value status-${health.status}`}>
                  {health.status}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Çalışma Süresi:</span>
                <span className="metric-value">
                  {formatDuration((health.uptime || 0) * 1000)}
                </span>
              </div>
              {health.issues && health.issues.length > 0 && (
                <div className="issues-list">
                  <span className="metric-label">Sorunlar:</span>
                  <ul>
                    {health.issues.map((issue, index) => (
                      <li key={index} className="issue-item">{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Son Alert'ler */}
        <div className="metric-card alerts">
          <h3>🚨 Son Alert'ler</h3>
          {stats?.alerts && stats.alerts.length > 0 ? (
            <div className="alerts-list">
              {stats.alerts.map((alert, index) => (
                <div key={index} className={`alert-item ${alert.severity}`}>
                  <div className="alert-header">
                    <span className="alert-type">{alert.type}</span>
                    <span className="alert-severity">{alert.severity}</span>
                  </div>
                  <div className="alert-message">{alert.message}</div>
                  <div className="alert-time">
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-alerts">Henüz alert yok</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonitoringDashboard; 
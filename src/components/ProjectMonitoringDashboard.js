import React, { useState, useEffect } from 'react';
import './ProjectMonitoringDashboard.css';
import ProjectStructureForm from './ProjectStructureForm';

const ProjectMonitoringDashboard = () => {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [projectStatus, setProjectStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showStructureForm, setShowStructureForm] = useState(false);

  // Proje yapısı ve bileşenleri
  const projectStructure = {
    core: {
      name: 'Ana Bileşenler',
      components: [
        { name: 'ImageProcessor', status: 'active', description: 'Görsel işleme motoru' },
        { name: 'Database', status: 'active', description: 'SQLite veritabanı' },
        { name: 'FileScanner', status: 'active', description: 'Dosya tarama sistemi' },
        { name: 'SearchEngine', status: 'active', description: 'Arama motoru' }
      ]
    },
    ai: {
      name: 'AI Bileşenleri',
      components: [
        { name: 'ONNX Runtime', status: 'warning', description: 'ONNX model desteği' },
        { name: 'OpenCV', status: 'error', description: 'HOG özellik çıkarımı' },
        { name: 'Font Recognition', status: 'inactive', description: 'Font tanıma sistemi' },
        { name: 'Embedding Generator', status: 'active', description: 'Görsel embedding' }
      ]
    },
    ui: {
      name: 'Kullanıcı Arayüzü',
      components: [
        { name: 'SearchBar', status: 'active', description: 'Arama çubuğu' },
        { name: 'ImageGrid', status: 'active', description: 'Görsel grid' },
        { name: 'SidePanel', status: 'active', description: 'Yan panel' },
        { name: 'MonitoringDashboard', status: 'active', description: 'Monitoring paneli' }
      ]
    },
    backend: {
      name: 'Backend Servisleri',
      components: [
        { name: 'IPC Handlers', status: 'active', description: 'IPC iletişimi' },
        { name: 'Smart Scanner', status: 'active', description: 'Akıllı tarama' },
        { name: 'Enhanced DB', status: 'active', description: 'Gelişmiş veritabanı' },
        { name: 'Worker Pool', status: 'inactive', description: 'İşçi havuzu' }
      ]
    }
  };

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

      // Proje durumunu analiz et
      analyzeProjectStatus(statsData);

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Proje durumunu analiz et
  const analyzeProjectStatus = (stats) => {
    const status = {
      database: {
        totalImages: stats?.custom?.total_images || 0,
        activeImages: stats?.custom?.active_images || 0,
        scanSuccess: stats?.custom?.scans_completed || 0,
        scanErrors: stats?.custom?.scan_errors || 0
      },
      performance: {
        avgProcessingTime: stats?.custom?.avg_processing_time || 0,
        memoryUsage: stats?.system?.memory?.usage || 0,
        cpuUsage: stats?.system?.cpu?.usage || 0
      },
      features: {
        searchSuccess: stats?.custom?.searches_completed || 0,
        searchErrors: stats?.custom?.search_errors || 0,
        uploadSuccess: stats?.custom?.uploads_completed || 0,
        uploadErrors: stats?.custom?.upload_errors || 0
      },
      issues: []
    };

    // Sorunları tespit et
    if (status.database.scanErrors > 0) {
      status.issues.push({
        type: 'error',
        message: `${status.database.scanErrors} tarama hatası tespit edildi`,
        severity: 'high'
      });
    }

    if (status.performance.memoryUsage > 80) {
      status.issues.push({
        type: 'warning',
        message: `Yüksek bellek kullanımı: ${status.performance.memoryUsage.toFixed(2)}%`,
        severity: 'medium'
      });
    }

    if (status.performance.cpuUsage > 90) {
      status.issues.push({
        type: 'critical',
        message: `Kritik CPU kullanımı: ${status.performance.cpuUsage.toFixed(2)}%`,
        severity: 'high'
      });
    }

    if (status.features.searchErrors > 0) {
      status.issues.push({
        type: 'warning',
        message: `${status.features.searchErrors} arama hatası tespit edildi`,
        severity: 'medium'
      });
    }

    setProjectStatus(status);
  };

  // Periyodik olarak verileri güncelle
  useEffect(() => {
    fetchMonitoringData();
    
    const interval = setInterval(fetchMonitoringData, 5000);
    
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
      <div className="project-monitoring-dashboard">
        <div className="dashboard-header">
          <h2>🏗️ Proje Monitoring Dashboard</h2>
        </div>
        <div className="loading">Yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-monitoring-dashboard">
        <div className="dashboard-header">
          <h2>🏗️ Proje Monitoring Dashboard</h2>
        </div>
        <div className="error">Hata: {error}</div>
      </div>
    );
  }

  return (
    <div className="project-monitoring-dashboard">
      <div className="dashboard-header">
        <h2>🏗️ Proje Monitoring Dashboard</h2>
        <div className="header-actions">
          <div className={`status-indicator ${health?.status || 'unknown'}`}>
            {health?.status || 'Bilinmiyor'}
          </div>
          <button 
            className="structure-form-btn"
            onClick={() => setShowStructureForm(!showStructureForm)}
          >
            {showStructureForm ? '📋 Formu Kapat' : '📋 Proje Yapısı Yönet'}
          </button>
        </div>
      </div>

      {/* Proje Yapısı Formu */}
      {showStructureForm && (
        <ProjectStructureForm 
          onSave={(structure) => {
            console.log('Proje yapısı kaydedildi:', structure);
            setShowStructureForm(false);
          }}
          onUpdate={(structure) => {
            console.log('Proje yapısı güncellendi:', structure);
          }}
          onTest={(structure) => {
            console.log('Proje yapısı test edildi:', structure);
          }}
        />
      )}

      <div className="dashboard-grid">
        {/* Proje Yapısı */}
        <div className="metric-card project-structure">
          <h3>🏗️ Proje Yapısı</h3>
          <div className="structure-content">
            {Object.entries(projectStructure).map(([key, section]) => (
              <div key={key} className="structure-section">
                <h4>{section.name}</h4>
                <div className="components-list">
                  {section.components.map((component, index) => (
                    <div key={index} className={`component-item ${component.status}`}>
                      <div className="component-header">
                        <span className="component-name">{component.name}</span>
                        <span className={`status-badge ${component.status}`}>
                          {component.status}
                        </span>
                      </div>
                      <div className="component-description">{component.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Veritabanı Durumu */}
        <div className="metric-card database-status">
          <h3>🗄️ Veritabanı Durumu</h3>
          <div className="metrics-content">
            <div className="metric-item">
              <span className="metric-label">Toplam Görsel:</span>
              <span className="metric-value">
                {projectStatus.database?.totalImages || 0}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Aktif Görsel:</span>
              <span className="metric-value">
                {projectStatus.database?.activeImages || 0}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Başarılı Tarama:</span>
              <span className="metric-value">
                {projectStatus.database?.scanSuccess || 0}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Tarama Hataları:</span>
              <span className={`metric-value ${(projectStatus.database?.scanErrors || 0) > 0 ? 'error' : ''}`}>
                {projectStatus.database?.scanErrors || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Performans Metrikleri */}
        <div className="metric-card performance-metrics">
          <h3>⚡ Performans Metrikleri</h3>
          <div className="metrics-content">
            <div className="metric-item">
              <span className="metric-label">Ortalama İşlem Süresi:</span>
              <span className="metric-value">
                {formatDuration(projectStatus.performance?.avgProcessingTime || 0)}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Bellek Kullanımı:</span>
              <span className={`metric-value ${(projectStatus.performance?.memoryUsage || 0) > 80 ? 'warning' : ''}`}>
                {formatPercentage(projectStatus.performance?.memoryUsage || 0)}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">CPU Kullanımı:</span>
              <span className={`metric-value ${(projectStatus.performance?.cpuUsage || 0) > 90 ? 'critical' : ''}`}>
                {formatPercentage(projectStatus.performance?.cpuUsage || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Özellik Kullanımı */}
        <div className="metric-card feature-usage">
          <h3>🎯 Özellik Kullanımı</h3>
          <div className="metrics-content">
            <div className="metric-item">
              <span className="metric-label">Başarılı Aramalar:</span>
              <span className="metric-value">
                {projectStatus.features?.searchSuccess || 0}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Arama Hataları:</span>
              <span className={`metric-value ${(projectStatus.features?.searchErrors || 0) > 0 ? 'error' : ''}`}>
                {projectStatus.features?.searchErrors || 0}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Başarılı Yüklemeler:</span>
              <span className="metric-value">
                {projectStatus.features?.uploadSuccess || 0}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Yükleme Hataları:</span>
              <span className={`metric-value ${(projectStatus.features?.uploadErrors || 0) > 0 ? 'error' : ''}`}>
                {projectStatus.features?.uploadErrors || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Tespit Edilen Sorunlar */}
        <div className="metric-card detected-issues">
          <h3>🚨 Tespit Edilen Sorunlar</h3>
          {projectStatus.issues && projectStatus.issues.length > 0 ? (
            <div className="issues-list">
              {projectStatus.issues.map((issue, index) => (
                <div key={index} className={`issue-item ${issue.severity}`}>
                  <div className="issue-header">
                    <span className="issue-type">{issue.type}</span>
                    <span className={`issue-severity ${issue.severity}`}>
                      {issue.severity}
                    </span>
                  </div>
                  <div className="issue-message">{issue.message}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-issues">Henüz sorun tespit edilmedi ✓</div>
          )}
        </div>

        {/* Öneriler */}
        <div className="metric-card recommendations">
          <h3>💡 Öneriler</h3>
          <div className="recommendations-list">
            {projectStatus.performance?.memoryUsage > 80 && (
              <div className="recommendation-item warning">
                <strong>Bellek Optimizasyonu:</strong> Yüksek bellek kullanımı tespit edildi. 
                Görsel işleme sırasında bellek temizleme işlemlerini kontrol edin.
              </div>
            )}
            
            {projectStatus.performance?.cpuUsage > 90 && (
              <div className="recommendation-item critical">
                <strong>CPU Optimizasyonu:</strong> Kritik CPU kullanımı tespit edildi. 
                İşlem havuzu boyutunu azaltmayı veya işlemleri sıraya almayı düşünün.
              </div>
            )}
            
            {projectStatus.database?.scanErrors > 0 && (
              <div className="recommendation-item error">
                <strong>Tarama Sistemi:</strong> Tarama hataları tespit edildi. 
                Dosya erişim izinlerini ve disk durumunu kontrol edin.
              </div>
            )}
            
            {projectStatus.features?.searchErrors > 0 && (
              <div className="recommendation-item warning">
                <strong>Arama Sistemi:</strong> Arama hataları tespit edildi. 
                Veritabanı bağlantısını ve arama algoritmalarını kontrol edin.
              </div>
            )}
            
            {(!projectStatus.issues || projectStatus.issues.length === 0) && (
              <div className="recommendation-item success">
                <strong>Sistem Durumu:</strong> Tüm sistemler normal çalışıyor. 
                Performans optimizasyonu için düzenli bakım yapmayı unutmayın.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectMonitoringDashboard; 
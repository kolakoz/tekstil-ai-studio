import React, { useState, useEffect } from 'react';
import './ProjectStructureForm.css';

function ProjectStructureForm({ onSave, onUpdate, onTest }) {
  const [projectStructure, setProjectStructure] = useState({
    name: 'Tekstil AI Studio',
    version: '1.0.0',
    description: 'AI destekli tekstil görsel arama ve analiz sistemi',
    components: {
      frontend: {
        name: 'React Frontend',
        status: 'active',
        components: [
          { name: 'SearchBar', status: 'active', type: 'component', path: 'src/components/SearchBar.js' },
          { name: 'ImageGrid', status: 'active', type: 'component', path: 'src/components/ImageGrid.js' },
          { name: 'MonitoringDashboard', status: 'active', type: 'component', path: 'src/components/MonitoringDashboard.js' },
          { name: 'ProjectMonitoringDashboard', status: 'active', type: 'component', path: 'src/components/ProjectMonitoringDashboard.js' },
          { name: 'SidePanel', status: 'active', type: 'component', path: 'src/components/SidePanel.js' },
          { name: 'SearchResults', status: 'active', type: 'component', path: 'src/components/SearchResults.js' },
          { name: 'ImageUploader', status: 'active', type: 'component', path: 'src/components/ImageUploader.js' },
          { name: 'SettingsDialog', status: 'active', type: 'component', path: 'src/components/SettingsDialog.js' }
        ]
      },
      backend: {
        name: 'Electron Backend',
        status: 'active',
        components: [
          { name: 'Main Process', status: 'active', type: 'process', path: 'electron/main.js' },
          { name: 'IPC Handlers', status: 'active', type: 'module', path: 'electron/ipc-handlers.js' },
          { name: 'Database', status: 'active', type: 'module', path: 'electron/database.js' },
          { name: 'Image Processor', status: 'active', type: 'module', path: 'electron/image-processor.js' },
          { name: 'Drive Scanner', status: 'active', type: 'module', path: 'electron/drive-scanner.js' },
          { name: 'Smart Scanner', status: 'active', type: 'module', path: 'electron/smart-disk-scanner.js' },
          { name: 'Enhanced Database', status: 'active', type: 'module', path: 'electron/enhanced-database.js' }
        ]
      },
      ai: {
        name: 'AI Components',
        status: 'active',
        components: [
          { name: 'ONNX Runtime', status: 'active', type: 'ai', path: 'electron/image-processor.js' },
          { name: 'Sharp HOG', status: 'active', type: 'ai', path: 'electron/image-processor.js' },
          { name: 'Font Recognition', status: 'active', type: 'ai', path: 'electron/font-recognizer.js' },
          { name: 'Worker Pool', status: 'active', type: 'ai', path: 'electron/workers/worker-pool.js' },
          { name: 'Image Worker', status: 'active', type: 'ai', path: 'electron/workers/image-worker.js' }
        ]
      },
      monitoring: {
        name: 'Monitoring System',
        status: 'active',
        components: [
          { name: 'TekstilMonitoring', status: 'active', type: 'monitoring', path: 'electron/monitoring/index.js' },
          { name: 'Export Manager', status: 'active', type: 'monitoring', path: 'electron/export-manager.js' },
          { name: 'Monitoring Dashboard', status: 'active', type: 'ui', path: 'src/components/MonitoringDashboard.js' },
          { name: 'Project Monitoring Dashboard', status: 'active', type: 'ui', path: 'src/components/ProjectMonitoringDashboard.js' }
        ]
      }
    },
    dependencies: {
      frontend: ['react', 'react-dom', 'webpack'],
      backend: ['electron', 'sqlite3', 'sharp'],
      ai: ['onnxruntime-node', 'tesseract.js'],
      monitoring: ['express', 'winston', 'node-cron', 'ws']
    },
    config: {
      monitoring: {
        enabled: true,
        interval: 5000,
        logLevel: 'info',
        exportEnabled: true
      },
      workerPool: {
        minWorkers: 2,
        maxWorkers: 6,
        autoScale: true
      },
      database: {
        type: 'sqlite',
        path: 'tekstil-ai-studio.db'
      }
    }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);

  // Proje yapısını kaydet
  const handleSave = async () => {
    try {
      const result = await window.electronAPI.saveProjectStructure(projectStructure);
      if (result.success) {
        alert('✅ Proje yapısı başarıyla kaydedildi!');
        setIsEditing(false);
        if (onSave) onSave(projectStructure);
      } else {
        alert(`❌ Kaydetme hatası: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Kaydetme hatası:', error);
      alert('Proje yapısı kaydedilirken hata oluştu');
    }
  };

  // Proje yapısını güncelle
  const handleUpdate = async () => {
    try {
      const result = await window.electronAPI.updateProjectStructure(projectStructure);
      if (result.success) {
        alert('✅ Proje yapısı başarıyla güncellendi!');
        if (onUpdate) onUpdate(projectStructure);
      } else {
        alert(`❌ Güncelleme hatası: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Güncelleme hatası:', error);
      alert('Proje yapısı güncellenirken hata oluştu');
    }
  };

  // Proje yapısını test et
  const handleTest = async () => {
    try {
      const result = await window.electronAPI.testProjectStructure(projectStructure);
      if (result.success) {
        alert('✅ Proje yapısı test edildi!\n\n' + result.details);
      } else {
        alert(`❌ Test hatası: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Test hatası:', error);
      alert('Proje yapısı test edilirken hata oluştu');
    }
  };

  // Bileşen durumunu değiştir
  const toggleComponentStatus = (category, componentIndex) => {
    const newStructure = { ...projectStructure };
    const component = newStructure.components[category].components[componentIndex];
    component.status = component.status === 'active' ? 'inactive' : 'active';
    setProjectStructure(newStructure);
  };

  // Bileşen seç
  const selectComponent = (category, componentIndex) => {
    const component = projectStructure.components[category].components[componentIndex];
    setSelectedComponent({ category, index: componentIndex, component });
  };

  // Bileşen düzenle
  const editComponent = (category, componentIndex, updates) => {
    const newStructure = { ...projectStructure };
    newStructure.components[category].components[componentIndex] = {
      ...newStructure.components[category].components[componentIndex],
      ...updates
    };
    setProjectStructure(newStructure);
  };

  return (
    <div className="project-structure-form">
      <div className="form-header">
        <h2>📋 Proje Yapısı Yönetimi</h2>
        <div className="form-actions">
          <button 
            className="btn btn-primary" 
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Düzenlemeyi Durdur' : 'Düzenle'}
          </button>
          {isEditing && (
            <>
              <button className="btn btn-success" onClick={handleSave}>
                💾 Kaydet
              </button>
              <button className="btn btn-info" onClick={handleUpdate}>
                🔄 Güncelle
              </button>
            </>
          )}
          <button className="btn btn-warning" onClick={handleTest}>
            🧪 Test Et
          </button>
        </div>
      </div>

      <div className="form-content">
        {/* Proje Bilgileri */}
        <div className="section">
          <h3>📁 Proje Bilgileri</h3>
          <div className="form-group">
            <label>Proje Adı:</label>
            <input
              type="text"
              value={projectStructure.name}
              onChange={(e) => setProjectStructure({
                ...projectStructure,
                name: e.target.value
              })}
              disabled={!isEditing}
            />
          </div>
          <div className="form-group">
            <label>Versiyon:</label>
            <input
              type="text"
              value={projectStructure.version}
              onChange={(e) => setProjectStructure({
                ...projectStructure,
                version: e.target.value
              })}
              disabled={!isEditing}
            />
          </div>
          <div className="form-group">
            <label>Açıklama:</label>
            <textarea
              value={projectStructure.description}
              onChange={(e) => setProjectStructure({
                ...projectStructure,
                description: e.target.value
              })}
              disabled={!isEditing}
              rows="3"
            />
          </div>
        </div>

        {/* Bileşenler */}
        <div className="section">
          <h3>🔧 Bileşenler</h3>
          {Object.entries(projectStructure.components).map(([category, categoryData]) => (
            <div key={category} className="category">
              <h4>
                {categoryData.name} 
                <span className={`status ${categoryData.status}`}>
                  {categoryData.status === 'active' ? '✅' : '❌'}
                </span>
              </h4>
              <div className="components-grid">
                {categoryData.components.map((component, index) => (
                  <div 
                    key={index} 
                    className={`component-card ${component.status} ${selectedComponent?.category === category && selectedComponent?.index === index ? 'selected' : ''}`}
                    onClick={() => selectComponent(category, index)}
                  >
                    <div className="component-header">
                      <span className="component-name">{component.name}</span>
                      <span className={`component-status ${component.status}`}>
                        {component.status === 'active' ? '✅' : '❌'}
                      </span>
                    </div>
                    <div className="component-details">
                      <span className="component-type">{component.type}</span>
                      <span className="component-path">{component.path}</span>
                    </div>
                    {isEditing && (
                      <button
                        className="toggle-status-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleComponentStatus(category, index);
                        }}
                      >
                        {component.status === 'active' ? '❌ Devre Dışı' : '✅ Etkinleştir'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Seçili Bileşen Detayları */}
        {selectedComponent && (
          <div className="section">
            <h3>🔍 Seçili Bileşen Detayları</h3>
            <div className="component-details-form">
              <div className="form-group">
                <label>Bileşen Adı:</label>
                <input
                  type="text"
                  value={selectedComponent.component.name}
                  onChange={(e) => editComponent(selectedComponent.category, selectedComponent.index, { name: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
              <div className="form-group">
                <label>Dosya Yolu:</label>
                <input
                  type="text"
                  value={selectedComponent.component.path}
                  onChange={(e) => editComponent(selectedComponent.category, selectedComponent.index, { path: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
              <div className="form-group">
                <label>Tip:</label>
                <select
                  value={selectedComponent.component.type}
                  onChange={(e) => editComponent(selectedComponent.category, selectedComponent.index, { type: e.target.value })}
                  disabled={!isEditing}
                >
                  <option value="component">Component</option>
                  <option value="module">Module</option>
                  <option value="process">Process</option>
                  <option value="ai">AI</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="ui">UI</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Konfigürasyon */}
        <div className="section">
          <h3>⚙️ Konfigürasyon</h3>
          <div className="config-grid">
            <div className="config-item">
              <label>Monitoring Etkin:</label>
              <input
                type="checkbox"
                checked={projectStructure.config.monitoring.enabled}
                onChange={(e) => setProjectStructure({
                  ...projectStructure,
                  config: {
                    ...projectStructure.config,
                    monitoring: {
                      ...projectStructure.config.monitoring,
                      enabled: e.target.checked
                    }
                  }
                })}
                disabled={!isEditing}
              />
            </div>
            <div className="config-item">
              <label>Monitoring Aralığı (ms):</label>
              <input
                type="number"
                value={projectStructure.config.monitoring.interval}
                onChange={(e) => setProjectStructure({
                  ...projectStructure,
                  config: {
                    ...projectStructure.config,
                    monitoring: {
                      ...projectStructure.config.monitoring,
                      interval: parseInt(e.target.value)
                    }
                  }
                })}
                disabled={!isEditing}
              />
            </div>
            <div className="config-item">
              <label>Min Worker Sayısı:</label>
              <input
                type="number"
                value={projectStructure.config.workerPool.minWorkers}
                onChange={(e) => setProjectStructure({
                  ...projectStructure,
                  config: {
                    ...projectStructure.config,
                    workerPool: {
                      ...projectStructure.config.workerPool,
                      minWorkers: parseInt(e.target.value)
                    }
                  }
                })}
                disabled={!isEditing}
              />
            </div>
            <div className="config-item">
              <label>Max Worker Sayısı:</label>
              <input
                type="number"
                value={projectStructure.config.workerPool.maxWorkers}
                onChange={(e) => setProjectStructure({
                  ...projectStructure,
                  config: {
                    ...projectStructure.config,
                    workerPool: {
                      ...projectStructure.config.workerPool,
                      maxWorkers: parseInt(e.target.value)
                    }
                  }
                })}
                disabled={!isEditing}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectStructureForm; 
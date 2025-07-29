const fs = require('fs').promises;
const path = require('path');
const { dialog } = require('electron');

class ProjectStructureManager {
  constructor() {
    this.structureFile = path.join(process.cwd(), 'project-structure.json');
    this.backupDir = path.join(process.cwd(), 'backups');
    this.currentStructure = null;
  }

  // Proje yapısını kaydet
  async saveProjectStructure(structure) {
    try {
      // Backup oluştur
      await this.createBackup();
      
      // Yapıyı kaydet
      await fs.writeFile(this.structureFile, JSON.stringify(structure, null, 2));
      
      // Mevcut yapıyı güncelle
      this.currentStructure = structure;
      
      // Monitoring sistemini güncelle
      await this.updateMonitoringSystem(structure);
      
      console.log('✅ Proje yapısı kaydedildi');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Proje yapısı kaydetme hatası:', error);
      return { success: false, error: error.message };
    }
  }

  // Proje yapısını yükle
  async loadProjectStructure() {
    try {
      if (await this.fileExists(this.structureFile)) {
        const data = await fs.readFile(this.structureFile, 'utf8');
        this.currentStructure = JSON.parse(data);
        return { success: true, structure: this.currentStructure };
      } else {
        return { success: false, error: 'Proje yapısı dosyası bulunamadı' };
      }
    } catch (error) {
      console.error('❌ Proje yapısı yükleme hatası:', error);
      return { success: false, error: error.message };
    }
  }

  // Proje yapısını güncelle
  async updateProjectStructure(structure) {
    try {
      // Mevcut yapıyı kontrol et
      const current = await this.loadProjectStructure();
      if (!current.success) {
        return await this.saveProjectStructure(structure);
      }

      // Değişiklikleri analiz et
      const changes = this.analyzeChanges(current.structure, structure);
      
      // Değişiklikleri uygula
      await this.applyChanges(changes);
      
      // Yapıyı kaydet
      await this.saveProjectStructure(structure);
      
      console.log('✅ Proje yapısı güncellendi');
      return { success: true, changes };
      
    } catch (error) {
      console.error('❌ Proje yapısı güncelleme hatası:', error);
      return { success: false, error: error.message };
    }
  }

  // Proje yapısını test et
  async testProjectStructure(structure) {
    try {
      const results = {
        components: {},
        dependencies: {},
        config: {},
        files: {},
        summary: ''
      };

      // Bileşenleri test et
      for (const [category, categoryData] of Object.entries(structure.components)) {
        results.components[category] = {};
        
        for (const component of categoryData.components) {
          const testResult = await this.testComponent(component);
          results.components[category][component.name] = testResult;
        }
      }

      // Bağımlılıkları test et
      results.dependencies = await this.testDependencies(structure.dependencies);

      // Konfigürasyonu test et
      results.config = await this.testConfiguration(structure.config);

      // Dosya yapısını test et
      results.files = await this.testFileStructure(structure);

      // Özet oluştur
      results.summary = this.generateTestSummary(results);

      return { success: true, details: results.summary, results };
      
    } catch (error) {
      console.error('❌ Proje yapısı test hatası:', error);
      return { success: false, error: error.message };
    }
  }

  // Bileşen test et
  async testComponent(component) {
    try {
      const filePath = path.join(process.cwd(), component.path);
      const fileExists = await this.fileExists(filePath);
      
      if (!fileExists) {
        return { status: 'error', message: 'Dosya bulunamadı' };
      }

      // Dosya içeriğini kontrol et
      const content = await fs.readFile(filePath, 'utf8');
      
      // Bileşen tipine göre test
      switch (component.type) {
        case 'component':
          return this.testReactComponent(content);
        case 'module':
          return this.testNodeModule(content);
        case 'process':
          return this.testElectronProcess(content);
        case 'ai':
          return this.testAIComponent(content);
        case 'monitoring':
          return this.testMonitoringComponent(content);
        case 'ui':
          return this.testUIComponent(content);
        default:
          return { status: 'warning', message: 'Bilinmeyen bileşen tipi' };
      }
      
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  // React bileşeni test et
  testReactComponent(content) {
    const hasImport = content.includes('import React');
    const hasExport = content.includes('export default') || content.includes('export {');
    const hasJSX = content.includes('return (') || content.includes('jsx');
    
    if (hasImport && hasExport && hasJSX) {
      return { status: 'success', message: 'Geçerli React bileşeni' };
    } else {
      return { status: 'warning', message: 'React bileşeni eksik özellikler' };
    }
  }

  // Node modülü test et
  testNodeModule(content) {
    const hasModuleExports = content.includes('module.exports') || content.includes('exports.');
    const hasRequire = content.includes('require(');
    
    if (hasModuleExports || hasRequire) {
      return { status: 'success', message: 'Geçerli Node modülü' };
    } else {
      return { status: 'warning', message: 'Node modülü eksik özellikler' };
    }
  }

  // Electron process test et
  testElectronProcess(content) {
    const hasElectron = content.includes('electron') || content.includes('app.on');
    const hasIPC = content.includes('ipcMain') || content.includes('ipcRenderer');
    
    if (hasElectron || hasIPC) {
      return { status: 'success', message: 'Geçerli Electron process' };
    } else {
      return { status: 'warning', message: 'Electron process eksik özellikler' };
    }
  }

  // AI bileşeni test et
  testAIComponent(content) {
    const hasAI = content.includes('onnx') || content.includes('tesseract') || content.includes('sharp');
    const hasWorker = content.includes('worker_threads') || content.includes('Worker');
    
    if (hasAI || hasWorker) {
      return { status: 'success', message: 'Geçerli AI bileşeni' };
    } else {
      return { status: 'warning', message: 'AI bileşeni eksik özellikler' };
    }
  }

  // Monitoring bileşeni test et
  testMonitoringComponent(content) {
    const hasMonitoring = content.includes('monitoring') || content.includes('winston') || content.includes('express');
    const hasMetrics = content.includes('metrics') || content.includes('stats');
    
    if (hasMonitoring || hasMetrics) {
      return { status: 'success', message: 'Geçerli monitoring bileşeni' };
    } else {
      return { status: 'warning', message: 'Monitoring bileşeni eksik özellikler' };
    }
  }

  // UI bileşeni test et
  testUIComponent(content) {
    const hasCSS = content.includes('.css') || content.includes('className') || content.includes('style');
    const hasJSX = content.includes('return (') || content.includes('jsx');
    
    if (hasCSS || hasJSX) {
      return { status: 'success', message: 'Geçerli UI bileşeni' };
    } else {
      return { status: 'warning', message: 'UI bileşeni eksik özellikler' };
    }
  }

  // Bağımlılıkları test et
  async testDependencies(dependencies) {
    const results = {};
    
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      
      for (const [category, deps] of Object.entries(dependencies)) {
        results[category] = {};
        
        for (const dep of deps) {
          const installed = packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep];
          results[category][dep] = {
            status: installed ? 'success' : 'error',
            message: installed ? 'Yüklü' : 'Yüklü değil',
            version: installed || 'N/A'
          };
        }
      }
      
      return results;
    } catch (error) {
      return { error: error.message };
    }
  }

  // Konfigürasyonu test et
  async testConfiguration(config) {
    const results = {};
    
    try {
      // Monitoring konfigürasyonu
      if (config.monitoring) {
        results.monitoring = {
          enabled: config.monitoring.enabled ? 'success' : 'warning',
          interval: config.monitoring.interval > 0 ? 'success' : 'error',
          logLevel: ['error', 'warn', 'info', 'debug'].includes(config.monitoring.logLevel) ? 'success' : 'error'
        };
      }

      // Worker Pool konfigürasyonu
      if (config.workerPool) {
        results.workerPool = {
          minWorkers: config.workerPool.minWorkers > 0 ? 'success' : 'error',
          maxWorkers: config.workerPool.maxWorkers >= config.workerPool.minWorkers ? 'success' : 'error',
          autoScale: typeof config.workerPool.autoScale === 'boolean' ? 'success' : 'error'
        };
      }

      // Database konfigürasyonu
      if (config.database) {
        results.database = {
          type: ['sqlite', 'mysql', 'postgresql'].includes(config.database.type) ? 'success' : 'error',
          path: config.database.path ? 'success' : 'error'
        };
      }

      return results;
    } catch (error) {
      return { error: error.message };
    }
  }

  // Dosya yapısını test et
  async testFileStructure(structure) {
    const results = {};
    
    try {
      for (const [category, categoryData] of Object.entries(structure.components)) {
        results[category] = {};
        
        for (const component of categoryData.components) {
          const filePath = path.join(process.cwd(), component.path);
          const exists = await this.fileExists(filePath);
          
          results[category][component.name] = {
            status: exists ? 'success' : 'error',
            message: exists ? 'Dosya mevcut' : 'Dosya bulunamadı',
            path: component.path
          };
        }
      }

      return results;
    } catch (error) {
      return { error: error.message };
    }
  }

  // Test özeti oluştur
  generateTestSummary(results) {
    let summary = '📊 Proje Yapısı Test Sonuçları\n';
    summary += '='.repeat(50) + '\n\n';

    // Bileşen sonuçları
    summary += '🔧 Bileşenler:\n';
    for (const [category, components] of Object.entries(results.components)) {
      summary += `\n${category.toUpperCase()}:\n`;
      for (const [name, result] of Object.entries(components)) {
        const icon = result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
        summary += `  ${icon} ${name}: ${result.message}\n`;
      }
    }

    // Bağımlılık sonuçları
    summary += '\n📦 Bağımlılıklar:\n';
    for (const [category, deps] of Object.entries(results.dependencies)) {
      summary += `\n${category.toUpperCase()}:\n`;
      for (const [name, result] of Object.entries(deps)) {
        const icon = result.status === 'success' ? '✅' : '❌';
        summary += `  ${icon} ${name}: ${result.message} (${result.version})\n`;
      }
    }

    // Konfigürasyon sonuçları
    summary += '\n⚙️ Konfigürasyon:\n';
    for (const [category, configs] of Object.entries(results.config)) {
      summary += `\n${category.toUpperCase()}:\n`;
      for (const [name, result] of Object.entries(configs)) {
        const icon = result === 'success' ? '✅' : result === 'warning' ? '⚠️' : '❌';
        summary += `  ${icon} ${name}: ${result}\n`;
      }
    }

    return summary;
  }

  // Değişiklikleri analiz et
  analyzeChanges(oldStructure, newStructure) {
    const changes = {
      added: [],
      removed: [],
      modified: [],
      config: {}
    };

    // Bileşen değişikliklerini analiz et
    for (const [category, categoryData] of Object.entries(newStructure.components)) {
      const oldCategory = oldStructure.components[category];
      
      if (!oldCategory) {
        changes.added.push(category);
        continue;
      }

      for (const component of categoryData.components) {
        const oldComponent = oldCategory.components.find(c => c.name === component.name);
        
        if (!oldComponent) {
          changes.added.push(`${category}.${component.name}`);
        } else if (JSON.stringify(oldComponent) !== JSON.stringify(component)) {
          changes.modified.push(`${category}.${component.name}`);
        }
      }
    }

    // Konfigürasyon değişikliklerini analiz et
    if (JSON.stringify(oldStructure.config) !== JSON.stringify(newStructure.config)) {
      changes.config = newStructure.config;
    }

    return changes;
  }

  // Değişiklikleri uygula
  async applyChanges(changes) {
    try {
      console.log('🔄 Değişiklikler uygulanıyor...');

      // Yeni bileşenler için dosya oluştur
      for (const added of changes.added) {
        await this.createComponentFile(added);
      }

      // Konfigürasyon güncellemeleri
      if (changes.config) {
        await this.updateConfiguration(changes.config);
      }

      console.log('✅ Değişiklikler uygulandı');
      
    } catch (error) {
      console.error('❌ Değişiklik uygulama hatası:', error);
      throw error;
    }
  }

  // Bileşen dosyası oluştur
  async createComponentFile(componentPath) {
    try {
      const [category, componentName] = componentPath.split('.');
      const template = this.getComponentTemplate(category, componentName);
      
      // Dosya yolunu belirle
      let filePath;
      switch (category) {
        case 'frontend':
          filePath = path.join(process.cwd(), 'src', 'components', `${componentName}.js`);
          break;
        case 'backend':
          filePath = path.join(process.cwd(), 'electron', `${componentName.toLowerCase()}.js`);
          break;
        case 'ai':
          filePath = path.join(process.cwd(), 'electron', `${componentName.toLowerCase()}.js`);
          break;
        case 'monitoring':
          filePath = path.join(process.cwd(), 'electron', 'monitoring', `${componentName.toLowerCase()}.js`);
          break;
        default:
          filePath = path.join(process.cwd(), `${componentName.toLowerCase()}.js`);
      }

      // Dizin oluştur
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      // Dosyayı oluştur
      await fs.writeFile(filePath, template);
      
      console.log(`✅ Bileşen dosyası oluşturuldu: ${filePath}`);
      
    } catch (error) {
      console.error('❌ Bileşen dosyası oluşturma hatası:', error);
      throw error;
    }
  }

  // Bileşen şablonu al
  getComponentTemplate(category, componentName) {
    switch (category) {
      case 'frontend':
        return this.getReactComponentTemplate(componentName);
      case 'backend':
        return this.getNodeModuleTemplate(componentName);
      case 'ai':
        return this.getAITemplate(componentName);
      case 'monitoring':
        return this.getMonitoringTemplate(componentName);
      default:
        return this.getDefaultTemplate(componentName);
    }
  }

  // React bileşen şablonu
  getReactComponentTemplate(name) {
    return `import React from 'react';
import './${name}.css';

function ${name}() {
  return (
    <div className="${name.toLowerCase()}-container">
      <h2>${name}</h2>
      {/* Bileşen içeriği buraya gelecek */}
    </div>
  );
}

export default ${name};
`;
  }

  // Node modül şablonu
  getNodeModuleTemplate(name) {
    return `const path = require('path');

class ${name} {
  constructor() {
    this.name = '${name}';
  }

  // ${name} işlevleri buraya gelecek
}

module.exports = ${name};
`;
  }

  // AI şablonu
  getAITemplate(name) {
    return `const path = require('path');

class ${name} {
  constructor() {
    this.name = '${name}';
    this.initialized = false;
  }

  async initialize() {
    try {
      // AI bileşeni başlatma kodu
      this.initialized = true;
      console.log('✅ ${name} başlatıldı');
    } catch (error) {
      console.error('❌ ${name} başlatma hatası:', error);
    }
  }

  // AI işlevleri buraya gelecek
}

module.exports = ${name};
`;
  }

  // Monitoring şablonu
  getMonitoringTemplate(name) {
    return `const winston = require('winston');

class ${name} {
  constructor() {
    this.name = '${name}';
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [
        new winston.transports.Console()
      ]
    });
  }

  // Monitoring işlevleri buraya gelecek
}

module.exports = ${name};
`;
  }

  // Varsayılan şablon
  getDefaultTemplate(name) {
    return `// ${name} bileşeni
// Bu dosya otomatik olarak oluşturuldu

class ${name} {
  constructor() {
    this.name = '${name}';
  }

  // Bileşen işlevleri buraya gelecek
}

module.exports = ${name};
`;
  }

  // Konfigürasyonu güncelle
  async updateConfiguration(config) {
    try {
      // Monitoring konfigürasyonunu güncelle
      if (config.monitoring) {
        await this.updateMonitoringConfig(config.monitoring);
      }

      // Worker Pool konfigürasyonunu güncelle
      if (config.workerPool) {
        await this.updateWorkerPoolConfig(config.workerPool);
      }

      console.log('✅ Konfigürasyon güncellendi');
      
    } catch (error) {
      console.error('❌ Konfigürasyon güncelleme hatası:', error);
      throw error;
    }
  }

  // Monitoring konfigürasyonunu güncelle
  async updateMonitoringConfig(config) {
    try {
      const monitoringPath = path.join(process.cwd(), 'electron', 'monitoring-config.js');
      
      let content = `module.exports = {
  monitoring: {
    enabled: ${config.enabled},
    interval: ${config.interval},
    logLevel: '${config.logLevel}',
    exportEnabled: ${config.exportEnabled}
  }
};`;

      await fs.writeFile(monitoringPath, content);
      
    } catch (error) {
      console.error('❌ Monitoring konfigürasyon güncelleme hatası:', error);
    }
  }

  // Worker Pool konfigürasyonunu güncelle
  async updateWorkerPoolConfig(config) {
    try {
      const workerPoolPath = path.join(process.cwd(), 'electron', 'workers', 'worker-pool.js');
      
      if (await this.fileExists(workerPoolPath)) {
        let content = await fs.readFile(workerPoolPath, 'utf8');
        
        // Konfigürasyon değerlerini güncelle
        content = content.replace(/minWorkers:\s*\d+/, `minWorkers: ${config.minWorkers}`);
        content = content.replace(/maxWorkers:\s*\d+/, `maxWorkers: ${config.maxWorkers}`);
        content = content.replace(/autoScale:\s*(true|false)/, `autoScale: ${config.autoScale}`);
        
        await fs.writeFile(workerPoolPath, content);
      }
      
    } catch (error) {
      console.error('❌ Worker Pool konfigürasyon güncelleme hatası:', error);
    }
  }

  // Monitoring sistemini güncelle
  async updateMonitoringSystem(structure) {
    try {
      const monitoring = global.monitoring;
      if (monitoring && structure.config.monitoring) {
        // Monitoring aralığını güncelle
        if (monitoring.updateInterval) {
          clearInterval(monitoring.updateInterval);
          monitoring.updateInterval = setInterval(() => {
            monitoring.updateMetrics();
          }, structure.config.monitoring.interval);
        }
        
        console.log('✅ Monitoring sistemi güncellendi');
      }
      
    } catch (error) {
      console.error('❌ Monitoring sistem güncelleme hatası:', error);
    }
  }

  // Backup oluştur
  async createBackup() {
    try {
      if (await this.fileExists(this.structureFile)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.backupDir, `project-structure-${timestamp}.json`);
        
        await fs.mkdir(this.backupDir, { recursive: true });
        await fs.copyFile(this.structureFile, backupPath);
        
        console.log(`✅ Backup oluşturuldu: ${backupPath}`);
      }
      
    } catch (error) {
      console.error('❌ Backup oluşturma hatası:', error);
    }
  }

  // Dosya varlığını kontrol et
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = ProjectStructureManager; 
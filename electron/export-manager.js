const fs = require('fs').promises;
const path = require('path');
const { dialog } = require('electron');

class ExportManager {
  constructor() {
    this.exportFormats = {
      csv: 'CSV',
      json: 'JSON',
      excel: 'Excel',
      txt: 'Text'
    };
  }

  // CSV formatında export
  async exportToCSV(data, filename = 'monitoring-data') {
    try {
      let csvContent = '';
      
      // Başlık satırı
      const headers = Object.keys(data[0] || {});
      csvContent += headers.join(',') + '\n';
      
      // Veri satırları
      data.forEach(row => {
        const values = headers.map(header => {
          const value = row[header];
          // Virgül içeren değerleri tırnak içine al
          return typeof value === 'string' && value.includes(',') ? 
            `"${value}"` : value;
        });
        csvContent += values.join(',') + '\n';
      });
      
      const filePath = await this.saveFile(csvContent, `${filename}.csv`);
      return { success: true, filePath };
      
    } catch (error) {
      console.error('❌ CSV export hatası:', error);
      return { success: false, error: error.message };
    }
  }

  // JSON formatında export
  async exportToJSON(data, filename = 'monitoring-data') {
    try {
      const jsonContent = JSON.stringify(data, null, 2);
      const filePath = await this.saveFile(jsonContent, `${filename}.json`);
      return { success: true, filePath };
      
    } catch (error) {
      console.error('❌ JSON export hatası:', error);
      return { success: false, error: error.message };
    }
  }

  // Text formatında export
  async exportToText(data, filename = 'monitoring-data') {
    try {
      let textContent = 'Tekstil AI Studio Monitoring Raporu\n';
      textContent += '='.repeat(50) + '\n\n';
      
      data.forEach((item, index) => {
        textContent += `Kayıt ${index + 1}:\n`;
        Object.entries(item).forEach(([key, value]) => {
          textContent += `  ${key}: ${value}\n`;
        });
        textContent += '\n';
      });
      
      const filePath = await this.saveFile(textContent, `${filename}.txt`);
      return { success: true, filePath };
      
    } catch (error) {
      console.error('❌ Text export hatası:', error);
      return { success: false, error: error.message };
    }
  }

  // Dosya kaydetme dialog'u
  async saveFile(content, defaultFilename) {
    const result = await dialog.showSaveDialog({
      title: 'Monitoring Verilerini Kaydet',
      defaultPath: defaultFilename,
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      await fs.writeFile(result.filePath, content, 'utf8');
      console.log(`✅ Dosya kaydedildi: ${result.filePath}`);
      return result.filePath;
    } else {
      throw new Error('Dosya kaydetme iptal edildi');
    }
  }

  // Monitoring verilerini hazırla
  prepareMonitoringData(monitoringInstance) {
    const data = {
      timestamp: new Date().toISOString(),
      systemMetrics: monitoringInstance.getSystemMetrics(),
      applicationMetrics: monitoringInstance.getApplicationMetrics(),
      customMetrics: monitoringInstance.getCustomMetrics(),
      alerts: monitoringInstance.getAlerts(),
      logs: monitoringInstance.getLogs()
    };
    
    return data;
  }

  // Worker Pool verilerini hazırla
  prepareWorkerPoolData(workerPool) {
    if (!workerPool) return null;
    
    const stats = workerPool.getStats();
    return {
      timestamp: new Date().toISOString(),
      totalWorkers: stats.totalWorkers,
      activeWorkers: stats.activeWorkers,
      idleWorkers: stats.idleWorkers,
      queuedTasks: stats.queuedTasks,
      totalTasksCompleted: stats.totalTasksCompleted,
      totalErrors: stats.totalErrors,
      averageTasksPerWorker: stats.averageTasksPerWorker,
      averageCpuUsage: stats.averageCpuUsage,
      averageMemoryUsage: stats.averageMemoryUsage,
      scalingEvents: stats.scalingEvents,
      autoScaling: stats.autoScaling,
      load: stats.load
    };
  }

  // Proje durumu verilerini hazırla
  prepareProjectStatusData(monitoringInstance) {
    const projectStatus = monitoringInstance.checkProjectStatus();
    return {
      timestamp: new Date().toISOString(),
      onnxAvailable: projectStatus.onnxAvailable,
      opencvAvailable: projectStatus.opencvAvailable,
      fontRecognitionAvailable: projectStatus.fontRecognitionAvailable,
      workerPoolAvailable: projectStatus.workerPoolAvailable,
      databaseStats: projectStatus.databaseStats,
      projectMetrics: projectStatus.projectMetrics
    };
  }

  // Kapsamlı rapor oluştur
  async generateComprehensiveReport(monitoringInstance, workerPool) {
    try {
      const report = {
        reportInfo: {
          title: 'Tekstil AI Studio Monitoring Raporu',
          generatedAt: new Date().toISOString(),
          version: '1.0.0'
        },
        monitoring: this.prepareMonitoringData(monitoringInstance),
        workerPool: this.prepareWorkerPoolData(workerPool),
        projectStatus: this.prepareProjectStatusData(monitoringInstance)
      };

      return report;
      
    } catch (error) {
      console.error('❌ Kapsamlı rapor oluşturma hatası:', error);
      return null;
    }
  }

  // Otomatik export (zamanlanmış)
  async autoExport(monitoringInstance, workerPool, format = 'json') {
    try {
      const report = await this.generateComprehensiveReport(monitoringInstance, workerPool);
      if (!report) return { success: false, error: 'Rapor oluşturulamadı' };

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `tekstil-ai-studio-report-${timestamp}`;

      switch (format.toLowerCase()) {
        case 'csv':
          return await this.exportToCSV([report], filename);
        case 'json':
          return await this.exportToJSON(report, filename);
        case 'txt':
          return await this.exportToText([report], filename);
        default:
          return await this.exportToJSON(report, filename);
      }
      
    } catch (error) {
      console.error('❌ Otomatik export hatası:', error);
      return { success: false, error: error.message };
    }
  }

  // Export formatlarını listele
  getAvailableFormats() {
    return this.exportFormats;
  }
}

module.exports = ExportManager; 
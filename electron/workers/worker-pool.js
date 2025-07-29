const { Worker } = require('worker_threads');
const path = require('path');
const EventEmitter = require('events');

class WorkerPool extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      minWorkers: options.minWorkers || 2,
      maxWorkers: options.maxWorkers || 8,
      workerScript: options.workerScript || path.join(__dirname, 'image-worker.js'),
      idleTimeout: options.idleTimeout || 30000, // 30 saniye
      autoScale: options.autoScale !== false,
      cpuThreshold: options.cpuThreshold || 0.7, // %70 CPU kullanımı
      memoryThreshold: options.memoryThreshold || 0.8, // %80 bellek kullanımı
      loadThreshold: options.loadThreshold || 0.8, // %80 yük
      scaleInterval: options.scaleInterval || 10000, // 10 saniye
      ...options
    };

    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers = 0;
    this.isShuttingDown = false;
    
    // Performans metrikleri
    this.performanceMetrics = {
      taskTimes: [],
      cpuHistory: [],
      memoryHistory: [],
      scalingEvents: 0
    };
    
    // Ölçeklendirme zamanlayıcısı
    this.scalingTimer = null;

    this.init();
  }

  // Worker havuzunu başlat
  init() {
    console.log(`🚀 Worker Pool başlatılıyor: ${this.options.minWorkers}-${this.options.maxWorkers} worker`);
    
    // Minimum worker sayısı kadar worker oluştur
    for (let i = 0; i < this.options.minWorkers; i++) {
      this.createWorker();
    }

    // Boşta kalan worker'ları temizle
    this.startIdleCleanup();
    
    // Otomatik ölçeklendirme başlat
    if (this.options.autoScale) {
      this.startAutoScaling();
    }
  }

  // Sistem metriklerini al
  async getSystemMetrics() {
    const os = require('os');
    
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = usedMemory / totalMemory;
    
    // CPU kullanımı (basit hesaplama)
    const cpus = os.cpus();
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b);
      const idle = cpu.times.idle;
      return acc + (1 - idle / total);
    }, 0) / cpus.length;
    
    return {
      cpuUsage,
      memoryUsage,
      loadAverage: os.loadavg(),
      totalMemory,
      freeMemory,
      usedMemory
    };
  }

  // Yük hesaplama
  calculateLoad() {
    const queueLoad = this.taskQueue.length / 10; // Kuyruk yükü
    const workerLoad = this.activeWorkers / this.workers.length; // Worker yükü
    
    return Math.min(queueLoad + workerLoad, 1);
  }

  // Yeni worker oluştur
  createWorker() {
    if (this.workers.length >= this.options.maxWorkers) {
      console.warn('⚠️ Maksimum worker sayısına ulaşıldı');
      return null;
    }

    try {
      const worker = new Worker(this.options.workerScript, {
        workerData: {
          workerId: this.workers.length + 1,
          options: this.options
        }
      });

      worker.on('message', (result) => {
        this.handleWorkerMessage(worker, result);
      });

      worker.on('error', (error) => {
        this.handleWorkerError(worker, error);
      });

      worker.on('exit', (code) => {
        this.handleWorkerExit(worker, code);
      });

      this.workers.push({
        worker,
        isBusy: false,
        lastUsed: Date.now(),
        tasksCompleted: 0,
        errors: 0
      });

      console.log(`✅ Worker ${this.workers.length} oluşturuldu`);
      return worker;

    } catch (error) {
      console.error('❌ Worker oluşturma hatası:', error);
      return null;
    }
  }

  // Worker mesajını işle
  handleWorkerMessage(worker, result) {
    const workerInfo = this.workers.find(w => w.worker === worker);
    if (workerInfo) {
      workerInfo.isBusy = false;
      workerInfo.lastUsed = Date.now();
      workerInfo.tasksCompleted++;
      this.activeWorkers--;

      // Sonraki görevi işle
      this.processNextTask();
    }

    // Sonucu emit et
    this.emit('taskCompleted', result);
  }

  // Worker hatasını işle
  handleWorkerError(worker, error) {
    const workerInfo = this.workers.find(w => w.worker === worker);
    if (workerInfo) {
      workerInfo.errors++;
      workerInfo.isBusy = false;
      this.activeWorkers--;

      console.error('❌ Worker hatası:', error);
      this.emit('workerError', { worker, error });
    }
  }

  // Worker çıkışını işle
  handleWorkerExit(worker, code) {
    const index = this.workers.findIndex(w => w.worker === worker);
    if (index !== -1) {
      this.workers.splice(index, 1);
      console.log(`🔚 Worker ${index + 1} çıktı (kod: ${code})`);
    }
  }

  // Görevi worker'a gönder
  executeTask(task) {
    return new Promise((resolve, reject) => {
      const availableWorker = this.workers.find(w => !w.isBusy);
      
      if (availableWorker) {
        availableWorker.isBusy = true;
        availableWorker.lastUsed = Date.now();
        this.activeWorkers++;

        // Worker'a görevi gönder
        availableWorker.worker.postMessage(task);

        // Sonucu bekle
        const timeout = setTimeout(() => {
          reject(new Error('Worker timeout'));
        }, 30000); // 30 saniye timeout

        this.once('taskCompleted', (result) => {
          clearTimeout(timeout);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        });

      } else {
        // Boş worker yoksa kuyruğa ekle
        this.taskQueue.push({ task, resolve, reject });
      }
    });
  }

  // Sonraki görevi işle
  processNextTask() {
    if (this.taskQueue.length > 0) {
      const { task, resolve, reject } = this.taskQueue.shift();
      
      // Yeni worker oluştur gerekirse
      if (this.activeWorkers < this.workers.length && this.workers.length < this.options.maxWorkers) {
        this.createWorker();
      }

      this.executeTask(task).then(resolve).catch(reject);
    }
  }

  // Boşta kalan worker'ları temizle
  startIdleCleanup() {
    setInterval(() => {
      if (this.isShuttingDown) return;

      const now = Date.now();
      const idleWorkers = this.workers.filter(w => 
        !w.isBusy && 
        (now - w.lastUsed) > this.options.idleTimeout &&
        this.workers.length > this.options.minWorkers
      );

      idleWorkers.forEach(workerInfo => {
        const index = this.workers.indexOf(workerInfo);
        if (index !== -1) {
          workerInfo.worker.terminate();
          this.workers.splice(index, 1);
          console.log(`🧹 Boşta kalan worker temizlendi`);
        }
      });
    }, 10000); // 10 saniyede bir kontrol et
  }

  // Toplu görev işle
  async executeBatch(tasks, batchSize = 5) {
    const results = [];
    const batches = [];

    // Görevleri batch'lere böl
    for (let i = 0; i < tasks.length; i += batchSize) {
      batches.push(tasks.slice(i, i + batchSize));
    }

    // Her batch'i işle
    for (const batch of batches) {
      const batchPromises = batch.map(task => this.executeTask(task));
      const batchResults = await Promise.allSettled(batchPromises);
      
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : { error: result.reason.message }
      ));
    }

    return results;
  }

  // Otomatik ölçeklendirme başlat
  startAutoScaling() {
    this.scalingTimer = setInterval(async () => {
      if (this.isShuttingDown) return;
      
      try {
        const metrics = await this.getSystemMetrics();
        const load = this.calculateLoad();
        
        // Metrikleri kaydet
        this.performanceMetrics.cpuHistory.push(metrics.cpuUsage);
        this.performanceMetrics.memoryHistory.push(metrics.memoryUsage);
        
        // Son 10 ölçümü tut
        if (this.performanceMetrics.cpuHistory.length > 10) {
          this.performanceMetrics.cpuHistory.shift();
          this.performanceMetrics.memoryHistory.shift();
        }
        
        // Ölçeklendirme kararı
        this.makeScalingDecision(metrics, load);
        
      } catch (error) {
        console.error('❌ Ölçeklendirme hatası:', error);
      }
    }, this.options.scaleInterval);
  }

  // Ölçeklendirme kararı
  makeScalingDecision(metrics, load) {
    const shouldScaleUp = 
      load > this.options.loadThreshold ||
      metrics.cpuUsage > this.options.cpuThreshold ||
      metrics.memoryUsage < this.options.memoryThreshold;
    
    const shouldScaleDown = 
      load < this.options.loadThreshold * 0.5 &&
      metrics.cpuUsage < this.options.cpuThreshold * 0.5 &&
      this.workers.length > this.options.minWorkers;
    
    if (shouldScaleUp && this.workers.length < this.options.maxWorkers) {
      this.scaleUp();
    } else if (shouldScaleDown) {
      this.scaleDown();
    }
  }

  // Worker sayısını artır
  scaleUp() {
    const newWorker = this.createWorker();
    if (newWorker) {
      this.performanceMetrics.scalingEvents++;
      console.log(`📈 Worker sayısı artırıldı: ${this.workers.length}/${this.options.maxWorkers}`);
      this.emit('scaledUp', { currentWorkers: this.workers.length, maxWorkers: this.options.maxWorkers });
    }
  }

  // Worker sayısını azalt
  scaleDown() {
    const idleWorkers = this.workers.filter(w => !w.isBusy);
    if (idleWorkers.length > 0 && this.workers.length > this.options.minWorkers) {
      const workerToRemove = idleWorkers[0];
      const index = this.workers.indexOf(workerToRemove);
      
      if (index !== -1) {
        workerToRemove.worker.terminate();
        this.workers.splice(index, 1);
        this.performanceMetrics.scalingEvents++;
        console.log(`📉 Worker sayısı azaltıldı: ${this.workers.length}/${this.options.maxWorkers}`);
        this.emit('scaledDown', { currentWorkers: this.workers.length, minWorkers: this.options.minWorkers });
      }
    }
  }

  // İstatistikleri al
  getStats() {
    const avgCpu = this.performanceMetrics.cpuHistory.length > 0 ? 
      this.performanceMetrics.cpuHistory.reduce((a, b) => a + b, 0) / this.performanceMetrics.cpuHistory.length : 0;
    
    const avgMemory = this.performanceMetrics.memoryHistory.length > 0 ? 
      this.performanceMetrics.memoryHistory.reduce((a, b) => a + b, 0) / this.performanceMetrics.memoryHistory.length : 0;
    
    return {
      totalWorkers: this.workers.length,
      activeWorkers: this.activeWorkers,
      idleWorkers: this.workers.length - this.activeWorkers,
      queuedTasks: this.taskQueue.length,
      totalTasksCompleted: this.workers.reduce((sum, w) => sum + w.tasksCompleted, 0),
      totalErrors: this.workers.reduce((sum, w) => sum + w.errors, 0),
      averageTasksPerWorker: this.workers.length > 0 ? 
        this.workers.reduce((sum, w) => sum + w.tasksCompleted, 0) / this.workers.length : 0,
      // Yeni metrikler
      averageCpuUsage: avgCpu,
      averageMemoryUsage: avgMemory,
      scalingEvents: this.performanceMetrics.scalingEvents,
      autoScaling: this.options.autoScale,
      load: this.calculateLoad()
    };
  }

  // Worker havuzunu durdur
  async shutdown() {
    console.log('🛑 Worker Pool kapatılıyor...');
    this.isShuttingDown = true;

    // Ölçeklendirme zamanlayıcısını durdur
    if (this.scalingTimer) {
      clearInterval(this.scalingTimer);
      this.scalingTimer = null;
    }

    // Tüm worker'ları durdur
    const terminationPromises = this.workers.map(workerInfo => 
      workerInfo.worker.terminate()
    );

    await Promise.all(terminationPromises);
    this.workers = [];
    this.taskQueue = [];
    
    console.log('✅ Worker Pool kapatıldı');
  }
}

module.exports = WorkerPool; 
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Basit JSON tabanlı ayar deposu (electron-store alternatifi)
class SimpleStore {
  constructor(filename = 'settings.json', defaults = {}) {
    this.filePath = path.join(app.getPath('userData'), filename);
    this._data = { ...defaults };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const json = JSON.parse(raw);
        this._data = { ...this._data, ...json };
      }
    } catch (err) {
      console.error('Config load error:', err);
    }
  }

  _save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this._data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Config save error:', err);
    }
  }

  get(key) {
    return this._data[key];
  }

  set(updates) {
    if (updates && typeof updates === 'object') {
      this._data = { ...this._data, ...updates };
      this._save();
    }
  }

  get store() {
    return { ...this._data };
  }
}

// Varsayılan değerlerle örnek oluştur
const defaults = {
  bingApiKey: '',
  internetSearchMode: 'bing', // 'bing' | 'scrape'
  similarityThreshold: 60, // benzerlik filtresi varsayılan %
};

module.exports = new SimpleStore('settings.json', defaults); 

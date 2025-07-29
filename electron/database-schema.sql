-- Ana görsel tablosu
CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_hash TEXT NOT NULL, -- Dosya içeriği MD5 hash
  
  -- Dosya metadata
  created_at_file DATETIME,
  modified_at_file DATETIME,
  
  -- Görsel özellikleri
  width INTEGER,
  height INTEGER,
  format TEXT,
  color_space TEXT,
  
  -- Ayak izi bilgileri
  perceptual_hash TEXT,
  color_hash TEXT,
  edge_hash TEXT,
  texture_hash TEXT,
  
  -- PDF/PS için özel alanlar
  page_count INTEGER DEFAULT 1,
  is_vector BOOLEAN DEFAULT 0,
  
  -- Durum bilgileri
  status TEXT DEFAULT 'active', -- active, deleted, moved
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  scan_count INTEGER DEFAULT 1,
  
  -- Sistem bilgileri
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tarama geçmişi tablosu
CREATE TABLE IF NOT EXISTS scan_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  disk_letter TEXT NOT NULL,
  scan_type TEXT NOT NULL, -- full, incremental, quick
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  
  -- İstatistikler
  total_scanned INTEGER DEFAULT 0,
  new_files INTEGER DEFAULT 0,
  updated_files INTEGER DEFAULT 0,
  deleted_files INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  
  -- Durum
  status TEXT DEFAULT 'running', -- running, completed, failed, cancelled
  error_message TEXT
);

-- Dosya değişiklik logları
CREATE TABLE IF NOT EXISTS file_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER,
  change_type TEXT NOT NULL, -- added, modified, deleted, moved
  old_path TEXT,
  new_path TEXT,
  detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  scan_history_id INTEGER,
  
  FOREIGN KEY (image_id) REFERENCES images(id),
  FOREIGN KEY (scan_history_id) REFERENCES scan_history(id)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_file_hash ON images(file_hash);
CREATE INDEX IF NOT EXISTS idx_file_path ON images(file_path);
CREATE INDEX IF NOT EXISTS idx_status ON images(status);
CREATE INDEX IF NOT EXISTS idx_perceptual_hash ON images(perceptual_hash);
CREATE INDEX IF NOT EXISTS idx_last_seen ON images(last_seen);
CREATE INDEX IF NOT EXISTS idx_scan_history_disk ON scan_history(disk_letter, started_at); 
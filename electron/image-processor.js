/*
 * image-processor.js
 * Sharp kullanarak görseller üzerinde temel işlemler (thumbnail, resize)
 */
const sharp = require('sharp');
const { hash: computeHash } = require('imghash');
const path = require('path');
const fs = require('fs').promises;
const ort = (() => {
  try {
    // onnxruntime-node native binding
    return require('onnxruntime-node');
  } catch (e) {
    console.warn('onnxruntime-node bulunamadı; embedding desteği devre dışı.', e.message);
    return null;
  }
})();
// Sharp.js ile HOG benzeri özellik çıkarımı için yardımcı fonksiyonlar
const sharpHOG = {
  // HOG benzeri özellik çıkarımı
  async extractHOGFeatures(imagePath) {
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      // Görüntüyü 64x128 boyutuna küçült (HOG standardı)
      const resized = await image
        .resize(64, 128, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer();
      
      // Gradient hesaplama
      const gradients = this.calculateGradients(resized, 64, 128);
      
      // HOG histogram hesaplama
      const hogFeatures = this.computeHOGHistogram(gradients, 64, 128);
      
      return {
        features: hogFeatures,
        metadata: {
          width: 64,
          height: 128,
          cellSize: 8,
          blockSize: 16,
          bins: 9
        }
      };
    } catch (error) {
      console.error('Sharp HOG özellik çıkarımı hatası:', error);
      return null;
    }
  },

  // Gradient hesaplama
  calculateGradients(pixelData, width, height) {
    const gradients = [];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const left = pixelData[idx - 1];
        const right = pixelData[idx + 1];
        const top = pixelData[(y - 1) * width + x];
        const bottom = pixelData[(y + 1) * width + x];
        
        // X ve Y gradientleri
        const gx = right - left;
        const gy = bottom - top;
        
        // Gradient büyüklüğü ve yönü
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const orientation = Math.atan2(gy, gx) * 180 / Math.PI;
        
        gradients.push({ magnitude, orientation });
      }
    }
    
    return gradients;
  },

  // HOG histogram hesaplama
  computeHOGHistogram(gradients, width, height) {
    const cellSize = 8;
    const blockSize = 16;
    const bins = 9;
    const features = [];
    
    // Her hücre için histogram hesapla
    for (let cy = 0; cy < height; cy += cellSize) {
      for (let cx = 0; cx < width; cx += cellSize) {
        const histogram = new Array(bins).fill(0);
        
        // Hücre içindeki gradientleri topla
        for (let y = cy; y < Math.min(cy + cellSize, height); y++) {
          for (let x = cx; x < Math.min(cx + cellSize, width); x++) {
            const idx = y * width + x;
            if (idx < gradients.length) {
              const grad = gradients[idx];
              const bin = Math.floor((grad.orientation + 180) / 40) % bins;
              histogram[bin] += grad.magnitude;
            }
          }
        }
        
        features.push(...histogram);
      }
    }
    
    return features;
  },

  // Basit HOG benzeri özellik çıkarımı
  async extractSimpleHOG(imagePath) {
    try {
      const image = sharp(imagePath);
      
      // Görüntüyü 32x32'ye küçült
      const resized = await image
        .resize(32, 32, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer();
      
      // Basit gradient analizi
      const features = [];
      for (let i = 0; i < resized.length - 1; i++) {
        const diff = resized[i + 1] - resized[i];
        features.push(diff);
      }
      
      return {
        features: features.slice(0, 100), // İlk 100 özellik
        type: 'simple_hog'
      };
    } catch (error) {
      console.error('Basit HOG özellik çıkarımı hatası:', error);
      return null;
    }
  }
};

// Desteklenen görsel uzantıları – BMP ve PS eklendi
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.ps'];

// Tarama sırasında atlanacak yaygın sistem klasörleri (küçük harf karşılaştırma)
const EXCLUDED_DIR_NAMES = [
  'windows',
  'program files',
  'program files (x86)',
  '$recycle.bin',
  'appdata',
  'programdata',
  'system volume information',
  'system32',
  'temp',
  'tmp',
  'config',
  'drivers',
  'logfiles',
  'nvidia',
  'amd',
  'intel',
  'msdtc',
  'networklist',
  'sru',
  'tasks',
  'wdi',
  'sleepstudy',
  'spool',
  'printers',
  'driverdata',
  'configuration',
  'com',
  'dmp',
  'appmgmt',
  's-1-5-18',
  'machine',
  'syswow64',
  'users\default',
  'perflogs',
  '$windows.~bt',
  '$windows.~ws',
  '$archivedata',
  '$temp',
  '$onedrive temp',
  '$git',
  '$svn',
  '$cache',
  '$node_modules',
  '$venv',
  '$env',
  'lib',
  'tcl',
  '.git',
  'node_modules',
  'vendor',
  '__pycache__',
  'build',
  'dist',
  '.vscode',
  'debug',
  'release',
  'logs',
];

// MobileNetV2 modeli tek sefer yüklenir
let ortSession = null;
async function getOrtSession() {
  if (!ort || ortSession) return ortSession;
  const modelPath = path.join(__dirname, 'models', 'mobilenetv2.onnx');
  try {
    ortSession = await ort.InferenceSession.create(modelPath, { executionProviders: ['cpu'] });
    console.log('ONNX model loaded');
  } catch (err) {
    console.error('ONNX model yüklenemedi:', err.message);
    ortSession = null;
  }
  return ortSession;
}

/**
 * Verilen dosya adının desteklenen bir görsel olup olmadığını kontrol eder.
 * @param {string} filename
 * @returns {boolean}
 */
function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_FORMATS.includes(ext);
}

/**
 * Bir görsel dosyasını işleyerek meta verilerini ve hash değerlerini döndürür.
 * @param {string} imagePath
 * @returns {Promise<object>} Görsel meta verileri
 */
async function processImage(imagePath) {
  try {
    // Dosya mevcut mu?
    await fs.access(imagePath);

    let imageBuffer;

    // BMP dosyaları için özel işlem
    if (imagePath.toLowerCase().endsWith('.bmp')) {
      // Sharp BMP'yi desteklemiyorsa, önce JPEG'e çevir
      imageBuffer = await sharp(imagePath).jpeg().toBuffer();
    } else {
      // Diğer formatlar için doğrudan dosyayı oku
      imageBuffer = await fs.readFile(imagePath);
    }

    // Sharp örneğini oluştur ve metadata al (şimdi buffer üzerinden)
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const stats = await fs.stat(imagePath); // fs.stat hala orijinal path'i kullanır

    // Perceptual hash (pHash) – 8x8 (64-bit) endüstri standardı
    const phash = await computeHash(imagePath, 8, 'hex');

    // Difference hash (dHash) hesapla (image burada sharp(imageBuffer) olarak gelir)
    let dhash = null;
    try {
      const resizedBuffer = await image
        .resize(9, 8, { fit: 'fill' })
        .greyscale()
        .raw()
        .toBuffer();
      dhash = calculateDHash(resizedBuffer, 9, 8);
    } catch (err) {
      console.error('DHash calculation failed:', err.message);
    }

    // Basit blockhash (computeBlockHash imagePath kullanır)
    let blockhash = null;
    try {
      const bhBits = await computeBlockHash(imagePath, 8);
      blockhash = bitsToHex(bhBits);
    } catch (err) {
      console.error('Blockhash calc error:', err.message);
    }

    // Renk histogramı (calculateColorHistogramExtended imagePath kullanır)
    let colorHist = null;
    try {
      colorHist = await calculateColorHistogramExtended(imagePath, 256); 
      console.log(`🎨 Renk histogramı hesaplandı: ${colorHist ? colorHist.length : 0} bin`);
    } catch (err) {
      console.error('Histogram error:', err.message);
    }

    // Embedding (ONNX) – (generateEmbedding imagePath kullanır)
    let embeddingBuf = null;
    try {
      embeddingBuf = await generateEmbedding(imagePath); 
      console.log(`🧠 Embedding oluşturuldu: ${embeddingBuf ? embeddingBuf.length : 0} bytes`);
    } catch (err) {
      console.error('Embedding generate error:', err.message);
    }

    // HOG vektörü (computeHOGVector imagePath kullanır)
    let hogVector = null;
    try {
      hogVector = await computeHOGVector(imagePath);
      console.log(`🔍 HOG vektörü hesaplandı: ${hogVector ? hogVector.length : 0} özellik`);
    } catch (err) {
      console.error('HOG vector calc error:', err.message);
    }

    // Hakim renkleri çıkar (extractDominantColors imagePath kullanır)
    const colors = await extractDominantColors(imagePath);

    const imageData = {
      filename: path.basename(imagePath),
      filepath: imagePath,
      phash: phash || null,
      dhash: dhash || null,
      blockhash: blockhash || null,
      colorHist: colorHist || null,
      width: metadata.width || 0,
      height: metadata.height || 0,
      filesize: stats.size || 0,
      colors: colors || [],
      embedding: embeddingBuf || null,
      hogVector: hogVector || null,
    };
    
    console.log(`✅ Görsel işlendi, embedding boyutu: ${embeddingBuf ? embeddingBuf.length : 0}`);
    return imageData;
  } catch (error) {
    console.warn(`Görsel işleme başarısız oldu ${imagePath}:`, error.message);
    return null;
  }
}

/**
 * dHash hesaplamak için yardımcı fonksiyon.
 * @param {Buffer} buffer Greyscale piksel verisi
 * @param {number} width
 * @param {number} height
 * @returns {string} Hex string dHash
 */
function calculateDHash(buffer, width, height) {
  let bits = '';

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const idx = y * width + x;
      const current = buffer[idx];
      const next = buffer[idx + 1];
      bits += current > next ? '1' : '0';
    }
  }

  // Binary dizi -> hex string
  return parseInt(bits, 2).toString(16).padStart(16, '0');
}

/**
 * Görselin dominant( baskın ) rengini döndürür.
 * @param {string} imagePath
 * @param {number} colorCount
 * @returns {Promise<Array>}
 */
async function extractDominantColors(imagePath, colorCount = 5) {
  try {
    const { dominant } = await sharp(imagePath)
      .resize(100, 100, { fit: 'inside' })
      .stats();
    return [dominant];
  } catch (error) {
    console.warn('Color extraction failed:', error.message);
    return [];
  }
}

/**
 * Belirtilen klasör altındaki tüm görselleri tarar ve işler.
 * @param {string} dirPath
 * @param {(progress:{current:number,total?:number,currentFile?:string})=>void} [onProgress]
 * @returns {Promise<Array<object>>}
 */
async function scanDirectory(dirPath, onProgress) {
  const results = [];
  let processed = 0;

  async function scan(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      // Yetki veya sistemi engelleyen klasörler – logla ve bu dalı atla
      if (onProgress) {
        onProgress({ current: processed, currentFile: dir, status: 'skipped-permission-denied', error: err.message });
      }
      console.warn(`Klasör atlandı (izin hatası - ${dir}):`, err.message);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const lowerFullPath = fullPath.toLowerCase();
        const isExcluded = EXCLUDED_DIR_NAMES.some((excludedName) => {
            // Hem klasör adını hem de tam yolu kontrol et
            return entry.name.toLowerCase() === excludedName || lowerFullPath.includes(excludedName + path.sep);
        });

        if (isExcluded) {
          if (onProgress) onProgress({ current: processed, currentFile: fullPath, status: 'skipped-excluded-name' });
          console.log(`Klasör atlandı (hariç tutuldu - ${fullPath})`);
          continue; 
        }

        // Alt klasörlerde de devam et
        await scan(fullPath);
      } else if (entry.isFile() && isImageFile(entry.name)) {
        const imageData = await processImage(fullPath);

        if (imageData) { // imageData null değilse ekle
          results.push(imageData);
          processed += 1;

          if (onProgress) {
            onProgress({ current: processed, currentFile: entry.name });
          }
        } else {
          // imageData null ise, zaten processImage içinde loglandı, burada bir şey yapmaya gerek yok.
        }
      }
    }
  }

  await scan(dirPath);

  if (onProgress) {
    onProgress({ current: processed, total: processed, status: 'done' });
  }

  return results;
}

/**
 * Basit blockhash algoritması (average hash benzeri) – n x n blok.
 */
async function computeBlockHash(imagePath, blocks = 8) {
  const size = blocks * 4; // 4px per block
  const buffer = await sharp(imagePath)
    .resize(size, size, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();

  const blockAvg = [];
  const pixelsPerBlock = 4 * 4; // 16

  for (let by = 0; by < blocks; by += 1) {
    for (let bx = 0; bx < blocks; bx += 1) {
      let sum = 0;
      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < 4; x += 1) {
          const px = (by * 4 + y) * size + (bx * 4 + x);
          sum += buffer[px];
        }
      }
      blockAvg.push(sum / pixelsPerBlock);
    }
  }

  const overallAvg = blockAvg.reduce((a, b) => a + b, 0) / blockAvg.length;
  return blockAvg.map((v) => (v > overallAvg ? 1 : 0)).join('');
}

function bitsToHex(bitString) {
  let hex = '';
  for (let i = 0; i < bitString.length; i += 4) {
    const chunk = bitString.substr(i, 4);
    hex += parseInt(chunk, 2).toString(16);
  }
  return hex;
}

async function calculateColorHistogram(imagePath, bins = 256) {
  // sharp.stats() kanal başına 256 uzunlukta histogram döndürür; bazı tek-kanallı
  // veya hatalı görsellerde histogram eksik olabilir. Güvenli şekilde dolduralım.
  const { channels } = await sharp(imagePath).resize(256, 256, { fit: 'inside' }).stats();

  const hist = [];
  for (let ci = 0; ci < 3; ci += 1) {
    const ch = channels[ci];
    let h = ch && Array.isArray(ch.histogram) ? ch.histogram : null;

    // Eğer histogram yoksa veya beklenen uzunlukta değilse sıfırlarla doldur
    if (!h || h.length < bins) {
      h = new Array(bins).fill(0);
    }
    // Fazla uzunluk varsa yalnızca ilk `bins` değeri al
    hist.push(...h.slice(0, bins));
  }

  const total = hist.reduce((a, b) => a + b, 0) || 1;
  return hist.map((v) => v / total);
}

/**
 * RGB (3×256) + HSV Hue (256) = 1024 elemanlı histogram döndürür.
 * RGB Sharp ile, Hue OpenCV ile hesaplanır; OpenCV yoksa Hue sıfırlar.
 */
async function calculateColorHistogramExtended(imagePath, bins = 256) {
  // --------------- RGB ----------------
  const { channels } = await sharp(imagePath).resize(256, 256, { fit: 'inside' }).stats();
  const counts = [];
  for (let ci = 0; ci < 3; ci += 1) {
    const ch = channels[ci];
    let arr = ch && Array.isArray(ch.histogram) ? ch.histogram : null;
    if (!arr || arr.length < bins) arr = new Array(bins).fill(0);
    counts.push(...arr.slice(0, bins));
  }

  // --------------- HSV Hue ----------------
  if (cv) {
    try {
      const mat = cv.imread(imagePath);
      if (!mat.empty) {
        const hsv = mat.cvtColor(cv.COLOR_BGR2HSV);
        const hChan = hsv.split()[0];
        const histMat = cv.calcHist(hChan, [{ channel: 0, bins, ranges: [0, 180] }]);
        let hueArr = histMat.getDataAsArray ? histMat.getDataAsArray() : [];
        if (Array.isArray(hueArr[0])) hueArr = hueArr.map((x) => x[0]);
        if (hueArr.length < bins) counts.push(...hueArr, ...new Array(bins - hueArr.length).fill(0));
        else counts.push(...hueArr.slice(0, bins));
      } else {
        counts.push(...new Array(bins).fill(0));
      }
    } catch (err) {
      console.warn('HSV histogram failed:', err.message);
      counts.push(...new Array(bins).fill(0));
    }
  } else {
    counts.push(...new Array(bins).fill(0));
  }

  // Normalizasyon
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return counts.map((v) => v / total);
}

/**
 * MobileNetV2 embedding (1000-d) üretir
 */
async function generateEmbedding(imagePath) {
  const session = await getOrtSession();
  if (!session) {
    console.error('ONNX session mevcut değil, embedding oluşturulamıyor.');
    return null;
  }

  try {
    const imageBuffer = await sharp(imagePath).resize(224, 224).raw().toBuffer();
    
    // Piksel verilerini Float32Array'e dönüştür ve normalize et
    const float32Data = new Float32Array(imageBuffer.length);
    for (let i = 0; i < imageBuffer.length; i++) {
      float32Data[i] = imageBuffer[i] / 255.0; // 0-1 aralığına normalize et
    }

    // NCHW -> (1,3,224,224) formatına dönüştür
    const transposed = new Float32Array(1 * 3 * 224 * 224);
    let p = 0;
    for (let y = 0; y < 224; y += 1) {
      for (let x = 0; x < 224; x += 1) {
        const idx = (y * 224 + x) * 3;
        transposed[p] = float32Data[idx]; // R
        transposed[224 * 224 + p] = float32Data[idx + 1]; // G
        transposed[2 * 224 * 224 + p] = float32Data[idx + 2]; // B
        p += 1;
      }
    }

    // ONNX modeli için uygun input tensörünü oluştur
    const inputTensor = new ort.Tensor('float32', transposed, [1, 3, 224, 224]);
    const feeds = { data: inputTensor }; // MobileNetV2 için 'data' anahtarını kullanıyoruz
    console.log('generateEmbedding: ONNX modeline gönderilen feeds objesi:', Object.keys(feeds));
    console.log('generateEmbedding: ONNX modeline gönderilen girdi tensör boyutu:', inputTensor.dims);
    console.log('generateEmbedding: ONNX modeline gönderilen girdi tensör tipi:', inputTensor.type);

    const results = await session.run(feeds);
    console.log('generateEmbedding: ONNX model çıktı anahtarları:', Object.keys(results));

    // Modelin çıktı ismini al, genellikle 'mobilenetv20_output_flatten0_reshape0' veya benzeri
    const outputKey = Object.keys(results)[0];
    const outputTensor = results[outputKey];
    console.log('generateEmbedding: ONNX model çıktı tensör boyutu:', outputTensor.dims);
    console.log('generateEmbedding: ONNX model çıktı tensör tipi:', outputTensor.type);

    // Çıktı tensörünü Buffer'a dönüştür
    const embeddingBuffer = Buffer.from(outputTensor.data.buffer);
    console.log(`generateEmbedding: Oluşturulan embedding buffer boyutu: ${embeddingBuffer.length}`);

    // Eğer buffer boyutu sıfırsa veya geçersizse null döndür
    if (embeddingBuffer.length === 0) {
      console.warn('Oluşturulan embedding buffer boş.');
      return null;
    }
    
    return embeddingBuffer;
  } catch (error) {
    console.error(`generateEmbedding hatası ${imagePath}:`, error);
    return null;
  }
}

async function computeHOGVector(imagePath) {
  try {
    // Sharp.js ile HOG benzeri özellik çıkarımı
    const hogFeatures = await sharpHOG.extractSimpleHOG(imagePath);
    
    if (hogFeatures) {
      console.log('✅ Sharp HOG özellikleri çıkarıldı:', hogFeatures.features.length, 'özellik');
      return hogFeatures.features;
    } else {
      console.warn('⚠️ Sharp HOG özellik çıkarımı başarısız');
      return null;
    }
  } catch (error) {
    console.error('Sharp HOG hesaplama hatası:', error);
    return null;
  }
}

module.exports = {
  processImage,
  scanDirectory,
  isImageFile,
  SUPPORTED_FORMATS,
  generateEmbedding,
  getImageBase64: async (filepath) => {
    try {
      // Dosya yolunu normalize et ve boşlukları kontrol et
      const normalizedPath = path.resolve(filepath);
      console.log('getImageBase64: Normalized path:', normalizedPath);
      
      // Dosyanın varlığını kontrol et
      await fs.access(normalizedPath);
      
      // Dosyayı oku
      const data = await fs.readFile(normalizedPath);
      const base64 = data.toString('base64');
      
      // MIME type'ı doğru şekilde belirle
      const ext = path.extname(normalizedPath).toLowerCase();
      let mimeType = 'image/jpeg'; // varsayılan
      
      switch (ext) {
        case '.png':
          mimeType = 'image/png';
          break;
        case '.gif':
          mimeType = 'image/gif';
          break;
        case '.webp':
          mimeType = 'image/webp';
          break;
        case '.bmp':
          mimeType = 'image/bmp';
          break;
        case '.jpg':
        case '.jpeg':
        default:
          mimeType = 'image/jpeg';
          break;
      }
      
      return { success: true, dataUrl: `data:${mimeType};base64,${base64}` };
    } catch (error) {
      console.error('Base64 görsel dönüşüm hatası:', error);
      return { success: false, error: error.message };
    }
  },
};

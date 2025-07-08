/*
 * hash-calculator.js – Görsel hash ve renk çıkarımı yardımcıları
 */

const sharp = require('sharp');
const imghash = require('imghash');

/**
 * Görsel üzerinde pHash (16x16) hesaplar.
 * @param {string} imagePath Görsel dosya yolu
 * @returns {Promise<string>} 64 karakterlik hex hash
 */
async function calculatePerceptualHash(imagePath) {
  // imghash.hash(imagePath, bits, format)
  return imghash.hash(imagePath, 16, 'hex');
}

/**
 * Ham piksel verisini hash hesaplamaya uygun boyuta indirger.
 * @param {Buffer|string} input Buffer ya da dosya yolu
 * @param {number} size Kenar boyutu (varsayılan 256)
 * @returns {Promise<Buffer>} Yeniden boyutlandırılmış RGBA buffer
 */
async function resizeForHash(input, size = 256) {
  return sharp(input)
    .resize(size, size, { fit: 'inside' })
    .toColourspace('rgb')
    .raw()
    .toBuffer();
}

/**
 * Basit Hamming benzerliği – 0-100 arası skor.
 */
function compareHashes(hash1, hash2) {
  if (!hash1 || !hash2) return 0;
  const len = Math.min(hash1.length, hash2.length);
  let diff = 0;
  for (let i = 0; i < len; i += 1) {
    if (hash1[i] !== hash2[i]) diff += 1;
  }
  return ((len - diff) / len) * 100;
}

/**
 * Dominant renkleri (varsayılan 5) HEX formatında döndürür.
 * Çok basit bir quantization + frequency analizi uygulanır.
 * @param {string} imagePath
 * @param {number} colorCount
 * @returns {Promise<string[]>}
 */
async function extractDominantColors(imagePath, colorCount = 5) {
  // Küçük bir boyuta indir (100px) + raw piksel verisini al
  const { data, info } = await sharp(imagePath)
    .resize(100, 100, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const counts = new Map();
  // RGBA sıralı, 4 byte per pixel
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // 4-bit quantization (0-15)
    const key = `${r >> 4}_${g >> 4}_${b >> 4}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  // En sık görülen renkleri sırala
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const hexColors = sorted.slice(0, colorCount).map(([key]) => {
    const [rq, gq, bq] = key.split('_').map((v) => parseInt(v, 10));
    // 4-bit değeri 8-bit'e ölçekle (x*17)
    const r = rq * 17;
    const g = gq * 17;
    const b = bq * 17;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  });

  return hexColors;
}

module.exports = {
  calculatePerceptualHash,
  resizeForHash,
  compareHashes,
  extractDominantColors,
};

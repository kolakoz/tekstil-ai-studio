/*
 * font-recognizer.js
 * Tesseract.js ile resimdeki yazıyı çözer ve basit font eşleştirmesi yapar
 */
import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fontDbPath = path.join(__dirname, '../assets/fonts-database.json');

const fontsDb = JSON.parse(fs.readFileSync(fontDbPath, 'utf-8'));

export async function recognizeFont(imagePath) {
  const worker = await createWorker('eng');
  const {
    data: { text },
  } = await worker.recognize(imagePath);
  await worker.terminate();
  // TODO: Gelişmiş font eşleştirme algoritması
  const matched = fontsDb.filter((f) => text.includes(f.sample));
  return matched.map((m) => m.name);
}

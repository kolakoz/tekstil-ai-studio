const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');
const settingsStore = require('./config-store');

/**
 * Basit internet görsel araması – Bing Visual Search API kullanır.
 * Ortam değişkeni BING_API_KEY zorunludur.
 * @param {string} imagePath Yerel görsel yolu
 * @returns {Promise<Array<{url:string, hostPageUrl:string, name:string}>>}
 */
async function searchImageOnline(imagePath) {
  // Öncelik sırayla: settings.json → ortam değişkeni
  const apiKey = settingsStore.get('bingApiKey') || process.env.BING_API_KEY;
  if (!apiKey) throw new Error('Bing API anahtarı tanımlı değil');

  const endpoint = 'https://api.bing.microsoft.com/v7.0/images/visualsearch';
  const imageData = await fs.promises.readFile(imagePath);

  const form = new FormData();
  form.append('image', imageData, path.basename(imagePath));

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bing API error: ${res.status} - ${text}`);
  }
  const json = await res.json();
  const tags = json.tags || [];
  const actions = tags.flatMap((t) => t.actions || []);
  const visuallySimilar = actions.find((a) => a.actionType === 'VisualSearch' && a.data && a.data.value);
  const results = visuallySimilar ? visuallySimilar.data.value.slice(0, 20) : [];
  return results.map((v) => ({ url: v.contentUrl, hostPageUrl: v.hostPageUrl, name: v.name }));
}

module.exports = {
  searchImageOnline,
}; 

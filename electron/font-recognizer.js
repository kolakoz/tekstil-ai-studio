/*
 * font-recognizer.js
 * Tesseract.js ile resimdeki yazıyı çözer ve basit font eşleştirmesi yapar
 */
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs').promises;

class FontRecognizer {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
    this.fontDatabase = this.loadFontDatabase();
  }

  // Font veritabanını yükle
  loadFontDatabase() {
    try {
      const fontData = require('../assets/fonts-database.json');
      return fontData;
    } catch (error) {
      console.warn('Font veritabanı yüklenemedi, varsayılan fontlar kullanılacak');
      return {
        fonts: [
          { name: 'Arial', characteristics: ['sans-serif', 'clean', 'modern'], weight: 'normal', style: 'normal' },
          { name: 'Times New Roman', characteristics: ['serif', 'traditional', 'formal'], weight: 'normal', style: 'normal' },
          { name: 'Helvetica', characteristics: ['sans-serif', 'clean', 'professional'], weight: 'normal', style: 'normal' },
          { name: 'Georgia', characteristics: ['serif', 'elegant', 'readable'], weight: 'normal', style: 'normal' },
          { name: 'Verdana', characteristics: ['sans-serif', 'web-safe', 'clear'], weight: 'normal', style: 'normal' },
          { name: 'Roboto', characteristics: ['sans-serif', 'modern', 'google'], weight: 'normal', style: 'normal' },
          { name: 'Open Sans', characteristics: ['sans-serif', 'web-safe', 'clean'], weight: 'normal', style: 'normal' },
          { name: 'Lato', characteristics: ['sans-serif', 'modern', 'friendly'], weight: 'normal', style: 'normal' },
          { name: 'Courier New', characteristics: ['monospace', 'fixed', 'code'], weight: 'normal', style: 'normal' },
          { name: 'Impact', characteristics: ['display', 'bold', 'headline'], weight: 'bold', style: 'normal' },
          { name: 'Comic Sans MS', characteristics: ['casual', 'friendly', 'informal'], weight: 'normal', style: 'normal' },
          { name: 'Tahoma', characteristics: ['sans-serif', 'web-safe', 'clear'], weight: 'normal', style: 'normal' },
          { name: 'Trebuchet MS', characteristics: ['sans-serif', 'modern', 'web-safe'], weight: 'normal', style: 'normal' },
          { name: 'Lucida Console', characteristics: ['monospace', 'fixed', 'terminal'], weight: 'normal', style: 'normal' },
          { name: 'Palatino', characteristics: ['serif', 'elegant', 'classic'], weight: 'normal', style: 'normal' },
          { name: 'Garamond', characteristics: ['serif', 'traditional', 'elegant'], weight: 'normal', style: 'normal' },
          { name: 'Bookman', characteristics: ['serif', 'traditional', 'formal'], weight: 'normal', style: 'normal' },
          { name: 'Century Gothic', characteristics: ['sans-serif', 'modern', 'geometric'], weight: 'normal', style: 'normal' },
          { name: 'Baskerville', characteristics: ['serif', 'traditional', 'elegant'], weight: 'normal', style: 'normal' },
          { name: 'Futura', characteristics: ['sans-serif', 'modern', 'geometric'], weight: 'normal', style: 'normal' }
        ]
      };
    }
  }

  // Tesseract worker'ını başlat
  async initialize() {
    try {
      this.worker = await Tesseract.createWorker('eng');
      await this.worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?@#$%&*()_+-=[]{}|;:\'",./<>?`~',
      });
      this.isInitialized = true;
      console.log('✅ Font Recognition sistemi başlatıldı');
    } catch (error) {
      console.error('❌ Font Recognition başlatma hatası:', error);
      this.isInitialized = false;
    }
  }

  // Görselden metin çıkar
  async extractText(imagePath) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const { data: { text } } = await this.worker.recognize(imagePath);
      return text.trim();
    } catch (error) {
      console.error('Metin çıkarma hatası:', error);
      return '';
    }
  }

  // Font karakteristiklerini analiz et
  analyzeFontCharacteristics(text) {
    const characteristics = {
      hasSerifs: false,
      isBold: false,
      isItalic: false,
      isCondensed: false,
      isExpanded: false,
      hasDecorativeElements: false,
      averageCharacterWidth: 0,
      lineHeight: 0,
      fontFamily: 'unknown',
      fontWeight: 'normal',
      fontStyle: 'normal',
      letterSpacing: 'normal',
      confidence: 0
    };

    if (text.length > 0) {
      // Temel metrikler
      characteristics.averageCharacterWidth = text.length / text.replace(/\s/g, '').length;
      
      // Font ağırlığı analizi
      characteristics.isBold = this.analyzeFontWeight(text);
      characteristics.fontWeight = characteristics.isBold ? 'bold' : 'normal';
      
      // Font stili analizi
      characteristics.isItalic = this.analyzeFontStyle(text);
      characteristics.fontStyle = characteristics.isItalic ? 'italic' : 'normal';
      
      // Font genişliği analizi
      const widthAnalysis = this.analyzeFontWidth(text);
      characteristics.isCondensed = widthAnalysis.isCondensed;
      characteristics.isExpanded = widthAnalysis.isExpanded;
      characteristics.letterSpacing = widthAnalysis.letterSpacing;
      
      // Serif analizi
      characteristics.hasSerifs = this.analyzeSerifs(text);
      
      // Font ailesi tespiti
      characteristics.fontFamily = this.detectFontFamily(text);
      
      // Dekoratif element analizi
      characteristics.hasDecorativeElements = this.analyzeDecorativeElements(text);
      
      // Güven skoru hesapla
      characteristics.confidence = this.calculateConfidence(characteristics);
    }

    return characteristics;
  }

  // Font ağırlığı analizi
  analyzeFontWeight(text) {
    // Büyük harf oranı ve karakter kalınlığı göstergeleri
    const upperCaseRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    const hasBoldIndicators = text.includes('**') || text.includes('__') || 
                              text.includes('BOLD') || text.includes('STRONG');
    
    return upperCaseRatio > 0.3 || hasBoldIndicators;
  }

  // Font stili analizi
  analyzeFontStyle(text) {
    // İtalik göstergeleri
    const hasItalicIndicators = text.includes('*') || text.includes('_') || 
                                text.includes('italic') || text.includes('em');
    
    // Eğik karakter analizi (basit)
    const slantedChars = text.match(/[\/\\]/g);
    const slantedRatio = slantedChars ? slantedChars.length / text.length : 0;
    
    return hasItalicIndicators || slantedRatio > 0.1;
  }

  // Font genişliği analizi
  analyzeFontWidth(text) {
    const result = {
      isCondensed: false,
      isExpanded: false,
      letterSpacing: 'normal'
    };

    // Karakter aralığı analizi
    const avgCharWidth = text.length / text.replace(/\s/g, '').length;
    const wordCount = text.split(/\s+/).length;
    const avgWordLength = text.replace(/\s/g, '').length / wordCount;

    if (avgCharWidth < 0.8) {
      result.isCondensed = true;
      result.letterSpacing = 'condensed';
    } else if (avgCharWidth > 1.2) {
      result.isExpanded = true;
      result.letterSpacing = 'expanded';
    }

    return result;
  }

  // Serif analizi
  analyzeSerifs(text) {
    const serifIndicators = [
      'Times', 'Georgia', 'Baskerville', 'Garamond', 'Palatino', 
      'Bookman', 'Century', 'Bodoni', 'Caslon', 'Didot'
    ];
    
    const serifKeywords = [
      'serif', 'traditional', 'formal', 'elegant', 'classic'
    ];

    return serifIndicators.some(indicator => 
      text.toLowerCase().includes(indicator.toLowerCase())
    ) || serifKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // Font ailesi tespiti
  detectFontFamily(text) {
    const fontPatterns = {
      'Arial': ['arial', 'helvetica', 'sans-serif'],
      'Times New Roman': ['times', 'roman', 'serif'],
      'Georgia': ['georgia', 'elegant', 'serif'],
      'Verdana': ['verdana', 'web-safe', 'clear'],
      'Roboto': ['roboto', 'google', 'modern'],
      'Open Sans': ['open sans', 'web-safe', 'clean'],
      'Lato': ['lato', 'modern', 'friendly'],
      'Helvetica': ['helvetica', 'clean', 'professional'],
      'Courier New': ['courier', 'monospace', 'fixed'],
      'Impact': ['impact', 'bold', 'display']
    };

    const lowerText = text.toLowerCase();
    
    for (const [font, patterns] of Object.entries(fontPatterns)) {
      if (patterns.some(pattern => lowerText.includes(pattern))) {
        return font;
      }
    }

    return 'unknown';
  }

  // Dekoratif element analizi
  analyzeDecorativeElements(text) {
    const decorativePatterns = [
      /[★☆♠♥♦♣]/g,  // Semboller
      /[①②③④⑤]/g,   // Çevreli sayılar
      /[☀☁☂☃]/g,    // Hava durumu
      /[♪♫♬]/g,      // Müzik notaları
      /[→←↑↓]/g,     // Oklar
      /[✿❀❁]/g       // Çiçekler
    ];

    return decorativePatterns.some(pattern => pattern.test(text));
  }

  // Font tahmini yap
  async recognizeFont(imagePath) {
    try {
      const text = await this.extractText(imagePath);
      
      if (!text || text.length < 3) {
        return {
          success: false,
          error: 'Yeterli metin bulunamadı',
          suggestions: []
        };
      }

      const characteristics = this.analyzeFontCharacteristics(text);
      const suggestions = this.findSimilarFonts(characteristics);

      return {
        success: true,
        extractedText: text,
        characteristics,
        suggestions: suggestions.slice(0, 5), // En iyi 5 öneri
        confidence: this.calculateConfidence(characteristics)
      };

    } catch (error) {
      console.error('Font tanıma hatası:', error);
      return {
        success: false,
        error: error.message,
        suggestions: []
      };
    }
  }

  // Benzer fontları bul
  findSimilarFonts(characteristics) {
    const scores = this.fontDatabase.fonts.map(font => {
      let score = 0;
      
      // Font ailesi eşleştirme
      if (characteristics.fontFamily === font.name) {
        score += 50; // Tam eşleşme
      }
      
      // Serif kontrolü
      if (characteristics.hasSerifs) {
        if (font.characteristics.includes('serif')) score += 25;
        if (font.characteristics.includes('traditional')) score += 15;
        if (font.characteristics.includes('elegant')) score += 10;
      } else {
        if (font.characteristics.includes('sans-serif')) score += 25;
        if (font.characteristics.includes('modern')) score += 15;
        if (font.characteristics.includes('clean')) score += 10;
      }

      // Font ağırlığı eşleştirme
      if (characteristics.fontWeight === font.weight) {
        score += 15;
      }

      // Font stili eşleştirme
      if (characteristics.fontStyle === font.style) {
        score += 15;
      }

      // Karakteristik eşleştirme
      font.characteristics.forEach(char => {
        if (characteristics.hasSerifs && char === 'serif') score += 10;
        if (!characteristics.hasSerifs && char === 'sans-serif') score += 10;
        if (char === 'clean') score += 8;
        if (char === 'modern') score += 8;
        if (char === 'professional') score += 8;
        if (char === 'elegant') score += 8;
        if (char === 'web-safe') score += 5;
        if (char === 'geometric') score += 5;
      });

      // Font genişliği eşleştirme
      if (characteristics.isCondensed && font.characteristics.includes('condensed')) {
        score += 10;
      }
      if (characteristics.isExpanded && font.characteristics.includes('expanded')) {
        score += 10;
      }

      // Dekoratif element eşleştirme
      if (characteristics.hasDecorativeElements && font.characteristics.includes('display')) {
        score += 15;
      }

      return { 
        font: font.name, 
        score, 
        characteristics: font.characteristics,
        weight: font.weight,
        style: font.style
      };
    });

    // Skora göre sırala
    return scores
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  // Güven skoru hesapla
  calculateConfidence(characteristics) {
    let confidence = 50; // Temel güven skoru

    // Temel metrikler
    if (characteristics.averageCharacterWidth > 0) {
      confidence += 10;
    }

    // Font ailesi tespiti
    if (characteristics.fontFamily !== 'unknown') {
      confidence += 15;
    }

    // Font özellikleri
    if (characteristics.fontWeight !== 'normal') {
      confidence += 5;
    }

    if (characteristics.fontStyle !== 'normal') {
      confidence += 5;
    }

    if (characteristics.letterSpacing !== 'normal') {
      confidence += 5;
    }

    // Serif analizi
    if (characteristics.hasSerifs !== undefined) {
      confidence += 10;
    }

    // Dekoratif elementler
    if (characteristics.hasDecorativeElements) {
      confidence += 5;
    }

    // Metin uzunluğu bonusu
    if (characteristics.averageCharacterWidth > 10) {
      confidence += 5;
    }

    return Math.min(confidence, 100);
  }

  // Sistemi durdur
  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      console.log('✅ Font Recognition sistemi durduruldu');
    }
  }

  // Sistem durumunu kontrol et
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasWorker: this.worker !== null,
      fontDatabaseSize: this.fontDatabase.fonts.length,
      availableFonts: this.fontDatabase.fonts.map(f => f.name)
    };
  }
}

module.exports = FontRecognizer;

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class PDFProcessor {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'tekstil-ai-pdf');
    this.initTempDir();
  }

  async initTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Temp dizin oluşturma hatası:', error);
    }
  }

  // PDF'i görüntüye dönüştür
  async processPDF(pdfPath) {
    const tempFile = path.join(this.tempDir, `${Date.now()}.png`);
    
    try {
      // PDF'in ilk sayfasını PNG'ye dönüştür
      // Not: Ghostscript veya ImageMagick gerekli
      await execAsync(`convert -density 150 "${pdfPath}[0]" -quality 90 "${tempFile}"`);
      
      // Sharp ile işle
      const imageBuffer = await fs.readFile(tempFile);
      const metadata = await sharp(imageBuffer).metadata();
      
      // PDF metadata
      const pdfInfo = await this.getPDFInfo(pdfPath);
      
      return {
        ...metadata,
        format: 'pdf',
        page_count: pdfInfo.pageCount,
        is_vector: true,
        original_path: pdfPath
      };
      
    } catch (error) {
      console.error('PDF işleme hatası:', error);
      throw error;
    } finally {
      // Temp dosyayı temizle
      try {
        await fs.unlink(tempFile);
      } catch (err) {
        // Sessizce geç
      }
    }
  }

  // PDF bilgilerini al
  async getPDFInfo(pdfPath) {
    try {
      const { stdout } = await execAsync(`pdfinfo "${pdfPath}"`);
      const pageMatch = stdout.match(/Pages:\s+(\d+)/);
      return {
        pageCount: pageMatch ? parseInt(pageMatch[1]) : 1
      };
    } catch (error) {
      return { pageCount: 1 };
    }
  }

  // PostScript işleme
  async processPS(psPath) {
    // PS'yi PDF'e çevir, sonra PDF olarak işle
    const tempPdf = path.join(this.tempDir, `${Date.now()}.pdf`);
    
    try {
      await execAsync(`ps2pdf "${psPath}" "${tempPdf}"`);
      const result = await this.processPDF(tempPdf);
      return {
        ...result,
        format: 'ps',
        original_format: 'PostScript'
      };
    } catch (error) {
      console.error('PS işleme hatası:', error);
      throw error;
    } finally {
      try {
        await fs.unlink(tempPdf);
      } catch (err) {
        // Sessizce geç
      }
    }
  }

  // SVG işleme
  async processSVG(svgPath) {
    const tempFile = path.join(this.tempDir, `${Date.now()}.png`);
    
    try {
      // SVG'yi PNG'ye dönüştür
      await sharp(svgPath)
        .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toFile(tempFile);
      
      const imageBuffer = await fs.readFile(tempFile);
      const metadata = await sharp(imageBuffer).metadata();
      
      return {
        ...metadata,
        format: 'svg',
        is_vector: true,
        original_path: svgPath
      };
      
    } catch (error) {
      console.error('SVG işleme hatası:', error);
      throw error;
    } finally {
      try {
        await fs.unlink(tempFile);
      } catch (err) {
        // Sessizce geç
      }
    }
  }

  // AI dosyası işleme (Adobe Illustrator)
  async processAI(aiPath) {
    // AI dosyaları genellikle PDF formatında
    // PDF olarak işlemeyi dene
    try {
      return await this.processPDF(aiPath);
    } catch (error) {
      console.error('AI dosya işleme hatası:', error);
      throw error;
    }
  }

  // EPS işleme
  async processEPS(epsPath) {
    // EPS'yi PDF'e çevir, sonra PDF olarak işle
    const tempPdf = path.join(this.tempDir, `${Date.now()}.pdf`);
    
    try {
      await execAsync(`ps2pdf -dEPSCrop "${epsPath}" "${tempPdf}"`);
      const result = await this.processPDF(tempPdf);
      return {
        ...result,
        format: 'eps',
        original_format: 'Encapsulated PostScript'
      };
    } catch (error) {
      console.error('EPS işleme hatası:', error);
      throw error;
    } finally {
      try {
        await fs.unlink(tempPdf);
      } catch (err) {
        // Sessizce geç
      }
    }
  }

  // Vektör dosya tespiti
  isVectorFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.pdf', '.ps', '.eps', '.ai', '.svg'].includes(ext);
  }

  // Vektör dosya işleme (ana fonksiyon)
  async processVectorFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.pdf':
        return await this.processPDF(filePath);
      case '.ps':
        return await this.processPS(filePath);
      case '.eps':
        return await this.processEPS(filePath);
      case '.ai':
        return await this.processAI(filePath);
      case '.svg':
        return await this.processSVG(filePath);
      default:
        throw new Error(`Desteklenmeyen vektör format: ${ext}`);
    }
  }

  // Temp dizini temizle
  async cleanup() {
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        await fs.unlink(path.join(this.tempDir, file));
      }
    } catch (error) {
      console.error('Temp dizin temizleme hatası:', error);
    }
  }
}

module.exports = new PDFProcessor(); 
const cheerio = require('cheerio');
const fs = require('fs');

class HTMLTestParser {
  constructor() {
    this.testData = {
      testKodu: '',
      testAdi: '',
      soruSayisi: 0,
      cevaplar: {},
      videolar: {}
    };
  }

  /**
   * HTML dosyasını parse ederek test verilerini çıkarır
   * @param {string} htmlFilePath - HTML dosyasının yolu
   * @returns {Object} Test verileri
   */
  parseHTMLFile(htmlFilePath) {
    try {
      // HTML dosyasını oku
      const htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
      return this.parseHTMLContent(htmlContent);
    } catch (error) {
      throw new Error(`HTML dosyası okunamadı: ${error.message}`);
    }
  }

  /**
   * HTML içeriğini parse ederek test verilerini çıkarır
   * @param {string} htmlContent - HTML içeriği
   * @returns {Object} Test verileri
   */
  parseHTMLContent(htmlContent) {
    const $ = cheerio.load(htmlContent);
    
    // Test adını ve kodunu title'dan al
    const title = $('title').text().trim();
    this.testData.testAdi = title || 'İçeri Aktarılan Test';
    this.testData.testKodu = this.generateTestCode();

    // Cevap anahtarını çıkar
    this.extractAnswersFromHTML($);
    
    // Soru sayısını hesapla
    this.testData.soruSayisi = Object.keys(this.testData.cevaplar).length;

    return {
      testKodu: this.testData.testKodu,
      testAdi: this.testData.testAdi,
      soruSayisi: this.testData.soruSayisi,
      cevaplar: this.testData.cevaplar,
      videolar: this.testData.videolar
    };
  }

  /**
   * HTML'den cevapları ve video linklerini çıkarır
   * @param {object} $ - Cheerio instance
   */
  extractAnswersFromHTML($) {
    let soruNo = 1;
    
    // Tablodaki tüm hücreleri tara
    $('td').each((index, element) => {
      const $cell = $(element);
      
      // Link içeren hücreleri bul
      const $link = $cell.find('a');
      if ($link.length > 0) {
        const cevap = $link.text().trim();
        const videoUrl = $link.attr('href');
        
        // Cevap A, B, C, D, E olmalı
        if (/^[A-E]$/.test(cevap) && videoUrl) {
          this.testData.cevaplar[`cevap_${soruNo}`] = cevap;
          this.testData.videolar[`video_${soruNo}`] = videoUrl;
          soruNo++;
        }
      }
    });

    // Alternatif yöntem: Satır satır işle
    if (Object.keys(this.testData.cevaplar).length === 0) {
      this.extractAnswersAlternative($);
    }
  }

  /**
   * Alternatif cevap çıkarma yöntemi
   * @param {object} $ - Cheerio instance
   */
  extractAnswersAlternative($) {
    const rows = $('tr');
    let soruNo = 1;

    rows.each((rowIndex, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      cells.each((cellIndex, cell) => {
        const $cell = $(cell);
        const $link = $cell.find('a');
        
        if ($link.length > 0) {
          const cevap = $link.text().trim();
          const videoUrl = $link.attr('href');
          
          if (/^[A-E]$/.test(cevap) && videoUrl && soruNo <= 25) {
            this.testData.cevaplar[`cevap_${soruNo}`] = cevap;
            this.testData.videolar[`video_${soruNo}`] = videoUrl;
            soruNo++;
          }
        }
      });
    });
  }

  /**
   * Benzersiz test kodu oluşturur
   * @returns {string} Test kodu
   */
  generateTestCode() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `HTML_${timestamp}_${random}`.substring(0, 20);
  }

  /**
   * Parse edilen veriyi doğrula
   * @param {Object} testData - Test verileri
   * @returns {Object} Doğrulama sonucu
   */
  validateTestData(testData) {
    const errors = [];
    const warnings = [];

    // Test kodu kontrolü
    if (!testData.testKodu || testData.testKodu.trim() === '') {
      errors.push('Test kodu boş olamaz');
    }

    // Test adı kontrolü
    if (!testData.testAdi || testData.testAdi.trim() === '') {
      warnings.push('Test adı belirtilmemiş, varsayılan ad kullanılacak');
    }

    // Soru sayısı kontrolü
    if (testData.soruSayisi === 0) {
      errors.push('Hiç soru bulunamadı');
    } else if (testData.soruSayisi > 25) {
      warnings.push(`${testData.soruSayisi} soru bulundu, maksimum 25 soru destekleniyor`);
    }

    // Cevap kontrolü
    for (let i = 1; i <= testData.soruSayisi; i++) {
      if (!testData.cevaplar[`cevap_${i}`]) {
        errors.push(`${i}. sorunun cevabı bulunamadı`);
      }
    }

    // Video kontrolü
    let videoSayisi = 0;
    for (let i = 1; i <= testData.soruSayisi; i++) {
      if (testData.videolar[`video_${i}`]) {
        videoSayisi++;
      }
    }

    if (videoSayisi === 0) {
      warnings.push('Hiç video linki bulunamadı');
    } else if (videoSayisi !== testData.soruSayisi) {
      warnings.push(`${testData.soruSayisi} sorudan sadece ${videoSayisi} tanesinin video linki bulundu`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      stats: {
        toplam: testData.soruSayisi,
        cevaplar: Object.keys(testData.cevaplar).length,
        videolar: Object.keys(testData.videolar).length
      }
    };
  }

  /**
   * Test verilerini konsola yazdır (debug için)
   * @param {Object} testData - Test verileri
   */
  debugPrint(testData) {
    console.log('=== Test Verileri ===');
    console.log(`Test Kodu: ${testData.testKodu}`);
    console.log(`Test Adı: ${testData.testAdi}`);
    console.log(`Soru Sayısı: ${testData.soruSayisi}`);
    console.log('\n=== Cevaplar ===');
    for (let i = 1; i <= testData.soruSayisi; i++) {
      console.log(`${i}. ${testData.cevaplar[`cevap_${i}`] || 'Yok'}`);
    }
    console.log('\n=== Video Linkleri ===');
    for (let i = 1; i <= testData.soruSayisi; i++) {
      console.log(`${i}. ${testData.videolar[`video_${i}`] || 'Yok'}`);
    }
  }
}

module.exports = HTMLTestParser;
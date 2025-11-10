const cheerio = require('cheerio');

class HtmlTestParser {
  parseMultipleTests(htmlContent) {
    console.log('🚀 parseMultipleTests - Başlıyor...');
    const $ = cheerio.load(htmlContent);
    const tests = [];
    
    // Tabloları bul
    const tables = $('table');
    console.log(`📊 Bulunan tablo sayısı: ${tables.length}`);
    
    tables.each((tableIndex, table) => {
      const $table = $(table);
      const rows = $table.find('tr');
      console.log(`📋 Tablo ${tableIndex + 1} - Satır sayısı: ${rows.length}`);
      
      rows.each((rowIndex, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length >= 3) {
          // İlk hücre test kodu kontrolü
          const testCodeCell = $(cells[0]).text().trim();
          const testNameCell = $(cells[1]).text().trim();
          
          console.log(`🔍 Satır ${rowIndex + 1}: Test Kodu="${testCodeCell}", Test Adı="${testNameCell}"`);
          
          // Header satırını atla (KOD, TEST gibi değerleri içeren)
          if (testCodeCell === 'KOD' || testNameCell === 'TEST') {
            console.log(`⏭️ Header satırı atlandı: ${testCodeCell} - ${testNameCell}`);
            return; // Bu satırı atla
          }
          
          // Test kodunun geçerli olup olmadığını kontrol et
          if (testCodeCell && 
              testCodeCell.length > 5 && // En az 5 karakter
              testNameCell &&
              (testNameCell.includes('Test') || testNameCell.includes('TEST') || testNameCell.match(/Test-\d+/))) {
            
            console.log(`✅ Geçerli test satırı bulundu: ${testCodeCell}`);
            const testData = this.parseTestRow($row);
            if (testData) {
              tests.push(testData);
              console.log(`✅ Test eklendi: ${testData.testCode} (${testData.totalQuestions} soru)`);
            }
          } else {
            console.log(`❌ Geçersiz test satırı: Test Kodu="${testCodeCell}" Test Adı="${testNameCell}"`);
          }
        }
      });
    });
    
    console.log(`🎯 Toplam ${tests.length} test parse edildi`);
    return tests;
  }
  
  parseTestRow($row) {
    console.log('🔍 parseTestRow - Satır parse ediliyor...');
    
    const cells = $row.find('td');
    console.log(`📊 parseTestRow - Bulunan hücre sayısı: ${cells.length}`);
    
    if (cells.length < 3) {
      console.log('❌ parseTestRow - Yetersiz hücre sayısı');
      return null;
    }

    // Test kodu (ilk hücre)
    const testCodeCell = cells.eq(0);
    let testCode = testCodeCell.text().trim();
    console.log(`🏷️ parseTestRow - Ham test kodu: "${testCode}"`);
    
    // Test kodundan gereksiz karakterleri temizle
    testCode = testCode.replace(/\s+/g, ' ').trim();
    
    if (!testCode) {
      console.log('❌ parseTestRow - Test kodu bulunamadı');
      return null;
    }

    // Test adı olarak sadece test kodunu kullan (ön ek olmadan)
    const testName = testCode;
    
    console.log(`✅ parseTestRow - Final test kodu: "${testCode}"`);
    console.log(`✅ parseTestRow - Final test adı: "${testName}"`);

    // Cevapları topla (3. hücreden itibaren)
    const answers = [];
    const videoLinks = [];
    
    for (let i = 2; i < cells.length; i++) {
      const cell = cells.eq(i);
      let cellText = cell.text().trim();
      
      // Sadece harf cevapları al (A, B, C, D, E)
      const match = cellText.match(/^([ABCDE])/i);
      if (match) {
        answers.push(match[1].toUpperCase());
        
        // Video linkini kontrol et
        const videoLink = cell.find('a').attr('href');
        videoLinks.push(videoLink && videoLink.trim() ? videoLink.trim() : '');
        
        console.log(`📝 parseTestRow - Hücre ${i}: "${cellText}" -> Cevap: "${match[1].toUpperCase()}"${videoLink ? `, Video: "${videoLink}"` : ''}`);
      } else if (cellText === '') {
        // Boş hücreleri atla
        console.log(`⏭️ parseTestRow - Hücre ${i}: Boş hücre atlandı`);
        continue;
      } else {
        console.log(`⚠️ parseTestRow - Hücre ${i}: Geçersiz cevap "${cellText}"`);
      }
    }

    console.log(`📝 parseTestRow - Toplanan cevaplar: [${answers.join(', ')}] (${answers.length} adet)`);

    // En az 5 cevap varsa geçerli test
    if (answers.length < 5) {
      console.log('❌ parseTestRow - Yetersiz cevap sayısı');
      return null;
    }

    // Backend için uygun format
    const cevaplar = {};
    const videolar = {};
    
    for (let i = 0; i < answers.length; i++) {
      cevaplar[`cevap_${i + 1}`] = answers[i];
      // Video linki varsa ekle, yoksa boş bırak
      videolar[`video_${i + 1}`] = videoLinks[i] || '';
    }

    // Video sayısını logla
    const videoCount = videoLinks.filter(link => link && link.trim()).length;
    console.log(`📹 parseTestRow - ${videoCount} video link bulundu`);

    const result = {
      testCode: testCode,
      testName: testName,
      testKodu: testCode,
      testAdi: testName,
      soruSayisi: answers.length,
      totalQuestions: answers.length,
      answers: answers,
      cevaplar: cevaplar,
      videolar: videolar
    };

    console.log('✅ parseTestRow - Test başarıyla parse edildi:', {
      testCode: result.testCode,
      testName: result.testName,
      soruSayisi: result.soruSayisi
    });
    return result;
  }
  
  // Eski tek test parse fonksiyonu - geriye dönük uyumluluk için
  parseHtml(htmlContent) {
    const tests = this.parseMultipleTests(htmlContent);
    return tests.length > 0 ? tests[0] : null;
  }
}

module.exports = HtmlTestParser;
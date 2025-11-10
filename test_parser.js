const fs = require('fs');
const HtmlTestParser = require('./utils/HtmlTestParser');

// HTML dosyasını oku
const htmlContent = fs.readFileSync('ornek.html', 'utf8');

console.log('🚀 HTML dosyası okundu, parser test ediliyor...');

const parser = new HtmlTestParser();
const tests = parser.parseMultipleTests(htmlContent);

console.log('\n🎯 SONUÇ:');
console.log(`Toplam bulunan test sayısı: ${tests.length}`);

tests.forEach((test, index) => {
    console.log(`\n📋 Test ${index + 1}:`);
    console.log(`  - Test Kodu: ${test.testCode}`);
    console.log(`  - Test Adı: ${test.testName}`);
    console.log(`  - Soru Sayısı: ${test.soruSayisi}`);
    console.log(`  - Cevaplar: ${test.answers.join(', ')}`);
});

console.log('\n✅ Test tamamlandı!');
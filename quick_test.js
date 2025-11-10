const fs = require('fs');
const HtmlTestParser = require('./utils/HtmlTestParser');

// HTML dosyasını oku
const htmlContent = fs.readFileSync('ornek.html', 'utf8');

console.log('🚀 HTML dosyası okundu, parser test ediliyor...');

const parser = new HtmlTestParser();
const tests = parser.parseMultipleTests(htmlContent);

console.log('\n🎯 SONUÇ:');
console.log(`Toplam bulunan test sayısı: ${tests.length}`);

// İlk 5 testi göster
tests.slice(0, 5).forEach((test, index) => {
    console.log(`\n📋 Test ${index + 1}:`);
    console.log(`  - Test Kodu: ${test.testCode}`);
    console.log(`  - Test Adı: ${test.testName}`);
    console.log(`  - Soru Sayısı: ${test.soruSayisi}`);
    console.log(`  - İlk 10 Cevap: ${test.answers.slice(0, 10).join(', ')}`);
});

if (tests.length > 5) {
    console.log(`\n... ve ${tests.length - 5} test daha...`);
}

console.log('\n✅ Test tamamlandı!');
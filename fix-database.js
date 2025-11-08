// Veritabanını otomatik düzelten script
const db = require('./database');

console.log('🔧 Veritabanı düzeltiliyor...\n');

const kolonlar = [
  {
    ad: 'ozel_test_adi',
    sql: `ALTER TABLE ogrenci_testleri ADD COLUMN ozel_test_adi VARCHAR(255) DEFAULT NULL COMMENT 'Öğrenciye özel gösterilecek test adı' AFTER test_id`
  },
  {
    ad: 'puan',
    sql: `ALTER TABLE ogrenci_testleri ADD COLUMN puan DECIMAL(5,2) DEFAULT NULL AFTER durum`
  },
  {
    ad: 'dogru_sayisi',
    sql: `ALTER TABLE ogrenci_testleri ADD COLUMN dogru_sayisi INT DEFAULT 0 AFTER puan`
  },
  {
    ad: 'yanlis_sayisi',
    sql: `ALTER TABLE ogrenci_testleri ADD COLUMN yanlis_sayisi INT DEFAULT 0 AFTER dogru_sayisi`
  },
  {
    ad: 'bos_sayisi',
    sql: `ALTER TABLE ogrenci_testleri ADD COLUMN bos_sayisi INT DEFAULT 0 AFTER yanlis_sayisi`
  },
  {
    ad: 'tamamlanma_tarihi',
    sql: `ALTER TABLE ogrenci_testleri ADD COLUMN tamamlanma_tarihi TIMESTAMP NULL AFTER atanma_tarihi`
  }
];

let tamamlanan = 0;
let eklenen = 0;

kolonlar.forEach((kolon) => {
  db.query(`SHOW COLUMNS FROM ogrenci_testleri LIKE '${kolon.ad}'`, (err, results) => {
    if (err) {
      console.error(`❌ Hata (${kolon.ad}):`, err.message);
      tamamlanan++;
      kontrol();
    } else if (results.length === 0) {
      // Kolon yok, ekle
      db.query(kolon.sql, (err) => {
        if (err) {
          console.error(`❌ Ekleme hatası (${kolon.ad}):`, err.message);
        } else {
          console.log(`✓ ${kolon.ad} eklendi`);
          eklenen++;
        }
        tamamlanan++;
        kontrol();
      });
    } else {
      console.log(`- ${kolon.ad} zaten mevcut`);
      tamamlanan++;
      kontrol();
    }
  });
});

function kontrol() {
  if (tamamlanan === kolonlar.length) {
    console.log(`\n✅ Tamamlandı! ${eklenen} kolon eklendi.`);
    process.exit(0);
  }
}

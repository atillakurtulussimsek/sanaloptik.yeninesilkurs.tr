const db = require('./database');
const crypto = require('crypto');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 Sanal Optik Form - Veritabanı Kurulumu');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// MD5 şifreleme fonksiyonu
function md5(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

// Örnek adminler
const adminler = [
  { kullanici_adi: 'admin', ad: 'Admin', soyad: 'Kullanıcı', sifre: md5('admin123') }
];

// Örnek öğrenciler
const ogrenciler = [
  { ad: 'Ahmet', soyad: 'Yılmaz', numara: '1001', sifre: md5('123456') },
  { ad: 'Ayşe', soyad: 'Demir', numara: '1002', sifre: md5('123456') },
  { ad: 'Mehmet', soyad: 'Kaya', numara: '1003', sifre: md5('123456') }
];

// Örnek testler (havuzda)
const testler = [
  {
    test_kodu: 'MAT2024-001',
    test_adi: 'Matematik Deneme 1',
    soru_sayisi: 10,
    cevaplar: ['A', 'B', 'C', 'D', 'E', 'A', 'B', 'C', 'D', 'E'], // 10 soru
    videolar: [
      'https://youtube.com/watch?v=example1',
      'https://youtube.com/watch?v=example2',
      null,
      'https://youtube.com/watch?v=example3',
      null,
      null,
      'https://youtube.com/watch?v=example4',
      null,
      null,
      'https://youtube.com/watch?v=example5'
    ]
  },
  {
    test_kodu: 'TUR2024-001',
    test_adi: 'Türkçe Deneme 1',
    soru_sayisi: 15,
    cevaplar: ['C', 'A', 'B', 'D', 'E', 'A', 'C', 'B', 'D', 'E', 'A', 'B', 'C', 'D', 'E'], // 15 soru
    videolar: Array(15).fill(null) // Hiç video yok
  },
  {
    test_kodu: 'FEN2024-001',
    test_adi: 'Fen Bilimleri Deneme 1',
    soru_sayisi: 20,
    cevaplar: ['B', 'B', 'C', 'C', 'D', 'D', 'E', 'E', 'A', 'A', 'B', 'C', 'D', 'E', 'A', 'B', 'C', 'D', 'E', 'A'], // 20 soru
    videolar: Array(20).fill(null)
  }
];

// Tabloları oluşturma fonksiyonu
function tablolariOlustur() {
  console.log('📋 Veritabanı tabloları kontrol ediliyor ve oluşturuluyor...\n');
  
  const tablolar = [
    {
      ad: 'ogrenciler',
      sql: `CREATE TABLE IF NOT EXISTS ogrenciler (
        id INT AUTO_INCREMENT PRIMARY KEY,
        numara VARCHAR(20) UNIQUE NOT NULL,
        ad VARCHAR(100) NOT NULL,
        soyad VARCHAR(100) NOT NULL,
        sifre VARCHAR(255) NOT NULL,
        k12net_id VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci`
    },
    {
      ad: 'adminler',
      sql: `CREATE TABLE IF NOT EXISTS adminler (
        id INT AUTO_INCREMENT PRIMARY KEY,
        kullanici_adi VARCHAR(50) UNIQUE NOT NULL,
        ad VARCHAR(100) NOT NULL,
        soyad VARCHAR(100) NOT NULL,
        sifre VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci`
    },
    {
      ad: 'test_havuzu',
      sql: `CREATE TABLE IF NOT EXISTS test_havuzu (
        id INT AUTO_INCREMENT PRIMARY KEY,
        test_kodu VARCHAR(50) UNIQUE NOT NULL,
        test_adi VARCHAR(255) NOT NULL,
        soru_sayisi INT NOT NULL,
        aktif TINYINT(1) DEFAULT 1,
        cevap_1 CHAR(1), cevap_2 CHAR(1), cevap_3 CHAR(1), cevap_4 CHAR(1), cevap_5 CHAR(1),
        cevap_6 CHAR(1), cevap_7 CHAR(1), cevap_8 CHAR(1), cevap_9 CHAR(1), cevap_10 CHAR(1),
        cevap_11 CHAR(1), cevap_12 CHAR(1), cevap_13 CHAR(1), cevap_14 CHAR(1), cevap_15 CHAR(1),
        cevap_16 CHAR(1), cevap_17 CHAR(1), cevap_18 CHAR(1), cevap_19 CHAR(1), cevap_20 CHAR(1),
        cevap_21 CHAR(1), cevap_22 CHAR(1), cevap_23 CHAR(1), cevap_24 CHAR(1), cevap_25 CHAR(1),
        video_1 VARCHAR(500), video_2 VARCHAR(500), video_3 VARCHAR(500), video_4 VARCHAR(500), video_5 VARCHAR(500),
        video_6 VARCHAR(500), video_7 VARCHAR(500), video_8 VARCHAR(500), video_9 VARCHAR(500), video_10 VARCHAR(500),
        video_11 VARCHAR(500), video_12 VARCHAR(500), video_13 VARCHAR(500), video_14 VARCHAR(500), video_15 VARCHAR(500),
        video_16 VARCHAR(500), video_17 VARCHAR(500), video_18 VARCHAR(500), video_19 VARCHAR(500), video_20 VARCHAR(500),
        video_21 VARCHAR(500), video_22 VARCHAR(500), video_23 VARCHAR(500), video_24 VARCHAR(500), video_25 VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (soru_sayisi >= 1 AND soru_sayisi <= 25)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci`
    },
    {
      ad: 'ogrenci_testleri',
      sql: `CREATE TABLE IF NOT EXISTS ogrenci_testleri (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ogrenci_id INT NOT NULL,
        test_id INT NOT NULL,
        ozel_test_adi VARCHAR(255) DEFAULT NULL COMMENT 'Öğrenciye özel gösterilecek test adı',
        durum ENUM('beklemede', 'devam_ediyor', 'tamamlandi') DEFAULT 'beklemede',
        puan DECIMAL(5,2) DEFAULT NULL,
        dogru_sayisi INT DEFAULT 0,
        yanlis_sayisi INT DEFAULT 0,
        bos_sayisi INT DEFAULT 0,
        atanma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tamamlanma_tarihi TIMESTAMP NULL,
        UNIQUE KEY unique_ogrenci_test (ogrenci_id, test_id),
        INDEX idx_ogrenci_testleri_ogrenci (ogrenci_id),
        INDEX idx_ogrenci_testleri_test (test_id),
        INDEX idx_ogrenci_testleri_durum (durum)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci`
    },
    {
      ad: 'ogrenci_cevaplari',
      sql: `CREATE TABLE IF NOT EXISTS ogrenci_cevaplari (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ogrenci_id INT NOT NULL,
        test_id INT NOT NULL,
        soru_no INT NOT NULL,
        cevap CHAR(1) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_ogrenci_test_soru (ogrenci_id, test_id, soru_no),
        INDEX idx_ogrenci_cevaplari_ogrenci_test (ogrenci_id, test_id),
        CHECK (soru_no >= 1 AND soru_no <= 25),
        CHECK (cevap IN ('A', 'B', 'C', 'D', 'E'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci`
    }
  ];
  
  let tamamlananTablo = 0;
  
  tablolar.forEach((tablo) => {
    db.query(tablo.sql, (err) => {
      if (err) {
        console.error(`  ❌ Tablo oluşturma hatası (${tablo.ad}):`, err.message);
      } else {
        console.log(`  ✓ Tablo hazır: ${tablo.ad}`);
      }
      
      tamamlananTablo++;
      if (tamamlananTablo === tablolar.length) {
        console.log('\n✅ Tüm tablolar hazır!\n');
        // Tabloları kontrol et ve eksik kolonları ekle
        setTimeout(eksikKolonlariKontrolEt, 500);
      }
    });
  });
}

// Eksik kolonları kontrol et ve ekle
function eksikKolonlariKontrolEt() {
  console.log('🔍 Tablo kolonları kontrol ediliyor...\n');
  
  const kolonKontrolleri = [
    {
      tablo: 'ogrenciler',
      kolon: 'k12net_id',
      sql: `ALTER TABLE ogrenciler ADD COLUMN k12net_id VARCHAR(255) DEFAULT NULL COMMENT 'K12NET SSO kullanıcı ID' AFTER sifre`
    },
    {
      tablo: 'ogrenci_testleri',
      kolon: 'ozel_test_adi',
      sql: `ALTER TABLE ogrenci_testleri ADD COLUMN ozel_test_adi VARCHAR(255) DEFAULT NULL COMMENT 'Öğrenciye özel gösterilecek test adı' AFTER test_id`
    },
    {
      tablo: 'ogrenci_testleri',
      kolon: 'puan',
      sql: `ALTER TABLE ogrenci_testleri ADD COLUMN puan DECIMAL(5,2) DEFAULT NULL AFTER durum`
    },
    {
      tablo: 'ogrenci_testleri',
      kolon: 'dogru_sayisi',
      sql: `ALTER TABLE ogrenci_testleri ADD COLUMN dogru_sayisi INT DEFAULT 0 AFTER puan`
    },
    {
      tablo: 'ogrenci_testleri',
      kolon: 'yanlis_sayisi',
      sql: `ALTER TABLE ogrenci_testleri ADD COLUMN yanlis_sayisi INT DEFAULT 0 AFTER dogru_sayisi`
    },
    {
      tablo: 'ogrenci_testleri',
      kolon: 'bos_sayisi',
      sql: `ALTER TABLE ogrenci_testleri ADD COLUMN bos_sayisi INT DEFAULT 0 AFTER yanlis_sayisi`
    },
    {
      tablo: 'ogrenci_testleri',
      kolon: 'tamamlanma_tarihi',
      sql: `ALTER TABLE ogrenci_testleri ADD COLUMN tamamlanma_tarihi TIMESTAMP NULL AFTER atanma_tarihi`
    }
  ];
  
  let tamamlananKontrol = 0;
  let eklenenKolon = 0;
  
  kolonKontrolleri.forEach((kontrol) => {
    db.query(`SHOW COLUMNS FROM ${kontrol.tablo} LIKE '${kontrol.kolon}'`, (err, results) => {
      if (err) {
        console.error(`  ❌ Kolon kontrolü hatası (${kontrol.tablo}.${kontrol.kolon}):`, err.message);
        tamamlananKontrol++;
      } else if (results.length === 0) {
        // Kolon yok, ekle
        db.query(kontrol.sql, (err) => {
          if (err) {
            console.error(`  ❌ Kolon ekleme hatası (${kontrol.tablo}.${kontrol.kolon}):`, err.message);
          } else {
            console.log(`  ✓ Kolon eklendi: ${kontrol.tablo}.${kontrol.kolon}`);
            eklenenKolon++;
          }
          
          tamamlananKontrol++;
          if (tamamlananKontrol === kolonKontrolleri.length) {
            if (eklenenKolon === 0) {
              console.log('  ✓ Tüm kolonlar mevcut');
            }
            console.log('\n✅ Kolon kontrolleri tamamlandı!\n');
            setTimeout(ekleAdminler, 500);
          }
        });
      } else {
        // Kolon mevcut
        tamamlananKontrol++;
        if (tamamlananKontrol === kolonKontrolleri.length) {
          if (eklenenKolon === 0) {
            console.log('  ✓ Tüm kolonlar mevcut');
          }
          console.log('\n✅ Kolon kontrolleri tamamlandı!\n');
          setTimeout(ekleAdminler, 500);
        }
      }
    });
  });
}

function ekleAdminler() {
  console.log('👤 Admin kullanıcıları ekleniyor...\n');
  let tamamlananAdmin = 0;
  
  // Adminleri ekle
  adminler.forEach((admin) => {
    db.query(
      'INSERT IGNORE INTO adminler (kullanici_adi, ad, soyad, sifre) VALUES (?, ?, ?, ?)',
      [admin.kullanici_adi, admin.ad, admin.soyad, admin.sifre],
      (err) => {
        if (err) {
          console.error('❌ Admin ekleme hatası:', err.message);
        } else {
          console.log(`✓ Admin eklendi: ${admin.kullanici_adi} (şifre: admin123)`);
        }
        
        tamamlananAdmin++;
        if (tamamlananAdmin === adminler.length) {
          // Adminler eklendikten sonra öğrencileri ekle
          setTimeout(ekleOgrenciler, 300);
        }
      }
    );
  });
}

function ekleOgrenciler() {
  console.log('\n👥 Öğrenciler ekleniyor...\n');
  let tamamlananOgrenci = 0;
  
  // Öğrencileri ekle
  ogrenciler.forEach((ogr) => {
    db.query(
      'INSERT IGNORE INTO ogrenciler (ad, soyad, numara, sifre) VALUES (?, ?, ?, ?)',
      [ogr.ad, ogr.soyad, ogr.numara, ogr.sifre],
      (err) => {
        if (err) {
          console.error('❌ Öğrenci ekleme hatası:', err.message);
        } else {
          console.log(`✓ Öğrenci eklendi: ${ogr.ad} ${ogr.soyad} (${ogr.numara})`);
        }
        
        tamamlananOgrenci++;
        if (tamamlananOgrenci === ogrenciler.length) {
          // Öğrenciler eklendikten sonra testleri ekle
          setTimeout(ekleTestler, 500);
        }
      }
    );
  });
}

function ekleTestler() {
  console.log('\n📚 Test havuzuna testler ekleniyor...\n');
  let tamamlananTest = 0;
  const testIdler = [];
  
  testler.forEach((test) => {
    // 25 elemanlı array oluştur (eksik olanlar null)
    const cevaplar = Array(25).fill(null);
    const videolar = Array(25).fill(null);
    
    for (let i = 0; i < test.soru_sayisi; i++) {
      cevaplar[i] = test.cevaplar[i] || null;
      videolar[i] = test.videolar[i] || null;
    }
    
    // SQL oluştur
    const cevapFields = [];
    const videoFields = [];
    const values = [test.test_kodu, test.test_adi, test.soru_sayisi];
    
    for (let i = 1; i <= 25; i++) {
      cevapFields.push(`cevap_${i}`);
      videoFields.push(`video_${i}`);
      values.push(cevaplar[i - 1]);
      values.push(videolar[i - 1]);
    }
    
    const sql = `INSERT INTO test_havuzu (test_kodu, test_adi, soru_sayisi, ${cevapFields.join(', ')}, ${videoFields.join(', ')}) 
                 VALUES (?, ?, ?, ${Array(50).fill('?').join(', ')})`;
    
    db.query(sql, values, function(err) {
      if (err) {
        console.error('❌ Test ekleme hatası:', err.message);
      } else {
        testIdler.push(this.insertId);
        console.log(`✓ Test eklendi: ${test.test_adi} (Kod: ${test.test_kodu})`);
      }
      
      tamamlananTest++;
      if (tamamlananTest === testler.length) {
        setTimeout(() => testleriOgrencilereAta(testIdler), 500);
      }
    });
  });
}

function testleriOgrencilereAta(testIdler) {
  console.log('\n👥 Testler öğrencilere atanıyor...');
  let tamamlanan = 0;
  const toplamIslem = ogrenciler.length * testIdler.length;
  
  // Öğrenci başına özel test adları
  const ozelTestAdlari = [
    ['Ahmet için Matematik Sınavı', 'Ahmet için Türkçe Sınavı', 'Ahmet için Fen Sınavı'],
    ['Ayşe için Matematik Denemesi', 'Ayşe için Türkçe Denemesi', 'Ayşe için Fen Denemesi'],
    [null, 'Mehmet Özel Test', null] // Mehmet'in 1. ve 3. testi orijinal adlarla
  ];
  
  // Her öğrenciye her testi ata
  ogrenciler.forEach((ogr, ogrIndex) => {
    testIdler.forEach((testId, testIndex) => {
      const ozelAd = ozelTestAdlari[ogrIndex][testIndex];
      
      const sql = ozelAd 
        ? 'INSERT INTO ogrenci_testleri (ogrenci_id, test_id, ozel_test_adi) VALUES (?, ?, ?)'
        : 'INSERT INTO ogrenci_testleri (ogrenci_id, test_id) VALUES (?, ?)';
      
      const params = ozelAd ? [ogrIndex + 1, testId, ozelAd] : [ogrIndex + 1, testId];
      
      db.query(sql, params, (err) => {
        if (err) {
          console.error('  ❌ Test atama hatası:', err.message);
        }
        
        tamamlanan++;
        if (tamamlanan === toplamIslem) {
          setTimeout(sonlandir, 500);
        }
      });
    });
  });
  
  console.log(`  ✓ ${testIdler.length} test her öğrenciye özel adlarla atandı`);
}

function sonlandir() {
  console.log('\n✅ Tüm örnek veriler başarıyla eklendi!');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('� ADMIN PANELİ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Kullanıcı Adı: admin, Şifre: admin123');
  console.log('URL: http://localhost:3000/admin/giris');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📋 ÖĞRENCİ GİRİŞLERİ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Numara: 1001, Şifre: 123456 (Ahmet Yılmaz)');
  console.log('Numara: 1002, Şifre: 123456 (Ayşe Demir)');
  console.log('Numara: 1003, Şifre: 123456 (Mehmet Kaya)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📚 TEST HAVUZU');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('• MAT2024-001: Matematik Deneme 1 (10 soru)');
  console.log('• TUR2024-001: Türkçe Deneme 1 (15 soru)');
  console.log('• FEN2024-001: Fen Bilimleri Deneme 1 (20 soru)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✨ ÖZEL TEST ADLARI ÖRNEK:');
  console.log('• Ahmet: Her test için özel adlandırma var');
  console.log('• Ayşe: Her test için özel adlandırma var');
  console.log('• Mehmet: 2. test özel, diğerleri orijinal adla');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🚀 Uygulamayı başlatmak için: npm start');
  console.log('🌐 Tarayıcıda açın: http://localhost:3000\n');
  process.exit(0);
}

// Önce tabloları oluştur ve kontrol et
setTimeout(tablolariOlustur, 1000);

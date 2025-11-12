const db = require('../database');

class Test {
  // Öğrenciye atanan testleri getir
  static ogrencininTestleriniGetir(ogrenciId, callback) {
    db.query(
      `SELECT th.*, 
              ot.durum, 
              ot.atanma_tarihi, 
              ot.tamamlanma_tarihi,
              COALESCE(ot.ozel_test_adi, th.test_adi) as gorunen_test_adi
       FROM test_havuzu th
       INNER JOIN ogrenci_testleri ot ON th.id = ot.test_id
       WHERE ot.ogrenci_id = ? AND th.aktif = 1
       ORDER BY ot.atanma_tarihi DESC`,
      [ogrenciId],
      (err, results) => {
        callback(err, results);
      }
    );
  }

  // Test detayını getir
  static getById(id, callback) {
    db.query(
      'SELECT * FROM test_havuzu WHERE id = ?',
      [id],
      (err, results) => {
        if (err) return callback(err);
        callback(null, results[0]);
      }
    );
  }

  // Öğrencinin teste erişimi var mı kontrol et
  static ogrenciTestErisimKontrol(ogrenciId, testId, callback) {
    db.query(
      `SELECT ot.*, 
              th.test_adi as orijinal_test_adi,
              COALESCE(ot.ozel_test_adi, th.test_adi) as gorunen_test_adi
       FROM ogrenci_testleri ot
       LEFT JOIN test_havuzu th ON ot.test_id = th.id
       WHERE ot.ogrenci_id = ? AND ot.test_id = ?`,
      [ogrenciId, testId],
      (err, results) => {
        if (err) return callback(err);
        callback(null, results.length > 0 ? results[0] : null);
      }
    );
  }

  // Öğrenci cevaplarını getir
  static ogrenciCevaplariniGetir(ogrenciId, testId, callback) {
    db.query(
      'SELECT soru_no, cevap FROM ogrenci_cevaplari WHERE ogrenci_id = ? AND test_id = ?',
      [ogrenciId, testId],
      (err, results) => {
        callback(err, results);
      }
    );
  }

  // Cevap kaydet
  static cevapKaydet(ogrenciId, testId, soruNo, cevap, callback) {
    db.query(
      `INSERT INTO ogrenci_cevaplari (ogrenci_id, test_id, soru_no, cevap) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE cevap = VALUES(cevap), created_at = CURRENT_TIMESTAMP`,
      [ogrenciId, testId, soruNo, cevap],
      (err) => {
        if (err) return callback(err);
        
        // Test durumunu güncelle
        db.query(
          `UPDATE ogrenci_testleri 
           SET durum = 'devam_ediyor' 
           WHERE ogrenci_id = ? AND test_id = ? AND durum = 'beklemede'`,
          [ogrenciId, testId],
          callback
        );
      }
    );
  }

  // Öğrenciye test ata
  static ogrenciyeTestAta(ogrenciId, testId, callback) {
    db.query(
      'INSERT IGNORE INTO ogrenci_testleri (ogrenci_id, test_id) VALUES (?, ?)',
      [ogrenciId, testId],
      callback
    );
  }

  // Test havuzuna yeni test ekle
  static testEkle(testKodu, testAdi, soruSayisi, cevaplar, videolar, callback) {
    // Cevaplar ve videolar array olarak gelecek
    const cevapFields = [];
    const videoFields = [];
    const values = [testKodu, testAdi, soruSayisi];
    
    for (let i = 1; i <= 25; i++) {
      cevapFields.push(`cevap_${i}`);
      videoFields.push(`video_${i}`);
      values.push(cevaplar[i - 1] || null);
      values.push(videolar[i - 1] || null);
    }
    
    const sql = `INSERT INTO test_havuzu (test_kodu, test_adi, soru_sayisi, ${cevapFields.join(', ')}, ${videoFields.join(', ')}) 
                 VALUES (?, ?, ?, ${Array(50).fill('?').join(', ')})`;

    db.query(sql, values, (err, result) => {
      if (err) return callback(err);
      callback(null, result.insertId);
    });
  }

  // Test oluştur (Admin için)
  static testOlustur(testKodu, testAdi, soruSayisi, cevaplarObj, videolarObj, callback) {
    const fields = ['test_kodu', 'test_adi', 'soru_sayisi'];
    const values = [testKodu, testAdi, soruSayisi];
    const placeholders = ['?', '?', '?'];
    
    // Cevapları ve videoları ekle
    for (let i = 1; i <= 25; i++) {
      if (cevaplarObj['cevap_' + i]) {
        fields.push('cevap_' + i);
        values.push(cevaplarObj['cevap_' + i]);
        placeholders.push('?');
      }
      if (videolarObj['video_' + i]) {
        fields.push('video_' + i);
        values.push(videolarObj['video_' + i]);
        placeholders.push('?');
      }
    }
    
    const sql = `INSERT INTO test_havuzu (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
    
    db.query(sql, values, (err, result) => {
      if (err) return callback(err);
      callback(null, result.insertId);
    });
  }

  // Tüm testleri getir (Admin için)
  static tumTestleriGetir(callback) {
    db.query(
      'SELECT * FROM test_havuzu WHERE aktif = 1 ORDER BY test_kodu',
      (err, results) => {
        callback(err, results);
      }
    );
  }

  // Test ata (Admin için) - Test kodu ve öğrenci numarası ile
  static testAtaKodlarla(ogrenciNumara, testKodu, ozelTestAdi, callback) {
    // Trim ve büyük harfe çevir
    const temizOgrenciNo = ogrenciNumara.toString().trim();
    const temizTestKodu = testKodu.toString().trim().toUpperCase();
    
    // Önce öğrenciyi bul
    db.query(
      'SELECT id FROM ogrenciler WHERE numara = ?',
      [temizOgrenciNo],
      (err, ogrenciSonuc) => {
        if (err) return callback(err);
        if (ogrenciSonuc.length === 0) {
          return callback(new Error('Öğrenci numarası bulunamadı: ' + temizOgrenciNo));
        }
        
        const ogrenciId = ogrenciSonuc[0].id;
        
        // Testi bul (büyük/küçük harf duyarsız)
        db.query(
          'SELECT id FROM test_havuzu WHERE UPPER(test_kodu) = ? AND aktif = 1',
          [temizTestKodu],
          (err, testSonuc) => {
            if (err) return callback(err);
            if (testSonuc.length === 0) {
              return callback(new Error('Test kodu bulunamadı veya aktif değil: ' + temizTestKodu));
            }
            
            const testId = testSonuc[0].id;
            
            // Test daha önce atanmış mı kontrol et
            db.query(
              'SELECT id FROM ogrenci_testleri WHERE ogrenci_id = ? AND test_id = ?',
              [ogrenciId, testId],
              (err, mevcutAtama) => {
                if (err) return callback(err);
                if (mevcutAtama.length > 0) {
                  return callback(new Error('Bu test zaten bu öğrenciye atanmış'));
                }
                
                // Test ata
                const sql = ozelTestAdi 
                  ? 'INSERT INTO ogrenci_testleri (ogrenci_id, test_id, ozel_test_adi, durum) VALUES (?, ?, ?, "beklemede")'
                  : 'INSERT INTO ogrenci_testleri (ogrenci_id, test_id, durum) VALUES (?, ?, "beklemede")';
                
                const params = ozelTestAdi ? [ogrenciId, testId, ozelTestAdi] : [ogrenciId, testId];
                
                db.query(sql, params, callback);
              }
            );
          }
        );
      }
    );
  }

  // Test ata (Admin için)
  static testAta(ogrenciId, testId, ozelTestAdi, callback) {
    const sql = ozelTestAdi 
      ? 'INSERT INTO ogrenci_testleri (ogrenci_id, test_id, ozel_test_adi, durum) VALUES (?, ?, ?, "beklemede")'
      : 'INSERT INTO ogrenci_testleri (ogrenci_id, test_id, durum) VALUES (?, ?, "beklemede")';
    
    const params = ozelTestAdi ? [ogrenciId, testId, ozelTestAdi] : [ogrenciId, testId];
    
    db.query(sql, params, callback);
  }

  // Test sonucunu hesapla
  static testSonucuHesapla(ogrenciId, testId, callback) {
    // Testin doğru cevaplarını al
    this.getById(testId, (err, test) => {
      if (err || !test) return callback(err);
      
      // Öğrencinin cevaplarını al
      this.ogrenciCevaplariniGetir(ogrenciId, testId, (err, cevaplar) => {
        if (err) return callback(err);
        
        let dogruSayisi = 0;
        let yanlisSayisi = 0;
        let bosSayisi = test.soru_sayisi;
        const detaylar = [];
        
        // Her soru için kontrol
        for (let i = 1; i <= test.soru_sayisi; i++) {
          const dogruCevap = test[`cevap_${i}`];
          const ogrenciCevabi = cevaplar.find(c => c.soru_no === i);
          
          if (ogrenciCevabi && ogrenciCevabi.cevap) {
            bosSayisi--;
            if (ogrenciCevabi.cevap === dogruCevap) {
              dogruSayisi++;
              detaylar.push({ soru_no: i, durum: 'dogru', ogrenci_cevap: ogrenciCevabi.cevap, dogru_cevap: dogruCevap });
            } else {
              yanlisSayisi++;
              detaylar.push({ soru_no: i, durum: 'yanlis', ogrenci_cevap: ogrenciCevabi.cevap, dogru_cevap: dogruCevap });
            }
          } else {
            detaylar.push({ soru_no: i, durum: 'bos', ogrenci_cevap: null, dogru_cevap: dogruCevap });
          }
        }
        
        callback(null, {
          dogru: dogruSayisi,
          yanlis: yanlisSayisi,
          bos: bosSayisi,
          toplam: test.soru_sayisi,
          puan: parseFloat(((dogruSayisi * 100) / test.soru_sayisi).toFixed(2)), // Number olarak döndür
          detaylar: detaylar
        });
      });
    });
  }

  // Testi tamamla
  static testiTamamla(ogrenciId, testId, callback) {
    // Önce test sonucunu hesapla
    this.testSonucuHesapla(ogrenciId, testId, (err, sonuc) => {
      if (err) return callback(err);
      
      // Test durumunu ve sonuçları güncelle
      db.query(
        `UPDATE ogrenci_testleri 
         SET durum = 'tamamlandi', 
             tamamlanma_tarihi = NOW(),
             puan = ?,
             dogru_sayisi = ?,
             yanlis_sayisi = ?,
             bos_sayisi = ?
         WHERE ogrenci_id = ? AND test_id = ?`,
        [sonuc.puan, sonuc.dogru, sonuc.yanlis, sonuc.bos, ogrenciId, testId],
        callback
      );
    });
  }
}

module.exports = Test;

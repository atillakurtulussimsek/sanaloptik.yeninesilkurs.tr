const db = require('../database');
const crypto = require('crypto');

class Admin {
  // MD5 hash fonksiyonu
  static md5(text) {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  // Admin girişi
  static girisYap(kullaniciAdi, sifre, callback) {
    const hashedPassword = this.md5(sifre);
    const sql = 'SELECT * FROM adminler WHERE kullanici_adi = ? AND sifre = ?';
    
    db.query(sql, [kullaniciAdi, hashedPassword], (err, results) => {
      if (err) return callback(err);
      
      if (results.length > 0) {
        callback(null, results[0]);
      } else {
        callback(null, null);
      }
    });
  }

  // Admin bilgilerini getir
  static getById(id, callback) {
    const sql = 'SELECT id, kullanici_adi, ad, soyad FROM adminler WHERE id = ?';
    db.query(sql, [id], (err, results) => {
      if (err) return callback(err);
      callback(null, results[0]);
    });
  }

  // Tüm adminleri getir
  static tumunuGetir(callback) {
    const sql = 'SELECT id, kullanici_adi, ad, soyad FROM adminler';
    db.query(sql, (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  }

  // Yeni admin ekle
  static ekle(kullaniciAdi, sifre, ad, soyad, callback) {
    const hashedPassword = this.md5(sifre);
    const sql = 'INSERT INTO adminler (kullanici_adi, sifre, ad, soyad) VALUES (?, ?, ?, ?)';
    
    db.query(sql, [kullaniciAdi, hashedPassword, ad, soyad], (err, result) => {
      if (err) return callback(err);
      callback(null, result.insertId);
    });
  }

  // Dashboard istatistikleri
  static dashboardIstatistikleri(callback) {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM ogrenciler) as toplam_ogrenci,
        (SELECT COUNT(*) FROM test_havuzu) as toplam_test,
        (SELECT COUNT(*) FROM ogrenci_testleri WHERE durum = 'tamamlandi') as tamamlanan_testler,
        (SELECT COUNT(*) FROM ogrenci_testleri WHERE durum != 'tamamlandi') as devam_eden_testler,
        (SELECT COUNT(DISTINCT ogrenci_id) FROM ogrenci_testleri WHERE durum = 'tamamlandi') as aktif_ogrenci
    `;
    
    db.query(sql, (err, results) => {
      if (err) return callback(err);
      callback(null, results[0]);
    });
  }

  // Öğrenci detaylı istatistikleri
  static ogrenciIstatistikleri(callback) {
    const sql = `
      SELECT 
        o.id,
        o.numara,
        o.ad,
        o.soyad,
        COUNT(ot.id) as toplam_test,
        SUM(CASE WHEN ot.durum = 'tamamlandi' THEN 1 ELSE 0 END) as tamamlanan,
        SUM(CASE WHEN ot.durum = 'devam_ediyor' THEN 1 ELSE 0 END) as devam_eden,
        AVG(CASE WHEN ot.durum = 'tamamlandi' THEN ot.puan ELSE NULL END) as ortalama_puan,
        MAX(CASE WHEN ot.durum = 'tamamlandi' THEN ot.puan ELSE NULL END) as en_yuksek_puan,
        SUM(CASE WHEN ot.durum = 'tamamlandi' THEN ot.dogru_sayisi ELSE 0 END) as toplam_dogru
      FROM ogrenciler o
      LEFT JOIN ogrenci_testleri ot ON o.id = ot.ogrenci_id
      GROUP BY o.id, o.numara, o.ad, o.soyad
      ORDER BY o.numara
    `;
    
    db.query(sql, (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  }

  // Test detaylı istatistikleri
  static testIstatistikleri(callback) {
    const sql = `
      SELECT 
        t.id,
        t.test_kodu,
        t.test_adi,
        t.soru_sayisi,
        COUNT(ot.id) as atanan_ogrenci,
        SUM(CASE WHEN ot.durum = 'tamamlandi' THEN 1 ELSE 0 END) as tamamlanan,
        SUM(CASE WHEN ot.durum = 'devam_ediyor' THEN 1 ELSE 0 END) as devam_eden,
        AVG(CASE WHEN ot.durum = 'tamamlandi' THEN ot.puan ELSE NULL END) as ortalama_puan,
        MAX(CASE WHEN ot.durum = 'tamamlandi' THEN ot.puan ELSE NULL END) as en_yuksek_puan,
        MIN(CASE WHEN ot.durum = 'tamamlandi' THEN ot.puan ELSE NULL END) as en_dusuk_puan,
        AVG(CASE WHEN ot.durum = 'tamamlandi' AND t.soru_sayisi > 0 THEN (ot.dogru_sayisi / t.soru_sayisi * 100) ELSE NULL END) as ortalama_dogru_yuzde
      FROM test_havuzu t
      LEFT JOIN ogrenci_testleri ot ON t.id = ot.test_id
      GROUP BY t.id, t.test_kodu, t.test_adi, t.soru_sayisi
      ORDER BY t.test_kodu
    `;
    
    db.query(sql, (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  }

  // Genel sistem istatistikleri
  static genelIstatistikler(callback) {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM ogrenciler) as toplamOgrenci,
        (SELECT COUNT(*) FROM test_havuzu) as toplamTest,
        (SELECT SUM(soru_sayisi) FROM test_havuzu) as toplamSoru,
        (SELECT COUNT(*) FROM ogrenci_testleri WHERE durum = 'tamamlandi') as tamamlananTestler,
        (SELECT COUNT(*) FROM ogrenci_testleri WHERE durum = 'devam_ediyor') as devamEdenTestler,
        (SELECT AVG(puan) FROM ogrenci_testleri WHERE durum = 'tamamlandi' AND puan IS NOT NULL) as sistemOrtalamasi
    `;
    
    db.query(sql, (err, results) => {
      if (err) return callback(err);
      callback(null, results[0] || {});
    });
  }
}

module.exports = Admin;

const db = require('../database');
const crypto = require('crypto');

class Ogrenci {
  static md5(text) {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  static girisYap(numara, sifre, callback) {
    const sifreliSifre = this.md5(sifre);
    db.query(
      'SELECT * FROM ogrenciler WHERE numara = ? AND sifre = ?',
      [numara, sifreliSifre],
      (err, results) => {
        if (err) return callback(err);
        callback(null, results[0]);
      }
    );
  }

  static getById(id, callback) {
    db.query(
      'SELECT * FROM ogrenciler WHERE id = ?',
      [id],
      (err, results) => {
        if (err) return callback(err);
        callback(null, results[0]);
      }
    );
  }

  static tumunuGetir(callback) {
    db.query(
      'SELECT id, ad, soyad, numara FROM ogrenciler',
      (err, results) => {
        callback(err, results);
      }
    );
  }

  static ekle(ad, soyad, numara, sifre, callback) {
    const sifreliSifre = this.md5(sifre);
    db.query(
      'INSERT INTO ogrenciler (ad, soyad, numara, sifre) VALUES (?, ?, ?, ?)',
      [ad, soyad, numara, sifreliSifre],
      callback
    );
  }
}

module.exports = Ogrenci;

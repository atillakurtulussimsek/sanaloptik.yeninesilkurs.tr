const mysql = require('mysql2');

// İlk önce veritabanı olmadan bağlantı oluştur (veritabanını kontrol etmek için)
const initConnection = mysql.createConnection({
  host: '94.156.11.185',
  user: 'yeninesil_optik',
  password: 'yeninesil_optik'
});

// Veritabanını oluştur (eğer yoksa)
initConnection.query('CREATE DATABASE IF NOT EXISTS yeninesil_optik CHARACTER SET utf8mb4 COLLATE utf8mb4_turkish_ci', (err) => {
  if (err) {
    console.error('⚠️  Veritabanı kontrol hatası:', err.message);
  } else {
    console.log('✓ Veritabanı hazır: yeninesil_optik');
  }
  initConnection.end();
});

// MySQL bağlantı havuzu oluştur
const pool = mysql.createPool({
  host: '94.156.11.185',
  user: 'yeninesil_optik',
  password: 'yeninesil_optik',  // MySQL şifrenizi buraya girin
  database: 'yeninesil_optik',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// Promise wrapper
const promisePool = pool.promise();

// Test bağlantısı
pool.getConnection((err, connection) => {
  if (err) {
    console.error('MySQL bağlantı hatası:', err.message);
    console.log('\n⚠️  MySQL ayarlarını kontrol edin:');
    console.log('1. MySQL servisinin çalıştığından emin olun');
    console.log('2. database.js içindeki user, password değerlerini kontrol edin');
    console.log('3. "sanaloptik" veritabanını oluşturun: CREATE DATABASE sanaloptik;');
  } else {
    console.log('✓ MySQL bağlantısı başarılı');
    connection.release();
  }
});

module.exports = pool;

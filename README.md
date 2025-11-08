# 🎓 Sanal Optik Form Sistemi

Öğrencilerin online test çözebileceği, optik form benzeri bir platform.

## 🚀 Kurulum

### 1. MySQL Kurulumu

MySQL'in yüklü ve çalışır durumda olduğundan emin olun.

### 2. Veritabanı Oluşturma

**Seçenek A - SQL Dosyası ile (Önerilen):**
```bash
mysql -u root -p < schema.sql
```

**Seçenek B - Manuel:**
```sql
CREATE DATABASE sanaloptik CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
Sonra `schema.sql` dosyasını çalıştırın.

### 3. Veritabanı Bağlantı Ayarları

`database.js` dosyasını açın ve MySQL bilgilerinizi girin:

```javascript
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',          // MySQL kullanıcı adınız
  password: '',          // MySQL şifreniz
  database: 'sanaloptik'
});
```

### 4. Paketleri Yükleyin

```bash
npm install
```

### 5. Örnek Verileri Ekleyin

```bash
npm run seed
```

Bu komut şunları ekler:
- 3 örnek öğrenci
- 2 test (Matematik ve Türkçe)
- Testler için sorular

### 6. Uygulamayı Başlatın

```bash
npm start
```

Tarayıcınızda açın: **http://localhost:3000**

## 👥 Test Kullanıcıları

| Öğrenci No | Şifre  | Ad Soyad      |
|------------|--------|---------------|
| 1001       | 123456 | Ahmet Yılmaz  |
| 1002       | 123456 | Ayşe Demir    |
| 1003       | 123456 | Mehmet Kaya   |

## 📋 Özellikler

- ✅ Öğrenci giriş sistemi (MD5 şifreleme)
- ✅ Test havuzu sistemi
- ✅ Soru kodları ve çözüm video linkleri
- ✅ Öğrencilere test atama sistemi
- ✅ Test listeleme (Beklemede, Devam Ediyor, Tamamlandı)
- ✅ A-B-C-D-E şıklarıyla test çözme
- ✅ Otomatik cevap kaydetme
- ✅ Modern ve responsive tasarım

## 🗄️ Veritabanı Yapısı

### Tablolar

- **ogrenciler** - Öğrenci bilgileri (MD5 şifreli)
- **test_havuzu** - Tüm sorular (soru kodu, doğru cevap, çözüm video linki, ders, konu, zorluk)
- **testler** - Test paketleri
- **test_sorulari** - Test-soru ilişkisi (hangi testte hangi sorular var)
- **ogrenci_testleri** - Öğrenci-test ilişkisi (öğrenciye hangi testler atandı)
- **ogrenci_cevaplari** - Öğrencilerin işaretledikleri cevaplar

## 🛠️ Teknolojiler

- **Backend:** Node.js + Express.js
- **Veritabanı:** MySQL
- **Template Engine:** EJS
- **Session:** express-session

## 📝 Notlar

- Cevaplar anında kaydedilir (her şık değişikliğinde)
- Session süresi 24 saat
- UTF-8 karakter desteği mevcuttur

## 🔧 Sorun Giderme

### MySQL bağlantı hatası alıyorsanız:

1. MySQL servisinin çalıştığını kontrol edin
2. `database.js` içindeki kullanıcı adı ve şifreyi kontrol edin
3. `sanaloptik` veritabanının oluşturulduğunu kontrol edin

### Port 3000 kullanımda hatası:

`bin/www` dosyasında portu değiştirebilirsiniz.

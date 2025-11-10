var express = require('express');
var router = express.Router();
var Ogrenci = require('../models/Ogrenci');
var Test = require('../models/Test');
var Admin = require('../models/Admin');
var authMiddleware = require('../middleware/auth');
var K12NetSSO = require('../utils/K12NetSSO');
var HTMLTestParser = require('../utils/htmlParser');
var { Logger } = require('../logger');
var logger = new Logger();
var multer = require('multer');
var xlsx = require('xlsx');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

// Multer konfigürasyonu (Excel dosyalar için)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, 'ogrenciler_' + Date.now() + '.xlsx');
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Sadece Excel dosyaları (.xlsx, .xls) kabul edilir!'), false);
    }
  }
});

// HTML dosyalar için multer konfigürasyonu
const htmlStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, 'test_import_' + Date.now() + '_' + file.originalname);
  }
});

const uploadHTML = multer({ 
  storage: htmlStorage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'text/html' || 
        file.originalname.toLowerCase().endsWith('.html') ||
        file.originalname.toLowerCase().endsWith('.htm')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece HTML dosyaları (.html, .htm) kabul edilir!'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});


// Admin middleware
function adminAuthMiddleware(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  res.redirect('/admin/giris');
}

// Ana sayfa - Giriş sayfasına yönlendir
router.get('/', function(req, res, next) {
  if (req.session && req.session.ogrenci) {
    return res.redirect('/testler');
  }
  res.redirect('/giris');
});

// Giriş sayfası
router.get('/giris', function(req, res, next) {
  if (req.session && req.session.ogrenci) {
    return res.redirect('/testler');
  }
  res.render('giris', { hata: null });
});

// Giriş işlemi
router.post('/giris', function(req, res, next) {
  const { numara, sifre } = req.body;
  
  // Giriş denemesi logla
  const { ip, port } = req.systemLogger.getClientIPInfo(req);
  req.systemLogger.log({
    userType: 'student',
    actionType: 'login_attempt',
    actionCategory: 'auth',
    actionDescription: `Öğrenci giriş denemesi - Numara: ${numara}`,
    ipAddress: ip,
    clientPort: port,
    userAgent: logger.getUserAgent(req),
    method: req.method,
    url: req.originalUrl,
    requestData: { numara }
  }).catch(console.error);
  
  Ogrenci.girisYap(numara, sifre, (err, ogrenci) => {
    if (err) {
      // Hata logla
      req.systemLogger.logError(err, req, null, 'student').catch(console.error);
      return res.render('giris', { hata: 'Bir hata oluştu.' });
    }
    
    if (!ogrenci) {
      // Başarısız giriş logla
      const { ip, port } = req.systemLogger.getClientIPInfo(req);
      req.systemLogger.log({
        userType: 'student',
        actionType: 'login_failed',
        actionCategory: 'auth',
        actionDescription: `Başarısız giriş denemesi - Numara: ${numara}`,
        ipAddress: ip,
        clientPort: port,
        userAgent: logger.getUserAgent(req),
        method: req.method,
        url: req.originalUrl,
        requestData: { numara }
      }).catch(console.error);
      
      return res.render('giris', { hata: 'Numara veya şifre hatalı!' });
    }
    
    req.session.ogrenci = {
      id: ogrenci.id,
      ad: ogrenci.ad,
      soyad: ogrenci.soyad,
      numara: ogrenci.numara
    };
    
    // Başarılı giriş logla
    req.systemLogger.logStudentAuth('login_success', ogrenci.id, req, {
      studentNumber: ogrenci.numara,
      studentName: `${ogrenci.ad} ${ogrenci.soyad}`
    }).catch(console.error);
    
    res.redirect('/testler');
  });
});

// Çıkış işlemi
router.get('/cikis', function(req, res, next) {
  // Çıkış logla
  if (req.session && req.session.ogrenci) {
    req.systemLogger.logStudentAuth('logout', req.session.ogrenci.id, req, {
      studentNumber: req.session.ogrenci.numara,
      studentName: `${req.session.ogrenci.ad} ${req.session.ogrenci.soyad}`
    }).catch(console.error);
  }
  
  req.session.destroy();
  res.redirect('/giris');
});

// Testler listesi (Giriş gerekli)
router.get('/testler', authMiddleware, function(req, res, next) {
  const ogrenciId = req.session.ogrenci.id;
  
  Test.ogrencininTestleriniGetir(ogrenciId, (err, testler) => {
    if (err) {
      return next(err);
    }
    
    res.render('testler', { 
      ogrenci: req.session.ogrenci,
      testler: testler 
    });
  });
});

// Test detay ve çözme sayfası (Giriş gerekli)
router.get('/test/:id', authMiddleware, function(req, res, next) {
  const testId = req.params.id;
  const ogrenciId = req.session.ogrenci.id;
  
  // Test erişim logla
  req.systemLogger.logStudentTest('test_accessed', ogrenciId, testId, req, {
    testId: testId
  }).catch(console.error);
  
  // Önce öğrencinin bu teste erişimi var mı kontrol et
  Test.ogrenciTestErisimKontrol(ogrenciId, testId, (err, erisim) => {
    if (err) return next(err);
    
    if (!erisim) {
      // Yetkisiz erişim denemesi logla
      req.systemLogger.log({
        userId: ogrenciId,
        userType: 'student',
        actionType: 'unauthorized_access',
        actionCategory: 'security',
        actionDescription: `Yetkisiz test erişim denemesi - Test ID: ${testId}`,
        targetType: 'test',
        targetId: testId,
        ipAddress: req.systemLogger.getClientIP(req),
        userAgent: logger.getUserAgent(req),
        method: req.method,
        url: req.originalUrl
      }).catch(console.error);
      
      return res.redirect('/testler');
    }
    
    Test.getById(testId, (err, test) => {
      if (err || !test) {
        return res.redirect('/testler');
      }
      
      Test.ogrenciCevaplariniGetir(ogrenciId, testId, (err, cevaplar) => {
        if (err) {
          return next(err);
        }
        
        // Cevapları soru numarasına göre map'le
        const cevapMap = {};
        cevaplar.forEach(c => {
          cevapMap[c.soru_no] = c.cevap;
        });
        
        res.render('test-detay', {
          ogrenci: req.session.ogrenci,
          test: test,
          cevaplar: cevapMap,
          testDurum: erisim
        });
      });
    });
  });
});

// Cevap kaydetme (AJAX)
router.post('/cevap-kaydet', authMiddleware, function(req, res, next) {
  const { test_id, soru_no, cevap } = req.body;
  const ogrenciId = req.session.ogrenci.id;
  
  // Cevap işaretleme logla
  req.systemLogger.logStudentAnswer(ogrenciId, test_id, soru_no, cevap, req, {
    previousAnswer: null // Önceki cevap varsa buraya eklenebilir
  }).catch(console.error);
  
  Test.cevapKaydet(ogrenciId, test_id, soru_no, cevap, (err) => {
    if (err) {
      req.systemLogger.logError(err, req, ogrenciId, 'student').catch(console.error);
      return res.json({ success: false, message: 'Cevap kaydedilemedi.' });
    }
    
    res.json({ success: true, message: 'Cevap kaydedildi.' });
  });
});

// Test tamamlama
router.post('/test-tamamla', authMiddleware, function(req, res, next) {
  const { test_id } = req.body;
  const ogrenciId = req.session.ogrenci.id;
  
  // Test tamamlama logla
  req.systemLogger.logStudentTest('test_completed', ogrenciId, test_id, req, {
    completionMethod: 'manual'
  }).catch(console.error);
  
  // Test sonucunu hesapla
  Test.testSonucuHesapla(ogrenciId, test_id, (err, sonuc) => {
    if (err) {
      req.systemLogger.logError(err, req, ogrenciId, 'student').catch(console.error);
      return res.json({ success: false, message: 'Test değerlendirilemedi.' });
    }
    
    // Test durumunu tamamlandı olarak güncelle
    Test.testiTamamla(ogrenciId, test_id, (err) => {
      if (err) {
        req.systemLogger.logError(err, req, ogrenciId, 'student').catch(console.error);
        return res.json({ success: false, message: 'Test tamamlanamadı.' });
      }
      
      res.json({ 
        success: true, 
        message: 'Test tamamlandı!',
        sonuc: sonuc
      });
    });
  });
});

// Test sonucunu getir
router.get('/test-sonuc', authMiddleware, function(req, res, next) {
  const { test_id } = req.query;
  const ogrenciId = req.session.ogrenci.id;
  
  Test.testSonucuHesapla(ogrenciId, test_id, (err, sonuc) => {
    if (err) {
      return res.json({ success: false, message: 'Test sonucu alınamadı.' });
    }
    
    res.json({ success: true, sonuc: sonuc });
  });
});

// ============ VIDEO İZLEME API'LERİ ============

// Video izleme başlatma
router.post('/video-izleme-baslat', authMiddleware, function(req, res, next) {
  const { test_id, soru_no } = req.body;
  const ogrenciId = req.session.ogrenci.id;
  const db = require('../database');
  
  // Video izleme detay kaydı başlat
  db.query(
    `INSERT INTO video_izleme_detay 
     (ogrenci_id, test_id, soru_no, session_id, ip_address, user_agent) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      ogrenciId, 
      test_id, 
      soru_no, 
      req.session.id,
      req.systemLogger.getClientIP(req),
      logger.getUserAgent(req)
    ],
    (err, result) => {
      if (err) {
        console.error('Video izleme detay kayıt hatası:', err);
        return res.json({ success: false, message: 'Video izleme kaydedilemedi.' });
      }
      
      // Ana video izleme tablosunu güncelle
      db.query(
        `INSERT INTO video_izleme 
         (ogrenci_id, test_id, soru_no, izleme_sayisi, ip_address, tarayici)
         VALUES (?, ?, ?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE 
         izleme_sayisi = izleme_sayisi + 1,
         son_izleme_tarihi = CURRENT_TIMESTAMP,
         ip_address = VALUES(ip_address)`,
        [
          ogrenciId, 
          test_id, 
          soru_no,
          req.systemLogger.getClientIP(req),
          logger.getUserAgent(req)
        ],
        (err2) => {
          if (err2) {
            console.error('Video izleme ana tablo hatası:', err2);
          }
          
          // Video izleme logla
          req.systemLogger.logVideoAccess(ogrenciId, test_id, soru_no, req, {
            detayId: result.insertId,
            sessionStart: new Date().toISOString()
          }).catch(console.error);
          
          res.json({ 
            success: true, 
            message: 'Video izleme başlatıldı.',
            detay_id: result.insertId
          });
        }
      );
    }
  );
});

// Video izleme bitirme
router.post('/video-izleme-bitir', authMiddleware, function(req, res, next) {
  const { detay_id, izleme_suresi, video_yuzde, tam_izlendi, cikis_noktasi } = req.body;
  const db = require('../database');
  
  db.query(
    `UPDATE video_izleme_detay 
     SET izleme_bitir = CURRENT_TIMESTAMP,
         izleme_suresi = ?,
         video_yuzde_izlendi = ?,
         tam_izlendi = ?,
         cikis_noktasi = ?
     WHERE id = ?`,
    [izleme_suresi, video_yuzde, tam_izlendi, cikis_noktasi, detay_id],
    (err) => {
      if (err) {
        console.error('Video izleme bitirme hatası:', err);
        return res.json({ success: false, message: 'Video izleme güncellenemedi.' });
      }
      
      // Ana tablodaki toplam süreyi güncelle
      db.query(
        `UPDATE video_izleme 
         SET toplam_izleme_suresi = toplam_izleme_suresi + ?,
             son_izleme_suresi = ?
         WHERE ogrenci_id = (SELECT ogrenci_id FROM video_izleme_detay WHERE id = ?)
         AND test_id = (SELECT test_id FROM video_izleme_detay WHERE id = ?)
         AND soru_no = (SELECT soru_no FROM video_izleme_detay WHERE id = ?)`,
        [izleme_suresi, izleme_suresi, detay_id, detay_id, detay_id],
        (err2) => {
          if (err2) {
            console.error('Video süre güncelleme hatası:', err2);
          }
          
          // Soru numarasını almak için sorgu yap
          db.query(
            'SELECT soru_no FROM video_izleme_detay WHERE id = ?',
            [detay_id],
            (err3, results) => {
              const soruNo = results && results.length > 0 ? results[0].soru_no : null;
              
              res.json({ 
                success: true, 
                message: 'Video izleme tamamlandı.',
                izleme_suresi: izleme_suresi,
                tam_izlendi: tam_izlendi,
                soru_no: soruNo
              });
            }
          );
        }
      );
    }
  );
});

// Video izleme istatistikleri getir
router.get('/video-istatistikleri/:testId', authMiddleware, function(req, res, next) {
  const testId = req.params.testId;
  const ogrenciId = req.session.ogrenci.id;
  const db = require('../database');
  
  db.query(
    `SELECT 
       soru_no,
       izleme_sayisi,
       toplam_izleme_suresi,
       son_izleme_suresi,
       ilk_izleme_tarihi,
       son_izleme_tarihi
     FROM video_izleme 
     WHERE ogrenci_id = ? AND test_id = ?
     ORDER BY soru_no`,
    [ogrenciId, testId],
    (err, results) => {
      if (err) {
        console.error('Video istatistikleri hatası:', err);
        return res.json({ success: false, message: 'İstatistikler alınamadı.' });
      }
      
      const istatistikler = {};
      results.forEach(stat => {
        istatistikler[stat.soru_no] = {
          izlenmeSayisi: stat.izleme_sayisi,
          toplamSure: stat.toplam_izleme_suresi,
          sonSure: stat.son_izleme_suresi,
          ilkIzleme: stat.ilk_izleme_tarihi,
          sonIzleme: stat.son_izleme_tarihi
        };
      });
      
      res.json({ success: true, istatistikler: istatistikler });
    }
  );
});

// ============ ADMIN ROUTES ============

// Admin giriş sayfası
router.get('/admin/giris', function(req, res, next) {
  if (req.session && req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin-giris', { hata: null });
});

// Admin giriş işlemi
router.post('/admin/giris', function(req, res, next) {
  const { kullanici_adi, sifre } = req.body;
  
  // Admin giriş denemesi logla
  req.systemLogger.log({
    userType: 'admin',
    actionType: 'login_attempt',
    actionCategory: 'auth',
    actionDescription: `Admin giriş denemesi - Kullanıcı: ${kullanici_adi}`,
    ipAddress: req.systemLogger.getClientIP(req),
    userAgent: logger.getUserAgent(req),
    method: req.method,
    url: req.originalUrl,
    requestData: { kullanici_adi }
  }).catch(console.error);
  
  Admin.girisYap(kullanici_adi, sifre, (err, admin) => {
    if (err) {
      req.systemLogger.logError(err, req, null, 'admin').catch(console.error);
      return res.render('admin-giris', { hata: 'Bir hata oluştu.' });
    }
    
    if (!admin) {
      // Başarısız admin giriş logla
      req.systemLogger.log({
        userType: 'admin',
        actionType: 'login_failed',
        actionCategory: 'auth',
        actionDescription: `Başarısız admin giriş denemesi - Kullanıcı: ${kullanici_adi}`,
        ipAddress: req.systemLogger.getClientIP(req),
        userAgent: logger.getUserAgent(req),
        method: req.method,
        url: req.originalUrl,
        requestData: { kullanici_adi }
      }).catch(console.error);
      
      return res.render('admin-giris', { hata: 'Kullanıcı adı veya şifre hatalı!' });
    }
    
    req.session.admin = {
      id: admin.id,
      ad: admin.ad,
      soyad: admin.soyad,
      kullanici_adi: admin.kullanici_adi
    };
    
    // Başarılı admin giriş logla
    req.systemLogger.logAdminAuth('login_success', admin.id, req, {
      adminUsername: admin.kullanici_adi,
      adminName: `${admin.ad} ${admin.soyad}`
    }).catch(console.error);
    
    res.redirect('/admin/dashboard');
  });
});

// Admin çıkış işlemi
router.get('/admin/cikis', function(req, res, next) {
  // Admin çıkış logla
  if (req.session && req.session.admin) {
    req.systemLogger.logAdminAuth('logout', req.session.admin.id, req, {
      adminUsername: req.session.admin.kullanici_adi
    }).catch(console.error);
  }
  
  req.session.destroy();
  res.redirect('/admin/giris');
});

// Admin dashboard
router.get('/admin/dashboard', adminAuthMiddleware, function(req, res, next) {
  // Dashboard erişim logla
  req.systemLogger.logAdminAction('dashboard_accessed', req.session.admin.id, req).catch(console.error);
  
  Admin.dashboardIstatistikleri((err, istatistikler) => {
    if (err) return next(err);
    
    res.render('admin-dashboard', {
      admin: req.session.admin,
      istatistikler: istatistikler
    });
  });
});

// Öğrenci Yönetimi
router.get('/admin/ogrenci-yonetimi', adminAuthMiddleware, function(req, res, next) {
  const db = require('../database');
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  
  let whereClause = '';
  let queryParams = [];
  
  if (search) {
    whereClause = 'WHERE (numara LIKE ? OR ad LIKE ? OR soyad LIKE ? OR email LIKE ?)';
    const searchTerm = `%${search}%`;
    queryParams = [searchTerm, searchTerm, searchTerm, searchTerm];
  }
  
  // Toplam öğrenci sayısını al
  db.query(
    `SELECT COUNT(*) as total FROM ogrenciler ${whereClause}`,
    queryParams,
    (err, countResult) => {
      if (err) return next(err);
      
      const totalStudents = countResult[0].total;
      const totalPages = Math.ceil(totalStudents / limit);
      
      // Öğrencileri getir
      db.query(
        `SELECT * FROM ogrenciler ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset],
        (err, students) => {
          if (err) return next(err);
          
          res.render('admin-ogrenci-yonetimi', {
            admin: req.session.admin,
            ogrenciler: students,
            currentPage: page,
            totalPages: totalPages,
            totalStudents: totalStudents,
            search: search,
            hata: req.query.hata || null,
            basari: req.query.basari || null
          });
        }
      );
    }
  );
});

// Öğrenci ekleme
router.post('/admin/ogrenci-ekle', adminAuthMiddleware, function(req, res, next) {
  const { numara, ad, soyad, email, sifre } = req.body;
  const db = require('../database');
  
  // Öğrenci numarası kontrolü
  db.query(
    'SELECT id FROM ogrenciler WHERE numara = ?',
    [numara],
    (err, existingStudent) => {
      if (err) return next(err);
      
      if (existingStudent.length > 0) {
        return res.redirect('/admin/ogrenci-yonetimi?hata=' + encodeURIComponent('Bu numara zaten kullanılıyor!'));
      }
      
      // Şifreyi MD5 ile şifrele
      const hashedPassword = crypto.createHash('md5').update(sifre).digest('hex');
      
      // Yeni öğrenci ekle
      db.query(
        'INSERT INTO ogrenciler (numara, ad, soyad, email, sifre) VALUES (?, ?, ?, ?, ?)',
        [numara, ad, soyad, email, hashedPassword],
        (err, result) => {
          if (err) return next(err);
          
          // Log kaydet
          const clientInfo = logger.getClientIPInfo(req);
          logger.logAdminAction(
            'student_create',
            req.session.admin.id,
            `Yeni öğrenci eklendi - Numara: ${numara}, Ad: ${ad} ${soyad}`,
            clientInfo.ip,
            clientInfo.port,
            logger.getUserAgent(req)
          ).catch(console.error);
          
          res.redirect('/admin/ogrenci-yonetimi?basari=' + encodeURIComponent('Öğrenci başarıyla eklendi!'));
        }
      );
    }
  );
});

// Öğrenci silme
router.post('/admin/ogrenci-sil/:id', adminAuthMiddleware, function(req, res, next) {
  const ogrenciId = req.params.id;
  const db = require('../database');
  
  // Önce öğrenci bilgilerini al (log için)
  db.query(
    'SELECT * FROM ogrenciler WHERE id = ?',
    [ogrenciId],
    (err, ogrenci) => {
      if (err) return next(err);
      
      if (ogrenci.length === 0) {
        return res.redirect('/admin/ogrenci-yonetimi?hata=' + encodeURIComponent('Öğrenci bulunamadı!'));
      }
      
      // Öğrenciyi sil
      db.query(
        'DELETE FROM ogrenciler WHERE id = ?',
        [ogrenciId],
        (err, result) => {
          if (err) return next(err);
          
          // Log kaydet
          const clientInfo = logger.getClientIPInfo(req);
          logger.logAdminAction(
            'student_delete',
            req.session.admin.id,
            `Öğrenci silindi - Numara: ${ogrenci[0].numara}, Ad: ${ogrenci[0].ad} ${ogrenci[0].soyad}`,
            clientInfo.ip,
            clientInfo.port,
            logger.getUserAgent(req)
          ).catch(console.error);
          
          res.redirect('/admin/ogrenci-yonetimi?basari=' + encodeURIComponent('Öğrenci başarıyla silindi!'));
        }
      );
    }
  );
});

// Excel ile toplu öğrenci yükleme
router.post('/admin/ogrenci-toplu-yukle', adminAuthMiddleware, upload.single('excelFile'), function(req, res, next) {
  const db = require('../database');
  const fs = require('fs');
  
  if (!req.file) {
    return res.redirect('/admin/ogrenci-yonetimi?hata=' + encodeURIComponent('Lütfen bir Excel dosyası seçin!'));
  }
  
  try {
    // Excel dosyasını oku
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);
    
    if (data.length === 0) {
      fs.unlinkSync(req.file.path); // Dosyayı sil
      return res.redirect('/admin/ogrenci-yonetimi?hata=' + encodeURIComponent('Excel dosyası boş!'));
    }
    
    let basariliEklenen = 0;
    let hataliKayitlar = [];
    let toplamKayit = data.length;
    
    // Her öğrenci için işlem yap
    const processStudent = (index) => {
      if (index >= data.length) {
        // Tüm işlemler tamamlandı
        fs.unlinkSync(req.file.path); // Dosyayı sil
        
        // Log kaydet
        const clientInfo = logger.getClientIPInfo(req);
        logger.logAdminAction(
          'bulk_student_upload',
          req.session.admin.id,
          `Toplu öğrenci yükleme - Toplam: ${toplamKayit}, Başarılı: ${basariliEklenen}, Hatalı: ${hataliKayitlar.length}`,
          clientInfo.ip,
          clientInfo.port,
          logger.getUserAgent(req)
        ).catch(console.error);
        
        if (hataliKayitlar.length > 0) {
          const hataMesaji = `${basariliEklenen} öğrenci eklendi. ${hataliKayitlar.length} kayıt hatalı: ${hataliKayitlar.join(', ')}`;
          return res.redirect('/admin/ogrenci-yonetimi?hata=' + encodeURIComponent(hataMesaji));
        } else {
          return res.redirect('/admin/ogrenci-yonetimi?basari=' + encodeURIComponent(`${basariliEklenen} öğrenci başarıyla eklendi!`));
        }
      }
      
      const student = data[index];
      const numara = student.numara || student.Numara || student.NUMARA;
      const ad = student.ad || student.Ad || student.AD || student.isim || student.İsim;
      const soyad = student.soyad || student.Soyad || student.SOYAD || student.soyisim || student.Soyisim;
      const email = student.email || student.Email || student.EMAIL || student.eposta;
      const sifre = student.sifre || student.Sifre || student.SIFRE || student.password || numara; // Varsayılan şifre numara
      
      // Gerekli alanları kontrol et
      if (!numara || !ad || !soyad) {
        hataliKayitlar.push(`Satır ${index + 2}: Eksik bilgi`);
        return processStudent(index + 1);
      }
      
      // Öğrenci numarası kontrolü
      db.query(
        'SELECT id FROM ogrenciler WHERE numara = ?',
        [numara],
        (err, existingStudent) => {
          if (err) {
            hataliKayitlar.push(`Satır ${index + 2}: Veritabanı hatası`);
            return processStudent(index + 1);
          }
          
          if (existingStudent.length > 0) {
            hataliKayitlar.push(`Satır ${index + 2}: ${numara} numarası zaten mevcut`);
            return processStudent(index + 1);
          }
          
          // Şifreyi MD5 ile şifrele
          const hashedPassword = crypto.createHash('md5').update(sifre.toString()).digest('hex');
          
          // Yeni öğrenci ekle
          db.query(
            'INSERT INTO ogrenciler (numara, ad, soyad, email, sifre) VALUES (?, ?, ?, ?, ?)',
            [numara, ad, soyad, email || '', hashedPassword],
            (err, result) => {
              if (err) {
                hataliKayitlar.push(`Satır ${index + 2}: ${numara} - ${err.message}`);
              } else {
                basariliEklenen++;
              }
              processStudent(index + 1);
            }
          );
        }
      );
    };
    
    // İşlemi başlat
    processStudent(0);
    
  } catch (error) {
    // Hata durumunda dosyayı sil
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('Excel işleme hatası:', error);
    return res.redirect('/admin/ogrenci-yonetimi?hata=' + encodeURIComponent('Excel dosyası işlenirken hata oluştu!'));
  }
});

// Excel şablonu indirme
router.get('/admin/ogrenci-sablon-indir', adminAuthMiddleware, function(req, res, next) {
  try {
    // Örnek verilerle Excel şablonu oluştur
    const sampleData = [
      {
        numara: '1001',
        ad: 'Ahmet',
        soyad: 'Yılmaz',
        email: 'ahmet.yilmaz@email.com',
        sifre: '1001'
      },
      {
        numara: '1002',
        ad: 'Fatma',
        soyad: 'Demir',
        email: 'fatma.demir@email.com',
        sifre: '1002'
      },
      {
        numara: '1003',
        ad: 'Mehmet',
        soyad: 'Kaya',
        email: 'mehmet.kaya@email.com',
        sifre: '1003'
      }
    ];
    
    // Workbook oluştur
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(sampleData);
    
    // Sütun genişliklerini ayarla
    ws['!cols'] = [
      { wch: 10 }, // numara
      { wch: 15 }, // ad
      { wch: 15 }, // soyad
      { wch: 25 }, // email
      { wch: 10 }  // sifre
    ];
    
    // Worksheet'i workbook'a ekle
    xlsx.utils.book_append_sheet(wb, ws, 'Öğrenciler');
    
    // Dosya adı ve yolu
    const fileName = `ogrenci_sablonu_${Date.now()}.xlsx`;
    const filePath = path.join(__dirname, '..', 'uploads', fileName);
    
    // Excel dosyasını oluştur
    xlsx.writeFile(wb, filePath);
    
    // Dosyayı indir
    res.download(filePath, 'ogrenci_sablonu.xlsx', (err) => {
      if (err) {
        console.error('Dosya indirme hatası:', err);
      }
      // İndirme tamamlandıktan sonra dosyayı sil
      fs.unlinkSync(filePath);
    });
    
    // Log kaydet
    req.systemLogger.log({
      userType: 'admin',
      userId: req.session.admin.id,
      actionType: 'template_download',
      actionCategory: 'student_management',
      actionDescription: 'Öğrenci Excel şablonu indirildi',
      ipAddress: req.systemLogger.getClientIP(req),
      userAgent: logger.getUserAgent(req)
    }).catch(console.error);
    
  } catch (error) {
    console.error('Şablon oluşturma hatası:', error);
    res.redirect('/admin/ogrenci-yonetimi?hata=' + encodeURIComponent('Şablon oluşturulurken hata oluştu!'));
  }
});

// Test oluşturma sayfası
router.get('/admin/test-olustur', adminAuthMiddleware, function(req, res, next) {
  res.render('admin-test-olustur', {
    admin: req.session.admin,
    hata: null,
    basari: null
  });
});

// Test kodu kontrol endpoint'i (AJAX için)
router.get('/admin/test-kod-kontrol', adminAuthMiddleware, function(req, res, next) {
  const testKodu = req.query.kod;
  
  if (!testKodu) {
    return res.json({ mevcut: false });
  }
  
  // Test kodunun veritabanında olup olmadığını kontrol et
  const db = require('../database');
  db.query(
    'SELECT id FROM test_havuzu WHERE UPPER(test_kodu) = ?',
    [testKodu.toUpperCase()],
    (err, results) => {
      if (err) {
        console.error('Test kodu kontrol hatası:', err);
        return res.json({ mevcut: false });
      }
      
      // Eğer sonuç varsa kod zaten kullanılıyor
      res.json({ mevcut: results.length > 0 });
    }
  );
});

// Öğrenci numarası kontrol endpoint'i (AJAX için)
router.get('/admin/ogrenci-kontrol', adminAuthMiddleware, function(req, res, next) {
  const ogrenciNumara = req.query.numara;
  
  if (!ogrenciNumara) {
    return res.json({ bulundu: false });
  }
  
  const db = require('../database');
  db.query(
    'SELECT numara, ad, soyad FROM ogrenciler WHERE numara = ?',
    [ogrenciNumara],
    (err, results) => {
      if (err) {
        console.error('Öğrenci kontrol hatası:', err);
        return res.json({ bulundu: false });
      }
      
      if (results.length > 0) {
        res.json({ 
          bulundu: true, 
          ad: results[0].ad,
          soyad: results[0].soyad
        });
      } else {
        res.json({ bulundu: false });
      }
    }
  );
});

// Test kodu mevcut mu kontrol endpoint'i (test atama için - AJAX)
router.get('/admin/test-havuz-kontrol', adminAuthMiddleware, function(req, res, next) {
  const testKodu = req.query.kod;
  
  if (!testKodu) {
    return res.json({ bulundu: false });
  }
  
  const db = require('../database');
  db.query(
    'SELECT test_kodu, test_adi FROM test_havuzu WHERE UPPER(test_kodu) = ?',
    [testKodu.toUpperCase()],
    (err, results) => {
      if (err) {
        console.error('Test havuz kontrol hatası:', err);
        return res.json({ bulundu: false });
      }
      
      if (results.length > 0) {
        res.json({ 
          bulundu: true, 
          testAdi: results[0].test_adi
        });
      } else {
        res.json({ bulundu: false });
      }
    }
  );
});

// Test oluşturma işlemi
router.post('/admin/test-olustur', adminAuthMiddleware, function(req, res, next) {
  const { test_kodu, test_adi, soru_sayisi } = req.body;
  
  // Test kodunu büyük harfe çevir ve temizle
  const temizTestKodu = test_kodu.trim().toUpperCase();
  
  // Önce test kodunun benzersiz olduğunu kontrol et
  const db = require('../database');
  db.query(
    'SELECT id FROM test_havuzu WHERE UPPER(test_kodu) = ?',
    [temizTestKodu],
    (err, results) => {
      if (err) {
        return res.render('admin-test-olustur', {
          admin: req.session.admin,
          hata: 'Kontrol hatası: ' + err.message,
          basari: null
        });
      }
      
      // Eğer kod zaten varsa hata ver
      if (results.length > 0) {
        return res.render('admin-test-olustur', {
          admin: req.session.admin,
          hata: 'Bu test kodu zaten kullanılıyor! Lütfen farklı bir kod girin.',
          basari: null
        });
      }
      
      // Cevapları ve videoları topla
      const cevaplar = {};
      const videolar = {};
      
      for (let i = 1; i <= 25; i++) {
        if (req.body['cevap_' + i]) {
          cevaplar['cevap_' + i] = req.body['cevap_' + i];
        }
        if (req.body['video_' + i]) {
          videolar['video_' + i] = req.body['video_' + i];
        }
      }
      
      // Temizlenmiş kodu kullan
      Test.testOlustur(temizTestKodu, test_adi, soru_sayisi, cevaplar, videolar, (err, testId) => {
        if (err) {
          // Hata logla
          const clientInfo = logger.getClientIPInfo(req);
          logger.logAdminAction(
            'test_create_failed',
            req.session.admin.id,
            `Test oluşturma başarısız - Kod: ${temizTestKodu}, Hata: ${err.message}`,
            clientInfo.ip,
            clientInfo.port,
            logger.getUserAgent(req)
          ).catch(console.error);
          
          return res.render('admin-test-olustur', {
            admin: req.session.admin,
            hata: 'Test oluşturulamadı: ' + err.message,
            basari: null
          });
        }
        
        // Başarı logla
        const clientInfo = logger.getClientIPInfo(req);
        logger.logAdminAction(
          'test_create',
          req.session.admin.id,
          `Yeni test oluşturuldu - Kod: ${temizTestKodu}, Ad: ${test_adi}, Soru Sayısı: ${soru_sayisi}`,
          clientInfo.ip,
          clientInfo.port,
          logger.getUserAgent(req)
        ).catch(console.error);
        
        res.render('admin-test-olustur', {
          admin: req.session.admin,
          hata: null,
          basari: 'Test başarıyla oluşturuldu!'
        });
      });
    }
  );
});

// Test atama sayfası
router.get('/admin/test-ata', adminAuthMiddleware, function(req, res, next) {
  // Tüm öğrencileri ve testleri getir
  Ogrenci.tumunuGetir((err, ogrenciler) => {
    if (err) return next(err);
    
    Test.tumTestleriGetir((err, testler) => {
      if (err) return next(err);
      
      res.render('admin-test-ata', {
        admin: req.session.admin,
        ogrenciler: ogrenciler,
        testler: testler,
        hata: null,
        basari: null
      });
    });
  });
});

// Test atama işlemi
router.post('/admin/test-ata', adminAuthMiddleware, function(req, res, next) {
  const { ogrenci_numara, test_kodu, ozel_test_adi } = req.body;
  
  // Özel test adı varsa trim yap, boşsa null gönder
  const ozelAd = ozel_test_adi && ozel_test_adi.trim() ? ozel_test_adi.trim() : null;
  
  Test.testAtaKodlarla(ogrenci_numara, test_kodu, ozelAd, (err) => {
    if (err) {
      // Hata logla
      const clientInfo = logger.getClientIPInfo(req);
      logger.logAdminAction(
        'test_assign_failed',
        req.session.admin.id,
        `Test atama başarısız - Öğrenci: ${ogrenci_numara}, Test: ${test_kodu}, Hata: ${err.message}`,
        clientInfo.ip,
        clientInfo.port,
        logger.getUserAgent(req)
      ).catch(console.error);
      
      return Ogrenci.tumunuGetir((err2, ogrenciler) => {
        Test.tumTestleriGetir((err3, testler) => {
          res.render('admin-test-ata', {
            admin: req.session.admin,
            ogrenciler: ogrenciler || [],
            testler: testler || [],
            hata: err.message,
            basari: null
          });
        });
      });
    }
    
    // Başarı logla
    const clientInfo = logger.getClientIPInfo(req);
    logger.logAdminAction(
      'test_assign',
      req.session.admin.id,
      `Test atandı - Öğrenci: ${ogrenci_numara}, Test: ${test_kodu.toUpperCase()}${ozelAd ? `, Özel Ad: "${ozelAd}"` : ''}`,
      clientInfo.ip,
      clientInfo.port,
      logger.getUserAgent(req)
    ).catch(console.error);
    
    // Başarılı atama mesajı
    const basariMesaji = ozelAd 
      ? `Test başarıyla atandı! Öğrenci: ${ogrenci_numara} | Test: ${test_kodu.toUpperCase()} | Özel Ad: "${ozelAd}"`
      : `Test başarıyla atandı! Öğrenci: ${ogrenci_numara} | Test: ${test_kodu.toUpperCase()}`;
    
    Ogrenci.tumunuGetir((err2, ogrenciler) => {
      Test.tumTestleriGetir((err3, testler) => {
        res.render('admin-test-ata', {
          admin: req.session.admin,
          ogrenciler: ogrenciler || [],
          testler: testler || [],
          hata: null,
          basari: basariMesaji
        });
      });
    });
  });
});

// İstatistikler sayfası
router.get('/admin/istatistikler', adminAuthMiddleware, function(req, res, next) {
  // İstatistikler sayfası erişim logla
  req.systemLogger.logAdminAction('statistics_viewed', req.session.admin.id, req).catch(console.error);
  
  Admin.ogrenciIstatistikleri((err, ogrenciStats) => {
    if (err) return next(err);
    
    Admin.testIstatistikleri((err, testStats) => {
      if (err) return next(err);
      
      Admin.genelIstatistikler((err, genelStats) => {
        if (err) return next(err);
        
        res.render('admin-istatistikler', {
          admin: req.session.admin,
          ogrenciStats: ogrenciStats,
          testStats: testStats,
          genelStats: genelStats
        });
      });
    });
  });
});

// İşlem kayıtları (Logs) sayfası
router.get('/admin/islem-kayitlari', adminAuthMiddleware, function(req, res, next) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  
  const userType = req.query.user_type || '';
  const actionCategory = req.query.action_category || '';
  const dateFrom = req.query.date_from || '';
  const dateTo = req.query.date_to || '';
  const searchTerm = req.query.search || '';
  
  // Log görüntüleme işlemini logla
  req.systemLogger.logAdminAction('logs_viewed', req.session.admin.id, req, null, null, {
    filters: { userType, actionCategory, dateFrom, dateTo, searchTerm },
    page, limit
  }).catch(console.error);
  
  let whereConditions = [];
  let queryParams = [];
  
  if (userType) {
    whereConditions.push('user_type = ?');
    queryParams.push(userType);
  }
  
  if (actionCategory) {
    whereConditions.push('action_category = ?');
    queryParams.push(actionCategory);
  }
  
  if (dateFrom) {
    whereConditions.push('created_at >= ?');
    queryParams.push(dateFrom + ' 00:00:00');
  }
  
  if (dateTo) {
    whereConditions.push('created_at <= ?');
    queryParams.push(dateTo + ' 23:59:59');
  }
  
  if (searchTerm) {
    whereConditions.push('(action_description LIKE ? OR ip_address LIKE ? OR url LIKE ?)');
    queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
  }
  
  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  
  const db = require('../database');
  
  // Toplam kayıt sayısını al
  const countQuery = `SELECT COUNT(*) as total FROM logs ${whereClause}`;
  db.query(countQuery, queryParams, (err, countResults) => {
    if (err) return next(err);
    
    const totalRecords = countResults[0].total;
    const totalPages = Math.ceil(totalRecords / limit);
    
    // Logs kayıtlarını al
    const logsQuery = `
      SELECT 
        l.*,
        o.ad as ogrenci_ad, o.soyad as ogrenci_soyad, o.numara as ogrenci_numara,
        a.ad as admin_ad, a.soyad as admin_soyad, a.kullanici_adi as admin_kullanici
      FROM logs l
      LEFT JOIN ogrenciler o ON l.user_id = o.id AND l.user_type = 'student'
      LEFT JOIN adminler a ON l.user_id = a.id AND l.user_type = 'admin'
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    queryParams.push(limit, offset);
    
    db.query(logsQuery, queryParams, (err, logs) => {
      if (err) return next(err);
      
      res.render('admin-islem-kayitlari', {
        admin: req.session.admin,
        logs: logs,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalRecords: totalRecords,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          limit: limit
        },
        filters: {
          userType,
          actionCategory,
          dateFrom,
          dateTo,
          searchTerm
        }
      });
    });
  });
});

// Öğrenci detay sayfası
router.get('/admin/ogrenci/:id', adminAuthMiddleware, function(req, res, next) {
  const ogrenciId = req.params.id;
  const db = require('../database');
  
  // Öğrenci bilgilerini al
  db.query(
    'SELECT * FROM ogrenciler WHERE id = ?',
    [ogrenciId],
    (err, ogrenciResults) => {
      if (err) return next(err);
      if (ogrenciResults.length === 0) {
        return res.render('error', {
          message: 'Öğrenci bulunamadı',
          error: { status: 404, stack: '' }
        });
      }
      
      const ogrenci = ogrenciResults[0];
      
      // Öğrencinin test istatistiklerini al
      db.query(
        `SELECT 
          ot.*,
          th.test_kodu,
          th.test_adi,
          th.soru_sayisi,
          COALESCE(ot.ozel_test_adi, th.test_adi) as gorunen_test_adi,
          CASE 
            WHEN ot.tamamlanma_tarihi IS NOT NULL AND ot.atanma_tarihi IS NOT NULL 
            THEN TIMESTAMPDIFF(MINUTE, ot.atanma_tarihi, ot.tamamlanma_tarihi)
            ELSE NULL
          END as sure_dakika
        FROM ogrenci_testleri ot
        JOIN test_havuzu th ON ot.test_id = th.id
        WHERE ot.ogrenci_id = ?
        ORDER BY ot.atanma_tarihi DESC`,
        [ogrenciId],
        (err, testResults) => {
          if (err) return next(err);
          
          // Genel istatistikler hesapla
              if (err) return next(err);
              
              // Genel istatistikler hesapla
          const toplamTest = testResults.length;
          const tamamlanan = testResults.filter(t => t.durum === 'tamamlandi').length;
          const devamEden = testResults.filter(t => t.durum === 'devam_ediyor').length;
          const bekleyen = testResults.filter(t => t.durum === 'beklemede').length;
          
          const tamamlananTestler = testResults.filter(t => t.durum === 'tamamlandi' && t.puan !== null);
          const ortalamaPuan = tamamlananTestler.length > 0
            ? tamamlananTestler.reduce((sum, t) => sum + parseFloat(t.puan || 0), 0) / tamamlananTestler.length
            : 0;
          
          const toplamDogru = tamamlananTestler.reduce((sum, t) => sum + (t.dogru_sayisi || 0), 0);
          const toplamYanlis = tamamlananTestler.reduce((sum, t) => sum + (t.yanlis_sayisi || 0), 0);
          const toplamBos = tamamlananTestler.reduce((sum, t) => sum + (t.bos_sayisi || 0), 0);
          
          // Yeni detaylı istatistikler
          const enYuksekPuan = tamamlananTestler.length > 0 
            ? Math.max(...tamamlananTestler.map(t => parseFloat(t.puan || 0)))
            : 0;
          
          const toplamSoru = testResults.reduce((sum, t) => sum + (t.soru_sayisi || 0), 0);
          
          const basariOrani = toplamTest > 0 ? ((tamamlanan / toplamTest) * 100).toFixed(1) : 0;
          
          const toplananSoru = toplamDogru + toplamYanlis + toplamBos;
          const dogruOrani = toplananSoru > 0 ? ((toplamDogru / toplananSoru) * 100).toFixed(1) : 0;
          
          const surelerinOrt = tamamlananTestler.filter(t => t.sure_dakika).length > 0
            ? (tamamlananTestler.filter(t => t.sure_dakika).reduce((sum, t) => sum + (t.sure_dakika || 0), 0) / tamamlananTestler.filter(t => t.sure_dakika).length).toFixed(0)
            : null;
          
          // Başarı seviyesi belirleme
          let basariSeviyesi = 'Başlangıç';
          if (ortalamaPuan >= 90) basariSeviyesi = 'Mükemmel';
          else if (ortalamaPuan >= 80) basariSeviyesi = 'Çok İyi';
          else if (ortalamaPuan >= 70) basariSeviyesi = 'İyi';
          else if (ortalamaPuan >= 60) basariSeviyesi = 'Orta';
          else if (ortalamaPuan >= 50) basariSeviyesi = 'Geçer';
          else if (ortalamaPuan > 0) basariSeviyesi = 'Gelişmeli';
          
          res.render('admin-ogrenci-detay', {
            admin: req.session.admin,
            ogrenci: ogrenci,
            testSonuclari: testResults,
            istatistikler: {
              toplamTest,
              tamamlanan,
              devamEden,
              bekleyen,
              ortalamaPuan: ortalamaPuan.toFixed(2),
              toplamDogru,
              toplamYanlis,
              toplamBos,
              enYuksekPuan: enYuksekPuan.toFixed(2),
              toplamSoru,
              basariOrani,
              dogruOrani,
              ortalamaSure: surelerinOrt,
              basariSeviyesi
            }
          });
        }
      );
    }
  );
});

// Test cevaplarını getir (Admin için)
router.get('/admin/test-cevaplari/:testId', adminAuthMiddleware, function(req, res, next) {
  const testId = req.params.testId;
  const db = require('../database');
  
  // Test bilgilerini ve öğrencinin cevaplarını al
  db.query(
    `SELECT 
      ot.*,
      th.test_kodu,
      th.test_adi,
      th.soru_sayisi,
      th.cevap_1, th.cevap_2, th.cevap_3, th.cevap_4, th.cevap_5,
      th.cevap_6, th.cevap_7, th.cevap_8, th.cevap_9, th.cevap_10,
      th.cevap_11, th.cevap_12, th.cevap_13, th.cevap_14, th.cevap_15,
      th.cevap_16, th.cevap_17, th.cevap_18, th.cevap_19, th.cevap_20,
      th.cevap_21, th.cevap_22, th.cevap_23, th.cevap_24, th.cevap_25,
      o.ad,
      o.soyad,
      o.numara
    FROM ogrenci_testleri ot
    JOIN test_havuzu th ON ot.test_id = th.id
    JOIN ogrenciler o ON ot.ogrenci_id = o.id
    WHERE ot.id = ? AND ot.durum = 'tamamlandi'`,
    [testId],
    (err, results) => {
      if (err) {
        console.error('Test cevapları sorgu hatası:', err);
        return res.json({ success: false, message: 'Veritabanı hatası.' });
      }
      
      if (results.length === 0) {
        return res.json({ success: false, message: 'Test bulunamadı veya tamamlanmamış.' });
      }
      
      const testData = results[0];
      
      // Öğrencinin cevaplarını al
      db.query(
        'SELECT soru_no, cevap as secilen_cevap FROM ogrenci_cevaplari WHERE ogrenci_id = ? AND test_id = ? ORDER BY soru_no',
        [testData.ogrenci_id, testData.test_id],
        (err, cevapResults) => {
          if (err) {
            console.error('Cevaplar sorgu hatası:', err);
            return res.json({ success: false, message: 'Cevaplar getirilemedi.' });
          }
          
          // Öğrenci cevaplarını obje formatına çevir
          const ogrenciCevaplari = {};
          cevapResults.forEach(cevap => {
            ogrenciCevaplari[cevap.soru_no] = cevap.secilen_cevap;
          });
          
          // Cevap anahtarını test havuzundan oluştur
          const cevapAnahtari = {};
          for (let i = 1; i <= testData.soru_sayisi; i++) {
            const cevapKolonu = `cevap_${i}`;
            if (testData[cevapKolonu]) {
              cevapAnahtari[i] = testData[cevapKolonu];
            }
          }
          
          // Video izleme bilgilerini al
          db.query(
            `SELECT soru_no, izleme_sayisi, toplam_izleme_suresi, son_izleme_tarihi
             FROM video_izleme 
             WHERE ogrenci_id = ? AND test_id = ?`,
            [testData.ogrenci_id, testData.test_id],
            (err, videoResults) => {
              if (err) {
                console.error('Video istatistikleri hatası:', err);
              }
              
              const videoIstatistikleri = {};
              if (videoResults) {
                videoResults.forEach(video => {
                  videoIstatistikleri[video.soru_no] = {
                    izlenmeSayisi: video.izleme_sayisi,
                    toplamSure: video.toplam_izleme_suresi,
                    sonIzleme: video.son_izleme_tarihi
                  };
                });
              }
              
              res.json({
                success: true,
                cevaplar: ogrenciCevaplari,
                cevapAnahtari: cevapAnahtari,
                videoIstatistikleri: videoIstatistikleri,
                testBilgisi: {
                  testAdi: testData.test_adi,
                  testKodu: testData.test_kodu,
                  soruSayisi: testData.soru_sayisi,
                  puan: testData.puan ? parseFloat(testData.puan).toFixed(2) : '0.00',
                  dogru: testData.dogru_sayisi || 0,
                  yanlis: testData.yanlis_sayisi || 0,
                  bos: testData.bos_sayisi || 0,
                  ogrenci: {
                    ad: testData.ad,
                    soyad: testData.soyad,
                    numara: testData.numara
                  }
                }
              });
            }
          );
        }
      );
    }
  );
});

// Öğrenci arama (numara ile)
router.post('/admin/ogrenci-ara', adminAuthMiddleware, function(req, res, next) {
  const { numara } = req.body;
  const db = require('../database');
  
  if (!numara) {
    return res.json({ success: false, message: 'Öğrenci numarası gerekli.' });
  }
  
  db.query(
    'SELECT id, numara, ad, soyad FROM ogrenciler WHERE numara = ?',
    [numara],
    (err, results) => {
      if (err) {
        console.error('Öğrenci arama hatası:', err);
        return res.json({ success: false, message: 'Veritabanı hatası.' });
      }
      
      if (results.length === 0) {
        return res.json({ success: false, message: `${numara} numaralı öğrenci bulunamadı.` });
      }
      
      res.json({ 
        success: true, 
        message: 'Öğrenci bulundu.',
        ogrenci: results[0]
      });
    }
  );
});

// Tamamlanmış testlerin sonuçlarını yeniden hesapla (Admin için)
router.post('/admin/test-sonuclarini-guncelle', adminAuthMiddleware, function(req, res, next) {
  const db = require('../database');
  
  // Tamamlanmış ama puan bilgisi olmayan testleri bul
  db.query(
    `SELECT ot.ogrenci_id, ot.test_id, o.ad, o.soyad, o.numara, th.test_kodu, th.test_adi
     FROM ogrenci_testleri ot
     JOIN ogrenciler o ON ot.ogrenci_id = o.id
     JOIN test_havuzu th ON ot.test_id = th.id
     WHERE ot.durum = 'tamamlandi' AND (ot.puan IS NULL OR ot.dogru_sayisi IS NULL)`,
    (err, testler) => {
      if (err) {
        return res.json({ success: false, message: 'Sorgu hatası: ' + err.message });
      }
      
      if (testler.length === 0) {
        return res.json({ success: true, message: 'Güncellenecek test bulunamadı.', guncellenen: 0 });
      }
      
      let tamamlanan = 0;
      let hatalar = [];
      
      testler.forEach((test, index) => {
        Test.testSonucuHesapla(test.ogrenci_id, test.test_id, (err, sonuc) => {
          if (err) {
            hatalar.push(`${test.numara} - ${test.test_kodu}: ${err.message}`);
          } else {
            // Sonuçları güncelle
            db.query(
              `UPDATE ogrenci_testleri 
               SET puan = ?, dogru_sayisi = ?, yanlis_sayisi = ?, bos_sayisi = ?
               WHERE ogrenci_id = ? AND test_id = ?`,
              [sonuc.puan, sonuc.dogru, sonuc.yanlis, sonuc.bos, test.ogrenci_id, test.test_id],
              (err) => {
                if (err) {
                  hatalar.push(`${test.numara} - ${test.test_kodu}: Güncelleme hatası`);
                }
                tamamlanan++;
                
                // Son test işlendiyse sonucu döndür
                if (tamamlanan === testler.length) {
                  // İşlem tamamlandı, log kaydet
                  const clientInfo = logger.getClientIPInfo(req);
                  logger.logAdminAction(
                    'test_results_updated',
                    req.session.admin.id,
                    `Test sonuçları güncellendi - Toplam: ${testler.length}, Başarılı: ${testler.length - hatalar.length}, Hatalı: ${hatalar.length}`,
                    clientInfo.ip,
                    clientInfo.port,
                    logger.getUserAgent(req)
                  ).catch(console.error);
                  
                  res.json({
                    success: true,
                    message: `${testler.length - hatalar.length} test sonucu güncellendi.`,
                    guncellenen: testler.length - hatalar.length,
                    hatalar: hatalar
                  });
                }
              }
            );
          }
        });
      });
    }
  );
});

// ==================== K12NET SSO ENDPOINTS ====================

// SSO Login - Kullanıcıyı K12NET login sayfasına yönlendir
router.get('/sso/login', function(req, res, next) {
  // K12NET SSO giriş denemesi logla
  req.systemLogger.log({
    userType: 'system',
    actionType: 'k12net_login_initiated',
    actionCategory: 'auth',
    actionDescription: 'K12NET SSO giriş işlemi başlatıldı',
    ipAddress: req.systemLogger.getClientIP(req),
    userAgent: logger.getUserAgent(req),
    method: req.method,
    url: req.originalUrl
  }).catch(console.error);
  
  const authUrl = K12NetSSO.getAuthorizationUrl();
  res.redirect(authUrl);
});

// SSO Callback - K12NET'ten dönüş (Ana /sso endpoint'i)
router.get('/sso', async function(req, res, next) {
  const authorizationCode = req.query.code;
  const error = req.query.error;
  
  // K12NET callback logla
  req.systemLogger.log({
    userType: 'system',
    actionType: 'k12net_callback_received',
    actionCategory: 'auth',
    actionDescription: 'K12NET SSO callback alındı',
    ipAddress: req.systemLogger.getClientIP(req),
    userAgent: logger.getUserAgent(req),
    method: req.method,
    url: req.originalUrl,
    requestData: { hasCode: !!authorizationCode, hasError: !!error }
  }).catch(console.error);
  
  // Hata varsa
  if (error) {
    console.error('SSO Authorization hatası:', error);
    
    // K12NET hata logla
    req.systemLogger.log({
      userType: 'system',
      actionType: 'k12net_auth_failed',
      actionCategory: 'auth',
      actionDescription: 'K12NET SSO authorization hatası',
      ipAddress: req.systemLogger.getClientIP(req),
      errorMessage: error,
      additionalData: { errorCode: error }
    }).catch(console.error);
    
    return res.render('error', {
      message: 'SSO girişinde hata oluştu',
      error: { status: 401, stack: error }
    });
  }
  
  // Authorization code yoksa
  if (!authorizationCode) {
    return res.render('error', {
      message: 'Authorization code bulunamadı',
      error: { status: 400, stack: 'No authorization code received' }
    });
  }
  
  try {
    // 1. Authorization code ile access token al
    const tokenResult = await K12NetSSO.exchangeCodeForToken(authorizationCode);
    
    console.log('\n=== TOKEN RESPONSE ===');
    console.log(JSON.stringify(tokenResult, null, 2));
    
    if (!tokenResult.success) {
      throw new Error('Token alınamadı: ' + JSON.stringify(tokenResult.error));
    }
    
    const accessToken = tokenResult.data.access_token;
    
    // 2. Access token ile kullanıcı bilgilerini al
    const userInfoResult = await K12NetSSO.getUserInfo(accessToken);
    
    console.log('\n=== USER INFO RESPONSE ===');
    console.log(JSON.stringify(userInfoResult, null, 2));
    
    if (!userInfoResult.success) {
      throw new Error('Kullanıcı bilgisi alınamadı: ' + JSON.stringify(userInfoResult.error));
    }
    
    const userInfo = userInfoResult.data;
    
    // 3. Kullanıcı profili kontrolü - Sadece Student kabul ediyoruz
    if (userInfo.profile !== 'Student') {
      return res.render('error', {
        message: 'Yetkilendirme Hatası',
        error: { 
          status: 403, 
          stack: 'Bu sistem sadece öğrenciler içindir. Profil türünüz: ' + userInfo.profile 
        }
      });
    }
    
    // 4. API access token al (ek bilgiler için)
    const apiTokenResult = await K12NetSSO.getApiAccessToken();
    
    console.log('\n=== API TOKEN RESPONSE ===');
    console.log(JSON.stringify(apiTokenResult, null, 2));
    
    if (!apiTokenResult.success) {
      console.error('API token alınamadı:', apiTokenResult.error);
      // API token alınamazsa devam et, sadece temel bilgilerle giriş yap
    }
    
    const apiAccessToken = apiTokenResult.accessToken;
    
    // 5. Öğrenci detay bilgilerini al
    let studentDetails = null;
    let studentDemographics = null;
    
    if (apiAccessToken) {
      const studentInfoResult = await K12NetSSO.getStudentInfo(userInfo.ID, apiAccessToken);
      console.log('\n=== STUDENT INFO RESPONSE ===');
      console.log(JSON.stringify(studentInfoResult, null, 2));
      
      if (studentInfoResult.success) {
        studentDetails = studentInfoResult.data;
      }
      
      const demographicsResult = await K12NetSSO.getStudentDemographics(userInfo.ID, apiAccessToken);
      console.log('\n=== STUDENT DEMOGRAPHICS RESPONSE ===');
      console.log(JSON.stringify(demographicsResult, null, 2));
      
      if (demographicsResult.success) {
        studentDemographics = demographicsResult.data;
      }
    }
    
    // 6. Öğrenciyi veritabanında bul veya oluştur
    const db = require('../database');
    const k12netId = userInfo.ID;
    const studentNumber = userInfo.sub; // K12NET'ten gelen öğrenci numarası
    
    console.log('\n=== DATABASE SEARCH ===');
    console.log('K12NET ID:', k12netId);
    console.log('Student Number:', studentNumber);
    
    // Veritabanında K12NET ID ile öğrenci ara
    db.query(
      'SELECT * FROM ogrenciler WHERE k12net_id = ?',
      [k12netId],
      (err, results) => {
        if (err) {
          console.error('Veritabanı hatası:', err);
          return res.render('error', {
            message: 'Veritabanı hatası',
            error: { status: 500, stack: err.message }
          });
        }
        
        if (results.length > 0) {
          // Öğrenci zaten var, session'a al ve yönlendir
          const ogrenci = results[0];
          req.session.ogrenci = {
            id: ogrenci.id,
            numara: ogrenci.numara,
            ad: ogrenci.ad,
            soyad: ogrenci.soyad,
            k12net_id: ogrenci.k12net_id
          };
          
          // K12NET başarılı giriş logla
          req.systemLogger.logStudentAuth('k12net_auth', ogrenci.id, req, {
            k12netId: k12netId,
            studentNumber: studentNumber,
            studentName: `${ogrenci.ad} ${ogrenci.soyad}`,
            existingUser: true
          }).catch(console.error);
          
          return res.redirect('/');
        } else {
          // Yeni öğrenci, kaydet
          // fullName'den ad ve soyad ayır
          let ad = 'K12NET';
          let soyad = 'Öğrenci';
          
          if (studentDetails?.fullName) {
            const nameParts = studentDetails.fullName.trim().split(' ');
            if (nameParts.length >= 2) {
              ad = nameParts[0];
              soyad = nameParts.slice(1).join(' ');
            } else if (nameParts.length === 1) {
              ad = nameParts[0];
              soyad = '';
            }
          }
          
          // Öğrenci numarası enrollment.localId'den al
          let ogrenciNumarasi = null;
          
          if (studentDetails?.enrollment?.localId) {
            ogrenciNumarasi = studentDetails.enrollment.localId;
            
            console.log('\n=== CHECKING EXISTING STUDENT BY localId ===');
            console.log('Local ID:', ogrenciNumarasi);
            
            // Bu numara ile kayıtlı öğrenci var mı kontrol et
            db.query(
              'SELECT * FROM ogrenciler WHERE numara = ?',
              [ogrenciNumarasi],
              (err, existingStudents) => {
                if (err) {
                  console.error('Numara kontrolü hatası:', err);
                  ogrenciNumarasi = 'K12-' + Date.now();
                  kayitYap();
                } else if (existingStudents.length > 0) {
                  // Bu numara ile kayıtlı öğrenci var, k12net_id güncelle
                  console.log('Bu numara ile kayıtlı öğrenci bulundu, K12NET ID güncelleniyor...');
                  
                  db.query(
                    'UPDATE ogrenciler SET k12net_id = ?, ad = ?, soyad = ? WHERE numara = ?',
                    [k12netId, ad, soyad, ogrenciNumarasi],
                    (err) => {
                      if (err) {
                        console.error('Öğrenci güncelleme hatası:', err);
                        return res.render('error', {
                          message: 'Öğrenci güncellenemedi',
                          error: { status: 500, stack: err.message }
                        });
                      }
                      
                      // Güncellenen öğrenciyi session'a al
                      req.session.ogrenci = {
                        id: existingStudents[0].id,
                        numara: ogrenciNumarasi,
                        ad: ad,
                        soyad: soyad,
                        k12net_id: k12netId
                      };
                      
                      return res.redirect('/');
                    }
                  );
                } else {
                  // Bu numara ile öğrenci yok, yeni kayıt oluştur
                  kayitYap();
                }
              }
            );
          } else {
            // localId yoksa random numara oluştur
            ogrenciNumarasi = 'K12-' + Date.now();
            kayitYap();
          }
          
          function kayitYap() {
            // Şifre K12NET ID'den MD5 hash oluştur
            const crypto = require('crypto');
            const sifre = crypto.createHash('md5').update(k12netId).digest('hex');
            
            console.log('\n=== CREATING NEW STUDENT ===');
            console.log('Numara:', ogrenciNumarasi);
            console.log('Ad:', ad);
            console.log('Soyad:', soyad);
            console.log('K12NET ID:', k12netId);
            
            db.query(
              'INSERT INTO ogrenciler (numara, ad, soyad, sifre, k12net_id) VALUES (?, ?, ?, ?, ?)',
              [ogrenciNumarasi, ad, soyad, sifre, k12netId],
              (err, result) => {
                if (err) {
                  console.error('Öğrenci kayıt hatası:', err);
                  return res.render('error', {
                    message: 'Öğrenci kaydedilemedi',
                    error: { status: 500, stack: err.message }
                  });
                }
                
                // Yeni oluşturulan öğrenciyi session'a al
                req.session.ogrenci = {
                  id: result.insertId,
                  numara: ogrenciNumarasi,
                  ad: ad,
                  soyad: soyad,
                  k12net_id: k12netId
                };
                
                // Yeni K12NET öğrenci kaydı logla
                req.systemLogger.logStudentAuth('k12net_auth', result.insertId, req, {
                  k12netId: k12netId,
                  studentNumber: ogrenciNumarasi,
                  studentName: `${ad} ${soyad}`,
                  existingUser: false,
                  newRegistration: true
                }).catch(console.error);
                
                return res.redirect('/');
              }
            );
          }
        }
      }
    );

    
  } catch (error) {
    console.error('SSO Callback hatası:', error);
    
    // K12NET genel hata logla
    req.systemLogger.log({
      userType: 'system',
      actionType: 'k12net_callback_error',
      actionCategory: 'error',
      actionDescription: 'K12NET SSO callback sırasında hata oluştu',
      ipAddress: req.systemLogger.getClientIP(req),
      errorMessage: error.message,
      additionalData: { errorStack: error.stack }
    }).catch(console.error);
    
    res.render('error', {
      message: 'SSO işlemi sırasında hata oluştu',
      error: { status: 500, stack: error.message }
    });
  }
});

// SSO ile giriş yapmış öğrenci bilgilerini göster (test/debug için)
router.get('/sso/profile', authMiddleware, async function(req, res, next) {
  const ogrenci = req.session.ogrenci;
  
  if (!ogrenci.k12net_id) {
    return res.json({
      message: 'Bu öğrenci K12NET SSO ile giriş yapmamış',
      ogrenci: ogrenci
    });
  }
  
  try {
    // API access token al
    const apiTokenResult = await K12NetSSO.getApiAccessToken();
    
    if (!apiTokenResult.success) {
      throw new Error('API token alınamadı');
    }
    
    const apiAccessToken = apiTokenResult.accessToken;
    
    // Öğrenci bilgilerini al
    const studentInfo = await K12NetSSO.getStudentInfo(ogrenci.k12net_id, apiAccessToken);
    const demographics = await K12NetSSO.getStudentDemographics(ogrenci.k12net_id, apiAccessToken);
    const enrollments = await K12NetSSO.getStudentEnrollments(ogrenci.k12net_id, apiAccessToken);
    
    res.json({
      message: 'K12NET SSO Profil Bilgileri',
      session: ogrenci,
      k12net: {
        studentInfo: studentInfo.success ? studentInfo.data : null,
        demographics: demographics.success ? demographics.data : null,
        enrollments: enrollments.success ? enrollments.data : null
      }
    });
    
  } catch (error) {
    res.json({
      message: 'K12NET bilgileri alınırken hata oluştu',
      error: error.message,
      ogrenci: ogrenci
    });
  }
});

// Video izleme sayıları API
router.get('/api/video-izleme-sayilari', authMiddleware, async function(req, res) {
  try {
    const { test_id } = req.query;
    
    if (!test_id) {
      return res.json({ success: false, message: 'Test ID gerekli' });
    }

    const db = req.app.get('db');
    
    // Bu test için video izleme sayılarını getir
    const query = `
      SELECT 
        vi.soru_no,
        COUNT(DISTINCT vi.id) as izleme_sayisi,
        SUM(CASE WHEN vid.tam_izlendi = 1 THEN 1 ELSE 0 END) as tam_izleme_sayisi
      FROM video_izleme vi
      LEFT JOIN video_izleme_detay vid ON vi.id = vid.video_izleme_id
      WHERE vi.test_id = ? AND vi.ogrenci_id = ?
      GROUP BY vi.soru_no
      ORDER BY vi.soru_no
    `;
    
    const sayilar = await db.query(query, [test_id, req.session.ogrenci.id]);
    
    res.json({
      success: true,
      sayilar: sayilar
    });
    
  } catch (error) {
    console.error('Video izleme sayıları alma hatası:', error);
    res.json({
      success: false,
      message: 'Video izleme sayıları alınamadı'
    });
  }
});

// Öğrenci detay sayfası
router.get('/admin/ogrenci-detay/:id', adminAuthMiddleware, function(req, res, next) {
  const ogrenciId = req.params.id;
  const db = require('../database');
  
  // Öğrenci bilgilerini al
  db.query(
    'SELECT * FROM ogrenciler WHERE id = ?',
    [ogrenciId],
    (err, ogrenciResults) => {
      if (err || ogrenciResults.length === 0) {
        console.error('Öğrenci bulunamadı:', err);
        return res.redirect('/admin/ogrenci-yonetimi?hata=' + encodeURIComponent('Öğrenci bulunamadı'));
      }
      
      const ogrenci = ogrenciResults[0];
      
      // Öğrencinin test sonuçlarını al
      db.query(`
        SELECT ts.*, th.test_adi, th.test_kodu, th.soru_sayisi,
               DATE_FORMAT(ts.tamamlanma_tarihi, '%d.%m.%Y %H:%i') as formatli_tarih
        FROM test_sonuclari ts
        JOIN test_havuzu th ON ts.test_id = th.id
        WHERE ts.ogrenci_id = ?
        ORDER BY ts.tamamlanma_tarihi DESC
      `, [ogrenciId], (err, testResults) => {
        if (err) {
          console.error('Test sonuçları alınamadı:', err);
          testResults = [];
        }
        
        // İstatistikleri hesapla
        const istatistikler = {
          toplamTest: testResults.length,
          tamamlananTest: testResults.filter(t => t.puan !== null).length,
          ortalamaPuan: testResults.length > 0 ? 
            Math.round(testResults.reduce((sum, t) => sum + (t.puan || 0), 0) / testResults.length) : 0,
          enYuksekPuan: testResults.length > 0 ? 
            Math.max(...testResults.map(t => t.puan || 0)) : 0
        };
        
        res.render('admin-ogrenci-detay', {
          admin: req.session.admin,
          ogrenci: ogrenci,
          testSonuclari: testResults,
          istatistikler: istatistikler,
          hata: req.query.hata || null,
          basari: req.query.basari || null
        });
      });
    }
  );
});

// Test düzenleme sayfası
router.get('/admin/test-duzenle', adminAuthMiddleware, function(req, res, next) {
  res.render('admin-test-duzenle', {
    admin: req.session.admin,
    test: null,
    hata: req.query.hata || null,
    basari: req.query.basari || null
  });
});

// Test kodu ile test getirme (AJAX)
router.get('/admin/test-getir', adminAuthMiddleware, function(req, res, next) {
  const testKodu = req.query.kod;
  
  if (!testKodu) {
    return res.json({ success: false, message: 'Test kodu gereklidir!' });
  }
  
  const db = require('../database');
  db.query(
    'SELECT * FROM test_havuzu WHERE UPPER(test_kodu) = ?',
    [testKodu.toUpperCase()],
    (err, results) => {
      if (err) {
        console.error('Test getirme hatası:', err);
        return res.json({ success: false, message: 'Veritabanı hatası!' });
      }
      
      if (results.length === 0) {
        return res.json({ success: false, message: 'Test bulunamadı!' });
      }
      
      res.json({ success: true, test: results[0] });
    }
  );
});

// Test güncelleme
router.post('/admin/test-guncelle', adminAuthMiddleware, function(req, res, next) {
  const { test_id, test_adi, soru_sayisi, ...cevaplarVeVideolar } = req.body;
  const db = require('../database');
  
  if (!test_id) {
    return res.redirect('/admin/test-duzenle?hata=' + encodeURIComponent('Test ID gereklidir!'));
  }
  
  // Cevapları ve videoları ayır
  const cevaplar = {};
  const videolar = {};
  
  Object.keys(cevaplarVeVideolar).forEach(key => {
    if (key.startsWith('cevap_')) {
      cevaplar[key] = cevaplarVeVideolar[key] || null;
    } else if (key.startsWith('video_')) {
      videolar[key] = cevaplarVeVideolar[key] || null;
    }
  });
  
  // Güncelleme sorgusu oluştur
  const updateFields = ['test_adi = ?', 'soru_sayisi = ?'];
  const updateValues = [test_adi, parseInt(soru_sayisi)];
  
  // Cevapları ekle
  for (let i = 1; i <= 25; i++) {
    const cevapKey = `cevap_${i}`;
    updateFields.push(`${cevapKey} = ?`);
    updateValues.push(cevaplar[cevapKey] || null);
  }
  
  // Videoları ekle
  for (let i = 1; i <= 25; i++) {
    const videoKey = `video_${i}`;
    updateFields.push(`${videoKey} = ?`);
    updateValues.push(videolar[videoKey] || null);
  }
  
  updateValues.push(test_id);
  
  const updateQuery = `UPDATE test_havuzu SET ${updateFields.join(', ')} WHERE id = ?`;
  
  db.query(updateQuery, updateValues, (err, result) => {
    if (err) {
      console.error('Test güncelleme hatası:', err);
      return res.redirect('/admin/test-duzenle?hata=' + encodeURIComponent('Test güncellenirken hata oluştu!'));
    }
    
    // Log kaydet
    req.systemLogger.log({
      userType: 'admin',
      userId: req.session.admin.id,
      actionType: 'test_update',
      actionCategory: 'test_management',
      actionDescription: `Test güncellendi - ID: ${test_id}, Test Adı: ${test_adi}`,
      ipAddress: req.systemLogger.getClientIP(req),
      userAgent: logger.getUserAgent(req),
      targetData: { test_id, test_adi, soru_sayisi }
    }).catch(console.error);
    
    res.redirect('/admin/test-duzenle?basari=' + encodeURIComponent('Test başarıyla güncellendi!'));
  });
});

// Test yeniden değerlendirme
router.post('/admin/test-yeniden-degerlendir/:testId', adminAuthMiddleware, function(req, res, next) {
  const testId = req.params.testId;
  const db = require('../database');
  
  // Önce test bilgilerini al
  db.query(
    'SELECT test_kodu, test_adi FROM test_havuzu WHERE id = ?',
    [testId],
    (err, testResults) => {
      if (err || testResults.length === 0) {
        return res.json({ success: false, message: 'Test bulunamadı!' });
      }
      
      const test = testResults[0];
      
      // Test sonuçlarını yeniden hesapla
      db.query(`
        SELECT ts.id, ts.ogrenci_id, ts.cevaplar, th.*,
               o.ad, o.soyad, o.numara
        FROM test_sonuclari ts
        JOIN test_havuzu th ON ts.test_id = th.id
        JOIN ogrenciler o ON ts.ogrenci_id = o.id
        WHERE ts.test_id = ?
      `, [testId], (err, results) => {
        if (err) {
          console.error('Test sonuçları getirme hatası:', err);
          return res.json({ success: false, message: 'Test sonuçları getirilemedi!' });
        }
        
        if (results.length === 0) {
          return res.json({ success: false, message: 'Bu teste ait sonuç bulunamadı!' });
        }
        
        let guncellenenSayisi = 0;
        let toplamSonuc = results.length;
        
        // Her test sonucunu yeniden değerlendir
        const processResult = (index) => {
          if (index >= results.length) {
            // Tüm işlemler tamamlandı
            req.systemLogger.log({
              userType: 'admin',
              userId: req.session.admin.id,
              actionType: 'test_reevaluate',
              actionCategory: 'test_management',
              actionDescription: `Test yeniden değerlendirildi - ${test.test_kodu} (${test.test_adi}) - ${guncellenenSayisi}/${toplamSonuc} sonuç güncellendi`,
              ipAddress: req.systemLogger.getClientIP(req),
              userAgent: logger.getUserAgent(req),
              targetData: { testId, test_kodu: test.test_kodu, guncellenenSayisi, toplamSonuc }
            }).catch(console.error);
            
            return res.json({ 
              success: true, 
              message: `${guncellenenSayisi}/${toplamSonuc} test sonucu yeniden değerlendirildi!`,
              guncellenenSayisi,
              toplamSonuc
            });
          }
          
          const sonuc = results[index];
          const ogrenciCevaplari = JSON.parse(sonuc.cevaplar || '{}');
          
          // Puanı yeniden hesapla
          let dogruSayisi = 0;
          let yanlisSayisi = 0;
          let bosSayisi = 0;
          
          for (let i = 1; i <= sonuc.soru_sayisi; i++) {
            const dogruCevap = sonuc[`cevap_${i}`];
            const ogrenciCevabi = ogrenciCevaplari[i];
            
            if (!ogrenciCevabi || ogrenciCevabi === '') {
              bosSayisi++;
            } else if (ogrenciCevabi.toUpperCase() === dogruCevap?.toUpperCase()) {
              dogruSayisi++;
            } else {
              yanlisSayisi++;
            }
          }
          
          const puan = Math.round((dogruSayisi / sonuc.soru_sayisi) * 100);
          
          // Sonucu güncelle
          db.query(`
            UPDATE test_sonuclari 
            SET dogru_sayisi = ?, yanlis_sayisi = ?, bos_sayisi = ?, puan = ?
            WHERE id = ?
          `, [dogruSayisi, yanlisSayisi, bosSayisi, puan, sonuc.id], (err, updateResult) => {
            if (!err) {
              guncellenenSayisi++;
            }
            processResult(index + 1);
          });
        };
        
        processResult(0);
      });
    }
  );
});

// ==================== TEST İMPORT ENDPOINTS ====================

// Test import sayfası
router.get('/admin/test-import', adminAuthMiddleware, function(req, res, next) {
  // Test import sayfası erişim logla
  const clientInfo = logger.getClientIPInfo(req);
  logger.logAdminAction(
    'test_import_page_accessed',
    req.session.admin.id,
    'Test import sayfasına erişim',
    clientInfo.ip,
    clientInfo.port,
    logger.getUserAgent(req)
  ).catch(console.error);

  res.render('admin-test-import', {
    admin: req.session.admin,
    hata: req.query.hata || null,
    basari: req.query.basari || null
  });
});

// Test import önizleme (AJAX) - Multi-Test Support
router.post('/admin/test-import/preview', adminAuthMiddleware, uploadHTML.single('htmlFile'), function(req, res, next) {
  try {
    console.log('🔍 Test import preview başlatıldı');
    
    if (!req.file) {
      console.log('❌ HTML dosyası yok');
      return res.json({
        success: false,
        message: 'HTML dosyası seçilmedi'
      });
    }

    console.log('📁 Dosya bilgileri:', {
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size
    });

    // HTML dosyasını oku
    const htmlContent = fs.readFileSync(req.file.path, 'utf8');
    console.log('📖 HTML dosyası okundu, boyut:', htmlContent.length);

    // Yeni multi-test parser'ı kullan
    const HtmlTestParser = require('../utils/HtmlTestParser');
    const parser = new HtmlTestParser();
    
    // Çoklu test parse et
    const tests = parser.parseMultipleTests(htmlContent);
    console.log(`✅ ${tests.length} test parse edildi`);

    // Geçici dosyayı sil
    fs.unlinkSync(req.file.path);
    console.log('🗑️ Geçici dosya silindi');

    // Validation
    const validation = {
      stats: {
        testSayisi: tests.length,
        cevaplar: tests.reduce((total, test) => total + test.soruSayisi, 0),
        videolar: tests.reduce((total, test) => {
          return total + Object.keys(test.videolar).filter(key => test.videolar[key]).length;
        }, 0)
      },
      warnings: [],
      errors: []
    };

    // Test sayısı kontrolü
    if (tests.length === 0) {
      validation.errors.push('HTML dosyasında hiç test bulunamadı');
    } else if (tests.length > 100) {
      validation.warnings.push(`${tests.length} test bulundu. Bu çok fazla olabilir.`);
    }

    // Test kodları duplicate kontrolü (dosya içi) - sessiz kontrol
    const testCodes = tests.map(t => t.testKodu);
    const duplicates = testCodes.filter((code, index) => testCodes.indexOf(code) !== index);
    if (duplicates.length > 0) {
      console.log(`📋 Dosya içinde duplicate test kodları tespit edildi: ${[...new Set(duplicates)].join(', ')}`);
    }

    // Veritabanında mevcut test kodlarını kontrol et
    const db = require('../database');
    const existingCodes = [];
    let checkCount = 0;
    
    const checkExistingCodes = () => {
      if (checkCount < testCodes.length) {
        const testCode = testCodes[checkCount];
        db.query(
          'SELECT test_kodu FROM test_havuzu WHERE UPPER(test_kodu) = ?',
          [testCode.toUpperCase()],
          (err, results) => {
            if (!err && results.length > 0) {
              existingCodes.push(testCode);
            }
            checkCount++;
            checkExistingCodes();
          }
        );
      } else {
        // Tüm kontroler tamamlandı - mevcut kodlar sessizce tespit edildi
        if (existingCodes.length > 0) {
          console.log(`📋 Veritabanında zaten mevcut test kodları tespit edildi: ${existingCodes.join(', ')}`);
        }
        
        // Log kaydet
        const clientInfo = logger.getClientIPInfo(req);
        logger.logAdminAction(
          'multi_test_import_preview',
          req.session.admin.id,
          `Multi-test import önizleme - ${tests.length} test bulundu, ${existingCodes.length} mevcut`,
          clientInfo.ip,
          clientInfo.port,
          logger.getUserAgent(req)
        ).catch(console.error);

        console.log('✅ Preview başarıyla tamamlandı');
        res.json({
          success: true,
          data: {
            testCount: tests.length,
            tests: tests,
            totalQuestions: validation.stats.cevaplar,
            totalVideos: validation.stats.videolar,
            existingCodes: existingCodes
          },
          validation: validation
        });
      }
    };
    
    // Kontrol işlemini başlat
    checkExistingCodes();

  } catch (error) {
    console.error('🚨 Test import preview error:', error);
    
    // Hata durumunda geçici dosyayı sil
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Hata sonrası geçici dosya silindi');
      } catch (unlinkError) {
        console.error('🚨 Geçici dosya silinemedi:', unlinkError);
      }
    }

    res.json({
      success: false,
      message: 'Dosya işlenirken hata oluştu: ' + error.message
    });
  }
});

// Test import işlemi (Çoklu test desteği)
router.post('/admin/test-import', adminAuthMiddleware, uploadHTML.single('htmlFile'), function(req, res, next) {
  try {
    if (!req.file) {
      return res.redirect('/admin/test-import?hata=' + encodeURIComponent('HTML dosyası seçilmedi'));
    }

    const parser = new HTMLTestParser();
    const filePath = req.file.path;
    const htmlContent = fs.readFileSync(filePath, 'utf8');

    // Yeni multi-test parser'ı kullan
    const HtmlTestParser = require('../utils/HtmlTestParser');
    const multiParser = new HtmlTestParser();
    
    // Çoklu test parse et
    const tests = multiParser.parseMultipleTests(htmlContent);

    if (tests.length === 0) {
      fs.unlinkSync(filePath);
      return res.redirect('/admin/test-import?hata=' + encodeURIComponent('HTML dosyasında geçerli test bulunamadı'));
    }

    console.log(`Bulunan test sayısı: ${tests.length}`);

    const db = require('../database');
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let errors = [];

    // Her testi işle
    const processTest = (index) => {
      if (index >= tests.length) {
        // Tüm testler işlendi
        fs.unlinkSync(filePath);

        // Sonuç logla
        const clientInfo = logger.getClientIPInfo(req);
        logger.logAdminAction(
          'bulk_test_import',
          req.session.admin.id,
          `Toplu test import - Toplam: ${tests.length}, Başarılı: ${successCount}, Hatalı: ${errorCount}`,
          clientInfo.ip,
          clientInfo.port,
          logger.getUserAgent(req)
        ).catch(console.error);

        let message = `${successCount} test başarıyla import edildi`;
        if (errorCount > 0) {
          message += `, ${errorCount} test başarısız`;
          if (errors.length > 0) {
            message += ` (Örnekler: ${errors.slice(0, 2).join(', ')}${errors.length > 2 ? ` ve ${errors.length - 2} tane daha...` : ''})`;
          }
        }

        console.log(`📊 Import Özeti: Başarılı: ${successCount}, Hatalı: ${errorCount}, Toplam: ${tests.length}`);

        const redirectUrl = errorCount > 0 && successCount === 0 ? 
          '/admin/test-import?hata=' + encodeURIComponent(message) :
          '/admin/test-import?basari=' + encodeURIComponent(message);

        return res.redirect(redirectUrl);
      }

      const testData = tests[index];

      // Test kodunun benzersiz olduğunu kontrol et
      db.query(
        'SELECT id FROM test_havuzu WHERE UPPER(test_kodu) = ?',
        [testData.testKodu.toUpperCase()],
        (err, results) => {
          if (err) {
            errors.push(`${testData.testKodu}: DB hatası`);
            errorCount++;
            processedCount++;
            return processTest(index + 1);
          }

          if (results.length > 0) {
            console.log(`⚠️ Test kodu zaten mevcut: ${testData.testKodu}`);
            errors.push(`${testData.testKodu}: Bu test kodu zaten veritabanında mevcut`);
            errorCount++;
            processedCount++;
            return processTest(index + 1);
          }

          // Test havuzuna ekle
          Test.testOlustur(
            testData.testKodu,
            testData.testAdi,
            testData.soruSayisi,
            testData.cevaplar,
            testData.videolar,
            (err, testId) => {
              if (err) {
                errors.push(`${testData.testKodu}: ${err.message}`);
                errorCount++;
              } else {
                successCount++;
                console.log(`✓ ${testData.testKodu} başarıyla eklendi`);
              }
              
              processedCount++;
              processTest(index + 1);
            }
          );
        }
      );
    };

    // İşlemi başlat
    processTest(0);

  } catch (error) {
    // Hata durumunda geçici dosyayı sil
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Geçici dosya silinemedi:', unlinkError);
      }
    }

    console.error('Test import error:', error);
    res.redirect('/admin/test-import?hata=' + encodeURIComponent('HTML dosyası işlenemedi: ' + error.message));
  }
});

module.exports = router;


const mysql = require('mysql2/promise');

// Veritabanı bağlantısı (app.js'den aynı config)
const dbConfig = {
  host: '94.156.11.185',
  user: 'yeninesil_optik',
  password: 'yeninesil_optik',
  database: 'yeninesil_optik'
};

class Logger {
  constructor() {
    this.pool = mysql.createPool(dbConfig);
  }

  // Ana log fonksiyonu
  async log(logData) {
    try {
      const {
        userId = null,
        userType = 'system',
        actionType,
        actionCategory,
        actionDescription,
        targetType = null,
        targetId = null,
        requestData = null,
        responseData = null,
        sessionId = null,
        ipAddress,
        clientPort = null,
        userAgent = null,
        referer = null,
        method = null,
        url = null,
        statusCode = null,
        responseTimeMs = null,
        errorMessage = null,
        additionalData = null
      } = logData;

      const query = `
        INSERT INTO logs (
          user_id, user_type, action_type, action_category, action_description,
          target_type, target_id, request_data, response_data, session_id,
          ip_address, client_port, user_agent, referer, method, url, status_code,
          response_time_ms, error_message, additional_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        userId, userType, actionType, actionCategory, actionDescription,
        targetType, targetId, 
        requestData ? JSON.stringify(requestData) : null,
        responseData ? JSON.stringify(responseData) : null,
        sessionId, ipAddress, clientPort, userAgent, referer, method, url, statusCode,
        responseTimeMs, errorMessage,
        additionalData ? JSON.stringify(additionalData) : null
      ];

      await this.pool.execute(query, values);
    } catch (error) {
      console.error('Logger Error:', error);
      // Log hatası sistem loglarına kaydedilir
      console.error('Failed to save log:', logData);
    }
  }

  // Öğrenci işlemleri için kısayollar
  async logStudentAuth(action, userId, req, additionalData = {}) {
    const { ip, port } = this.getClientIPInfo(req);
    await this.log({
      userId,
      userType: 'student',
      actionType: action,
      actionCategory: 'auth',
      actionDescription: this.getAuthDescription(action),
      sessionId: req.session?.id,
      ipAddress: ip,
      clientPort: port,
      userAgent: this.getUserAgent(req),
      referer: (req && req.headers ? req.headers['referer'] || null : null),
      method: req.method,
      url: req.originalUrl,
      additionalData
    });
  }

  async logStudentTest(action, userId, testId, req, additionalData = {}) {
    const { ip, port } = this.getClientIPInfo(req);
    await this.log({
      userId,
      userType: 'student',
      actionType: action,
      actionCategory: 'test',
      actionDescription: this.getTestDescription(action),
      targetType: 'test',
      targetId: testId,
      sessionId: req.session?.id,
      ipAddress: ip,
      clientPort: port,
      userAgent: this.getUserAgent(req),
      referer: (req && req.headers ? req.headers['referer'] || null : null),
      method: req.method,
      url: req.originalUrl,
      additionalData
    });
  }

  async logStudentAnswer(userId, testId, questionNumber, selectedAnswer, req, additionalData = {}) {
    const { ip, port } = this.getClientIPInfo(req);
    await this.log({
      userId,
      userType: 'student',
      actionType: 'answer_selected',
      actionCategory: 'answer',
      actionDescription: `Soru ${questionNumber} için ${selectedAnswer} seçeneği işaretlendi`,
      targetType: 'test',
      targetId: testId,
      sessionId: req.session?.id,
      ipAddress: ip,
      clientPort: port,
      userAgent: this.getUserAgent(req),
      requestData: { questionNumber, selectedAnswer },
      additionalData
    });
  }

  async logVideoAccess(userId, testId, questionNumber, req, additionalData = {}) {
    const { ip, port } = this.getClientIPInfo(req);
    await this.log({
      userId,
      userType: 'student',
      actionType: 'video_accessed',
      actionCategory: 'video',
      actionDescription: `Soru ${questionNumber} çözüm videosu görüntülendi`,
      targetType: 'test',
      targetId: testId,
      sessionId: req.session?.id,
      ipAddress: ip,
      clientPort: port,
      userAgent: this.getUserAgent(req),
      requestData: { questionNumber },
      additionalData
    });
  }

  // Admin işlemleri için kısayollar
  async logAdminAuth(action, adminId, req, additionalData = {}) {
    const { ip, port } = this.getClientIPInfo(req);
    await this.log({
      userId: adminId,
      userType: 'admin',
      actionType: action,
      actionCategory: 'auth',
      actionDescription: this.getAuthDescription(action),
      sessionId: req.session?.id,
      ipAddress: ip,
      clientPort: port,
      userAgent: this.getUserAgent(req),
      referer: (req && req.headers ? req.headers['referer'] || null : null),
      method: req.method,
      url: req.originalUrl,
      additionalData
    });
  }

  async logAdminAction(action, adminId, req, targetType = null, targetId = null, additionalData = {}) {
    const { ip, port } = this.getClientIPInfo(req);
    await this.log({
      userId: adminId,
      userType: 'admin',
      actionType: action,
      actionCategory: 'admin',
      actionDescription: this.getAdminDescription(action),
      targetType,
      targetId,
      sessionId: req.session?.id,
      ipAddress: ip,
      clientPort: port,
      userAgent: this.getUserAgent(req),
      referer: req && req.headers ? req.headers['referer'] || null : null,
      method: req.method,
      url: req.originalUrl,
      additionalData
    });
  }

  // Sistem işlemleri
  async logSystem(action, description, additionalData = {}) {
    await this.log({
      userType: 'system',
      actionType: action,
      actionCategory: 'system',
      actionDescription: description,
      ipAddress: '127.0.0.1',
      additionalData
    });
  }

  // Hata kayıtları
  async logError(error, req = null, userId = null, userType = 'system') {
    const { ip, port } = req ? this.getClientIPInfo(req) : { ip: '127.0.0.1', port: null };
    await this.log({
      userId,
      userType,
      actionType: 'error_occurred',
      actionCategory: 'error',
      actionDescription: error.message || 'Bilinmeyen hata',
      errorMessage: error.stack || error.toString(),
      ipAddress: ip,
      clientPort: port,
      userAgent: req ? this.getUserAgent(req) : null,
      method: req ? req.method : null,
      url: req ? req.originalUrl : null,
      additionalData: {
        errorName: error.name,
        errorCode: error.code
      }
    });
  }

  // Yardımcı fonksiyonlar
  getClientIP(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.headers['cf-connecting-ip'] ||
           req.headers['x-client-ip'] ||
           '127.0.0.1';
  }

  getClientIPInfo(req) {
    // Güvenlik kontrolü
    if (!req || !req.headers) {
      return { ip: '127.0.0.1', port: null };
    }

    let ip = req.ip || 
             req.connection?.remoteAddress || 
             req.socket?.remoteAddress ||
             (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
             '127.0.0.1';

    // X-Forwarded-For header'ını kontrol et (proxy/load balancer durumlarında)
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = xForwardedFor.split(',').map(ip => ip.trim());
      ip = ips[0]; // İlk IP gerçek client IP'sidir
    }

    // Diğer proxy header'larını kontrol et
    ip = ip || 
         req.headers['x-real-ip'] ||
         req.headers['cf-connecting-ip'] ||
         req.headers['x-client-ip'] ||
         '127.0.0.1';

    // Port bilgisini al
    let port = null;
    if (req.connection?.remotePort) {
      port = req.connection.remotePort;
    } else if (req.socket?.remotePort) {
      port = req.socket.remotePort;
    } else if (req.headers['x-forwarded-port']) {
      port = parseInt(req.headers['x-forwarded-port']);
    }

    // IPv6 mapped IPv4 adreslerini temizle ve localhost'u normalize et
    if (ip && ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }
    
    // IPv6 localhost'u IPv4'e çevir
    if (ip === '::1') {
      ip = '127.0.0.1';
    }

    return { ip, port };
  }

  // Güvenli User-Agent alma fonksiyonu
  getUserAgent(req) {
    if (!req || !req.headers) {
      return 'Unknown';
    }
    return req.headers['user-agent'] || 'Unknown';
  }

  getAuthDescription(action) {
    const descriptions = {
      'login_attempt': 'Giriş denemesi yapıldı',
      'login_success': 'Başarılı giriş yapıldı',
      'login_failed': 'Başarısız giriş denemesi',
      'logout': 'Çıkış yapıldı',
      'session_expired': 'Oturum süresi doldu',
      'k12net_auth': 'K12NET ile giriş yapıldı',
      'k12net_failed': 'K12NET girişi başarısız'
    };
    return descriptions[action] || action;
  }

  getTestDescription(action) {
    const descriptions = {
      'test_started': 'Test başlatıldı',
      'test_continued': 'Teste devam edildi',
      'test_paused': 'Test duraklatıldı',
      'test_completed': 'Test tamamlandı',
      'test_submitted': 'Test gönderildi',
      'test_accessed': 'Test sayfası görüntülendi',
      'test_time_extended': 'Test süresi uzatıldı'
    };
    return descriptions[action] || action;
  }

  getAdminDescription(action) {
    const descriptions = {
      'dashboard_accessed': 'Admin paneli ana sayfası görüntülendi',
      'statistics_viewed': 'İstatistikler görüntülendi',
      'student_searched': 'Öğrenci arandı',
      'student_details_viewed': 'Öğrenci detayları görüntülendi',
      'test_answers_viewed': 'Test cevapları görüntülendi',
      'logs_viewed': 'İşlem kayıtları görüntülendi',
      'export_data': 'Veri dışa aktarıldı'
    };
    return descriptions[action] || action;
  }
}

// Express middleware
function createLoggerMiddleware(logger) {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Response'u izlemek için
    const originalSend = res.send;
    res.send = function(body) {
      const responseTime = Date.now() - startTime;
      
      // HTTP isteklerini loglama kapatıldı
      // Sadece özel log fonksiyonları kullanılacak
      
      return originalSend.call(this, body);
    };
    
    next();
  };
}

module.exports = { Logger, createLoggerMiddleware };

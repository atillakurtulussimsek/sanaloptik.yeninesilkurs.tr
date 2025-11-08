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
          ip_address, user_agent, referer, method, url, status_code,
          response_time_ms, error_message, additional_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        userId, userType, actionType, actionCategory, actionDescription,
        targetType, targetId, 
        requestData ? JSON.stringify(requestData) : null,
        responseData ? JSON.stringify(responseData) : null,
        sessionId, ipAddress, userAgent, referer, method, url, statusCode,
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
    await this.log({
      userId,
      userType: 'student',
      actionType: action,
      actionCategory: 'auth',
      actionDescription: this.getAuthDescription(action),
      sessionId: req.session?.id,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      method: req.method,
      url: req.originalUrl,
      additionalData
    });
  }

  async logStudentTest(action, userId, testId, req, additionalData = {}) {
    await this.log({
      userId,
      userType: 'student',
      actionType: action,
      actionCategory: 'test',
      actionDescription: this.getTestDescription(action),
      targetType: 'test',
      targetId: testId,
      sessionId: req.session?.id,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      method: req.method,
      url: req.originalUrl,
      additionalData
    });
  }

  async logStudentAnswer(userId, testId, questionNumber, selectedAnswer, req, additionalData = {}) {
    await this.log({
      userId,
      userType: 'student',
      actionType: 'answer_selected',
      actionCategory: 'answer',
      actionDescription: `Soru ${questionNumber} için ${selectedAnswer} seçeneği işaretlendi`,
      targetType: 'test',
      targetId: testId,
      sessionId: req.session?.id,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestData: { questionNumber, selectedAnswer },
      additionalData
    });
  }

  async logVideoAccess(userId, testId, questionNumber, req, additionalData = {}) {
    await this.log({
      userId,
      userType: 'student',
      actionType: 'video_accessed',
      actionCategory: 'video',
      actionDescription: `Soru ${questionNumber} çözüm videosu görüntülendi`,
      targetType: 'test',
      targetId: testId,
      sessionId: req.session?.id,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestData: { questionNumber },
      additionalData
    });
  }

  // Admin işlemleri için kısayollar
  async logAdminAuth(action, adminId, req, additionalData = {}) {
    await this.log({
      userId: adminId,
      userType: 'admin',
      actionType: action,
      actionCategory: 'auth',
      actionDescription: this.getAuthDescription(action),
      sessionId: req.session?.id,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      method: req.method,
      url: req.originalUrl,
      additionalData
    });
  }

  async logAdminAction(action, adminId, req, targetType = null, targetId = null, additionalData = {}) {
    await this.log({
      userId: adminId,
      userType: 'admin',
      actionType: action,
      actionCategory: 'admin',
      actionDescription: this.getAdminDescription(action),
      targetType,
      targetId,
      sessionId: req.session?.id,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
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
    await this.log({
      userId,
      userType,
      actionType: 'error_occurred',
      actionCategory: 'error',
      actionDescription: error.message || 'Bilinmeyen hata',
      errorMessage: error.stack || error.toString(),
      ipAddress: req ? this.getClientIP(req) : '127.0.0.1',
      userAgent: req ? req.get('User-Agent') : null,
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
           req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           '127.0.0.1';
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
      
      // Her HTTP isteğini logla (sadece önemli endpoint'ler)
      const importantRoutes = ['/auth', '/test', '/admin', '/api'];
      const shouldLog = importantRoutes.some(route => req.path.startsWith(route));
      
      if (shouldLog) {
        const userId = req.session?.ogrenci?.id || req.session?.admin?.id || null;
        const userType = req.session?.ogrenci ? 'student' : 
                        req.session?.admin ? 'admin' : 'system';
        
        logger.log({
          userId,
          userType,
          actionType: 'http_request',
          actionCategory: 'system',
          actionDescription: `${req.method} ${req.path}`,
          sessionId: req.session?.id,
          ipAddress: logger.getClientIP(req),
          userAgent: req.get('User-Agent'),
          referer: req.get('Referer'),
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          responseTimeMs: responseTime,
          requestData: req.method === 'POST' ? req.body : req.query
        }).catch(console.error);
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  };
}

module.exports = { Logger, createLoggerMiddleware };
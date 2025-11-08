var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');

var indexRouter = require('./routes/index');
var db = require('./database');
const { Logger, createLoggerMiddleware } = require('./logger');

var app = express();
const systemLogger = new Logger();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: 'sanaloptik-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 saat
}));
app.use(express.static(path.join(__dirname, 'public')));

// Logger middleware'i ekle
app.use(createLoggerMiddleware(systemLogger));

// Logger'ı route'larda kullanabilmek için request'e ekle
app.use((req, res, next) => {
  req.systemLogger = systemLogger;
  next();
});

app.use('/', indexRouter);

app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  // Hataları logla
  if (req.systemLogger) {
    req.systemLogger.logError(err, req).catch(console.error);
  }
  
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

// Sistem başlatma logunu ekle
systemLogger.logSystem('system_start', 'Uygulama başarıyla başlatıldı', {
  nodeVersion: process.version,
  platform: process.platform,
  pid: process.pid
}).catch(console.error);

module.exports = app;

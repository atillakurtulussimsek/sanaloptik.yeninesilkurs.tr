function authMiddleware(req, res, next) {
  if (req.session && req.session.ogrenci) {
    return next();
  }
  res.redirect('/giris');
}

module.exports = authMiddleware;

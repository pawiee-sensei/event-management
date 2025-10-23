// middlewares/auth.js
export function ensureAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/admin/login');
  }
  next();
}

export function isAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('Access denied. Admins only.');
  }
  next();
}

export function redirectIfAuthenticated(req, res, next) {
  if (req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  next();
}

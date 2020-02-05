const csurf = require('csurf');

const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }

  req.flash('danger', 'Please login to view this content');
  return res.redirect('/user/login');
};

const csrfProtection = [
  csurf(),
  (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    return next();
  },
];

module.exports = {
  ensureAuth,
  csrfProtection,
};

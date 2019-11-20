const csurf = require('csurf');

const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  } else {
    req.flash('danger', 'Please login to view this content');
    res.redirect('/user/login');
  }
};

const csrfProtection = [
  csurf(),
  (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
  },
];

module.exports = {
  ensureAuth,
  csrfProtection,
};

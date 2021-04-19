const csurf = require('csurf');
const { validationResult } = require('express-validator');
const User = require('../models/user');

const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }

  req.flash('danger', 'Please login to view this content');
  return res.redirect('/user/login');
};

const ensureRole = (role) => (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.flash('danger', 'Please login to view this content');
    return res.redirect('/user/login');
  }

  return User.findById(req.user.id, (err, user) => {
    if (user.roles && user.roles.includes(role)) {
      return next();
    }
    return res.redirect('/404');
  });
};

const csrfProtection = [
  csurf(),
  (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    return next();
  },
];

function flashValidationErrors(req, res, next) {
  const errors = validationResult(req).formatWith(({ msg }) => msg);
  req.validated = errors.isEmpty();

  for (const error of errors.array()) {
    req.flash('danger', error);
  }

  next();
}

function jsonValidationErrors(req, res, next) {
  const errors = validationResult(req).formatWith(({ msg }) => msg);
  if (!errors.isEmpty()) {
    res.status(400).send({
      success: 'false',
      errors: errors.array(),
    });
    req.validated = false;
    return;
  }

  req.validated = true;
  next();
}

module.exports = {
  ensureAuth,
  ensureRole,
  csrfProtection,
  flashValidationErrors,
  jsonValidationErrors,
};

const csurf = require('csurf');
const { validationResult } = require('express-validator');
const User = require('../dynamo/models/user');
const { redirect } = require('../serverjs/render');

const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }

  req.flash('danger', 'Please login to view this content');
  return redirect(req, res, '/user/login');
};

const ensureRole = (role) => async (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.flash('danger', 'Please login to view this content');
    return redirect(req, res, '/user/login');
  }

  const user = await User.getById(req.user.id);

  if (user.roles && user.roles.includes(role)) {
    return next();
  }
  return redirect(req, res, '/404');
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

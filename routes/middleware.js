const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  } else {
    req.flash('danger', 'Please login to view this content');
    res.redirect('/user/login');
  }
}

module.exports = {
  ensureAuth
}

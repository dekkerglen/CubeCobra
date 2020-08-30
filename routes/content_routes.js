// Load Environment Variables
require('dotenv').config();

const express = require('express');
const { ensureAuth, csrfProtection } = require('./middleware');
const { render } = require('../serverjs/render');
const Application = require('../models/application');

const router = express.Router();

router.use(csrfProtection);

router.get('/application', ensureAuth, async (req, res) => {
  if (!req.user) {
    req.flash('danger', 'Please log in to apply to be a content creator partner.');
    return render(req, res, 'ContactPage');
  }
  return render(req, res, 'ApplicationPage');
});

router.post('/submitapplication', ensureAuth, async (req, res) => {
  try {
    if (!req.user) {
      req.flash('danger', 'Please log in to apply to be a content creator partner.');
      return render(req, res, 'ContactPage');
    }
    const application = new Application();

    application.userid = req.user.id;
    application.info = req.body.info;
    application.timePosted = new Date();

    await application.save();

    req.flash('success', 'Your application has been submitted. We will reach out via email when a decision is made.');
    return render(req, res, 'ApplicationPage');
  } catch (err) {
    req.flash('danger', 'Please log in to apply to be a content creator partner.');
    return render(req, res, 'ApplicationPage');
  }
});

module.exports = router;

const router = require('express').Router();

router.use('/api', require('./api'));
router.use('', require('./views'));

module.exports = router;
const express = require('express');
const { csrfProtection } = require('../middleware');
const { getUserFromId } = require('../../serverjs/cache.js');

const router = express.Router();

router.use(csrfProtection);

router.post('/getUser', async (req, res) => {
  const { userId } = req.body;
  const user = await getUserFromId(userId);

  return res.status(200).send({
    success: 'true',
    user,
  });
});

module.exports = router;

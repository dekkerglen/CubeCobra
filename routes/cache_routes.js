const express = require('express');

const router = express.Router();

const { evict } = require('../dynamo/cache');

router.post('/invalidate', (req, res) => {
  const { secret, key } = req.body;

  if (secret !== process.env.CACHE_SECRET) {
    return res.status(401).send({
      success: 'false',
      message: 'Invalid secret',
    });
  }

  evict(key);

  return res.status(200).send({
    success: 'true',
  });
});

module.exports = router;

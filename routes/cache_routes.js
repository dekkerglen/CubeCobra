const express = require('express');

const router = express.Router();

const { evict, updatePeers } = require('../dynamo/cache');

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

router.post('/newpeer', async (req, res) => {
  const { secret } = req.body;

  if (secret !== process.env.CACHE_SECRET) {
    return res.status(401).send({
      success: 'false',
      message: 'Invalid secret',
    });
  }

  await updatePeers();

  return res.status(200).send({
    success: 'true',
  });
});

module.exports = router;

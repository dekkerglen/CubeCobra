const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  return res.status(200).send({
    status: 'ok',
  });
});

module.exports = router;

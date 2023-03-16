const express = require('express');
const { csrfProtection } = require('../middleware');
const Changelog = require('../../dynamo/models/changelog');

const router = express.Router();

router.use(csrfProtection);

router.post('/changelog', async (req, res) => {
  const { changelogId, cubeId } = req.body;
  try {
    const changelog = await Changelog.getById(cubeId, changelogId);

    return res.status(200).send({
      success: 'true',
      changelog,
    });
  } catch (err) {
    return res.status(500).send({
      success: 'false',
      error: err.message,
    });
  }
});

module.exports = router;

const express = require('express');
const { csrfProtection } = require('../middleware');
const Changelog = require('../../dynamo/models/changelog');
const util = require('../../serverjs/util');
const User = require('../../dynamo/models/user');

const router = express.Router();

router.use(csrfProtection);

router.post('/userfromid', async (req, res) => {
  const { userId } = req.body;
  const user = await User.getById(userId);

  user.ImageData = util.getImageData(user.imageName);

  return res.status(200).send({
    success: 'true',
    user,
  });
});

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

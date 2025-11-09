const express = require('express');
const util = require('../../serverutils/util');
const Cube = require('dynamo/models/cube');
const { isCubeViewable } = require('../../serverutils/cubefn');
const Changelog = require('dynamo/models/changelog');

const router = express.Router();

router.post(
  '/cube/history/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).send('Cube not found.');
    }

    const query = await Changelog.getByCube(cube.id, 50, req.body.lastKey);
    return res.status(200).send({
      success: 'true',
      posts: query.items,
      lastKey: query.lastKey,
    });
  }),
);

module.exports = router;

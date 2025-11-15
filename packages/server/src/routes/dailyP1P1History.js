const express = require('express');

const Cube = require('dynamo/models/cube');
const p1p1PackModel = require('dynamo/models/p1p1Pack');
const dailyP1P1Model = require('dynamo/models/dailyP1P1');

const { render } = require('../serverutils/render');
const { csrfProtection } = require('./middleware');

const router = express.Router();

router.use(csrfProtection);

router.get('/archive', async (req, res) => {
  try {
    const limit = 10;

    // Get daily P1P1 archive
    const result = await dailyP1P1Model.getDailyP1P1History(undefined, limit);

    let history = [];
    let hasMore = false;
    let lastKey = null;

    if (result.items && result.items.length > 0) {
      // Get pack and cube data for each history item
      const historyWithData = await Promise.all(
        result.items.map(async (item) => {
          const [pack, cube] = await Promise.all([p1p1PackModel.getById(item.packId), Cube.getById(item.cubeId)]);

          return {
            ...item,
            pack,
            cube,
          };
        }),
      );

      // Filter out items where pack or cube couldn't be loaded
      history = historyWithData.filter((item) => item.pack && item.cube);
      hasMore = !!result.lastKey;
      lastKey = result.lastKey ? JSON.stringify(result.lastKey) : null;
    }

    return render(req, res, 'DailyP1P1HistoryPage', {
      history,
      hasMore,
      lastKey,
    });
  } catch (err) {
    req.logger.error('Error loading daily P1P1 archive page:', err);
    req.flash('danger', 'Error loading daily P1P1 archive');
    return res.redirect('/explore');
  }
});

module.exports = router;

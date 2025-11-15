const Cube = require('dynamo/models/cube');
const p1p1PackModel = require('dynamo/models/p1p1Pack');
const dailyP1P1Model = require('dynamo/models/dailyP1P1');

/**
 * Fetches the current daily P1P1 data including pack and cube information
 * @param {Object} logger - Logger instance for error reporting
 * @returns {Promise<Object|null>} Daily P1P1 data with pack, cube, and date, or null if not available
 */
async function getDailyP1P1(logger) {
  let dailyP1P1 = null;
  try {
    const dailyP1P1Record = await dailyP1P1Model.getCurrentDailyP1P1();
    if (dailyP1P1Record) {
      const p1p1pack = await p1p1PackModel.getById(dailyP1P1Record.packId);
      const p1p1cube = await Cube.getById(dailyP1P1Record.cubeId);
      if (p1p1pack && p1p1cube) {
        dailyP1P1 = { pack: p1p1pack, cube: p1p1cube, date: dailyP1P1Record.date };
      }
    }
  } catch (err) {
    // Daily P1P1 is optional, don't fail if it can't be loaded
    if (logger) {
      logger.error('Error loading daily P1P1:', err);
    }
  }
  return dailyP1P1;
}

module.exports = { getDailyP1P1 };

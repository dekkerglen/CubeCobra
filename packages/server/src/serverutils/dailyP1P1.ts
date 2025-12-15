import { cubeDao, dailyP1P1Dao, p1p1PackDao } from 'dynamo/daos';

interface Logger {
  error: (message: string, error: any) => void;
}

interface DailyP1P1Result {
  pack: any;
  cube: any;
  date: string | number;
}

/**
 * Fetches the current daily P1P1 data including pack and cube information
 * @param {Object} logger - Logger instance for error reporting
 * @returns {Promise<Object|null>} Daily P1P1 data with pack, cube, and date, or null if not available
 */
async function getDailyP1P1(logger?: Logger): Promise<DailyP1P1Result | null> {
  let dailyP1P1: DailyP1P1Result | null = null;
  try {
    const dailyP1P1Record = await dailyP1P1Dao.getCurrentDailyP1P1();
    if (dailyP1P1Record) {
      const p1p1pack = await p1p1PackDao.getById(dailyP1P1Record.packId);
      const p1p1cube = await cubeDao.getById(dailyP1P1Record.cubeId);
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

export { getDailyP1P1 };
export default { getDailyP1P1 };

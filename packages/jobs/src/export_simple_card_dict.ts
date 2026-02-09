import dotenv from 'dotenv';
dotenv.config({ path: require('path').join(__dirname, '..', '..', '.env') });
import { exportTaskDao } from '@server/dynamo/daos';
import { initializeCardDb } from '@server/serverutils/cardCatalog';
import { getAllOracleIds, getMostReasonableById, getVersionsByOracleId } from '@server/serverutils/carddb';
import fs from 'fs';
import path from 'path';

import 'module-alias/register';

const taskId = process.env.EXPORT_TASK_ID;

(async () => {
  try {
    if (taskId) {
      await exportTaskDao.updateStep(taskId, 'Initializing');
    }

    const privateDir = path.join(__dirname, '..', '..', 'server', 'private');
    await initializeCardDb(privateDir);

    if (taskId) {
      await exportTaskDao.updateStep(taskId, 'Processing cards');
    }

  const allOracleIds = getAllOracleIds();

  const result = Object.fromEntries(
    allOracleIds.map((oracleId) => {
      const card = getVersionsByOracleId(oracleId)[0];

      if (!card) {
        return [
          oracleId,
          {
            name: 'Unknown Card',
            image: null,
            elo: null,
            type: null,
            cmc: null,
          },
        ];
      }

      const reasonable = getMostReasonableById(card);

      return [
        oracleId,
        {
          name: reasonable?.name,
          image: reasonable?.image_small,
          elo: reasonable?.elo,
          type: reasonable?.type,
          cmc: reasonable?.cmc,
        },
      ];
    }),
  );

  if (taskId) {
    await exportTaskDao.updateStep(taskId, 'Writing export file');
  }

  fs.writeFileSync('./temp/export/simpleCardDict.json', JSON.stringify(result));

  console.log('Export complete!');
  process.exit(0);
  } catch (error) {
    console.error('Export failed:', error);
    if (taskId) {
      await exportTaskDao.markAsFailed(
        taskId,
        error instanceof Error ? error.message : 'Unknown error during card dictionary export',
      );
    }
    process.exit(1);
  }
})();

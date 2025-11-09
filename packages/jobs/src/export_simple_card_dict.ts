import dotenv from 'dotenv';
dotenv.config({ path: require('path').join(__dirname, '..', '..', '.env') });
import fs from 'fs';

import 'module-alias/register';

import { initializeCardDb } from '@server/util/cardCatalog';
import { getAllOracleIds, getMostReasonableById, getVersionsByOracleId } from '@server/util/carddb';
import path from 'path';

(async () => {
  const privateDir = path.join(__dirname, '..', '..', 'server', 'private');
  await initializeCardDb(privateDir);

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

  fs.writeFileSync('./temp/export/simpleCardDict.json', JSON.stringify(result));
})();

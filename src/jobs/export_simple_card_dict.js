require('dotenv').config();

const fs = require('fs');
//foo
const {getVersionsByOracleId, getMostReasonableById, initializeCardDb, getAllOracleIds} = require('../util/carddb');

(async () => {
  await initializeCardDb();

  const allOracleIds = getAllOracleIds();

  const result = Object.fromEntries(
    allOracleIds.map((oracleId) => {
      const card = getVersionsByOracleId(oracleId)[0];
      const reasonable = getMostReasonableById(card);

      return [
        oracleId,
        {
          name: reasonable.name,
          image: reasonable.image_small,
          elo: reasonable.elo,
          type: reasonable.type,
          cmc: reasonable.cmc,
        },
      ];
    }),
  );

  fs.writeFileSync('./temp/export/simpleCardDict.json', JSON.stringify(result));
})();

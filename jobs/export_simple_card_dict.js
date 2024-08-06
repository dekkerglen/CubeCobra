require('dotenv').config();

const fs = require('fs');
const carddb = require('../serverjs/carddb');

(async () => {
  await carddb.initializeCardDb();

  const allOracleIds = carddb.allOracleIds();

  const result = Object.fromEntries(
    allOracleIds.map((oracleId) => {
      const card = carddb.getVersionsByOracleId(oracleId)[0];
      const reasonable = carddb.getMostReasonableById(card);

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

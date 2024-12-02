require('dotenv').config();

const fs = require('fs');
const carddb = require('../serverjs/carddb');

(async () => {
  const exportPath = './temp/export';
  if (!fs.existsSync(exportPath)) {
    fs.mkdirSync(exportPath, { recursive: true });
  }
  console.info(`Prepared export path: ${exportPath}`);
  await carddb.initializeCardDb();

  const allOracleIds = carddb.allOracleIds();


  const cardDictPath = `${exportPath}/simpleCardDict.json`
  const cardStream = fs.createWriteStream(cardDictPath);
  cardStream.on('error', (error) => {
    console.error(`An error occured while writing to the file. Error: ${error.message}`);
  });
  cardStream.on('finish', () => {
    console.log(`Cards have been written to ${cardDictPath}`);
  });

  // Write start of JSON object
  cardStream.write("{");
  let written = 0;

  const result = allOracleIds.forEach((oracleId) => {
    const card = carddb.getVersionsByOracleId(oracleId)[0];
    const reasonable = carddb.getMostReasonableById(card);
    const data = {
      name: reasonable.name,
      image: reasonable.image_small,
      elo: reasonable.elo,
      type: reasonable.type,
      cmc: reasonable.cmc,
    };

    // write comma separator after the first record
    if (written > 0) cardStream.write(",");
    cardStream.write(`"${oracleId}": ${JSON.stringify(data)}`)
    written++;
  });

  // Write close of JSON object and end stream
  cardStream.write("}");
  cardStream.end();

  // fs.writeFileSync('./temp/export/simpleCardDict.json', JSON.stringify(result));
})();

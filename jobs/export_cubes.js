require('dotenv').config();

const fs = require('fs');
const carddb = require('../serverjs/carddb');

const Cube = require('../dynamo/models/cube');

const fetchCards = async (cubeId) => {
  try {
    const cards = await Cube.getCards(cubeId);
    return cards;
  } catch (err) {
    console.error(err);
    console.log(`Error processing cube ${cubeId}`);
    return null;
  }
}

// not possible to bulk fetch card list objects from S3, but collects async operations
const bulkFetchCards = async (cubeIds) => {
  return cubeIds.reduce(async (acc, cubeId) => {
    const cards = await fetchCards(cubeId);
    acc[cubeId] = cards;
    return acc;
  }, {})
}

const processCube = (cube, cards, oracleToIndex) => {
  if (!cards) return null;
  return {
    cards: cards.mainboard.map((card) => oracleToIndex[card.details.oracle_id] || -1),
    id: cube.id,
    name: cube.name,
    owner: cube.owner.username,
    owner_id: cube.owner.id,
    image_uri: cube.image.uri,
    image_artist: cube.image.artist,
    card_count: cards.mainboard.length,
    following: cube.following,
  };
};

(async () => {
  const exportPath = './temp/export';
  if (!fs.existsSync(exportPath)) {
    fs.mkdirSync(exportPath, { recursive: true });
  }
  console.info(`Prepared export path: ${exportPath}`);

  await carddb.initializeCardDb();
  const allOracles = carddb.allOracleIds();
  const oracleToIndex = Object.fromEntries(allOracles.map((oracle, index) => [oracle, index]));
  const indexToOracleMap = Object.fromEntries(allOracles.map((oracle, index) => [index, oracle]));

  const oraclePath = `${exportPath}/indexToOracleMap.json`;
  fs.writeFileSync(oraclePath, JSON.stringify(indexToOracleMap));
  console.info(`Wrote index to oracle map: ${oraclePath}`);

  let lastKey = null;
  let processed = 0;
  let written = 0;

  const cubeFilePath = `${exportPath}/cubes.json`
  const cubeStream = fs.createWriteStream(cubeFilePath);
  cubeStream.on('error', (error) => {
    console.error(`An error occured while writing to the file. Error: ${error.message}`);
  });
  cubeStream.on('finish', () => {
    console.log(`Cubes have been written to ${cubeFilePath}`);
  });

  // Write start of JSON array
  cubeStream.write("[");
  const pageSize = 100;
  do {
    // TODO incremental fetch by modified date?
    // query all for snapshot then query changed delta on later runs. ex:
    //   1. snapshot: query public visibility, updated after unix time 0
    //   2. delta: query public visiblity, use last run's unix time
    // awslocal dynamodb query \
    //   --table-name LOCAL_CUBE_METADATA \
    //   --key-condition-expression "visibility = :vis and #dt > :dt" \
    //   --expression-attribute-values '{":vis":{"S":"pu"},":dt":{"N":"0"}}' \
    //   --expression-attribute-names '{"#dt": "date"}' --index-name ByVisiblity
    const result = await Cube.getByVisibility(Cube.VISIBILITY.PUBLIC, lastKey, pageSize);
    lastKey = result.lastKey;
    processed += result.items.length;
    console.info(`Fetched page of ${pageSize} cubes. Total cubes: ${processed}`)

    const cubeIds = result.items.map((cube) => cube.id);
    const cubeCardsMap = await bulkFetchCards(cubeIds);
    const processedCubes = result.items.map((cube) => {
      const cards = cubeCardsMap[cube.id];
      return processCube(cube, cards, oracleToIndex);
    });
    processedCubes.filter((cube) => cube !== null).forEach((cube) => {
      // Write JSON array separator after the first record
      if (written > 0) cubeStream.write(",");
      cubeStream.write(JSON.stringify(cube));
      written++;
    });

    console.log(`Processed ${processed} cubes; Wrote ${written} cubes.`);
  } while (lastKey);

  // Write close of JSON array and end stream
  cubeStream.write("]");
  cubeStream.end();
})();

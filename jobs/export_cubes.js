require('dotenv').config();

const fs = require('fs');
const carddb = require('../serverjs/carddb');

const Cube = require('../dynamo/models/cube');

const processCube = async (cube, oracleToIndex) => {
  try {
    const cards = await Cube.getCards(cube.id);

    return {
      cards: cards.mainboard.map((card) => oracleToIndex[card.details.oracle_id] || -1),
      id: cube.id,
      name: cube.name,
      owner: cube.owner.username,
      owner_id: cube.owner.id,
      image_uri: cube.image.uri,
      iamge_artist: cube.image.artist,
      card_count: cards.mainboard.length,
      following: cube.following,
    };
  } catch (err) {
    console.error(err);
    console.log(`Error processing cube ${cube.id}`);
    return null;
  }
};

(async () => {
  await carddb.initializeCardDb();

  const allOracles = carddb.allOracleIds();
  const oracleToIndex = Object.fromEntries(allOracles.map((oracle, index) => [oracle, index]));
  const indexToOracleMap = Object.fromEntries(allOracles.map((oracle, index) => [index, oracle]));

  let lastKey = null;
  let processed = 0;
  const cubes = [];

  do {
    const result = await Cube.getByVisibility(Cube.VISIBILITY.PUBLIC, lastKey, 100);
    lastKey = result.lastKey;
    processed += result.items.length;

    const processedCubes = await Promise.all(result.items.map((item) => processCube(item, oracleToIndex)));

    cubes.push(...processedCubes.filter((cube) => cube !== null));

    console.log(`Processed ${processed} cubes`);
  } while (lastKey);

  // if /temp doesn't exist, create it
  if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp');
  }

  // if /temp/export doesn't exist, create it
  if (!fs.existsSync('./temp/export')) {
    fs.mkdirSync('./temp/export');
  }

  fs.writeFileSync('./temp/export/cubes.json', JSON.stringify(cubes));
  fs.writeFileSync('./temp/export/indexToOracleMap.json', JSON.stringify(indexToOracleMap));
})();

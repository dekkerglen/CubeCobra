import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

import 'module-alias/register';

import Card from '@utils/datatypes/Card';
import { cardOracleId } from '@utils/cardutil';

import type CubeType from '@utils/datatypes/Cube';
import { initializeCardDb } from '@server/util/cardCatalog';
import { getAllOracleIds } from '@server/util/carddb';

const Cube = require('../dynamo/models/cube');

const processCube = async (cube: CubeType, oracleToIndex: Record<string, number>) => {
  try {
    const cards = await Cube.getCards(cube.id);

    return {
      cards: cards.mainboard.map((card: Card) => oracleToIndex[cardOracleId(card)] || -1),
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
    // eslint-disable-next-line no-console
    console.error(err);
    // eslint-disable-next-line no-console
    console.log(`Error processing cube ${cube.id}`);
    return null;
  }
};

(async () => {
  await initializeCardDb();

  const allOracles = getAllOracleIds();
  const oracleToIndex = Object.fromEntries(allOracles.map((oracle, index) => [oracle, index]));
  const indexToOracleMap = Object.fromEntries(allOracles.map((oracle, index) => [index, oracle]));

  let lastKey: any = null;
  let processed = 0;
  const cubes: CubeType[] = [];

  do {
    const result = await Cube.getByVisibility(Cube.VISIBILITY.PUBLIC, lastKey, 100);
    lastKey = result.lastKey;
    processed += result.items.length;

    const processedCubes = await Promise.all(result.items.map((item: CubeType) => processCube(item, oracleToIndex)));

    cubes.push(...processedCubes.filter((cube) => cube !== null));

    // eslint-disable-next-line no-console
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

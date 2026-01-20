import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import 'module-alias/register';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import { cubeDao } from '@server/dynamo/daos';
import { initializeCardDb } from '@server/serverutils/cardCatalog';
import { getAllOracleIds } from '@server/serverutils/carddb';
import { cardOracleId } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import type CubeType from '@utils/datatypes/Cube';

const processCube = async (cube: CubeType, oracleToIndex: Record<string, number>) => {
  try {
    const cards = await cubeDao.getCards(cube.id);

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
    console.error(err);

    console.log(`Error processing cube ${cube.id}`);
    return null;
  }
};

(async () => {
  const privateDir = path.join(__dirname, '..', '..', 'server', 'private');
  await initializeCardDb(privateDir);

  const allOracles = getAllOracleIds();
  const oracleToIndex = Object.fromEntries(allOracles.map((oracle, index) => [oracle, index]));
  const indexToOracleMap = Object.fromEntries(allOracles.map((oracle, index) => [index, oracle]));

  let lastKey: any = null;
  let processed = 0;
  const cubes: CubeType[] = [];

  do {
    const result = await cubeDao.queryPublic(lastKey, 100);
    lastKey = result.lastKey;
    processed += result.items.length;

    const processedCubes = await Promise.all(result.items.map((item: CubeType) => processCube(item, oracleToIndex)));

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

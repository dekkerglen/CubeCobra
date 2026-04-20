/**
 * Prints oracle tag frequency for all cards in a given cube.
 * Usage:
 *   cd packages/scripts
 *   ts-node -r tsconfig-paths/register --project tsconfig.json src/cube_otag_frequency.ts <cubeId>
 */

import 'dotenv/config';

import { cubeDao } from '@server/dynamo/daos';
import { initializeCardDb } from 'serverutils/cardCatalog';
import catalog from 'serverutils/cardCatalog';
import { cardFromId } from 'serverutils/carddb';
import Card from '@utils/datatypes/Card';

async function main() {
  const cubeId = process.argv[2];
  if (!cubeId) {
    console.error('Usage: ts-node ... cube_otag_frequency.ts <cubeId>');
    process.exit(1);
  }

  console.log('Loading card database...');
  await initializeCardDb('../server/private');

  console.log(`Fetching cube ${cubeId}...`);
  const cube = await cubeDao.getById(cubeId);
  if (!cube) {
    console.error(`Cube not found: ${cubeId}`);
    process.exit(1);
  }
  console.log(`Cube: ${cube.name}`);

  const cubeCards = await cubeDao.getCards(cube.id);
  const allCards: Card[] = Object.entries(cubeCards).flatMap(([key, val]) =>
    key !== 'id' && Array.isArray(val) ? (val as Card[]) : [],
  );
  console.log(`Cards in cube: ${allCards.length}\n`);

  // Count oracle tags across all cards
  const tagCounts = new Map<string, number>();

  for (const card of allCards) {
    const details = card.details ?? cardFromId(card.cardID);
    const oracleId = details?.oracle_id;
    if (!oracleId) continue;

    const oracleIndex = catalog.oracleToIndex[oracleId];
    if (oracleIndex === undefined) continue;

    const tagIndices = catalog.oracleTagDict[oracleIndex];
    if (!tagIndices || tagIndices.length === 0) continue;

    for (const tagIdx of tagIndices) {
      const tagName = catalog.oracleTagNames[tagIdx];
      if (tagName) tagCounts.set(tagName, (tagCounts.get(tagName) ?? 0) + 1);
    }
  }

  const ranked = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`${'Count'.padStart(6)}  Tag`);
  console.log('-'.repeat(50));
  for (const [name, count] of ranked) {
    console.log(`${String(count).padStart(6)}  ${name}`);
  }
  console.log(`\nTotal unique tags: ${ranked.length}`);
}

main().catch(console.error);

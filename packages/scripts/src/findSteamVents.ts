import { cardFromId } from '../../server/src/serverutils/carddb';
import { initializeCardDb } from '../../server/src/serverutils/cardCatalog';
// @ts-ignore - using old model for scan operation
import packageModel from '../../server/src/dynamo/models/package';

async function findSteamVents() {
  console.log('Loading card database...');
  await initializeCardDb('../server/private');
  console.log('Card database loaded!\n');

  console.log('Searching for packages with Steam Vents...');

  let lastKey: any = undefined;
  let hasMore = true;
  let foundCount = 0;

  while (hasMore) {
    const result = await packageModel.scan(lastKey);

    if (!result.items || result.items.length === 0) {
      break;
    }

    for (const pkg of result.items) {
      if (Array.isArray(pkg.cards)) {
        for (const cardId of pkg.cards) {
          try {
            const card = cardFromId(cardId);
            if (card && card.name.toLowerCase().includes('steam vents')) {
              foundCount++;
              console.log(`\nFound in package: ${pkg.id} (${pkg.title})`);
              console.log(`  Card: ${card.name}`);
              console.log(`  Oracle ID: ${card.oracle_id}`);
              console.log(`  Card ID: ${cardId}`);
              break; // Only log once per package
            }
          } catch (error) {
            // Skip invalid cards
          }
        }
      }
    }

    lastKey = result.lastKey;
    hasMore = !!lastKey;
  }

  console.log(`\n\nTotal packages with Steam Vents: ${foundCount}`);
}

findSteamVents().catch(console.error);

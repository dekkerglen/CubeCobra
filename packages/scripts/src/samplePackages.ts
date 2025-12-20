// @ts-ignore - using old model for scan operation
import packageModel from '../../server/src/dynamo/models/package';
import { cardFromId } from '../../server/src/serverutils/carddb';
import { initializeCardDb } from '../../server/src/serverutils/cardCatalog';

async function samplePackages() {
  console.log('Loading card database...');
  await initializeCardDb('../server/private');
  console.log('Card database loaded!\n');

  console.log('Finding Shock lands package...\n');

  let lastKey: any = undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await packageModel.scan(lastKey);

    if (!result.items || result.items.length === 0) {
      break;
    }

    for (const pkg of result.items) {
      if (pkg.title.toLowerCase().includes('shock')) {
        console.log(`\n=== Package: ${pkg.title} (ID: ${pkg.id}) ===`);
        console.log(`Owner: ${JSON.stringify(pkg.owner)}`);
        console.log(`Cards count: ${pkg.cards?.length || 0}`);

        if (Array.isArray(pkg.cards)) {
          console.log('All cards:');
          for (let j = 0; j < pkg.cards.length; j++) {
            console.log(`  [${j}] Raw card ID: ${pkg.cards[j]} (type: ${typeof pkg.cards[j]})`);
            try {
              const card = cardFromId(pkg.cards[j]);
              console.log(`      -> ${card.name} (oracle: ${card.oracle_id})`);
            } catch (error) {
              console.log(`      -> Error loading: ${error}`);
            }
          }
        }
      }
    }

    lastKey = result.lastKey;
    hasMore = !!lastKey;
  }
}

samplePackages().catch(console.error);

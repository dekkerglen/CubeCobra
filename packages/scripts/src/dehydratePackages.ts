import { NativeAttributeValue } from '@aws-sdk/util-dynamodb';
import packageModel from '../../server/src/dynamo/models/package';
import { initializeCardDb } from '../../server/src/server/cards/cardCatalog';

const TABLE_NAME = process.env.DYNAMO_TABLE_NAME || 'CubeCobraTable';

async function dehydratePackages() {
  console.log('Starting package dehydration...');
  console.log(`Using table: ${TABLE_NAME}`);

  let processedCount = 0;
  let skippedCount = 0;
  let lastKey: Record<string, NativeAttributeValue> | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    // Scan all packages
    const result = await packageModel.scan(lastKey);

    if (!result.items || result.items.length === 0) {
      console.log('No more packages to process');
      break;
    }

    console.log(`Processing batch of ${result.items.length} packages...`);

    for (const pkg of result.items) {
      try {
        // Check if cards are already dehydrated (strings) or need dehydration (objects)
        if (!Array.isArray(pkg.cards) || pkg.cards.length === 0) {
          console.log(`Package ${pkg.id} has no cards, skipping`);
          skippedCount++;
          continue;
        }

        const firstCard = pkg.cards[0];
        
        // If first card is a string, assume all are strings (already dehydrated)
        if (typeof firstCard === 'string') {
          console.log(`Package ${pkg.id} already dehydrated, skipping`);
          skippedCount++;
          continue;
        }

        // If first card is an object, dehydrate all cards
        if (typeof firstCard === 'object' && firstCard !== null) {
          const cardIds: string[] = [];
          
          for (const card of pkg.cards) {
            if (card && typeof card === 'object' && 'scryfall_id' in card) {
              cardIds.push(card.scryfall_id as string);
            } else {
              console.warn(`Invalid card object in package ${pkg.id}`);
            }
          }

          if (cardIds.length === 0) {
            console.log(`Package ${pkg.id} has no valid card IDs, skipping`);
            skippedCount++;
            continue;
          }

          // Update the package with dehydrated card IDs
          await packageModel.put({
            ...pkg,
            cards: cardIds,
          });

          console.log(`Dehydrated package ${pkg.id}: ${pkg.title} (${cardIds.length} cards)`);
          processedCount++;
        } else {
          console.log(`Package ${pkg.id} has unexpected card format, skipping`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error processing package ${pkg.id}:`, error);
        skippedCount++;
      }
    }

    lastKey = result.lastKey;
    hasMore = !!lastKey;
  }

  console.log('\nDehydration complete!');
  console.log(`Dehydrated: ${processedCount} packages`);
  console.log(`Skipped: ${skippedCount} packages`);
}

async function main() {
  try {
    await dehydratePackages();
    console.log('Migration finished successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();

// Script to cleanup duplicate podcast episodes
// Keeps the oldest episode for each GUID and deletes newer duplicates
require('dotenv').config();

import { episodeDao } from '@server/dynamo/daos';
import { ContentStatus } from '@utils/datatypes/Content';
import Episode from '@utils/datatypes/Episode';

const run = async () => {
  try {
    console.log('Scanning for duplicate podcast episodes...\n');

    // Get all published episodes
    const allEpisodes: Episode[] = [];
    let lastKey = undefined;

    do {
      const result = await episodeDao.queryByStatus(ContentStatus.PUBLISHED, lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        allEpisodes.push(...result.items);
      }
    } while (lastKey);

    console.log(`Total episodes found: ${allEpisodes.length}\n`);

    // Group by GUID
    const guidMap = new Map<string, Episode[]>();
    for (const episode of allEpisodes) {
      if (!guidMap.has(episode.podcastGuid)) {
        guidMap.set(episode.podcastGuid, []);
      }
      guidMap.get(episode.podcastGuid)!.push(episode);
    }

    // Find duplicates
    const duplicateGroups = Array.from(guidMap.entries()).filter(([, episodes]) => episodes.length > 1);

    if (duplicateGroups.length === 0) {
      console.log('✓ No duplicates found!');
      process.exit(0);
    }

    console.log(`Found ${duplicateGroups.length} GUIDs with duplicates\n`);

    // Prepare deletion list
    const toDelete: Episode[] = [];
    const toKeep: Episode[] = [];

    for (const [guid, episodes] of duplicateGroups) {
      // Sort by dateCreated (oldest first)
      const sorted = episodes.sort((a, b) => a.dateCreated - b.dateCreated);

      // Keep the oldest, delete the rest
      const keeper = sorted[0];
      const duplicates = sorted.slice(1);

      toKeep.push(keeper);
      toDelete.push(...duplicates);

      if (toDelete.length <= 5) {
        console.log(`GUID: ${guid}`);
        console.log(
          `  Keeping: ${keeper.title} (ID: ${keeper.id}, Created: ${new Date(keeper.dateCreated).toISOString()})`,
        );
        for (const dup of duplicates) {
          console.log(`  Deleting: ${dup.title} (ID: ${dup.id}, Created: ${new Date(dup.dateCreated).toISOString()})`);
        }
        console.log('');
      }
    }

    if (duplicateGroups.length > 5) {
      console.log(`... (showing first 5 groups only)\n`);
    }

    console.log(`\nSummary:`);
    console.log(`  Total duplicate groups: ${duplicateGroups.length}`);
    console.log(`  Episodes to keep: ${toKeep.length}`);
    console.log(`  Episodes to delete: ${toDelete.length}`);
    console.log(`  Final episode count: ${allEpisodes.length - toDelete.length}\n`);

    // Confirm deletion
    console.log('⚠️  WARNING: This will permanently delete duplicate episodes!');
    console.log('Press Ctrl+C now to cancel, or waiting 5 seconds to continue...\n');

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Delete episodes
    console.log('Starting deletion...\n');
    let deletedCount = 0;

    for (const episode of toDelete) {
      try {
        await episodeDao.delete(episode);
        deletedCount += 1;

        if (deletedCount % 50 === 0) {
          console.log(`Deleted ${deletedCount} of ${toDelete.length} episodes...`);
        }
      } catch (err) {
        console.error(`Failed to delete episode ${episode.id}:`, err);
      }
    }

    console.log(`\n✓ Cleanup complete!`);
    console.log(`  Deleted: ${deletedCount} duplicate episodes`);
    console.log(`  Remaining: ${allEpisodes.length - deletedCount} episodes`);

    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error during cleanup:', err);
    process.exit(1);
  }
};

run();

// Script to delete duplicate podcast episodes created within the past hour
// Run this after a workflow that accidentally created duplicates

require('dotenv').config();

import { episodeDao } from '@server/dynamo/daos';
import { ContentStatus } from '@utils/datatypes/Content';
import Episode from '@utils/datatypes/Episode';

const run = async () => {
  try {
    console.log('Starting deletion of recent duplicate podcast episodes...');

    const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour in milliseconds
    console.log(`Looking for episodes created after: ${new Date(oneHourAgo).toISOString()}`);

    // Get all published episodes
    const allEpisodes: Episode[] = [];
    let lastKey = undefined;

    console.log('Fetching all published episodes...');
    do {
      const result = await episodeDao.queryByStatus(ContentStatus.PUBLISHED, lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        allEpisodes.push(...result.items);
        console.log(`Fetched ${result.items.length} episodes (total: ${allEpisodes.length})`);
      }
    } while (lastKey);

    console.log(`Total episodes found: ${allEpisodes.length}`);

    // Filter to only recent episodes (created within the past hour)
    const recentEpisodes = allEpisodes.filter((episode) => episode.date > oneHourAgo);
    console.log(`Episodes created in the past hour: ${recentEpisodes.length}`);

    if (recentEpisodes.length === 0) {
      console.log('No recent episodes found. Nothing to delete.');
      process.exit(0);
    }

    // All recent episodes are duplicates - delete them all
    console.log(`\nDeleting ALL ${recentEpisodes.length} episodes created in the past hour:`);

    for (const episode of recentEpisodes) {
      console.log(`  - ${episode.title} (${episode.podcastName}) - ID: ${episode.id}`);
    }

    const toDelete = recentEpisodes;

    console.log(`\n\nTotal episodes to delete: ${toDelete.length}`);

    if (toDelete.length === 0) {
      console.log('Nothing to delete.');
      process.exit(0);
    }

    // Delete episodes one by one
    let deletedCount = 0;

    for (const episode of toDelete) {
      try {
        await episodeDao.delete(episode);
        deletedCount += 1;

        if (deletedCount % 25 === 0) {
          console.log(`Deleted ${deletedCount} of ${toDelete.length} episodes...`);
        }
      } catch (err) {
        console.error(`Failed to delete episode ${episode.id}:`, err);
      }
    }

    console.log(`\n✓ Cleanup complete! Deleted ${deletedCount} episodes.`);

    process.exit(0);
  } catch (err) {
    console.error('Error during deletion:', err);
    process.exit(1);
  }
};

run();

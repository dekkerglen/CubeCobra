// Script to inspect podcast episodes and look for duplicates
require('dotenv').config();

import { episodeDao } from '@server/dynamo/daos';
import { ContentStatus } from '@utils/datatypes/Content';
import Episode from '@utils/datatypes/Episode';

const run = async () => {
  try {
    console.log('Scanning podcast episodes...\n');

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

    // Group by podcast
    const byPodcast = new Map<string, Episode[]>();
    for (const episode of allEpisodes) {
      if (!byPodcast.has(episode.podcast)) {
        byPodcast.set(episode.podcast, []);
      }
      byPodcast.get(episode.podcast)!.push(episode);
    }

    console.log(`Found ${byPodcast.size} unique podcasts\n`);

    // Check for duplicates by GUID
    const guidMap = new Map<string, Episode[]>();
    for (const episode of allEpisodes) {
      if (!guidMap.has(episode.podcastGuid)) {
        guidMap.set(episode.podcastGuid, []);
      }
      guidMap.get(episode.podcastGuid)!.push(episode);
    }

    // Find duplicates
    const duplicates = Array.from(guidMap.entries()).filter(([, episodes]) => episodes.length > 1);

    if (duplicates.length > 0) {
      console.log(`\n⚠️  Found ${duplicates.length} duplicate GUIDs:\n`);

      for (const [guid, episodes] of duplicates.slice(0, 5)) {
        console.log(`GUID: ${guid}`);
        console.log(`  Count: ${episodes.length} episodes`);
        for (const ep of episodes) {
          const dateStr = ep.date ? new Date(ep.date).toISOString() : 'INVALID';
          const createdStr = ep.dateCreated ? new Date(ep.dateCreated).toISOString() : 'INVALID';
          console.log(`  - ID: ${ep.id}`);
          console.log(`    Title: ${ep.title}`);
          console.log(`    Date: ${dateStr}`);
          console.log(`    Created: ${createdStr}`);
          console.log(`    Podcast: ${ep.podcastName} (${ep.podcast})`);
        }
        console.log('');
      }

      if (duplicates.length > 5) {
        console.log(`... and ${duplicates.length - 5} more duplicate GUIDs\n`);
      }
    } else {
      console.log('✓ No duplicate GUIDs found\n');
    }

    // Show sample of episodes
    console.log('\n📋 Sample episodes (first 3):');
    for (const episode of allEpisodes.slice(0, 3)) {
      console.log(`\nTitle: ${episode.title}`);
      console.log(`  ID: ${episode.id}`);
      console.log(`  GUID: ${episode.podcastGuid}`);
      console.log(`  Date: ${new Date(episode.date).toISOString()}`);
      console.log(`  Created: ${new Date(episode.dateCreated).toISOString()}`);
      console.log(`  Podcast: ${episode.podcastName} (${episode.podcast})`);
      console.log(`  Image: ${episode.image ? 'Yes' : 'No'}`);
    }

    // Show GUID patterns
    console.log('\n🔍 GUID Analysis:');
    const uniqueGuids = new Set(allEpisodes.map((e) => e.podcastGuid));
    console.log(`  Unique GUIDs: ${uniqueGuids.size}`);
    console.log(`  Total episodes: ${allEpisodes.length}`);
    console.log(`  Duplicates: ${allEpisodes.length - uniqueGuids.size}`);

    // Show first few GUIDs
    console.log('\n  Sample GUIDs:');
    Array.from(uniqueGuids)
      .slice(0, 5)
      .forEach((guid) => {
        console.log(`    - ${guid}`);
      });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

run();

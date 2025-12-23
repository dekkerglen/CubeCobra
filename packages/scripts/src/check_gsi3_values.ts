// Script to check GSI3 values on episodes to debug the query issue
require('dotenv').config();

import { episodeDao } from '@server/dynamo/daos';
import { ContentStatus } from '@utils/datatypes/Content';
import Episode from '@utils/datatypes/Episode';

const run = async () => {
  try {
    console.log('Checking GSI3 index values on episodes...\n');

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

    // Check Lucky Paper Radio specifically
    const luckyPaperEpisodes = allEpisodes.filter((e) => e.podcast === '5f5bacfef0a560104412d522');
    console.log(`Lucky Paper Radio episodes: ${luckyPaperEpisodes.length}`);

    if (luckyPaperEpisodes.length > 0) {
      const sample = luckyPaperEpisodes[0];
      console.log('\nSample Lucky Paper Radio episode:');
      console.log(`  Title: ${sample.title}`);
      console.log(`  ID: ${sample.id}`);
      console.log(`  podcast field: ${sample.podcast}`);
      console.log(`  podcastGuid: ${sample.podcastGuid}`);
      console.log(`  status: ${sample.status}`);
      console.log(`  Expected GSI3PK: EPISODE#PODCAST#${sample.podcast}`);
    }

    // Group by podcast ID
    const byPodcast = new Map<string, number>();
    for (const episode of allEpisodes) {
      const count = byPodcast.get(episode.podcast) || 0;
      byPodcast.set(episode.podcast, count + 1);
    }

    console.log('\n\nEpisodes by podcast ID:');
    for (const [podcastId, count] of byPodcast.entries()) {
      const sample = allEpisodes.find((e) => e.podcast === podcastId);
      console.log(`  ${podcastId}: ${count} episodes (${sample?.podcastName})`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

run();

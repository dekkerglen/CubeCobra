import { ContentStatus } from '@utils/datatypes/Content';
import { episodeDao, podcastDao } from 'dynamo/daos';
import { convert } from 'html-to-text';
import sanitizeHtml from 'sanitize-html';

import { getFeedData, getFeedEpisodes } from './rss';

const removeSpan = (text: string): string =>
  sanitizeHtml(text, {
    allowedTags: sanitizeHtml.defaults.allowedTags.filter((tag: string) => tag !== 'span'),
  });

export const updatePodcast = async (podcast: any): Promise<void> => {
  console.log(`[updatePodcast] Starting update for podcast: ${podcast.title} (ID: ${podcast.id})`);
  console.log(
    `[updatePodcast] Podcast object:`,
    JSON.stringify({ id: podcast.id, title: podcast.title, owner: podcast.owner }, null, 2),
  );

  const feedData = await getFeedData(podcast.url);
  const feedEpisodes = await getFeedEpisodes(podcast.url);
  console.log(`[updatePodcast] Found ${feedEpisodes.length} episodes in RSS feed`);

  // Fetch ALL existing episodes for this podcast (regardless of status)
  const existingEpisodes = [];
  let lastKey = undefined;

  console.log(`[updatePodcast] Querying for episodes with podcast ID: ${podcast.id}`);

  do {
    const result = await episodeDao.queryByPodcast(podcast.id, lastKey);
    console.log(`[updatePodcast] Query result: ${result.items?.length || 0} items, hasMore: ${!!result.lastKey}`);
    if (result.items && result.items.length > 0) {
      existingEpisodes.push(...result.items);
    }
    lastKey = result.lastKey;
  } while (lastKey);

  console.log(`[updatePodcast] Found ${existingEpisodes.length} existing episodes in database`);
  const existingGuids = existingEpisodes.map((episode) => episode.podcastGuid);
  console.log(`[updatePodcast] Existing GUIDs (first 5): ${existingGuids.slice(0, 5).join(', ')}`);

  // Find episodes that need image updates
  const episodesToUpdate = existingEpisodes.filter((episode) => episode.image !== feedData.image);

  if (episodesToUpdate.length > 0) {
    await episodeDao.batchPut(
      episodesToUpdate.map((episode) => ({
        ...episode,
        image: feedData.image,
      })),
    );
  }

  // Update podcast image if different
  if (podcast.image !== feedData.image) {
    podcast.image = feedData.image;
    await podcastDao.update(podcast);
  }

  // Filter out episodes that already exist or have invalid data
  const filtered = feedEpisodes.filter((episode) => {
    // Must have a GUID to prevent duplicates
    if (!episode.guid) {
      console.warn(`[updatePodcast] Skipping episode without GUID: ${episode.title}`);
      return false;
    }

    // Must not already exist
    if (existingGuids.includes(episode.guid)) {
      console.log(`[updatePodcast] Skipping existing episode: ${episode.title} (GUID: ${episode.guid})`);
      return false;
    }

    // Must have a valid date
    if (!episode.date) {
      console.warn(`[updatePodcast] Skipping episode without date: ${episode.title} (GUID: ${episode.guid})`);
      return false;
    }

    return true;
  });

  console.log(`[updatePodcast] Will create ${filtered.length} new episodes`);
  if (filtered.length > 0) {
    console.log(
      `[updatePodcast] New episodes (first 3): ${filtered
        .slice(0, 3)
        .map((e) => `"${e.title}" (${e.guid.substring(0, 20)}...)`)
        .join(', ')}`,
    );
  }

  await Promise.all(
    filtered.map((episode) => {
      const episodeDate = new Date(episode.date).valueOf();
      if (isNaN(episodeDate)) {
        console.error(`[updatePodcast] Invalid date for episode: ${episode.title}, date string: "${episode.date}"`);
      }

      const podcastEpisode = {
        title: episode.title || '',
        body: removeSpan(episode.description || ''),
        date: episodeDate,
        owner: podcast.owner.id,
        image: feedData.image,
        username: podcast.username,
        podcast: podcast.id,
        podcastName: podcast.title,
        podcastGuid: episode.guid,
        podcastLink: episode.link,
        url: episode.source,
        status: ContentStatus.PUBLISHED,
        short: convert(removeSpan(episode.description || ''), {
          wordwrap: 130,
        }).substring(0, 200),
      };

      return episodeDao.createEpisode(podcastEpisode);
    }),
  );

  console.log(`[updatePodcast] Successfully created ${filtered.length} new episodes`);

  podcast.date = new Date().valueOf();
  await podcastDao.update(podcast);
};

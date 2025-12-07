import { ContentStatus, ContentType } from '@utils/datatypes/Content';
import { convert } from 'html-to-text';
import sanitizeHtml from 'sanitize-html';
import { episodeDao, podcastDao } from 'dynamo/daos';

import { getFeedData, getFeedEpisodes } from './rss';

const removeSpan = (text: string): string =>
  sanitizeHtml(text, {
    allowedTags: sanitizeHtml.defaults.allowedTags.filter((tag: string) => tag !== 'span'),
  });

export const updatePodcast = async (podcast: any): Promise<void> => {
  const feedData = await getFeedData(podcast.url);
  const feedEpisodes = await getFeedEpisodes(podcast.url);
  const result = await episodeDao.queryByPodcastAndStatus(podcast.id, ContentStatus.PUBLISHED);

  const existingEpisodes = result.items || [];
  let lastKey = result.lastKey;

  do {
    const nextResult = await episodeDao.queryByPodcastAndStatus(podcast.id, ContentStatus.PUBLISHED, lastKey);
    existingEpisodes.push(...(nextResult.items || []));
    lastKey = nextResult.lastKey;
  } while (lastKey);

  const existingGuids = existingEpisodes.map((episode) => episode.podcastGuid);

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

  const filtered = feedEpisodes.filter((episode) => episode.guid && !existingGuids.includes(episode.guid));

  await Promise.all(
    filtered.map((episode) => {
      const podcastEpisode = {
        title: episode.title || '',
        body: removeSpan(episode.description || ''),
        date: new Date(episode.date || Date.now()).valueOf(),
        owner: podcast.owner.id,
        image: podcast.image,
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

  podcast.date = new Date().valueOf();
  await podcastDao.update(podcast);
};

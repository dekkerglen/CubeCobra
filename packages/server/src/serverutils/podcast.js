const { convert } = require('html-to-text');
const sanitizeHtml = require('sanitize-html');
const { getFeedEpisodes, getFeedData } = require('./rss');

const Content = require('dynamo/models/content');

import { ContentStatus, ContentType } from '@utils/datatypes/Content';

const removeSpan = (text) =>
  sanitizeHtml(text, {
    allowedTags: sanitizeHtml.defaults.allowedTags.filter((tag) => tag !== 'span'),
  });

export const updatePodcast = async (podcast) => {
  const feedData = await getFeedData(podcast.url);
  const feedEpisodes = await getFeedEpisodes(podcast.url);
  const existingEpisodes = await Content.getPodcastEpisodes(podcast.id, ContentStatus.PUBLISHED);
  const existingGuids = existingEpisodes.map((episode) => episode.podcastGuid);

  // Find episodes that need image updates
  const episodesToUpdate = existingEpisodes.filter((episode) => episode.image !== feedData.image);

  if (episodesToUpdate.length > 0) {
    await Content.batchPut(
      episodesToUpdate.map((episode) => ({
        ...episode,
        image: feedData.image,
      })),
    );
  }

  // Update podcast image if different
  if (podcast.image !== feedData.image) {
    podcast.image = feedData.image;
    await Content.update(podcast);
  }

  const filtered = feedEpisodes.filter((episode) => !existingGuids.includes(episode.guid));

  await Promise.all(
    filtered.map((episode) => {
      const podcastEpisode = {
        title: episode.title,
        body: removeSpan(episode.description),
        date: new Date(episode.date).valueOf(),
        owner: podcast.owner.id,
        image: podcast.image,
        username: podcast.username,
        podcast: podcast.id,
        podcastName: podcast.title,
        podcastGuid: episode.guid,
        podcastLink: episode.link,
        url: episode.source,
        status: ContentStatus.PUBLISHED,
        short: convert(removeSpan(episode.description), {
          wordwrap: 130,
        }).substring(0, 200),
      };

      return Content.put(podcastEpisode, ContentType.EPISODE);
    }),
  );

  podcast.date = new Date().valueOf();
  await Content.update(podcast);
};

module.exports = {
  updatePodcast,
};

const htmlToText = require('html-to-text');
const sanitizeHtml = require('sanitize-html');
const { getFeedEpisodes, getFeedData } = require('./rss');

const Content = require('../dynamo/models/content');

const removeSpan = (text) =>
  sanitizeHtml(text, {
    allowedTags: sanitizeHtml.defaults.allowedTags.filter((tag) => tag !== 'span'),
  });

const updatePodcast = async (podcast) => {
  const feedData = await getFeedData(podcast.url);

  const feedEpisodes = await getFeedEpisodes(podcast.url);

  let items = [];
  const existingEpisodes = [];
  let lastKey = null;

  do {
    const result = await Content.getByTypeAndStatus(Content.TYPES.EPISODE, Content.STATUS.PUBLISHED, lastKey);
    lastKey = result.lastKey;
    existingEpisodes.push(...result.items);
  } while (lastKey);

  const existingGuids = existingEpisodes.map((episode) => episode.podcastGuid);

  // if image is different
  if (podcast.image !== feedData.image) {
    // we need to fix this and all episodes
    podcast.image = feedData.image;

    items = existingEpisodes.map((episode) => ({
      ...episode,
      image: feedData.image,
    }));

    await Content.batchPut(items);
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
        status: Content.STATUS.PUBLISHED,
        short: htmlToText
          .fromString(removeSpan(episode.description), {
            wordwrap: 130,
          })
          .substring(0, 200),
      };

      return Content.put(podcastEpisode, Content.TYPES.EPISODE);
    }),
  );

  podcast.date = new Date().valueOf();
  await Content.update(podcast);
};

module.exports = {
  updatePodcast,
};

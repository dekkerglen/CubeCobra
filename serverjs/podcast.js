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

  const episodes = await getFeedEpisodes(podcast.url);
  const existingGuids = episodes.map((episode) => episode.guid);

  let result = await Content.getByTypeAndStatus(Content.TYPES.EPISODE, Content.STATUS.PUBLISHED);
  let items = result.items.filter((item) => existingGuids.includes(item.podcastGuid));
  while (result.lastKey) {
    // eslint-disable-next-line no-await-in-loop
    result = await Content.getByTypeAndStatus(Content.TYPES.EPISODE, Content.STATUS.PUBLISHED, result.lastKey);
    items = [...items, ...result.items.filter((item) => existingGuids.includes(item.podcastGuid))];
  }

  const guids = items.map((episode) => episode.podcastGuid);

  // if image is different
  if (podcast.image !== feedData.image) {
    // we need to fix this and all episodes
    podcast.image = feedData.image;

    items = items.map((episode) => ({
      ...episode,
      image: feedData.image,
    }));

    await Content.batchPut(items);
  }

  const filtered = episodes.filter((episode) => !guids.includes(episode.podcastGuid));

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
        podcastLink: podcast.link,
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

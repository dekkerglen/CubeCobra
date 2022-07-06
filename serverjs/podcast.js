const { getFeedEpisodes } = require('./rss');

const Content = require('../dynamo/models/content');

const updatePodcast = async (podcast) => {
  const episodes = await getFeedEpisodes(podcast.rss);
  const existingGuids = episodes.map((episode) => episode.guid);

  let result = await Content.getByTypeAndStatus(Content.TYPES.EPISODE, Content.STATUS.PUBLISHED);
  let items = result.items.filter((item) => existingGuids.includes(item.PodcastGuid));

  while (result.lastKey) {
    // eslint-disable-next-line no-await-in-loop
    result = await Content.getByTypeAndStatus(Content.TYPES.EPISODE, Content.STATUS.PUBLISHED, result.lastKey);
    items = [...episodes, ...result.items.filter((item) => existingGuids.includes(item.PodcastGuid))];
  }

  const guids = items.map((episode) => episode.PodcastGuid);

  const filtered = episodes.filter((episode) => !guids.includes(episode.guid));

  await Promise.all(
    filtered.map((episode) => {
      const podcastEpisode = {
        Title: episode.title,
        Description: episode.description,
        Url: episode.source,
        Date: new Date(episode.date).valueOf(),
        Owner: podcast.owner,
        Image: podcast.image,
        Username: podcast.username,
        PodcastId: podcast._id,
        PodcastName: podcast.title,
        PodcastGuid: episode.guid,
        PodcastLink: episode.link,
      };

      return Content.put(podcastEpisode, Content.TYPES.EPISODE);
    }),
  );

  podcast.Date = new Date().valueOf();
  await Content.update(podcast);
};

module.exports = {
  updatePodcast,
};

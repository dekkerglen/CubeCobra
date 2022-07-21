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

  const filtered = episodes.filter((episode) => !guids.includes(episode.PodcastGuid));

  await Promise.all(
    filtered.map((episode) => {
      const podcastEpisode = {
        Title: episode.Title,
        Description: episode.Description,
        Url: episode.Url,
        Date: new Date(episode.date).valueOf(),
        Owner: podcast.Owner,
        Image: podcast.Image,
        Username: podcast.Username,
        PodcastId: podcast.Id,
        PodcastName: podcast.Title,
        PodcastGuid: episode.PodcastGuid,
        PodcastLink: episode.Url,
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

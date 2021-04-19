const { getFeedEpisodes } = require('./rss');

const PodcastEpisode = require('../models/podcastEpisode');

const updatePodcast = async (podcast) => {
  const episodes = await getFeedEpisodes(podcast.rss);

  const liveEpisodes = await PodcastEpisode.find({ guid: { $in: episodes.map((episode) => episode.guid) } });

  const guids = liveEpisodes.map((episode) => episode.guid);

  const filtered = episodes.filter((episode) => !guids.includes(episode.guid));

  await Promise.all(
    filtered.map((episode) => {
      const podcastEpisode = new PodcastEpisode();

      podcastEpisode.title = episode.title;
      podcastEpisode.description = episode.description;
      podcastEpisode.source = episode.source;
      podcastEpisode.guid = episode.guid;
      podcastEpisode.link = episode.link;
      podcastEpisode.date = new Date(episode.date);

      podcastEpisode.podcast = podcast._id;
      podcastEpisode.owner = podcast.owner;
      podcastEpisode.image = podcast.image;
      podcastEpisode.username = podcast.username;
      podcastEpisode.podcastname = podcast.title;

      return podcastEpisode.save();
    }),
  );

  podcast.date = new Date();
  await podcast.save();
};

module.exports = {
  updatePodcast,
};

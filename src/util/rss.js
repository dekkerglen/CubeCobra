const RSSParser = require('rss-parser');

const parser = new RSSParser({
  customFields: {
    feed: [['itunes:image', 'image']],
    item: [['enclosure', 'source']],
  },
});
/* we need:

{
  title,
  description,
  url,
  image
}

*/
const getFeedData = async (url) => {
  const feed = await parser.parseURL(url);

  return {
    title: feed.title,
    description: feed.description,
    url: feed.link,
    image: feed.image.$.href,
  };
};

/* we need:

{ 
  title,
  description,
  source,
  guid,
  date,
  link,
}

*/
const getFeedEpisodes = async (url) => {
  const feed = await parser.parseURL(url);

  return feed.items.map((episode) => ({
    title: episode.title,
    description: episode.content,
    source: episode.source.$.url,
    guid: episode.guid,
    date: episode.isoDate,
    link: episode.link,
  }));
};

module.exports = {
  getFeedData,
  getFeedEpisodes,
};

import RSSParser from 'rss-parser';

interface CustomFeed {
  image?: {
    $: {
      href: string;
    };
  };
}

interface CustomItem {
  source?: {
    $: {
      url: string;
    };
  };
}

const parser: RSSParser<CustomFeed, CustomItem> = new RSSParser({
  customFields: {
    feed: [['itunes:image', 'image'] as [string, string]],
    item: [['enclosure', 'source'] as [string, string]],
  },
} as any);
interface FeedData {
  title: string;
  description: string;
  url: string;
  image: string;
}

/* we need:

{
  title,
  description,
  url,
  image
}

*/
const getFeedData = async (url: string): Promise<FeedData> => {
  const feed = await parser.parseURL(url);

  return {
    title: feed.title || '',
    description: feed.description || '',
    url: feed.link || '',
    image: feed.image?.$.href || '',
  };
};

interface FeedEpisode {
  title: string;
  description: string;
  source: string;
  guid: string;
  date: string;
  link: string;
}

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
const getFeedEpisodes = async (url: string): Promise<FeedEpisode[]> => {
  const feed = await parser.parseURL(url);

  return feed.items.map((episode) => ({
    title: episode.title || '',
    description: episode.content || '',
    source: episode.source?.$.url || '',
    guid: episode.guid || '',
    date: episode.isoDate || '',
    link: episode.link || '',
  }));
};

export { getFeedData, getFeedEpisodes };

export default {
  getFeedData,
  getFeedEpisodes,
};

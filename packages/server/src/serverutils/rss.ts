import RSSParser from 'rss-parser';

import { safeFetch } from './safeFetch';

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

// Podcast feeds can be long (years of episode notes), but nothing legitimate comes near this.
const MAX_FEED_BYTES = 5 * 1024 * 1024;
const FEED_TIMEOUT_MS = 10_000;

/** Thrown for any feed that can't be fetched or parsed. The message is safe to show users. */
export class FeedError extends Error {
  /** The underlying fetch or parse failure, for logging. */
  reason: unknown;

  constructor(reason: unknown) {
    super("We couldn't read that podcast feed. Please check the RSS URL and try again.");
    this.name = 'FeedError';
    this.reason = reason;
  }
}

/**
 * Fetches and parses a podcast feed. Feed URLs come from content creators, so the fetch goes
 * through safeFetch (public http(s) hosts only, bounded size and time) rather than letting
 * rss-parser follow the URL itself.
 */
const fetchFeed = async (url: string) => {
  try {
    const res = await safeFetch(url, {
      maxBytes: MAX_FEED_BYTES,
      timeoutMs: FEED_TIMEOUT_MS,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'CubeCobra podcast fetcher',
        Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8',
      },
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Feed responded with status ${res.status}`);
    }
    return await parser.parseString(res.body.toString('utf8'));
  } catch (err) {
    throw new FeedError(err);
  }
};

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
  const feed = await fetchFeed(url);

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
  const feed = await fetchFeed(url);

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

import { FeedError, getFeedData, getFeedEpisodes } from '../../src/serverutils/rss';

jest.mock('../../src/serverutils/safeFetch', () => ({
  safeFetch: jest.fn(),
}));

import { safeFetch } from '../../src/serverutils/safeFetch';

const FEED = `<?xml version="1.0"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Cube Talk</title>
    <description>All about cubes</description>
    <link>https://example.com</link>
    <itunes:image href="https://example.com/art.png"/>
    <item>
      <title>Episode 1</title>
      <guid>ep-1</guid>
      <link>https://example.com/1</link>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
      <enclosure url="https://example.com/1.mp3" type="audio/mpeg"/>
      <description>First</description>
    </item>
  </channel>
</rss>`;

const respond = (status: number, body: string) =>
  (safeFetch as jest.Mock).mockResolvedValue({ status, headers: {}, body: Buffer.from(body), url: 'x' });

describe('podcast feed fetching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches feeds through safeFetch with size and time limits', async () => {
    respond(200, FEED);

    const data = await getFeedData('https://example.com/feed.xml');

    expect(safeFetch).toHaveBeenCalledWith(
      'https://example.com/feed.xml',
      expect.objectContaining({ maxBytes: 5 * 1024 * 1024, timeoutMs: 10_000 }),
    );
    expect(data).toEqual({
      title: 'Cube Talk',
      description: 'All about cubes',
      url: 'https://example.com',
      image: 'https://example.com/art.png',
    });
  });

  it('parses episodes from the fetched body', async () => {
    respond(200, FEED);

    const episodes = await getFeedEpisodes('https://example.com/feed.xml');

    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({ title: 'Episode 1', guid: 'ep-1', source: 'https://example.com/1.mp3' });
  });

  it.each([
    ['a blocked address', () => (safeFetch as jest.Mock).mockRejectedValue(new Error('non-public address'))],
    ['an error status', () => respond(404, 'Not found')],
    ['a body that is not a feed', () => respond(200, 'not xml at all <<<')],
  ])('turns %s into a FeedError with a generic message', async (_label, setup) => {
    setup();

    const error = await getFeedData('http://10.0.0.1/feed').catch((err) => err);

    expect(error).toBeInstanceOf(FeedError);
    expect(error.message).not.toContain('10.0.0.1');
    expect(error.message).not.toContain('404');
  });
});

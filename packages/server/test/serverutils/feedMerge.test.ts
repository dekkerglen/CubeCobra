import BlogPost from '@utils/datatypes/BlogPost';

import { FeedCursor, mergeFeedStreams, parseFeedCursor } from '../../src/serverutils/feedMerge';

const post = (id: string, date: number, cube: string = 'cube-1'): BlogPost =>
  ({ id, date, cube, cubeName: 'Cube', body: '', owner: { id: 'u', username: 'u' } }) as unknown as BlogPost;

const merge = (input: {
  personal?: BlogPost[];
  personalHasMore?: boolean;
  announcements?: BlogPost[];
  announcementsHasMore?: boolean;
  limit?: number;
  cursor?: FeedCursor;
}) =>
  mergeFeedStreams({
    personal: input.personal ?? [],
    personalHasMore: input.personalHasMore ?? false,
    announcements: input.announcements ?? [],
    announcementsHasMore: input.announcementsHasMore ?? false,
    limit: input.limit ?? 10,
    cursor: input.cursor,
  });

describe('mergeFeedStreams', () => {
  it('interleaves the two streams newest first', () => {
    const { items } = merge({
      personal: [post('p300', 300), post('p100', 100)],
      announcements: [post('a200', 200, 'DEVBLOG')],
    });

    expect(items.map((i) => i.id)).toEqual(['p300', 'a200', 'p100']);
  });

  it('delivers announcements to a user with no personal feed', () => {
    const { items } = merge({ announcements: [post('a1', 200, 'DEVBLOG')] });

    expect(items.map((i) => i.id)).toEqual(['a1']);
  });

  it('drops legacy DEVBLOG rows from the personal stream', () => {
    const { items } = merge({
      personal: [post('a1', 200, 'DEVBLOG')],
      announcements: [post('a1', 200, 'DEVBLOG')],
    });

    expect(items.map((i) => i.id)).toEqual(['a1']);
  });

  it('returns no cursor when both streams are exhausted', () => {
    const { cursor } = merge({ personal: [post('p1', 100)], announcements: [post('a1', 200, 'DEVBLOG')] });

    expect(cursor).toBeUndefined();
  });

  it('returns a cursor when only the announcement stream has more', () => {
    const { cursor } = merge({
      personal: [post('p1', 100)],
      announcements: [post('a1', 200, 'DEVBLOG')],
      announcementsHasMore: true,
    });

    expect(cursor).toEqual({ date: 100, ids: ['p1'] });
  });

  it('returns a cursor when the page was truncated by the limit', () => {
    const { items, cursor } = merge({
      personal: [post('p300', 300), post('p200', 200)],
      limit: 1,
    });

    expect(items.map((i) => i.id)).toEqual(['p300']);
    expect(cursor).toEqual({ date: 300, ids: ['p300'] });
  });

  it('suppresses ids already emitted at the watermark date', () => {
    const { items } = merge({
      personal: [post('p1', 100), post('p2', 100)],
      cursor: { date: 100, ids: ['p1'] },
    });

    expect(items.map((i) => i.id)).toEqual(['p2']);
  });

  it('unions incoming cursor ids when the watermark date is unchanged', () => {
    const { cursor } = merge({
      personal: [post('p2', 100), post('p3', 100)],
      personalHasMore: true,
      cursor: { date: 100, ids: ['p1'] },
    });

    expect(cursor!.date).toBe(100);
    expect([...cursor!.ids].sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('carries a millisecond tie across a page boundary exactly once', () => {
    const personal = [post('p1', 100)];
    const announcements = [post('a1', 100, 'DEVBLOG')];

    const first = merge({ personal, announcements, limit: 1 });
    const second = merge({ personal, announcements, limit: 1, cursor: first.cursor });

    const seen = [...first.items, ...second.items].map((i) => i.id);
    expect([...seen].sort()).toEqual(['a1', 'p1']);
    expect(new Set(seen).size).toBe(2);
  });

  it('advances past the oldest fetched date when every fetched item was suppressed', () => {
    const { items, cursor } = merge({
      personal: [post('legacy', 100, 'DEVBLOG')],
      personalHasMore: true,
    });

    expect(items).toEqual([]);
    expect(cursor).toEqual({ date: 99, ids: [] });
  });

  it('never suppresses an announcement by the id of its legacy feed row', () => {
    // 'shared' is one blog post reachable from both streams. If the empty-page cursor
    // recorded its id, the announcement would be hidden on every later page.
    const { cursor } = merge({
      personal: [post('shared', 100, 'DEVBLOG')],
      personalHasMore: true,
    });

    expect(cursor!.ids).not.toContain('shared');
  });

  it('returns no cursor when nothing was fetched at all', () => {
    expect(merge({ personalHasMore: true }).cursor).toBeUndefined();
  });

  it('orders ties by id so the sequence is total and stable', () => {
    const { items } = merge({
      personal: [post('b', 100)],
      announcements: [post('a', 100, 'DEVBLOG')],
    });

    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  describe('visibility', () => {
    const hidden = new Set(['hidden-1', 'hidden-2']);
    const isVisible = (item: BlogPost) => !hidden.has(item.id);

    it('excludes items the visibility predicate rejects', () => {
      const { items } = mergeFeedStreams({
        personal: [post('hidden-1', 300), post('shown', 200)],
        personalHasMore: false,
        announcements: [],
        announcementsHasMore: false,
        limit: 10,
        isVisible,
      });

      expect(items.map((i) => i.id)).toEqual(['shown']);
    });

    it('fills the page from visible items rather than slicing before filtering', () => {
      // Slicing first would emit only 'hidden-1', leaving the caller an empty page while
      // visible items it could have shown sit just past the limit.
      const { items } = mergeFeedStreams({
        personal: [post('hidden-1', 300), post('hidden-2', 200), post('shown', 100)],
        personalHasMore: false,
        announcements: [],
        announcementsHasMore: false,
        limit: 1,
        isVisible,
      });

      expect(items.map((i) => i.id)).toEqual(['shown']);
    });

    it('advances the cursor when every fetched item was invisible', () => {
      const { items, cursor } = mergeFeedStreams({
        personal: [post('hidden-1', 300), post('hidden-2', 200)],
        personalHasMore: true,
        announcements: [],
        announcementsHasMore: false,
        limit: 10,
        isVisible,
      });

      expect(items).toEqual([]);
      expect(cursor).toEqual({ date: 199, ids: [] });
    });
  });
});

describe('parseFeedCursor', () => {
  it.each([null, undefined, 'x', 42, {}, { date: 'x' }, [], { ids: ['a'] }])(
    'returns undefined for malformed cursor %p',
    (raw) => {
      expect(parseFeedCursor(raw)).toBeUndefined();
    },
  );

  it('coerces a missing ids array to empty', () => {
    expect(parseFeedCursor({ date: 100 })).toEqual({ date: 100, ids: [] });
  });

  it('coerces a non-array ids to empty', () => {
    expect(parseFeedCursor({ date: 100, ids: 'nope' })).toEqual({ date: 100, ids: [] });
  });

  it('keeps only string ids', () => {
    expect(parseFeedCursor({ date: 100, ids: ['a', 7, null, 'b'] })).toEqual({ date: 100, ids: ['a', 'b'] });
  });

  it('round-trips a cursor produced by the merge', () => {
    const { cursor } = merge({ personal: [post('p1', 100)], personalHasMore: true });

    expect(parseFeedCursor(JSON.parse(JSON.stringify(cursor)))).toEqual(cursor);
  });
});

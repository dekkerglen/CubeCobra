import BlogPost from '@utils/datatypes/BlogPost';

import { FeedCursor, FeedStreamCursor, mergeFeedStreams, parseFeedCursor } from '../../src/serverutils/feedMerge';

const post = (id: string, date: number, cube: string = 'cube-1'): BlogPost =>
  ({ id, date, cube, cubeName: 'Cube', body: '', owner: { id: 'u', username: 'u' } }) as unknown as BlogPost;

const merge = (input: {
  personal?: BlogPost[];
  personalHasMore?: boolean;
  announcements?: BlogPost[];
  announcementsHasMore?: boolean;
  limit?: number;
  cursor?: FeedCursor;
  isVisible?: (item: BlogPost) => boolean;
}) =>
  mergeFeedStreams({
    personal: input.personal ?? [],
    personalHasMore: input.personalHasMore ?? false,
    announcements: input.announcements ?? [],
    announcementsHasMore: input.announcementsHasMore ?? false,
    limit: input.limit ?? 10,
    cursor: input.cursor,
    isVisible: input.isVisible ?? (() => true),
  });

const streamCursor = (date: number, ids: string[] = [], done = false): FeedStreamCursor => ({ date, ids, done });

const cursorFor = (personal: FeedStreamCursor, announcements: FeedStreamCursor): FeedCursor => ({
  personal,
  announcements,
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

    // The personal stream is exhausted with nothing left over, so it is done; the announcement
    // stream resumes at its own oldest fetched date rather than at the page cut.
    expect(cursor!.personal).toEqual(streamCursor(100, ['p1'], true));
    expect(cursor!.announcements).toEqual(streamCursor(200, ['a1']));
  });

  it('returns a cursor when the page was truncated by the limit', () => {
    const { items, cursor } = merge({
      personal: [post('p300', 300), post('p200', 200)],
      limit: 1,
    });

    expect(items.map((i) => i.id)).toEqual(['p300']);
    expect(cursor!.personal).toEqual(streamCursor(300, ['p300']));
    expect(cursor!.announcements).toEqual(streamCursor(300, [], true));
  });

  it('suppresses ids already emitted at the watermark date', () => {
    const { items } = merge({
      personal: [post('p1', 100), post('p2', 100)],
      cursor: cursorFor(streamCursor(100, ['p1']), streamCursor(100, ['p1'])),
    });

    expect(items.map((i) => i.id)).toEqual(['p2']);
  });

  it('unions incoming cursor ids when the watermark date is unchanged', () => {
    const { cursor } = merge({
      personal: [post('p2', 100), post('p3', 100)],
      personalHasMore: true,
      cursor: cursorFor(streamCursor(100, ['p1']), streamCursor(100, ['p1'])),
    });

    expect(cursor!.personal.date).toBe(100);
    expect([...cursor!.personal.ids].sort()).toEqual(['p1', 'p2', 'p3']);
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
    expect(cursor!.personal).toEqual(streamCursor(99));
    expect(cursor!.announcements).toEqual(streamCursor(Number.MAX_SAFE_INTEGER, [], true));
  });

  it('never suppresses an announcement by the id of its legacy feed row', () => {
    // 'shared' is one blog post reachable from both streams. If the empty-page cursor
    // recorded its id, the announcement would be hidden on every later page.
    const { cursor } = merge({
      personal: [post('shared', 100, 'DEVBLOG')],
      personalHasMore: true,
    });

    expect(cursor!.personal.ids).not.toContain('shared');
    expect(cursor!.announcements.ids).not.toContain('shared');
  });

  it('steps each stream back to its own oldest fetched date when the page is empty', () => {
    const { items, cursor } = merge({
      personal: [post('legacy', 1000, 'DEVBLOG')],
      personalHasMore: true,
      announcements: [],
      limit: 10,
    });

    expect(items).toEqual([]);
    expect(cursor!.personal.date).toBe(999);
    expect(cursor!.announcements.done).toBe(true);
  });

  it('does not drag one stream back to the other stream oldest date on an empty page', () => {
    const { cursor } = merge({
      personal: [post('legacy', 1000, 'DEVBLOG')],
      personalHasMore: true,
      announcements: [post('legacyA', 5, 'DEVBLOG')],
      announcementsHasMore: true,
      isVisible: () => false,
      limit: 10,
    });

    expect(cursor!.personal.date).toBe(999);
    expect(cursor!.announcements.date).toBe(4);
  });

  it('holds a stream on an empty page when its step-back would land at or above its own bound', () => {
    // Reachable today: the route queries both streams under the personal watermark, so the
    // announcement stream can fetch rows newer than its own bound. Stepping back from one of
    // those would move it up over announcements it has already shown.
    const { cursor } = merge({
      personal: [post('legacy', 1000, 'DEVBLOG')],
      personalHasMore: true,
      announcements: [post('legacyA', 900, 'DEVBLOG')],
      announcementsHasMore: true,
      isVisible: () => false,
      cursor: cursorFor(streamCursor(2000), streamCursor(500, ['a0'])),
      limit: 10,
    });

    expect(cursor!.announcements).toEqual(streamCursor(500, ['a0']));
  });

  it('leaves a stream that fetched nothing on an empty page exactly where it stood', () => {
    // The personal stream can come back empty with more to read, because feed rows whose blog
    // post was deleted are dropped during hydration. There is no date to step past, so the
    // stream must hold its bound — and keep the ids it already showed there suppressed.
    const { cursor } = merge({
      personal: [],
      personalHasMore: true,
      announcements: [post('legacyA', 1000, 'DEVBLOG')],
      announcementsHasMore: true,
      isVisible: () => false,
      cursor: cursorFor(streamCursor(500, ['p0']), streamCursor(2000)),
      limit: 10,
    });

    expect(cursor!.personal).toEqual(streamCursor(500, ['p0']));
    expect(cursor!.announcements.date).toBe(999);
  });

  it('holds a stream that fetched nothing above every date when it has no cursor yet', () => {
    // Without a prior bound there is nothing to hold, and any ordinary date would claim this
    // stream had been read down to it. The next query must still start from the top.
    const { cursor } = merge({
      personal: [],
      personalHasMore: true,
      announcements: [post('legacyA', 1000, 'DEVBLOG')],
      announcementsHasMore: true,
      isVisible: () => false,
      limit: 10,
    });

    expect(cursor!.personal).toEqual(streamCursor(Number.MAX_SAFE_INTEGER));
  });

  it('returns no cursor when neither stream fetched anything', () => {
    expect(merge({ personalHasMore: true }).cursor).toBeUndefined();
  });

  it('orders ties by id so the sequence is total and stable', () => {
    const { items } = merge({
      personal: [post('b', 100)],
      announcements: [post('a', 100, 'DEVBLOG')],
    });

    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('bounds a truncated personal stream by its own oldest fetched item, not the page cut', () => {
    // The reported bug: the page tails with ancient announcements, and the personal
    // stream still has unfetched items far newer than that tail.
    const { cursor } = merge({
      personal: [post('p1', 1000), post('p2', 999)],
      personalHasMore: true,
      announcements: [post('a1', 50, 'DEVBLOG'), post('a2', 10, 'DEVBLOG')],
      limit: 10,
    });

    expect(cursor!.personal.date).toBe(999);
    expect(cursor!.announcements.date).toBe(10);
  });

  it('bounds a truncated announcement stream by its own oldest fetched item', () => {
    const { cursor } = merge({
      personal: [post('p1', 50), post('p2', 10)],
      announcements: [post('a1', 1000, 'DEVBLOG'), post('a2', 999, 'DEVBLOG')],
      announcementsHasMore: true,
      limit: 10,
    });

    expect(cursor!.announcements.date).toBe(999);
    expect(cursor!.personal.date).toBe(10);
  });

  it('uses the page cut when a stream fetched past it', () => {
    const { cursor } = merge({
      personal: [post('p1', 300), post('p2', 200), post('p3', 100)],
      personalHasMore: true,
      limit: 2,
    });

    expect(cursor!.personal.date).toBe(200);
    expect(cursor!.personal.ids).toEqual(['p2']);
  });

  it('does not drag the other stream when one stream is empty', () => {
    const { cursor } = merge({
      personal: [post('p1', 1000), post('p2', 900)],
      personalHasMore: true,
      announcements: [],
      limit: 10,
    });

    expect(cursor!.personal.date).toBe(900);
    expect(cursor!.announcements.done).toBe(true);
  });

  it('marks a stream done when it is exhausted with nothing left over', () => {
    const { cursor } = merge({
      personal: [post('p1', 1000)],
      personalHasMore: false,
      announcements: [post('a1', 900, 'DEVBLOG')],
      announcementsHasMore: true,
      limit: 10,
    });

    expect(cursor!.personal.done).toBe(true);
  });

  it('does not mark an exhausted stream done when visible items fell past the limit', () => {
    const { cursor } = merge({
      personal: [post('p1', 300), post('p2', 200)],
      personalHasMore: false,
      announcements: [post('a1', 100, 'DEVBLOG')],
      announcementsHasMore: true,
      limit: 1,
    });

    expect(cursor!.personal.done).toBe(false);
    expect(cursor!.personal.date).toBe(300);
  });

  it('scopes suppressed ids to the stream that emitted them', () => {
    const { cursor } = merge({
      personal: [post('p1', 100)],
      personalHasMore: true,
      announcements: [post('a1', 100, 'DEVBLOG')],
      announcementsHasMore: true,
      limit: 10,
    });

    expect(cursor!.personal.ids).toEqual(['p1']);
    expect(cursor!.announcements.ids).toEqual(['a1']);
  });

  it('suppresses ids carried by either stream', () => {
    // The read side of per-stream ids. Under a shared cursor this passed by accident,
    // because both entries held the same ids.
    const { items } = merge({
      personal: [post('p1', 100), post('p2', 100)],
      announcements: [post('a1', 100, 'DEVBLOG'), post('a2', 100, 'DEVBLOG')],
      cursor: cursorFor(streamCursor(100, ['p1']), streamCursor(100, ['a1'])),
      limit: 10,
    });

    expect(items.map((i) => i.id).sort()).toEqual(['a2', 'p2']);
  });

  it('never advances a stream past the bound it was queried under', () => {
    // The personal stream filled the whole page above the announcement stream's incoming bound.
    // Without a clamp the announcement watermark jumps up to the page cut and re-reads every row
    // between 50 and 900 — including a0, which the cursor recorded as already shown.
    const { cursor } = merge({
      personal: [post('p1', 1000), post('p2', 900)],
      personalHasMore: true,
      announcements: [post('a1', 50, 'DEVBLOG')],
      announcementsHasMore: true,
      cursor: cursorFor(streamCursor(2000, []), streamCursor(50, ['a0'])),
      limit: 2,
    });

    expect(cursor!.announcements.date).toBe(50);
    expect(cursor!.announcements.ids).toEqual(['a0']);
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
      expect(cursor!.personal).toEqual(streamCursor(199));
      expect(cursor!.announcements).toEqual(streamCursor(Number.MAX_SAFE_INTEGER, [], true));
    });
  });
});

describe('parseFeedCursor', () => {
  const stream = { date: 100, ids: ['a'], done: false };

  it('parses a well-formed per-stream cursor', () => {
    expect(parseFeedCursor({ personal: stream, announcements: stream })).toEqual({
      personal: { date: 100, ids: ['a'], done: false },
      announcements: { date: 100, ids: ['a'], done: false },
    });
  });

  it('rejects the legacy single-date cursor shape', () => {
    expect(parseFeedCursor({ date: 100, ids: ['a'] })).toBeUndefined();
  });

  it.each([null, undefined, 'x', 7, [], {}, { personal: stream }, { announcements: stream }])(
    'returns undefined for %p',
    (raw) => {
      expect(parseFeedCursor(raw)).toBeUndefined();
    },
  );

  it.each([NaN, Infinity, -Infinity, '100'])('returns undefined for a non-finite date %p', (date) => {
    expect(parseFeedCursor({ personal: { ...stream, date }, announcements: stream })).toBeUndefined();
  });

  it('coerces a missing or malformed ids array to empty', () => {
    const parsed = parseFeedCursor({
      personal: { date: 100, done: false },
      announcements: { date: 100, ids: 'nope', done: false },
    });
    expect(parsed!.personal.ids).toEqual([]);
    expect(parsed!.announcements.ids).toEqual([]);
  });

  it('keeps only string ids', () => {
    const parsed = parseFeedCursor({
      personal: { date: 100, ids: ['a', 1, null, 'b'], done: false },
      announcements: stream,
    });
    expect(parsed!.personal.ids).toEqual(['a', 'b']);
  });

  it('coerces a non-boolean done to false', () => {
    const parsed = parseFeedCursor({ personal: { date: 100, ids: [], done: 'yes' }, announcements: stream });
    expect(parsed!.personal.done).toBe(false);
  });

  it('preserves a done stream through the parser', () => {
    // A parser that hardcoded done:false would pass every other test in this file,
    // and the bug would surface here as a done stream re-queried forever.
    const parsed = parseFeedCursor({
      personal: { date: 100, ids: [], done: true },
      announcements: { date: 100, ids: [], done: false },
    });

    expect(parsed!.personal.done).toBe(true);
  });

  it.each([null, [], 'x', 7])('returns undefined for a non-object stream entry %p', (personal) => {
    expect(parseFeedCursor({ personal, announcements: { date: 100, ids: [], done: false } })).toBeUndefined();
  });

  it('round-trips a cursor produced by the merge', () => {
    const { cursor } = merge({
      personal: [post('p1', 100)],
      personalHasMore: true,
      announcements: [post('a1', 200, 'DEVBLOG')],
      announcementsHasMore: true,
    });

    expect(cursor).toBeDefined();
    expect(parseFeedCursor(JSON.parse(JSON.stringify(cursor)))).toEqual(cursor);
  });
});

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
    // Not reachable through the dashboard route any more, now that it queries each stream under
    // its own watermark — this pins the guard that keeps it that way. A stream queried above its
    // own bound fetches rows newer than it, and stepping back from one would move the stream up
    // over announcements it has already shown.
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

  describe('paging to exhaustion', () => {
    const MAX_ROUNDS = 100;

    const idsOf = (items: BlogPost[]): string[] => items.map((item) => item.id);

    // One stream's side of one round, as the DAOs serve it: the newest `fetchLimit` rows at or
    // below that stream's own cursor date, plus whether any row remains below them. The date
    // bound is inclusive — the DAOs compare `GSI1SK <= 'DATE#' + before` — which is why the
    // last row of a page comes back on the next query and has to be suppressed by id. A stream
    // the merge marked done is not queried at all, matching the handler's EXHAUSTED_STREAM.
    const queryStream = (
      all: BlogPost[],
      cursor: FeedStreamCursor | undefined,
      fetchLimit: number,
    ): { items: BlogPost[]; hasMore: boolean } => {
      if (cursor?.done) {
        return { items: [], hasMore: false };
      }

      const available = all
        .filter((item) => cursor === undefined || item.date <= cursor.date)
        .sort((a, b) => b.date - a.date || a.id.localeCompare(b.id));

      return { items: available.slice(0, fetchLimit), hasMore: available.length > fetchLimit };
    };

    // Simulates the handler: each round re-queries both streams bounded by their own
    // cursor date, taking at most `fetchLimit` items per stream, until no cursor remains.
    // Throws after 100 rounds so non-termination fails loudly instead of hanging.
    // Returns the concatenated ids of every page, in page order.
    //
    // `fetchLimit` is deliberately larger than `pageLimit` in every call below. Production runs
    // them equal, which means one stream can never fill a whole page on its own, and that
    // arithmetic coincidence hides watermark bugs that only appear when it can.
    const drain = (
      personalAll: BlogPost[],
      announcementsAll: BlogPost[],
      pageLimit: number,
      fetchLimit: number,
      isVisible: (item: BlogPost) => boolean = () => true,
    ): string[] => {
      const seen: string[] = [];
      let cursor: FeedCursor | undefined;

      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const personal = queryStream(personalAll, cursor?.personal, fetchLimit);
        const announcements = queryStream(announcementsAll, cursor?.announcements, fetchLimit);

        // An empty page is a round that contributes nothing, which is what the handler's own
        // retry loop does before it answers the client.
        const page = merge({
          personal: personal.items,
          personalHasMore: personal.hasMore,
          announcements: announcements.items,
          announcementsHasMore: announcements.hasMore,
          limit: pageLimit,
          cursor,
          isVisible,
        });

        seen.push(...idsOf(page.items));
        cursor = page.cursor;

        if (!cursor) {
          return seen;
        }
      }

      throw new Error(`drain did not terminate within ${MAX_ROUNDS} rounds`);
    };

    it('yields every visible item exactly once when announcements are ancient and sparse', () => {
      const personalAll = Array.from({ length: 40 }, (_, i) => post(`p${i}`, 10000 - i));
      const announcementsAll = Array.from({ length: 5 }, (_, i) => post(`a${i}`, 100 - i, 'DEVBLOG'));

      const seen = drain(personalAll, announcementsAll, 10, 25);

      expect(new Set(seen).size).toBe(45);
      expect(seen.length).toBe(45);
      expect(new Set(seen)).toEqual(new Set(idsOf([...personalAll, ...announcementsAll])));
    });

    it('yields every visible item exactly once when the personal stream is ancient and sparse', () => {
      const personalAll = Array.from({ length: 5 }, (_, i) => post(`p${i}`, 100 - i));
      const announcementsAll = Array.from({ length: 40 }, (_, i) => post(`a${i}`, 10000 - i, 'DEVBLOG'));

      const seen = drain(personalAll, announcementsAll, 10, 25);

      expect(new Set(seen).size).toBe(45);
      expect(seen.length).toBe(45);
      expect(new Set(seen)).toEqual(new Set(idsOf([...personalAll, ...announcementsAll])));
    });

    it('yields every visible item exactly once when most personal rows are invisible', () => {
      const personalAll = Array.from({ length: 40 }, (_, i) =>
        post(`p${i}`, 10000 - i, i % 4 === 0 ? 'cube-1' : 'hidden'),
      );
      const announcementsAll = Array.from({ length: 5 }, (_, i) => post(`a${i}`, 100 - i, 'DEVBLOG'));

      const seen = drain(personalAll, announcementsAll, 10, 25, (item) => item.cube !== 'hidden');

      expect(seen.length).toBe(15);
      expect(new Set(seen).size).toBe(15);
      expect(new Set(seen)).toEqual(
        new Set(idsOf([...personalAll.filter((item) => item.cube !== 'hidden'), ...announcementsAll])),
      );
    });

    it('yields every visible item exactly once when one stream fills whole pages above the other bound', () => {
      // The Task 2 regression: a dense recent stream fills every page slot while the other
      // stream's bound sits far below, which is where an unclamped watermark regresses upward
      // and re-emits. Requires fetchLimit > pageLimit to reach.
      const personalAll = Array.from({ length: 60 }, (_, i) => post(`p${i}`, 10000 - i));
      const announcementsAll = Array.from({ length: 8 }, (_, i) => post(`a${i}`, 100 - i, 'DEVBLOG'));

      const seen = drain(personalAll, announcementsAll, 10, 25);

      expect(seen.length).toBe(68);
      expect(new Set(seen).size).toBe(68);
      expect(new Set(seen)).toEqual(new Set(idsOf([...personalAll, ...announcementsAll])));
    });

    it('yields every visible item exactly once when a page cuts inside the announcements and the next does not', () => {
      // The Task 2 regression, reached. The fixture above does not get there: its personal
      // stream is dense enough that the cut never lands inside the announcements while personal
      // rows remain above, so the announcement watermark never has recorded ids to lose.
      //
      // Here the first fetch window of the personal stream is mostly invisible, so the first
      // page tails with ancient announcements and the announcement cursor records a2 at date 98.
      // The second window is dense, so the second page is filled entirely by personal rows far
      // above 98. An unclamped watermark follows that cut up to ~9966, drops the a2 id with the
      // move, and re-emits a0-a2 on the page after it.
      const personalAll = Array.from({ length: 40 }, (_, i) =>
        post(`p${i}`, 10000 - i, i >= 25 || i % 4 === 0 ? 'cube-1' : 'hidden'),
      );
      const announcementsAll = Array.from({ length: 8 }, (_, i) => post(`a${i}`, 100 - i, 'DEVBLOG'));

      const seen = drain(personalAll, announcementsAll, 10, 25, (item) => item.cube !== 'hidden');

      expect(seen.length).toBe(30);
      expect(new Set(seen).size).toBe(30);
      expect(new Set(seen)).toEqual(
        new Set(idsOf([...personalAll.filter((item) => item.cube !== 'hidden'), ...announcementsAll])),
      );
    });

    it('terminates rather than looping', () => {
      // drain() throws after 100 rounds; reaching that is the failure. The personal stream here
      // is dense, entirely invisible, and longer than one fetch, so round after round comes back
      // empty and only the per-stream step-back moves the cursor. A step-back that failed to
      // move — or that moved one stream by the other's reach — would spin here forever.
      const personalAll = Array.from({ length: 60 }, (_, i) => post(`p${i}`, 10000 - i, 'hidden'));
      const announcementsAll = Array.from({ length: 5 }, (_, i) => post(`a${i}`, 100 - i, 'DEVBLOG'));

      const seen = drain(personalAll, announcementsAll, 10, 25, (item) => item.cube !== 'hidden');

      expect(seen).toEqual(['a0', 'a1', 'a2', 'a3', 'a4']);
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

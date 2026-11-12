import BlogPost from '@utils/datatypes/BlogPost';

/** The sentinel cube id that marks a post as a site-wide developer announcement. */
export const DEV_BLOG_CUBE = 'DEVBLOG';

/**
 * Position of a single stream in the merged feed: the date of the last item shown from it, plus
 * the ids already shown at exactly that date. The date bound on each stream query is inclusive,
 * so without the ids the last item of a page would reappear as the first item of the next one.
 * `done` means this stream has nothing left to contribute.
 */
export interface FeedStreamCursor {
  date: number;
  ids: string[];
  done: boolean;
}

/**
 * Position in the merged feed, as one watermark per stream.
 *
 * The streams are queried under independent limits and have independent densities, so a page cut
 * leaves them at different depths: one stream can be truncated at its limit with unfetched items
 * still above the cut while the other is exhausted far below it. A single shared watermark would
 * advance the truncated stream past those unfetched items and drop them permanently, so each
 * stream carries its own.
 */
export interface FeedCursor {
  personal: FeedStreamCursor;
  announcements: FeedStreamCursor;
}

const parseStreamCursor = (raw: unknown): FeedStreamCursor | undefined => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return undefined;
  }

  const { date, ids, done } = raw as { date?: unknown; ids?: unknown; done?: unknown };

  if (typeof date !== 'number' || !Number.isFinite(date)) {
    return undefined;
  }

  return {
    date,
    ids: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [],
    done: done === true,
  };
};

/**
 * Reads a cursor off a client request body. Returns undefined — meaning "start from the top" —
 * for anything malformed, including the legacy single-date shape, and never throws, because this
 * value is client-supplied. A cursor is accepted only if both of its streams parse: half a
 * position is not a position.
 */
export const parseFeedCursor = (raw: unknown): FeedCursor | undefined => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return undefined;
  }

  const { personal, announcements } = raw as { personal?: unknown; announcements?: unknown };

  const parsedPersonal = parseStreamCursor(personal);
  const parsedAnnouncements = parseStreamCursor(announcements);

  if (!parsedPersonal || !parsedAnnouncements) {
    return undefined;
  }

  return { personal: parsedPersonal, announcements: parsedAnnouncements };
};

const newestFirst = (a: BlogPost, b: BlogPost): number => b.date - a.date || a.id.localeCompare(b.id);

/**
 * The bound for a stream that has no position yet, so a query made under it reads the stream from
 * the top. A cursor entry must hold a finite date, so "unbounded" has to be spelled as a date no
 * row can reach.
 *
 * This outranks every stored row through its *string* form: the DAOs bound their queries with
 * `GSI1SK <= 'DATE#' + before`, compared lexicographically, and `DATE#9007199254740991` sorts above
 * every 13-digit epoch-millisecond key because `'9' > '1'`. A bound rendered some other way would
 * need checking again.
 */
const TOP_OF_STREAM = Number.MAX_SAFE_INTEGER;

const oldestFetchedDate = (stream: BlogPost[]): number | undefined =>
  stream.length === 0 ? undefined : Math.min(...stream.map((item) => item.date));

/**
 * Where one stream resumes on the next page.
 *
 * The bound is `max(cutDate, oldestFetched)`, clamped to the stream's own incoming bound: a
 * stream whose fetched rows reach past the page cut resumes at the cut, while a stream truncated
 * above the cut resumes at its own oldest fetched row, so the rows it never fetched are not
 * skipped.
 *
 * `ids` are the ids this stream emitted at exactly that bound, since the date bound on the query
 * is inclusive, unioned with the incoming ids when the bound has not moved.
 *
 * `done` is not simply `!hasMore`: a stream with nothing left to query can still have visible
 * items that fell past the page limit, and those must be re-queried rather than dropped.
 */
const nextStreamCursor = ({
  emitted,
  leftover,
  oldestFetched,
  hasMore,
  incoming,
  cutDate,
}: {
  emitted: BlogPost[];
  leftover: number;
  oldestFetched?: number;
  hasMore: boolean;
  incoming?: FeedStreamCursor;
  cutDate: number;
}): FeedStreamCursor => {
  const reached = oldestFetched === undefined ? cutDate : Math.max(cutDate, oldestFetched);

  // `reached` is only a lower bound — it proves no unfetched row is skipped, not that the
  // watermark stays put. `cutDate` is the oldest date on the merged page and can come entirely
  // from the *other* stream, so when that stream fills the page above this one's incoming bound,
  // an unclamped watermark jumps up and re-reads rows this stream already emitted.
  //
  // Clamping discards nothing: `reached > incoming.date` implies `cutDate > incoming.date`,
  // which implies this stream emitted nothing this page, because every row it holds is
  // `<= incoming.date < cutDate <=` every emitted date. Its leftovers and unfetched rows are
  // therefore all `<= incoming.date`, which the inclusive bound re-reads. The clamp also keeps
  // `incoming.date === date` true, so the incoming ids carry forward instead of being dropped
  // along with the jump.
  const date = incoming === undefined ? reached : Math.min(reached, incoming.date);

  const ids = emitted.filter((item) => item.date === date).map((item) => item.id);

  if (incoming?.date === date) {
    ids.push(...incoming.ids);
  }

  return { date, ids: [...new Set(ids)], done: !hasMore && leftover === 0 };
};

/**
 * Where one stream resumes after a page that emitted nothing at all — every row fetched was a
 * legacy duplicate, already shown, or no longer visible.
 *
 * Each stream steps strictly past its *own* oldest fetched row rather than past the oldest row of
 * the two combined, so neither is dragged over rows the other happened to reach but it did not.
 * A stream that fetched nothing has no page of its own to step past, so it does not move: it
 * resumes at the bound it was queried under, which on a first page is the top of the stream.
 *
 * The step-back takes the place of `cutDate`, since there is no page cut without emitted items. It
 * adds no clamp of its own and inherits `nextStreamCursor`'s. Now that the caller queries each
 * stream under its own watermark, every row a stream fetches is `<= incoming.date`, so
 * `oldestFetched - 1 < incoming.date` and that clamp is a no-op on this path. It stays as the
 * guard it is in `nextStreamCursor`: a stream queried above its own bound could otherwise step
 * back from a row newer than that bound and move up over announcements it has already shown.
 *
 * No fetched id is recorded, because none was displayed, and recording them would suppress a
 * legitimate announcement sharing its id with a legacy feed row. A stream that did not move
 * still carries its incoming ids forward, since it re-reads the inclusive bound that showed them.
 */
const emptyPageStreamCursor = ({
  fetched,
  hasMore,
  incoming,
}: {
  fetched: BlogPost[];
  hasMore: boolean;
  incoming?: FeedStreamCursor;
}): FeedStreamCursor => {
  const oldestFetched = oldestFetchedDate(fetched);

  return nextStreamCursor({
    emitted: [],
    leftover: 0,
    hasMore,
    incoming,
    cutDate: oldestFetched === undefined ? (incoming?.date ?? TOP_OF_STREAM) : oldestFetched - 1,
  });
};

/**
 * Merges the viewer's personal feed with the site-wide announcement stream into one
 * date-descending page.
 *
 * Both streams arrive newest-first, each bounded by its own entry in the incoming cursor.
 * Announcements reach the feed only through `announcements`; a `DEVBLOG` post found in
 * `personal` is a row left behind by the fan-out this replaced, and is dropped so followers
 * of an admin do not see announcements twice.
 *
 * Each stream leaves the page with its own watermark, `max(cutDate, oldestFetched)` clamped to
 * that stream's incoming bound, where `cutDate` is the date of the last emitted item and
 * `oldestFetched` the oldest date that stream fetched. That is sufficient because the page is the
 * newest `limit` items across both streams, so every *visible* item newer than the cut was
 * emitted; the only items still unprocessed are ones a stream never fetched, and those start
 * below its own `oldestFetched`. A single shared watermark would advance a stream truncated above
 * the cut past rows it never fetched.
 *
 * `oldestFetched` is read off the input arrays before any filtering, because those arrays are
 * everything the caller fetched and this merge considered, legacy and invisible rows included.
 *
 * A page that emits nothing has no cut to take a watermark from, and leaves each stream just past
 * its own oldest fetched row instead — see `emptyPageStreamCursor`.
 *
 * `isVisible` is applied before the page is cut, not after. Filtering a page the caller has
 * already sliced can empty it while items it could have shown sit just past the limit.
 */
export const mergeFeedStreams = ({
  personal,
  personalHasMore,
  announcements,
  announcementsHasMore,
  limit,
  cursor,
  isVisible = () => true,
}: {
  personal: BlogPost[];
  personalHasMore: boolean;
  announcements: BlogPost[];
  announcementsHasMore: boolean;
  limit: number;
  cursor?: FeedCursor;
  isVisible?: (item: BlogPost) => boolean;
}): { items: BlogPost[]; cursor?: FeedCursor } => {
  const alreadyShown = new Set([...(cursor?.personal.ids ?? []), ...(cursor?.announcements.ids ?? [])]);

  // Dropping the legacy DEVBLOG rows first makes the two streams' id sets disjoint, so an
  // emitted item can be attributed back to the stream it came from.
  const personalFeed = personal.filter((item) => item.cube !== DEV_BLOG_CUBE);
  const personalIds = new Set(personalFeed.map((item) => item.id));
  const fromPersonal = (item: BlogPost): boolean => personalIds.has(item.id);

  const merged = [...personalFeed, ...announcements]
    .filter((item) => !alreadyShown.has(item.id) && isVisible(item))
    .sort(newestFirst);

  const items = merged.slice(0, limit);
  const leftovers = merged.slice(limit);
  const hasMore = leftovers.length > 0 || personalHasMore || announcementsHasMore;

  if (!hasMore) {
    return { items };
  }

  if (items.length === 0) {
    if (personal.length === 0 && announcements.length === 0) {
      return { items };
    }

    // Everything fetched was dropped or already shown, so repeating these bounds would hand the
    // client the same empty page forever. Each stream steps strictly past its own oldest fetched
    // row. Nothing here was displayed, so nothing is hidden by skipping it — and recording these
    // ids instead would suppress a legitimate announcement that shares its id with a legacy feed
    // row.
    return {
      items,
      cursor: {
        personal: emptyPageStreamCursor({
          fetched: personal,
          hasMore: personalHasMore,
          incoming: cursor?.personal,
        }),
        announcements: emptyPageStreamCursor({
          fetched: announcements,
          hasMore: announcementsHasMore,
          incoming: cursor?.announcements,
        }),
      },
    };
  }

  const cutDate = items[items.length - 1]!.date;

  return {
    items,
    cursor: {
      personal: nextStreamCursor({
        emitted: items.filter(fromPersonal),
        leftover: leftovers.filter(fromPersonal).length,
        oldestFetched: oldestFetchedDate(personal),
        hasMore: personalHasMore,
        incoming: cursor?.personal,
        cutDate,
      }),
      announcements: nextStreamCursor({
        emitted: items.filter((item) => !fromPersonal(item)),
        leftover: leftovers.filter((item) => !fromPersonal(item)).length,
        oldestFetched: oldestFetchedDate(announcements),
        hasMore: announcementsHasMore,
        incoming: cursor?.announcements,
        cutDate,
      }),
    },
  };
};

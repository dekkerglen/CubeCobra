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
    const fetched = [...personal, ...announcements];
    if (fetched.length === 0) {
      return { items };
    }

    // Everything fetched was dropped or already shown, so repeating this date would hand the
    // client the same empty page forever. Step strictly past it. Nothing here was displayed,
    // so nothing is hidden by skipping it — and recording these ids instead would suppress a
    // legitimate announcement that shares its id with a legacy feed row.
    // TODO(Task 3): step each stream back past its own oldest fetched date.
    const steppedBack = Math.min(...fetched.map((item) => item.date)) - 1;
    return {
      items,
      cursor: {
        personal: { date: steppedBack, ids: [], done: false },
        announcements: { date: steppedBack, ids: [], done: false },
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

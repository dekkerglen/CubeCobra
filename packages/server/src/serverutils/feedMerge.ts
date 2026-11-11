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
 * Merges the viewer's personal feed with the site-wide announcement stream into one
 * date-descending page.
 *
 * Both streams arrive newest-first and already bounded by the incoming cursor's date.
 * Announcements reach the feed only through `announcements`; a `DEVBLOG` post found in
 * `personal` is a row left behind by the fan-out this replaced, and is dropped so followers
 * of an admin do not see announcements twice.
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
  // PLACEHOLDER — replaced by Task 2 with the real per-stream watermark rule. Until then this
  // reads the incoming bound from the personal stream only and writes the one watermark it
  // computes to both streams, reproducing the behaviour of the single shared cursor under the
  // new per-stream type.
  const sharedWatermark = (date: number, ids: string[]): FeedCursor => ({
    personal: { date, ids: [...ids], done: false },
    announcements: { date, ids: [...ids], done: false },
  });

  const alreadyShown = new Set(cursor?.personal.ids ?? []);

  const merged = [...personal.filter((item) => item.cube !== DEV_BLOG_CUBE), ...announcements]
    .filter((item) => !alreadyShown.has(item.id) && isVisible(item))
    .sort(newestFirst);

  const items = merged.slice(0, limit);
  const hasMore = merged.length > limit || personalHasMore || announcementsHasMore;

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
    return { items, cursor: sharedWatermark(Math.min(...fetched.map((item) => item.date)) - 1, []) };
  }

  const date = items[items.length - 1]!.date;
  const ids = items.filter((item) => item.date === date).map((item) => item.id);

  if (cursor?.personal.date === date) {
    ids.push(...cursor.personal.ids);
  }

  return { items, cursor: sharedWatermark(date, [...new Set(ids)]) };
};

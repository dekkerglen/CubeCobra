import BlogPost from '@utils/datatypes/BlogPost';

/** The sentinel cube id that marks a post as a site-wide developer announcement. */
export const DEV_BLOG_CUBE = 'DEVBLOG';

/**
 * Position in the merged feed: the date of the last item shown, plus the ids already shown at
 * exactly that date. The date bound on each stream query is inclusive, so without the ids the
 * last item of a page would reappear as the first item of the next one.
 */
export interface FeedCursor {
  date: number;
  ids: string[];
}

/**
 * Reads a cursor off a client request body. Returns undefined — meaning "start from the top" —
 * for anything malformed, and never throws, because this value is client-supplied.
 */
export const parseFeedCursor = (raw: unknown): FeedCursor | undefined => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return undefined;
  }

  const { date, ids } = raw as { date?: unknown; ids?: unknown };

  if (typeof date !== 'number' || !Number.isFinite(date)) {
    return undefined;
  }

  return {
    date,
    ids: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [],
  };
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
  const alreadyShown = new Set(cursor?.ids ?? []);

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
    return { items, cursor: { date: Math.min(...fetched.map((item) => item.date)) - 1, ids: [] } };
  }

  const date = items[items.length - 1]!.date;
  const ids = items.filter((item) => item.date === date).map((item) => item.id);

  if (cursor?.date === date) {
    ids.push(...cursor.ids);
  }

  return { items, cursor: { date, ids: [...new Set(ids)] } };
};

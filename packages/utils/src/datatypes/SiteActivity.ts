/**
 * Shapes for the admin Site Activity dashboard (/admin/siteactivity).
 *
 * Each count is bumped as the event happens and bucketed by the UTC day it happened on, so
 * there is no history from before counting began (beyond what the backfill script recovers).
 * Weeks, months and years are sums of days.
 */

export const SITE_ACTIVITY_METRICS = [
  'activeUsers',
  'signups',
  'emailVerifications',
  'cubesCreated',
  'cubeEdits',
  'cubeLikes',
  'smartSearches',
  'draftsStarted',
  'gridDraftsStarted',
  'housmanDraftsStarted',
  'sealedPoolsOpened',
  'draftsFinished',
  'packagesCreated',
  'packagesAddedToCubes',
  'packageUpvotes',
  'recordsCreated',
  'recordDecksAdded',
  'tournamentsStarted',
  'tournamentsFinished',
  'p1p1PacksCreated',
  'p1p1Votes',
  'comments',
  'blogPosts',
  'userFollows',
] as const;

export type SiteActivityMetric = (typeof SITE_ACTIVITY_METRICS)[number];

/** Each metric's chart title. */
export const SITE_ACTIVITY_LABELS: Record<SiteActivityMetric, string> = {
  activeUsers: 'Active users',
  signups: 'Signups',
  emailVerifications: 'Email verifications',
  cubesCreated: 'Cubes created',
  cubeEdits: 'Cube edits',
  cubeLikes: 'Cube likes',
  smartSearches: 'Smart Search searches',
  draftsStarted: 'Drafts started',
  gridDraftsStarted: 'Grid drafts started',
  housmanDraftsStarted: 'Housman drafts started',
  sealedPoolsOpened: 'Sealed pools opened',
  draftsFinished: 'Drafts finished',
  packagesCreated: 'Packages created',
  packagesAddedToCubes: 'Packages added to cubes',
  packageUpvotes: 'Package upvotes',
  recordsCreated: 'Records created',
  recordDecksAdded: 'Decks added to records',
  tournamentsStarted: 'Tournaments started',
  tournamentsFinished: 'Tournaments finished',
  p1p1PacksCreated: 'P1P1 packs created',
  p1p1Votes: 'P1P1 votes',
  comments: 'Comments',
  blogPosts: 'Blog posts',
  userFollows: 'User follows',
};

/** The dashboard's layout, one chart per metric. Every metric appears in exactly one section. */
export const SITE_ACTIVITY_SECTIONS: { title: string; metrics: SiteActivityMetric[] }[] = [
  { title: 'Accounts', metrics: ['activeUsers', 'signups', 'emailVerifications'] },
  { title: 'Cubes', metrics: ['cubesCreated', 'cubeEdits', 'cubeLikes', 'smartSearches'] },
  {
    title: 'Drafts',
    metrics: ['draftsStarted', 'draftsFinished', 'gridDraftsStarted', 'housmanDraftsStarted', 'sealedPoolsOpened'],
  },
  { title: 'Packages', metrics: ['packagesCreated', 'packagesAddedToCubes', 'packageUpvotes'] },
  { title: 'Records', metrics: ['recordsCreated', 'recordDecksAdded', 'tournamentsStarted', 'tournamentsFinished'] },
  { title: 'P1P1', metrics: ['p1p1PacksCreated', 'p1p1Votes'] },
  { title: 'Community', metrics: ['comments', 'blogPosts', 'userFollows'] },
];

/**
 * Stored beside the metrics but never charted. Summing a week's daily active users would count
 * someone active on three days three times, so each user's first activity in a week, month and
 * year also adds one to that period's counter on the day it happens. Summing a period's days of
 * its counter gives the period's distinct active users.
 */
export const ACTIVE_USER_PERIOD_COUNTERS = {
  week: 'activeUsersFirstOfWeek',
  month: 'activeUsersFirstOfMonth',
  year: 'activeUsersFirstOfYear',
} as const;

export type SiteActivityCounter =
  SiteActivityMetric | (typeof ACTIVE_USER_PERIOD_COUNTERS)[keyof typeof ACTIVE_USER_PERIOD_COUNTERS];

export const SITE_ACTIVITY_COUNTERS: SiteActivityCounter[] = [
  ...SITE_ACTIVITY_METRICS,
  ...Object.values(ACTIVE_USER_PERIOD_COUNTERS),
];

/** One UTC day's counts. */
export interface SiteActivityDay extends Record<SiteActivityCounter, number> {
  /** UTC day, YYYY-MM-DD. */
  date: string;
}

/** Calendar periods in UTC; weeks start on Monday. */
export type SiteActivityGranularity = 'day' | 'week' | 'month' | 'year';

/** How many periods back the range picker may reach, per granularity. */
export const SITE_ACTIVITY_MAX_PERIODS: Record<SiteActivityGranularity, number> = {
  day: 365,
  week: 104,
  month: 60,
  year: 10,
};

/** One period's counts. */
export interface SiteActivityBucket extends Record<SiteActivityMetric, number> {
  /** First UTC day of the period, YYYY-MM-DD. The last bucket is the current, unfinished period. */
  start: string;
}

export interface SiteActivityResponse {
  /** Ascending by start, one entry per period in the range (zero-filled). */
  buckets: SiteActivityBucket[];
}

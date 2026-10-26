import HistoryType from '@utils/datatypes/History';

const DAY_MS = 24 * 60 * 60 * 1000;

// Relative change explodes at small denominators -- three cubes becoming five reads as
// +67% -- so momentum is withheld until a card is in enough cubes for the rate to settle.
const DEFAULT_MIN_CUBES = 25;
// A single snapshot is a point, not a trend. Two still tolerates a missed week.
const DEFAULT_MIN_SAMPLES_PER_WINDOW = 2;

export interface Momentum {
  /** Mean over the most recent window. */
  current: number;
  /** Mean over the window immediately before it. */
  previous: number;
  /** current - previous, in the metric's own units. */
  change: number;
  /** change as a fraction of previous, or null when there is no baseline to divide by. */
  relativeChange: number | null;
  windowDays: number;
}

export interface MomentumOptions {
  minCubes?: number;
  minSamplesPerWindow?: number;
}

interface Windows {
  recent: HistoryType[];
  prior: HistoryType[];
}

interface Average {
  mean: number;
  count: number;
}

type Sample = (entry: HistoryType) => number | null;

/**
 * Splits history into two adjacent trailing windows measured back from the newest
 * snapshot's date.
 *
 * Dates rather than array positions: weekly rows are only written when the history job
 * runs on a Sunday, and a card drops out of a snapshot entirely on days it is in no
 * cubes, so position N is not reliably N weeks old.
 */
const splitWindows = (history: HistoryType[], windowDays: number): Windows | null => {
  // The card route substitutes an empty object when a card has no recorded history.
  const dated = history.filter((entry) => Number.isFinite(entry?.date));

  if (dated.length === 0) {
    return null;
  }

  const anchor = Math.max(...dated.map((entry) => entry.date));
  const windowMs = windowDays * DAY_MS;
  const recentFloor = anchor - windowMs;
  const priorFloor = recentFloor - windowMs;

  return {
    recent: dated.filter((entry) => entry.date > recentFloor && entry.date <= anchor),
    prior: dated.filter((entry) => entry.date > priorFloor && entry.date <= recentFloor),
  };
};

/**
 * Averages a sample across the entries that actually carry it. Entries the sample
 * rejects are dropped rather than counted as zero -- an absent snapshot means the week
 * went unrecorded, not that the card fell off a cliff.
 */
const averageOf = (entries: HistoryType[], sample: Sample): Average | null => {
  const values = entries.map(sample).filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return {
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    count: values.length,
  };
};

const momentumBetween = (
  windows: Windows,
  sample: Sample,
  minSamplesPerWindow: number,
  windowDays: number,
): Momentum | null => {
  const recent = averageOf(windows.recent, sample);
  const prior = averageOf(windows.prior, sample);

  if (!recent || !prior || recent.count < minSamplesPerWindow || prior.count < minSamplesPerWindow) {
    return null;
  }

  const change = recent.mean - prior.mean;

  return {
    current: recent.mean,
    previous: prior.mean,
    change,
    relativeChange: prior.mean === 0 ? null : change / prior.mean,
    windowDays,
  };
};

/** Share of all cubes running the card, as a percentage. */
const playRateOf = (entry: HistoryType): number | null => {
  if (!entry.total || entry.total[1] === 0) {
    return null;
  }

  return (entry.total[0] / entry.total[1]) * 100;
};

const cubeCountOf = (entry: HistoryType): number | null => {
  if (!entry.total || entry.total[1] === 0) {
    return null;
  }

  return entry.total[0];
};

const eloOf = (entry: HistoryType): number | null => (Number.isFinite(entry.elo) ? (entry.elo as number) : null);

/**
 * Pulls a plottable series out of history, oldest point first. Snapshots the sample
 * rejects are dropped, so a sparkline never dips to zero on a week that simply went
 * unrecorded.
 */
const seriesOf = (history: HistoryType[], sample: Sample): number[] =>
  history
    .filter((entry) => Number.isFinite(entry?.date))
    .sort((a, b) => a.date - b.date)
    .map(sample)
    .filter((value): value is number => value !== null);

export const playRateSeries = (history: HistoryType[]): number[] => seriesOf(history, playRateOf);

export const eloSeries = (history: HistoryType[]): number[] => seriesOf(history, eloOf);

export interface CurrentSample {
  cubeCount: number;
  /** Total cubes the rate is out of. Derivable from the catalog's popularity. */
  totalCubes: number;
  elo?: number;
}

/**
 * Appends the catalog's figures as one more point in the series.
 *
 * They are the same measurement the weekly rows carry, taken more recently:
 * update_metadata_dict reads the newest cubes_history and global_draft_history files,
 * while update_cube_history reads the file for each date it processes. update-all runs
 * the history job first, so the catalog is never the older of the two.
 *
 * Appending it rather than letting the headline diverge means the trend line ends on
 * the number printed above it, and the windows see the freshest figures there are.
 */
export const withCurrentSample = (history: HistoryType[], current: CurrentSample): HistoryType[] => {
  const dated = history.filter((entry) => Number.isFinite(entry?.date));

  // With no dated rows there is nothing to extend, and a lone sample draws no line and
  // computes no window. A rate also needs something to divide by.
  if (dated.length === 0 || !(current.totalCubes > 0)) {
    return history;
  }

  const newest = Math.max(...dated.map((entry) => entry.date));

  const sample = {
    // A day after the last snapshot. That is enough to sort last and sit inside the
    // recent window, and it avoids the clock: nothing here knows when the catalog was
    // actually built, and reading the time during render is impure anyway.
    date: newest + DAY_MS,
    total: [current.cubeCount, current.totalCubes],
    // Undefined when the card has no rating, which the extractor skips. The caller must
    // pass the raw figure rather than cardElo(), which substitutes a default of 1200.
    elo: current.elo,
  } as HistoryType;

  return [...history, sample];
};

/**
 * Change in the card's share of cubes between two adjacent trailing windows.
 *
 * Share, not raw cube count: the total number of cubes on the site grows over time, so a
 * card can gain cubes every week while its share of them slides.
 */
export const playRateMomentum = (
  history: HistoryType[],
  windowDays: number,
  options: MomentumOptions = {},
): Momentum | null => {
  const windows = splitWindows(history, windowDays);

  if (!windows) {
    return null;
  }

  const recentCubes = averageOf(windows.recent, cubeCountOf);

  if (!recentCubes || recentCubes.mean < (options.minCubes ?? DEFAULT_MIN_CUBES)) {
    return null;
  }

  return momentumBetween(
    windows,
    playRateOf,
    options.minSamplesPerWindow ?? DEFAULT_MIN_SAMPLES_PER_WINDOW,
    windowDays,
  );
};

/**
 * Change in the card's draft elo between two adjacent trailing windows. Reported in elo
 * points, which are an interval scale -- a percentage of an elo rating means nothing.
 */
export const eloMomentum = (
  history: HistoryType[],
  windowDays: number,
  options: MomentumOptions = {},
): Momentum | null => {
  const windows = splitWindows(history, windowDays);

  if (!windows) {
    return null;
  }

  return momentumBetween(windows, eloOf, options.minSamplesPerWindow ?? DEFAULT_MIN_SAMPLES_PER_WINDOW, windowDays);
};

/**
 * The weekly schedule: which puzzle a weekday gets, and how the day's concrete
 * theme value is drawn from it.
 *
 * The vocabulary and the set catalog are never touched here. `chooseTheme` takes
 * its pools as an argument and its depth probe as an injected function precisely
 * so this can be a fast unit test — the pools themselves are surveyed separately,
 * and what needs pinning is the drawing, not the data.
 */
import { makeFilter } from '@utils/filtering/FilterCards';
import {
  chooseTheme,
  CrosswordRestrictionKind,
  enumerateThemeFilters,
  planFor,
  themeFilterText,
  ThemePools,
  valuesFor,
  weekdayOf,
  WEEKLY_SCHEDULE,
} from 'serverutils/crossword/schedule';

/**
 * Pools shaped like the real ones, including the parts that make quoting matter.
 * The catalog-derived pools are not curated (see `themePools`), so a value with a
 * space, an apostrophe or a comma in it is a thing that will be drawn one day.
 */
const pools = (): ThemePools => ({
  creatureTypes: ['Elf', 'Goblin', 'Human', 'Merfolk', 'Sliver', 'Time Lord'],
  keywords: ['Flying', 'Trample', 'First Strike', 'Double Strike', "Alice's Adventures", 'Ward'],
  sets: ['mh3', 'znr', 'dsk', 'blb', '2x2', '10e'],
});

/** Seven consecutive real dates, so every weekday is covered exactly once. */
const WEEK = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];

/** Many dates, spanning years and leap days, for the properties that must always hold. */
const manyDates = (): string[] => {
  const dates: string[] = [];
  const cursor = new Date('2024-02-25T00:00:00Z');
  for (let i = 0; i < 400; i++) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 2);
  }
  return dates;
};

describe('WEEKLY_SCHEDULE', () => {
  it('covers every weekday, indexed the way getUTCDay is', () => {
    expect(WEEKLY_SCHEDULE).toHaveLength(7);
    expect(weekdayOf('2026-09-27')).toBe(0);
    expect(weekdayOf('2026-09-28')).toBe(1);
    // Parsed as UTC, so the plan doesn't move with the server's zone.
    expect(weekdayOf('2026-09-28')).toBe(new Date('2026-09-28T00:00:00Z').getUTCDay());
  });

  /**
   * Sunday was specified at 16 and ships at 15 — see the measurement on
   * WEEKLY_SCHEDULE. What this pins is the *shape*: Monday is the floor, the
   * week climbs, and Sunday is the biggest day. Raising Sunday back to 16 should
   * not have to touch this test; shipping a week that stops ramping should.
   */
  it('ramps Monday to Sunday on the NYT convention', () => {
    const byWeekday = (day: number) => WEEKLY_SCHEDULE[day]!;

    expect(byWeekday(1).size).toBe(9);

    // Monday..Saturday strictly increasing, and Sunday above all of them.
    const monToSat = [1, 2, 3, 4, 5, 6].map((day) => byWeekday(day).size);
    expect(monToSat).toEqual([...monToSat].sort((a, b) => a - b));
    expect(new Set(monToSat).size).toBe(monToSat.length);
    expect(byWeekday(0).size).toBeGreaterThan(Math.max(...monToSat));
  });

  /**
   * The reliability floor, kept as an assertion because it is the one thing
   * about this table that was expensive to learn: driven end to end through the
   * three-rung ladder, 15 builds 12 Sundays out of 12 and 16 builds 6. Anything
   * above 15 needs pre-generation or a longer request budget first.
   */
  it('keeps every size inside the range measured to build reliably', () => {
    for (const plan of WEEKLY_SCHEDULE) {
      expect(plan.size).toBeGreaterThanOrEqual(9);
      expect(plan.size).toBeLessThanOrEqual(16);
    }
  });

  it('asks a different kind of question every day', () => {
    const kinds = WEEKLY_SCHEDULE.map((plan) => plan.kind);
    expect(new Set(kinds).size).toBe(7);
    // The three the schedule was specified with.
    expect(WEEKLY_SCHEDULE[1]!.kind).toBe('creatureType');
    expect(WEEKLY_SCHEDULE[2]!.kind).toBe('colour');
    expect(WEEKLY_SCHEDULE[3]!.kind).toBe('cardType');
  });

  it('gives every kind something to draw from', () => {
    for (const plan of WEEKLY_SCHEDULE) {
      expect(valuesFor(plan.kind, pools()).length).toBeGreaterThan(0);
    }
  });

  it('maps a date to its weekday plan', () => {
    for (const date of WEEK) {
      expect(planFor(date)).toBe(WEEKLY_SCHEDULE[new Date(`${date}T00:00:00Z`).getUTCDay()]);
    }
  });

  /**
   * The rotate endpoint's Joi schema checks `\d{4}-\d{2}-\d{2}` and not the
   * calendar, so a request body can carry a date-shaped string that isn't one.
   * Naming it beats indexing the schedule with NaN and failing three frames later.
   */
  it('refuses a date-shaped string that is not a date', () => {
    expect(() => planFor('2026-13-45')).toThrow('Not a date: 2026-13-45');
    expect(() => weekdayOf('not-a-date')).toThrow();
  });
});

describe('theme filter text', () => {
  /**
   * The contract the rotate path depends on: a filter that doesn't parse is a
   * generation that silently runs themeless. Enumerated rather than sampled,
   * because a value that doesn't parse is one some future date will draw, and
   * sampling would find it on that day rather than here.
   */
  it('parses everything the schedule can emit, for every kind', () => {
    const filters = enumerateThemeFilters(pools());
    expect(filters.length).toBeGreaterThan(30);
    for (const filterText of filters) {
      const { err, filter } = makeFilter(filterText);
      // `makeFilter` reports success as `err: false`, so the filter text is
      // carried into the assertion — a bare toBeFalsy names nothing when it fails.
      expect([filterText, Boolean(err)]).toEqual([filterText, false]);
      expect(filter).toBeTruthy();
    }
  });

  it('quotes a value only when it needs it', () => {
    expect(themeFilterText('creatureType', 'Elf')).toBe('type:Elf');
    expect(themeFilterText('keyword', 'First Strike')).toBe('keyword:"First Strike"');
    expect(themeFilterText('colour', 'G')).toBe('ci=G');
    expect(themeFilterText('colourPair', 'WU')).toBe('ci=WU');
    expect(themeFilterText('manaValue', '>=7')).toBe('cmc>=7');
    expect(themeFilterText('set', 'mh3')).toBe('set:mh3');
  });
});

describe('chooseTheme', () => {
  /** Everything is deep enough, so the draw is the only thing under test. */
  const deep = () => 99;
  /** Nothing is, so the ladder has to give up. */
  const shallow = () => 0;

  it('is deterministic in the date, so a date always rebuilds its puzzle', () => {
    for (const date of WEEK) {
      const once = chooseTheme(date, 1, planFor(date), pools(), deep);
      const twice = chooseTheme(date, 1, planFor(date), pools(), deep);
      expect(once).toEqual(twice);
      expect(once).not.toBeNull();
    }
  });

  it('draws a different value on a different attempt', () => {
    // Not a guarantee for one date — two draws from a six-value pool collide
    // often — but across a year they must not be the same sequence.
    const dates = manyDates();
    const differing = dates.filter((date) => {
      const plan = planFor(date);
      const first = chooseTheme(date, 1, plan, pools(), deep);
      const second = chooseTheme(date, 2, plan, pools(), deep);
      return first?.value !== second?.value;
    });
    expect(differing.length).toBeGreaterThan(dates.length / 2);
  });

  it('never returns a filter that does not parse, for any weekday on any date', () => {
    for (const date of manyDates()) {
      const plan = planFor(date);
      for (const attempt of [1, 2]) {
        const theme = chooseTheme(date, attempt, plan, pools(), deep);
        expect(theme).not.toBeNull();
        expect(theme!.kind).toBe(plan.kind);
        const { err, filter } = makeFilter(theme!.filterText);
        expect([date, theme!.filterText, Boolean(err)]).toEqual([date, theme!.filterText, false]);
        expect(filter).toBeTruthy();
      }
    }
  });

  it('spreads its draws across the pool rather than favouring one value', () => {
    // Monday's pool, over a year of Mondays: a draw that always came back with
    // the same value would be deterministic and useless.
    const mondays = manyDates().filter((date) => weekdayOf(date) === 1);
    const drawn = new Set(mondays.map((date) => chooseTheme(date, 1, planFor(date), pools(), deep)!.value));
    expect(drawn.size).toBeGreaterThan(1);
  });

  it('skips a value whose filter does not parse rather than emitting it', () => {
    // `type:-` is rejected by the grammar; most punctuation is not, so this is a
    // value checked to fail rather than one that looks like it should.
    expect(Boolean(makeFilter('type:-').err)).toBe(true);
    const broken: ThemePools = { ...pools(), creatureTypes: ['-', 'Elf'] };
    const seen = new Set<string>();
    for (const date of manyDates().filter((d) => weekdayOf(d) === 1)) {
      const theme = chooseTheme(date, 1, planFor(date), broken, deep);
      expect(theme).not.toBeNull();
      seen.add(theme!.value);
    }
    expect(seen).toEqual(new Set(['Elf']));
  });

  it('reports how deep the theme it chose is', () => {
    const theme = chooseTheme('2026-09-28', 1, planFor('2026-09-28'), pools(), () => 7);
    expect(theme!.spanningNames).toBe(7);
  });

  /**
   * The quiet-degradation guard. `findSeedEntries` does not fail on a theme with
   * no entries long enough to frame the grid — it drops to its unthemed rung and
   * returns a grid with nothing of the theme in it. Returning null here is what
   * turns that into a logged fall-through instead.
   */
  it('returns null rather than a theme too thin to reach the frame', () => {
    for (const date of WEEK) {
      expect(chooseTheme(date, 1, planFor(date), pools(), shallow)).toBeNull();
    }
  });

  it('takes the first value that clears the floor and stops probing', () => {
    let probes = 0;
    const depth = (_filterText: string, _size: number) => {
      probes += 1;
      return probes >= 3 ? 99 : 0;
    };
    const theme = chooseTheme('2026-09-28', 1, planFor('2026-09-28'), pools(), depth);
    expect(theme).not.toBeNull();
    expect(probes).toBe(3);
  });

  it('never probes the same value twice within one draw', () => {
    const probed: string[] = [];
    const depth = (filterText: string) => {
      probed.push(filterText);
      return 0;
    };
    chooseTheme('2026-09-28', 1, planFor('2026-09-28'), pools(), depth);
    // Six creature types in the pool, drawn without replacement, so six distinct
    // probes and no more — each one costs a pass over the card catalog.
    expect(probed).toHaveLength(new Set(probed).size);
    expect(probed).toHaveLength(pools().creatureTypes.length);
  });

  it('handles a kind whose pool is empty', () => {
    const empty: ThemePools = { creatureTypes: [], keywords: [], sets: [] };
    const kinds: CrosswordRestrictionKind[] = ['creatureType', 'keyword', 'set'];
    for (const kind of kinds) {
      expect(chooseTheme('2026-09-28', 1, { size: 9, kind }, empty, deep)).toBeNull();
    }
  });
});

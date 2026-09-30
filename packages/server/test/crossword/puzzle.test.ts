import { CrosswordPuzzleGrid } from '@utils/datatypes/Crossword';

// Generation and clue writing are mocked: this file is about what gets stored,
// not about whether the generator can fill a grid (test/crossword/generate.test.ts
// covers that), and clue writing needs the card catalog.
jest.mock('serverutils/crossword/generate', () => ({
  generateCrossword: jest.fn(),
  isGenerateFailure: (result: any) => result?.reason !== undefined,
}));

jest.mock('serverutils/crossword/clues', () => ({
  getClueContext: jest.fn(() => ({})),
  clueFor: jest.fn((entry: any) => ({ clue: `clue for ${entry.text}`, clueFilter: 'ci=g' })),
}));

// The schedule's *table* is real here — which weekday gets which size and kind is
// exactly what these tests are about — but drawing a theme value reads the
// vocabulary and the set catalog, so the two pool-touching functions are stubbed.
jest.mock('serverutils/crossword/schedule', () => {
  const actual = jest.requireActual('serverutils/crossword/schedule');
  return {
    ...actual,
    themePools: jest.fn(() => ({ creatureTypes: ['Elf'], keywords: ['Flying'], sets: ['mh3'] })),
    chooseTheme: jest.fn(),
  };
});

import { generateCrossword } from '../../src/serverutils/crossword/generate';
import {
  buildDailyGrid,
  DAILY_CROSSWORD_BASE,
  DAILY_LADDER_BUDGET_MS,
  DAILY_RUNGS,
  isBuildFailure,
  storableGrid,
} from '../../src/serverutils/crossword/puzzle';
import { chooseTheme, planFor, WEEKLY_SCHEDULE } from '../../src/serverutils/crossword/schedule';

/** Monday, so `planFor` gives the 9x9 creature-type plan. */
const MONDAY = '2026-09-28';

const aTheme = (filterText: string) => ({
  kind: 'creatureType' as const,
  value: 'Elf',
  filterText,
  spanningNames: 12,
});

const fullGrid = (): CrosswordPuzzleGrid => ({
  width: 3,
  height: 3,
  blockCount: 0,
  blocks: [
    [false, false, false],
    [false, false, false],
    [false, false, false],
  ],
  letters: [
    ['C', 'A', 'T'],
    ['A', 'R', 'E'],
    ['T', 'E', 'N'],
  ],
  slots: [
    {
      id: 'a-0-0',
      direction: 'across',
      row: 0,
      col: 0,
      length: 3,
      number: 1,
      entry: {
        text: 'CAT',
        display: 'Felidae',
        entryClass: 'nameWord',
        // Generation-time bookkeeping that has no business in Dynamo.
        sourceCardName: 'Cat Warriors',
        sourceOracleId: 'oracle-1',
        sourceCardNames: ['Cat Warriors', 'Cat Burglar', 'Catacomb Sifter'],
        frequency: 312,
        setCode: 'lea',
        setReleasedAt: '1993-08-05',
        reprintOnly: false,
      },
    },
  ],
});

describe('storableGrid', () => {
  it('keeps only the three entry fields the game reads', () => {
    const stored = storableGrid(fullGrid());

    expect(stored.slots[0]!.entry).toEqual({ text: 'CAT', display: 'Felidae', entryClass: 'nameWord' });
  });

  it('keeps the geometry, the numbering and the clue', () => {
    const source = fullGrid();
    source.slots[0]!.clue = 'Purring pet';
    source.slots[0]!.nonsense = true;

    const stored = storableGrid(source);

    expect(stored).toMatchObject({ width: 3, height: 3, blockCount: 0 });
    expect(stored.letters).toEqual(source.letters);
    expect(stored.slots[0]).toMatchObject({
      id: 'a-0-0',
      direction: 'across',
      row: 0,
      col: 0,
      length: 3,
      number: 1,
      nonsense: true,
      clue: 'Purring pet',
    });
  });

  // The daily board never renders Scryfall syntax, and the filter is a more
  // machine-readable route to the answer than the English clue is.
  it('drops the clue filter', () => {
    const source = fullGrid();
    source.slots[0]!.clue = 'Purring pet';
    source.slots[0]!.clueFilter = 't:cat mv=2';

    expect(storableGrid(source).slots[0]).not.toHaveProperty('clueFilter');
  });

  // Unlike the filter, the cited card is kept: the answer key shows it in place of
  // the entry's display name, and it cannot be re-derived later without the rng
  // draw that chose it.
  it('keeps the card the clue cited', () => {
    const source = fullGrid();
    source.slots[0]!.clue = '____ Burglar';
    source.slots[0]!.clueSource = 'Cat Burglar';

    expect(storableGrid(source).slots[0]!.clueSource).toBe('Cat Burglar');
  });

  it('copies the rows so the stored grid is not an alias of the generated one', () => {
    const source = fullGrid();
    const stored = storableGrid(source);

    stored.letters[0]![0] = 'Z';
    stored.blocks[0]![0] = true;

    expect(source.letters[0]![0]).toEqual('C');
    expect(source.blocks[0]![0]).toBe(false);
  });
});

describe('buildDailyGrid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (chooseTheme as jest.Mock).mockReturnValue(aTheme('type:Elf'));
  });

  it('seeds generation off the date, so a date always makes the same puzzle', async () => {
    (generateCrossword as jest.Mock).mockReturnValue({ grid: fullGrid() });

    const result = await buildDailyGrid(MONDAY);

    expect(isBuildFailure(result)).toBe(false);
    expect(generateCrossword).toHaveBeenCalledWith(
      { ...DAILY_CROSSWORD_BASE, size: 9, themeFilterText: 'type:Elf', seed: MONDAY },
      { budgetMs: DAILY_RUNGS[0]!.budgetMs },
    );
  });

  it('takes the size and the restriction kind from the weekday', async () => {
    (generateCrossword as jest.Mock).mockReturnValue({ grid: fullGrid() });

    // Sunday through Saturday, one real date each.
    const week = ['2026-09-27', MONDAY, '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];
    for (const date of week) {
      (generateCrossword as jest.Mock).mockClear();
      (chooseTheme as jest.Mock).mockClear();
      await buildDailyGrid(date);

      const plan = WEEKLY_SCHEDULE[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
      expect((generateCrossword as jest.Mock).mock.calls[0]![0].size).toBe(plan.size);
      expect((chooseTheme as jest.Mock).mock.calls[0]![2]).toEqual(plan);
    }
  });

  it('clues every slot and trims it for storage', async () => {
    (generateCrossword as jest.Mock).mockReturnValue({ grid: fullGrid() });

    const result = (await buildDailyGrid(MONDAY)) as CrosswordPuzzleGrid;

    expect(result.slots[0]!.clue).toEqual('clue for CAT');
    expect(result.slots[0]).not.toHaveProperty('clueFilter');
    expect(result.slots[0]!.entry).toEqual({ text: 'CAT', display: 'Felidae', entryClass: 'nameWord' });
  });

  it('redraws the theme as well as the seed on the second rung', async () => {
    (generateCrossword as jest.Mock)
      .mockReturnValueOnce({ reason: 'no frame', blocksAdded: 3 })
      .mockReturnValueOnce({ grid: fullGrid() });
    (chooseTheme as jest.Mock).mockReturnValueOnce(aTheme('type:Elf')).mockReturnValueOnce(aTheme('type:Goblin'));

    const result = await buildDailyGrid(MONDAY);

    expect(isBuildFailure(result)).toBe(false);
    // A rung that failed is a statement about the theme at least as much as
    // about the seed, so retrying the same theme would re-ask a settled question.
    expect((generateCrossword as jest.Mock).mock.calls.map(([options]) => options.seed)).toEqual([
      MONDAY,
      `${MONDAY}#2`,
    ]);
    expect((generateCrossword as jest.Mock).mock.calls.map(([options]) => options.themeFilterText)).toEqual([
      'type:Elf',
      'type:Goblin',
    ]);
    expect((chooseTheme as jest.Mock).mock.calls.map(([, attempt]) => attempt)).toEqual([1, 2]);
  });

  /**
   * A failed rotation is a day with no puzzle, which is worse than a day with an
   * unthemed one. Theming is the goal and never the requirement.
   */
  it('falls back to themeless rather than failing the day', async () => {
    // Every themed rung fails, so only the themeless one at the end can save the
    // day — which is the case this ladder exists for.
    const themedRungs = DAILY_RUNGS.filter((rung) => rung.themed).length;
    const mock = generateCrossword as jest.Mock;
    for (let i = 0; i < themedRungs; i++) {
      mock.mockReturnValueOnce({ reason: `themed frame would not interlock (${i})`, blocksAdded: 3 });
    }
    mock.mockReturnValueOnce({ grid: fullGrid() });

    const result = await buildDailyGrid(MONDAY);

    expect(isBuildFailure(result)).toBe(false);
    const themes = mock.mock.calls.map(([options]) => options.themeFilterText);
    expect(themes).toEqual([...Array(themedRungs).fill('type:Elf'), '']);
    // The last rung is the themeless one, so nothing asked for a further draw.
    expect(chooseTheme as jest.Mock).toHaveBeenCalledTimes(themedRungs);
  });

  it('goes straight on to the next rung when the pool has no theme deep enough', async () => {
    (chooseTheme as jest.Mock).mockReturnValue(null);
    (generateCrossword as jest.Mock).mockReturnValue({ grid: fullGrid() });

    const result = await buildDailyGrid(MONDAY);

    expect(isBuildFailure(result)).toBe(false);
    // Both themed rungs found nothing to use, so the only generation attempted is
    // the themeless one — a themeless day rather than a wasted twenty seconds.
    expect(generateCrossword).toHaveBeenCalledTimes(1);
    expect((generateCrossword as jest.Mock).mock.calls[0]![0].themeFilterText).toEqual('');
  });

  it('reports the last reason when no rung works', async () => {
    (generateCrossword as jest.Mock).mockReturnValue({ reason: 'vocabulary too thin', blocksAdded: 9 });

    const result = await buildDailyGrid(MONDAY);

    expect(isBuildFailure(result)).toBe(true);
    expect((result as { reason: string }).reason).toEqual('vocabulary too thin');
    expect(generateCrossword).toHaveBeenCalledTimes(DAILY_RUNGS.length);
  });

  /**
   * The request-timeout guard.
   *
   * `generateCrossword` takes a budget override and the admin lab passes three
   * minutes of one. This path must not: it answers a rotate request, and
   * `index.ts` puts a 60-second `res.setTimeout` on every request — so the whole
   * ladder, plus the theme draws and the Dynamo write, has to finish inside that.
   * The lambda's own timeout is fifteen minutes and is not what binds. This is
   * here so that lengthening a rung has to be done on purpose rather than by
   * copying the lab.
   */
  it('keeps the whole ladder inside the request timeout', async () => {
    (generateCrossword as jest.Mock).mockReturnValue({ grid: fullGrid() });

    await buildDailyGrid(MONDAY);

    for (const [, controls] of (generateCrossword as jest.Mock).mock.calls) {
      expect(controls?.budgetMs).toBeDefined();
      expect(controls.budgetMs).toBeLessThanOrEqual(20_000);
    }
    // 40s of generation against a 60s request timeout, leaving the theme draws
    // (about 3.5s at worst) and the Dynamo round trips inside the remainder.
    expect(DAILY_LADDER_BUDGET_MS).toBe(44_000);
    expect(DAILY_LADDER_BUDGET_MS).toBeLessThan(60_000);
  });

  it('keeps the day-invariant options invariant', async () => {
    expect(DAILY_CROSSWORD_BASE).toMatchObject({ symmetry: 'rotational180', minWordLength: 3 });
    expect(DAILY_CROSSWORD_BASE.preferredClasses).not.toContain('acronym');
    expect(DAILY_CROSSWORD_BASE.allowedClasses).toContain('acronym');
    // Size and theme are the schedule's, so they are deliberately not in here.
    expect(DAILY_CROSSWORD_BASE).not.toHaveProperty('size');
    expect(DAILY_CROSSWORD_BASE).not.toHaveProperty('themeFilterText');
    expect(planFor(MONDAY)).toEqual({ size: 9, kind: 'creatureType' });
  });
});

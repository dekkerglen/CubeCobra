import { Catalog } from '@utils/datatypes/CardCatalog';

// Built inside the factory: the transform hoists jest.mock above module-scope
// declarations, so an outer const would be in the TDZ when the factory runs.
jest.mock('serverutils/cardCatalog', () => ({
  __esModule: true,
  default: {
    imagedict: {},
    cardimages: {},
    cardnames: [],
    comboTree: {},
    full_names: [],
    nameToId: {},
    oracleToId: {},
    english: {},
    _carddict: {},
    indexToOracle: [],
    oracleToIndex: {},
    metadatadict: {},
    printedCardList: [],
    printedCardListWithExtras: [],
    comboOracleToIndex: {},
    reasonable_names: [],
    reasonable_full_names: [],
    setdict: {},
  },
  whenCardDbReady: () => Promise.resolve(),
  isCardDbReady: () => true,
}));

import { CardDetails } from '@utils/datatypes/Card';
import { CrosswordGenerationOptions, CrosswordPuzzleGrid } from '@utils/datatypes/Crossword';
import cardCatalog from 'serverutils/cardCatalog';
import { generateCrossword, isGenerateFailure } from 'serverutils/crossword/generate';
import { clearVocabularyCache } from 'serverutils/crossword/vocabulary';

import { createCardDetails } from '../test-utils/data';

const mockCardCatalog = cardCatalog as unknown as Catalog;

/**
 * A synthetic vocabulary, because the real catalog takes a minute and a half to
 * load: every string over a three-letter alphabet at every length below the grid
 * width, plus a thin slice of the strings that span it.
 *
 * Complete at the short lengths so that whether a grid fills stops depending on
 * vocabulary luck — a run that comes back without its four full-length entries is
 * then a bug in the ladder, not a thin dictionary. Deliberately *not* complete at
 * full length: with every seven-letter string available the search prefers a grid
 * with no black squares at all, every line is full-length and the assertions pass
 * for the wrong reason. Starving that one length puts the black squares back and
 * leaves the frame as the only source of long entries, which is the real shape.
 *
 * Names are single words, so they only ever produce `cardName` entries — no name
 * words, acronyms or rules words to muddy the pool.
 */
const ALPHABET = 'ABC';
const SIZE = 7;
/** Roughly the depth the real catalog has at nine letters, relative to demand. */
const FULL_LENGTH_KEPT = 45;

const wordsOfLength = (length: number): string[] => {
  let words = [''];
  for (let i = 0; i < length; i++) {
    words = words.flatMap((word) => [...ALPHABET].map((letter) => word + letter));
  }
  return words;
};

// Capitalised so `normalize` has something to fold, as a real card name would.
const asName = (word: string): string => word[0]! + word.slice(1).toLowerCase();

const card = (name: string): CardDetails =>
  createCardDetails({
    isExtra: false,
    isToken: false,
    digital: false,
    layout: 'normal',
    language: 'en',
    set_type: 'expansion',
    // No creature type line, no keywords and no rules text: every entry in the
    // vocabulary is the card name it came from.
    type: 'Sorcery',
    keywords: [],
    oracle_text: '',
    name,
    name_lower: name.toLowerCase(),
    set: 'tst',
  });

/**
 * What the catalog offers at full length.
 *
 * `uncrossable` is the interesting one: plenty of entries span the grid, but they
 * all carry A at index 2 and B at index 4, so a column of the frame would have to
 * take its index-4 letter from a row's index-2 letter — an A where every candidate
 * insists on a B. Four long entries therefore exist and no four of them interlock,
 * which is the shape of a grid the old ladder would have quietly shipped two long
 * entries for.
 */
type FullLengthSupply = 'crossable' | 'uncrossable' | 'none';

const fullLengthNames = (supply: FullLengthSupply): string[] => {
  const spanning = wordsOfLength(SIZE);
  if (supply === 'none') {
    return [];
  }
  if (supply === 'uncrossable') {
    return spanning.filter((word) => word[2] === 'A' && word[4] === 'B').map(asName);
  }
  const stride = Math.floor(spanning.length / FULL_LENGTH_KEPT);
  return spanning.filter((_, index) => index % stride === 0).map(asName);
};

const loadCatalog = (supply: FullLengthSupply = 'crossable'): void => {
  const names: string[] = [];
  for (let length = 3; length < SIZE; length++) {
    names.push(...wordsOfLength(length).map(asName));
  }
  names.push(...fullLengthNames(supply));
  mockCardCatalog.setdict = {};
  mockCardCatalog.printedCardList = names.map(card);
  clearVocabularyCache();
};

const options = (overrides: Partial<CrosswordGenerationOptions> = {}): CrosswordGenerationOptions => ({
  size: SIZE,
  symmetry: 'rotational180',
  minWordLength: 3,
  maxAcronymRatio: 0,
  allowedClasses: ['cardName'],
  preferredClasses: ['cardName'],
  seed: 'generate-test',
  ...overrides,
});

const fullLength = (grid: CrosswordPuzzleGrid, direction: 'across' | 'down') =>
  grid.slots.filter((slot) => slot.direction === direction && slot.length === grid.width);

const generated = async (overrides: Partial<CrosswordGenerationOptions> = {}): Promise<CrosswordPuzzleGrid> => {
  const result = await generateCrossword(options(overrides));
  if (isGenerateFailure(result)) {
    throw new Error(`failed to generate: ${result.reason}`);
  }
  return result.grid;
};

describe('generateCrossword: full-length entry floor', () => {
  afterEach(() => {
    clearVocabularyCache();
  });

  it('delivers at least two full-length entries in each direction', async () => {
    loadCatalog();

    // Deadline-driven, so a seed does not pin the grid down; the property has to
    // hold for whichever grid comes back, every time.
    for (const seed of ['one', 'two', 'three', 'four', 'five']) {
      const grid = await generated({ seed });
      const across = fullLength(grid, 'across');
      const down = fullLength(grid, 'down');

      expect(across.length).toBeGreaterThanOrEqual(2);
      expect(down.length).toBeGreaterThanOrEqual(2);

      // Full-length means edge to edge, filled with real vocabulary rather than
      // leftover letters.
      for (const slot of [...across, ...down]) {
        expect(slot.length).toBe(grid.width);
        expect(slot.entry.text).toHaveLength(grid.width);
      }
      // A grid that lost its black squares would satisfy the counts trivially.
      expect(grid.blockCount).toBeGreaterThan(0);
    }
  }, 120_000);

  it('keeps the frame off the outer edge, at minWordLength - 1', async () => {
    loadCatalog();
    const grid = await generated();

    // Seeding row 0 forces its whole neighbourhood white and the grid stops being
    // fillable — see framePlan. The frame sits two in from each edge instead.
    expect(fullLength(grid, 'across').map((slot) => slot.row)).toEqual(expect.arrayContaining([2, SIZE - 3]));
    expect(fullLength(grid, 'down').map((slot) => slot.col)).toEqual(expect.arrayContaining([2, SIZE - 3]));
    expect(grid.blocks[0]!.some(Boolean)).toBe(true);
  }, 120_000);

  it('fails rather than shipping a grid with fewer, when the grid is too small to frame', async () => {
    loadCatalog();

    // 5x5 at a minimum word length of 3 puts both frame lines on row 2, so there
    // is no frame to seed. Degrading to a two-entry grid is what this replaced.
    const result = await generateCrossword(options({ size: 5 }));
    expect(isGenerateFailure(result)).toBe(true);
    expect((result as { reason: string }).reason).toMatch(/no room for 2 full-length entries/);
  });

  it('fails rather than shipping a grid with fewer, when nothing is long enough to frame', async () => {
    // Words stop one letter short of the grid, so no line can be filled edge to
    // edge. A themeless grid would still fill happily; it just wouldn't be a
    // puzzle, so the request fails instead.
    loadCatalog('none');

    const result = await generateCrossword(options());
    expect(isGenerateFailure(result)).toBe(true);
    expect((result as { reason: string }).reason).toMatch(/0 7-letter entries.*needs 4/);
  });

  /**
   * The property the lab's progress stream is built on, and the one that was
   * missing when it shipped.
   *
   * `res.write` from inside a loop that never hands the event loop a turn does
   * not send anything: the first write corks the socket and schedules the uncork
   * on `process.nextTick`, so every snapshot sits in the socket buffer until the
   * handler returns and then arrives at once. Measured against the real endpoint
   * before this: 22 snapshots spanning 2209ms of generation, all delivered inside
   * the same 4ms. Nothing about that is visible to a type-checker, and it is
   * invisible to a test that only counts callbacks — so count turns of the loop.
   *
   * The ticker is scheduled before generation starts, so it gets to run exactly
   * as often as generation lets it and not once more.
   */
  const eventLoopTurnsDuring = async (watching: boolean) => {
    let turns = 0;
    let snapshots = 0;
    let running = true;
    const tick = () => {
      if (running) {
        turns += 1;
        setImmediate(tick);
      }
    };
    setImmediate(tick);
    const result = await generateCrossword(options(), watching ? { onProgress: () => (snapshots += 1) } : {});
    running = false;
    return { turns, snapshots, result };
  };

  it('never yields when nobody is watching, so the daily path stays one blocking loop', async () => {
    loadCatalog();

    const { turns, snapshots, result } = await eventLoopTurnsDuring(false);

    // Not "few": none. The daily rotation runs on this path with a lambda blocked
    // on the response, and it should pay nothing at all for a feature the lab
    // asked for.
    expect(turns).toBe(0);
    expect(snapshots).toBe(0);
    expect(isGenerateFailure(result)).toBe(false);
  }, 120_000);

  it('yields at least once per snapshot when someone is watching', async () => {
    loadCatalog();

    const { turns, snapshots, result } = await eventLoopTurnsDuring(true);

    expect(isGenerateFailure(result)).toBe(false);
    expect(snapshots).toBeGreaterThan(0);
    // One turn per snapshot is the whole contract: a snapshot written without a
    // turn after it is a snapshot the client does not see until the end.
    expect(turns).toBeGreaterThanOrEqual(snapshots);
  }, 120_000);

  it('fails rather than shipping a grid with fewer, when no four long entries interlock', async () => {
    // Long entries in quantity, but none of them cross (see FullLengthSupply).
    // Two full-length rows would go down happily here, which is precisely the
    // two-entry grid that used to be delivered instead of an error.
    loadCatalog('uncrossable');

    const started = Date.now();
    const result = await generateCrossword(options());
    expect(isGenerateFailure(result)).toBe(true);
    expect((result as { reason: string }).reason).toMatch(/agree where they cross/);
    // And it says so promptly, rather than spending the whole budget proving a
    // bounded frame search can't find what isn't there.
    expect(Date.now() - started).toBeLessThan(5_000);
  }, 30_000);
});

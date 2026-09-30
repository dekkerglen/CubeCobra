import { CrosswordEntryClass, CrosswordPuzzle } from '@utils/datatypes/Crossword';
import { answerKey, checkLetters, isSolved, revealWord, toBoard } from 'serverutils/crossword/board';

const DATE = '2026-09-28';

/**
 * A 3x3 with no black squares:
 *
 *   C A T
 *   A R E
 *   T E N
 *
 * Numbering follows the usual scan: 1 at (0,0), 2 at (0,1), 3 at (0,2), 4 at
 * (1,0), 5 at (2,0).
 */
const LETTERS = [
  ['C', 'A', 'T'],
  ['A', 'R', 'E'],
  ['T', 'E', 'N'],
];

const entry = (text: string, display: string, entryClass: CrosswordEntryClass = 'nameWord') => ({
  text,
  display,
  entryClass,
});

const createPuzzle = (overrides?: Partial<CrosswordPuzzle>): CrosswordPuzzle => ({
  id: DATE,
  type: 'HISTORY',
  date: DATE,
  grid: {
    width: 3,
    height: 3,
    blockCount: 0,
    blocks: [
      [false, false, false],
      [false, false, false],
      [false, false, false],
    ],
    letters: LETTERS.map((row) => [...row]),
    slots: [
      {
        id: 'a-0-0',
        direction: 'across',
        row: 0,
        col: 0,
        length: 3,
        number: 1,
        entry: entry('CAT', 'Felidae'),
        clue: 'Purring pet',
      },
      {
        id: 'a-1-0',
        direction: 'across',
        row: 1,
        col: 0,
        length: 3,
        number: 4,
        entry: entry('ARE', 'Plural of is'),
        clue: 'They ___ here',
      },
      {
        id: 'a-2-0',
        direction: 'across',
        row: 2,
        col: 0,
        length: 3,
        number: 5,
        entry: entry('TEN', 'A round number'),
        clue: 'Digits on two hands',
      },
      {
        id: 'd-0-0',
        direction: 'down',
        row: 0,
        col: 0,
        length: 3,
        number: 1,
        entry: entry('CAT', 'Felidae'),
        clue: 'Purring pet, again',
      },
      {
        id: 'd-0-1',
        direction: 'down',
        row: 0,
        col: 1,
        length: 3,
        number: 2,
        entry: entry('ARE', 'Plural of is'),
        clue: 'You ___ correct',
      },
      {
        id: 'd-0-2',
        direction: 'down',
        row: 0,
        col: 2,
        length: 3,
        number: 3,
        entry: entry('TEN', 'A round number'),
        clue: 'Fingers, all told',
      },
    ],
  },
  isActive: true,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

describe('toBoard', () => {
  // The whole point of the module: the lab ships the solution to the browser, a
  // game must not. Mirrors the Synergy Connect leak test.
  it('never exposes a letter or an entry text', () => {
    const puzzle = createPuzzle();
    const board = toBoard(puzzle);
    const serialized = JSON.stringify(board);

    for (const slot of puzzle.grid.slots) {
      expect(serialized).not.toContain(slot.entry.text);
      expect(serialized).not.toContain(slot.entry.display);
    }

    // Structural too, so a renamed field can't sneak the answers back in.
    expect(board).not.toHaveProperty('letters');
    for (const slot of board.slots) {
      expect(slot).not.toHaveProperty('entry');
      expect(slot).not.toHaveProperty('clueFilter');
      expect(Object.keys(slot).sort()).toEqual(['clue', 'col', 'direction', 'id', 'length', 'number', 'row']);
    }
  });

  it('carries the geometry, the numbering and the clues', () => {
    const board = toBoard(createPuzzle());

    expect(board.date).toEqual(DATE);
    expect(board.width).toEqual(3);
    expect(board.height).toEqual(3);
    expect(board.blocks).toEqual([
      [false, false, false],
      [false, false, false],
      [false, false, false],
    ]);
    expect(board.slots).toHaveLength(6);
    expect(board.slots.map((slot) => slot.number)).toEqual([1, 4, 5, 1, 2, 3]);
    expect(board.slots[0]!.clue).toEqual('Purring pet');
  });

  it('falls back to a placeholder clue rather than shipping a clueless slot', () => {
    const puzzle = createPuzzle();
    delete puzzle.grid.slots[0]!.clue;

    expect(toBoard(puzzle).slots[0]!.clue).toEqual('3-letter answer');
  });

  it('copies the block rows so a caller cannot reach into the stored puzzle', () => {
    const puzzle = createPuzzle();
    const board = toBoard(puzzle);

    board.blocks[0]![0] = true;

    expect(puzzle.grid.blocks[0]![0]).toBe(false);
  });
});

describe('checkLetters', () => {
  const grid = createPuzzle().grid;

  it('reports a solved grid', () => {
    expect(checkLetters(grid, LETTERS)).toEqual({ wrong: [], blank: 0, solved: true });
    expect(isSolved(grid, LETTERS)).toBe(true);
  });

  it('counts empty cells as unfinished rather than wrong', () => {
    const partial = [
      ['C', 'A', 'T'],
      ['A', '', ''],
      ['', '', ''],
    ];

    expect(checkLetters(grid, partial)).toEqual({ wrong: [], blank: 5, solved: false });
  });

  it('names the filled cells that are wrong', () => {
    const wrongGrid = [
      ['C', 'A', 'T'],
      ['A', 'X', 'E'],
      ['T', 'E', 'Z'],
    ];

    expect(checkLetters(grid, wrongGrid)).toEqual({ wrong: ['1,1', '2,2'], blank: 0, solved: false });
  });

  it('accepts lowercase and treats anything that is not a letter as blank', () => {
    const messy = [
      ['c', 'a', 't'],
      ['a', 'r', 'e'],
      ['t', '3', '!'],
    ];

    expect(checkLetters(grid, messy)).toEqual({ wrong: [], blank: 2, solved: false });
  });

  it('survives a payload that is the wrong shape entirely', () => {
    expect(checkLetters(grid, null)).toEqual({ wrong: [], blank: 9, solved: false });
    expect(checkLetters(grid, [['C'], 'nonsense', 42])).toEqual({ wrong: [], blank: 8, solved: false });
  });

  it('ignores black squares', () => {
    const blocked = createPuzzle();
    blocked.grid.blocks[1]![1] = true;
    blocked.grid.letters[1]![1] = '';

    const filled = [
      ['C', 'A', 'T'],
      ['A', '', 'E'],
      ['T', 'E', 'N'],
    ];

    expect(checkLetters(blocked.grid, filled).solved).toBe(true);
  });
});

describe('revealWord', () => {
  const grid = createPuzzle().grid;

  it('returns one word with its cells in answer order', () => {
    expect(revealWord(grid, 'd-0-2')).toEqual({
      id: 'd-0-2',
      cells: [
        { row: 0, col: 2, letter: 'T' },
        { row: 1, col: 2, letter: 'E' },
        { row: 2, col: 2, letter: 'N' },
      ],
    });
  });

  it('refuses a slot id that is not in this puzzle', () => {
    expect(revealWord(grid, 'not-a-slot')).toBeNull();
  });
});

describe('answerKey', () => {
  it('lists every entry with its number and direction', () => {
    const answers = answerKey(createPuzzle());

    expect(answers).toHaveLength(6);
    expect(answers[0]).toEqual({
      id: 'a-0-0',
      number: 1,
      direction: 'across',
      text: 'CAT',
      display: 'Felidae',
      entryClass: 'nameWord',
    });
  });

  it('names the card the clue cited, not the one the entry is displayed as', () => {
    // A name-word clue blanks whichever of the entry's source cards the puzzle's
    // rng chose, and the entry's `display` is a different one of them. Reading
    // `display` here answered "____ Lantern" with "Reito Sentinel" — a card the
    // clue never mentioned, which makes the key's explanation incoherent.
    const puzzle = createPuzzle();
    puzzle.grid.slots[0]!.entry = entry('REITO', 'Reito Sentinel');
    puzzle.grid.slots[0]!.clue = '____ Lantern';
    puzzle.grid.slots[0]!.clueSource = 'Reito Lantern';

    expect(answerKey(puzzle)[0]!.display).toBe('Reito Lantern');
    // Everything that cites no particular card is unaffected.
    expect(answerKey(puzzle)[1]!.display).toBe('Plural of is');
  });
});

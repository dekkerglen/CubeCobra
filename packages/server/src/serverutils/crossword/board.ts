import {
  CrosswordAnswer,
  CrosswordBoard,
  CrosswordPuzzle,
  CrosswordPuzzleGrid,
  CrosswordSlot,
} from '@utils/datatypes/Crossword';

/**
 * The daily crossword's answer boundary.
 *
 * The admin lab ships the whole solution to the browser and checks it there,
 * which is fine for the person tuning the generator and fatal for a game. So
 * everything here is one-way: `toBoard` is the only shape a solver is handed,
 * and it carries the grid's geometry, its numbering and its clues — never a
 * letter and never an entry text. Checking a guess, revealing a word and
 * deciding whether the puzzle is solved all happen through this module, on the
 * server, against the stored grid.
 *
 * Deliberately free of the card catalog, the vocabulary and the clue writer, so
 * the leak test can assert the boundary with nothing mocked. See
 * serverutils/synergyconnect/board.ts for the same pattern on the other game.
 */

/** A cell's key in the compact form the client and the check API both speak. */
export const cellKey = (row: number, col: number): string => `${row},${col}`;

/** The cells a slot covers, in answer order. */
export const slotCells = (slot: CrosswordSlot): { row: number; col: number }[] =>
  Array.from({ length: slot.length }, (_, offset) =>
    slot.direction === 'across' ? { row: slot.row, col: slot.col + offset } : { row: slot.row + offset, col: slot.col },
  );

/**
 * A solver's typed letter, reduced to what the grid holds: one uppercase A-Z, or
 * '' for anything else. Client input is untrusted, so nothing else survives.
 */
const asLetter = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  const upper = value.trim().toUpperCase();
  return /^[A-Z]$/.test(upper) ? upper : '';
};

const isBlock = (grid: CrosswordPuzzleGrid, row: number, col: number): boolean => !!grid.blocks[row]?.[col];

/**
 * The puzzle as the client may see it. No `letters`, no `slot.entry`, no
 * `clueFilter` — the geometry, the numbering and the clue text, and that is all.
 */
export const toBoard = (puzzle: CrosswordPuzzle): CrosswordBoard => ({
  date: puzzle.date,
  width: puzzle.grid.width,
  height: puzzle.grid.height,
  // Copied row by row rather than handed over, so a caller mutating the board
  // can't reach into the stored puzzle.
  blocks: puzzle.grid.blocks.map((row) => [...row]),
  slots: puzzle.grid.slots.map((slot) => ({
    id: slot.id,
    direction: slot.direction,
    row: slot.row,
    col: slot.col,
    length: slot.length,
    number: slot.number,
    // A generated clue is always present; the fallback keeps a puzzle from an
    // older generator playable rather than clueless.
    clue: slot.clue ?? `${slot.length}-letter answer`,
  })),
});

/**
 * Every answer, in clue order. Only ever sent once the solver has finished the
 * puzzle — at which point the answers are no longer a secret.
 *
 * `display` is the card the clue actually cited where the clue cited one
 * (`clueSource`), and the entry's own readable form otherwise. The key is what a
 * solver reads to find out why they were wrong, so it has to be about the same
 * card the clue was about: the clue shapes that blank a word out of a card name
 * pick that card from a pool with the puzzle's rng, and reading `entry.display`
 * instead answered "____ Lantern" with "Reito Sentinel".
 */
export const answerKey = (puzzle: CrosswordPuzzle): CrosswordAnswer[] =>
  puzzle.grid.slots.map((slot) => ({
    id: slot.id,
    number: slot.number,
    direction: slot.direction,
    text: slot.entry.text,
    display: slot.clueSource ?? slot.entry.display,
    entryClass: slot.entry.entryClass,
  }));

export interface CheckResult {
  /** Keys of cells the solver filled with a letter that isn't the answer's. */
  wrong: string[];
  /** White cells still empty. */
  blank: number;
  solved: boolean;
}

/**
 * Grades a solver's grid.
 *
 * Reports which *filled* cells are wrong and how many are still empty — an empty
 * cell is not an error, it is unfinished work. This is the one place that tells a
 * client anything about the answers, which is why the endpoint behind it is rate
 * limited and why using it costs the solver a recorded "check".
 */
export const checkLetters = (grid: CrosswordPuzzleGrid, letters: unknown): CheckResult => {
  const rows = Array.isArray(letters) ? (letters as unknown[]) : [];
  const wrong: string[] = [];
  let blank = 0;

  for (let row = 0; row < grid.height; row++) {
    const line = Array.isArray(rows[row]) ? (rows[row] as unknown[]) : [];
    for (let col = 0; col < grid.width; col++) {
      if (isBlock(grid, row, col)) {
        continue;
      }
      const guess = asLetter(line[col]);
      if (!guess) {
        blank += 1;
      } else if (guess !== grid.letters[row]?.[col]) {
        wrong.push(cellKey(row, col));
      }
    }
  }

  return { wrong, blank, solved: wrong.length === 0 && blank === 0 };
};

/** Whether a solver's grid is the answer. The only thing `submit` reveals. */
export const isSolved = (grid: CrosswordPuzzleGrid, letters: unknown): boolean => checkLetters(grid, letters).solved;

export interface RevealedWord {
  id: string;
  /** The slot's cells with their answer letters, in answer order. */
  cells: { row: number; col: number; letter: string }[];
}

/**
 * One word's letters, for the Reveal word button. Returns null for a slot id
 * that isn't in this puzzle, so a client can't fish with made-up ids.
 */
export const revealWord = (grid: CrosswordPuzzleGrid, slotId: string): RevealedWord | null => {
  const slot = grid.slots.find((candidate) => candidate.id === slotId);
  if (!slot) {
    return null;
  }

  return {
    id: slot.id,
    cells: slotCells(slot).map(({ row, col }) => ({ row, col, letter: grid.letters[row]?.[col] ?? '' })),
  };
};

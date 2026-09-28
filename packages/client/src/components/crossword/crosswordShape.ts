import { CrosswordSlot } from '@utils/datatypes/Crossword';

/**
 * What the solving UI needs to know about a puzzle, and no more.
 *
 * Both callers satisfy this structurally: the daily game passes a CrosswordBoard,
 * whose slots carry a clue and nothing else, and the admin lab passes its
 * generated grid, whose slots also carry the answer. Typing the shared components
 * against this rather than against either one is what keeps the game page unable
 * to render an answer even by accident.
 */
export interface CrosswordDisplaySlot extends CrosswordSlot {
  clue?: string;
  /** The Scryfall filter a clue translates. The lab shows it; the game doesn't. */
  clueFilter?: string;
}

export interface CrosswordShape {
  width: number;
  height: number;
  /** true = black square. Row-major, height rows of width booleans. */
  blocks: boolean[][];
  slots: CrosswordDisplaySlot[];
}

export type Direction = 'across' | 'down';

export interface Coord {
  row: number;
  col: number;
}

export const cellKey = (row: number, col: number): string => `${row},${col}`;

/** The cells a slot covers, in answer order. */
export const slotCells = (slot: CrosswordDisplaySlot): Coord[] =>
  Array.from({ length: slot.length }, (_, offset) =>
    slot.direction === 'across' ? { row: slot.row, col: slot.col + offset } : { row: slot.row + offset, col: slot.col },
  );

/** An empty letter grid for a shape. */
export const emptyLetters = (shape: CrosswordShape): string[][] =>
  Array.from({ length: shape.height }, () => Array.from({ length: shape.width }, () => ''));

/** Whether a stored letter grid still fits the shape it was saved for. */
export const lettersFitShape = (letters: unknown, shape: CrosswordShape): letters is string[][] =>
  Array.isArray(letters) &&
  letters.length === shape.height &&
  letters.every((row) => Array.isArray(row) && row.length === shape.width);

/** mm:ss, or h:mm:ss once a run passes an hour. */
export const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};

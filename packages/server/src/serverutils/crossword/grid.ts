import { CrosswordSlot, CrosswordSymmetry } from '@utils/datatypes/Crossword';

/**
 * Black-square layout. Standard American crosswords use 180° rotational
 * symmetry; 90° is also offered but requires a square grid (and is much more
 * constrained, so it needs a lower density to stay fillable).
 */

/** Every cell that must be blocked alongside (row, col) to preserve symmetry. */
export const symmetricPartners = (
  row: number,
  col: number,
  width: number,
  height: number,
  symmetry: CrosswordSymmetry,
): [number, number][] => {
  if (symmetry === 'none') {
    return [[row, col]];
  }
  if (symmetry === 'rotational180') {
    return [
      [row, col],
      [height - 1 - row, width - 1 - col],
    ];
  }
  // 90°: four-fold rotation, only meaningful on a square grid.
  const n = width;
  return [
    [row, col],
    [col, n - 1 - row],
    [n - 1 - row, n - 1 - col],
    [n - 1 - col, row],
  ];
};

/** Runs of >= 2 cells become slots; anything shorter is an orphaned letter. */
const runsFor = (blocks: boolean[][], width: number, height: number, minWordLength: number) => {
  const across: { row: number; col: number; length: number }[] = [];
  const down: { row: number; col: number; length: number }[] = [];

  for (let row = 0; row < height; row++) {
    let start = -1;
    for (let col = 0; col <= width; col++) {
      const blocked = col === width || blocks[row]![col];
      if (blocked) {
        if (start >= 0 && col - start >= minWordLength) {
          across.push({ row, col: start, length: col - start });
        }
        start = -1;
      } else if (start < 0) {
        start = col;
      }
    }
  }

  for (let col = 0; col < width; col++) {
    let start = -1;
    for (let row = 0; row <= height; row++) {
      const blocked = row === height || blocks[row]![col];
      if (blocked) {
        if (start >= 0 && row - start >= minWordLength) {
          down.push({ row: start, col, length: row - start });
        }
        start = -1;
      } else if (start < 0) {
        start = row;
      }
    }
  }

  return { across, down };
};

/** Numbered across/down slots, in standard crossword order. */
export const slotsFor = (
  blocks: boolean[][],
  width: number,
  height: number,
  minWordLength: number,
): CrosswordSlot[] => {
  const { across, down } = runsFor(blocks, width, height, minWordLength);
  const startsAcross = new Map(across.map((run) => [`${run.row},${run.col}`, run]));
  const startsDown = new Map(down.map((run) => [`${run.row},${run.col}`, run]));

  const slots: CrosswordSlot[] = [];
  let number = 0;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const key = `${row},${col}`;
      const acrossRun = startsAcross.get(key);
      const downRun = startsDown.get(key);
      if (!acrossRun && !downRun) {
        continue;
      }
      number += 1;
      if (acrossRun) {
        slots.push({ id: `A${number}`, direction: 'across', row, col, length: acrossRun.length, number });
      }
      if (downRun) {
        slots.push({ id: `D${number}`, direction: 'down', row, col, length: downRun.length, number });
      }
    }
  }
  return slots;
};

export const isConnected = (blocks: boolean[][], width: number, height: number): boolean => {
  let whiteCount = 0;
  let first: [number, number] | null = null;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (blocks[row]![col]) continue;
      whiteCount += 1;
      if (!first) first = [row, col];
    }
  }
  if (!first) {
    return false;
  }

  const stack = [first];
  const seen = new Set<string>([`${first[0]},${first[1]}`]);
  while (stack.length > 0) {
    const [row, col] = stack.pop()!;
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as [number, number][]) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= height || nc < 0 || nc >= width || blocks[nr]![nc]) continue;
      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push([nr, nc]);
    }
  }
  return seen.size === whiteCount;
};

export const allRunsValid = (blocks: boolean[][], width: number, height: number, minWordLength: number): boolean => {
  for (let row = 0; row < height; row++) {
    let run = 0;
    for (let col = 0; col <= width; col++) {
      if (col === width || blocks[row]![col]) {
        if (run > 0 && run < minWordLength) return false;
        run = 0;
      } else {
        run += 1;
      }
    }
  }
  for (let col = 0; col < width; col++) {
    let run = 0;
    for (let row = 0; row <= height; row++) {
      if (row === height || blocks[row]![col]) {
        if (run > 0 && run < minWordLength) return false;
        run = 0;
      } else {
        run += 1;
      }
    }
  }
  return true;
};

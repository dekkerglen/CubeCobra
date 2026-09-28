import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  cellKey,
  Coord,
  CrosswordDisplaySlot,
  CrosswordShape,
  Direction,
  emptyLetters,
  slotCells,
} from './crosswordShape';

/**
 * The solving interaction, lifted out of the admin lab so the daily game and the
 * lab share one keyboard and one cursor.
 *
 * Deliberately knows nothing about answers. It owns what the solver typed, where
 * the cursor is, and which cells are flagged wrong or revealed; who decides what
 * is wrong is the caller's business — the lab compares against the grid it was
 * given, the game asks the server.
 */

export interface UseCrosswordSolverOptions {
  shape: CrosswordShape | null;
  /** Letters to start from, e.g. a run restored from localStorage. */
  initialLetters?: string[][] | null;
  /** Finished puzzles are read-only. */
  locked?: boolean;
}

export interface CrosswordSolver {
  filled: string[][];
  cursor: Coord | null;
  direction: Direction;
  activeSlot: CrosswordDisplaySlot | null;
  /** Keys of the cells in the active slot, for highlighting. */
  activeCells: Set<string>;
  wrong: Set<string>;
  revealed: Set<string>;
  /** Clue number per cell key, for the little corner numbers. */
  numberAt: Map<string, number>;
  acrossSlots: CrosswordDisplaySlot[];
  downSlots: CrosswordDisplaySlot[];
  /** Every white cell has a letter. */
  isFull: boolean;
  captureRef: React.RefObject<HTMLInputElement>;
  focusCapture: () => void;
  isBlocked: (row: number, col: number) => boolean;
  clickCell: (row: number, col: number) => void;
  selectSlot: (slot: CrosswordDisplaySlot) => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  handleCaptureChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Writes letters in, optionally flagging them as revealed rather than typed. */
  writeCells: (cells: { row: number; col: number; letter: string }[], asRevealed?: boolean) => void;
  markWrong: (keys: string[]) => void;
  clearAll: () => void;
}

/**
 * Keeps the soft keyboard up on mobile. The capture input is always "full", so a
 * Backspace there produces a change event we can read — an empty input swallows
 * the keystroke on several Android keyboards.
 */
const CAPTURE_FILLER = ' ';

export const useCrosswordSolver = ({
  shape,
  initialLetters,
  locked = false,
}: UseCrosswordSolverOptions): CrosswordSolver => {
  const [filled, setFilled] = useState<string[][]>(() => (shape ? (initialLetters ?? emptyLetters(shape)) : []));
  const [cursor, setCursor] = useState<Coord | null>(null);
  const [direction, setDirection] = useState<Direction>('across');
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const captureRef = useRef<HTMLInputElement>(null);

  // Clue numbers sit on the first cell of each slot.
  const numberAt = useMemo(() => {
    const map = new Map<string, number>();
    for (const slot of shape?.slots ?? []) {
      map.set(cellKey(slot.row, slot.col), slot.number);
    }
    return map;
  }, [shape]);

  /** Which across slot and which down slot each white cell belongs to. */
  const slotsByCell = useMemo(() => {
    const map = new Map<string, Partial<Record<Direction, CrosswordDisplaySlot>>>();
    for (const slot of shape?.slots ?? []) {
      for (const { row, col } of slotCells(slot)) {
        const key = cellKey(row, col);
        const at = map.get(key) ?? {};
        at[slot.direction] = slot;
        map.set(key, at);
      }
    }
    return map;
  }, [shape]);

  const acrossSlots = useMemo(
    () => (shape?.slots ?? []).filter((slot) => slot.direction === 'across').sort((a, b) => a.number - b.number),
    [shape],
  );
  const downSlots = useMemo(
    () => (shape?.slots ?? []).filter((slot) => slot.direction === 'down').sort((a, b) => a.number - b.number),
    [shape],
  );
  /** Tab order: all of Across by number, then all of Down. */
  const orderedSlots = useMemo(() => [...acrossSlots, ...downSlots], [acrossSlots, downSlots]);

  const activeSlot = useMemo(() => {
    if (!cursor) {
      return null;
    }
    const at = slotsByCell.get(cellKey(cursor.row, cursor.col));
    return at?.[direction] ?? at?.across ?? at?.down ?? null;
  }, [cursor, direction, slotsByCell]);

  const activeCells = useMemo(() => {
    const keys = new Set<string>();
    for (const { row, col } of activeSlot ? slotCells(activeSlot) : []) {
      keys.add(cellKey(row, col));
    }
    return keys;
  }, [activeSlot]);

  // A *different* puzzle resets the run and parks the cursor on the first clue.
  // Tracked by ref rather than left to the effect's first run, because mounting
  // isn't a change: the letters a run was restored with have to survive it.
  // Seeded with the shape we mounted on, so mounting compares equal and a
  // restored run keeps its letters. Seeding with null instead made the first
  // real shape compare as already-seen — which broke the lab outright, since it
  // mounts with no puzzle and only gets one when Generate returns: the letter
  // grid was never sized and every keystroke wrote into a row that didn't exist.
  const seenShape = useRef<CrosswordShape | null>(shape);
  useEffect(() => {
    const isNewShape = seenShape.current !== shape;
    seenShape.current = shape;

    if (!shape) {
      setFilled([]);
      setCursor(null);
      return;
    }
    if (isNewShape) {
      setFilled(emptyLetters(shape));
    }
    setWrong(new Set());
    setRevealed(new Set());
    setDirection('across');
    const first = [...shape.slots].sort((a, b) => a.number - b.number)[0];
    setCursor(first ? { row: first.row, col: first.col } : null);
    // initialLetters is a restore-on-mount value, not a live input: re-running
    // this when it changes would stamp on letters the solver has since typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape]);

  const focusCapture = useCallback(() => captureRef.current?.focus({ preventScroll: true }), []);

  const isBlocked = useCallback(
    (row: number, col: number): boolean =>
      !shape || row < 0 || col < 0 || row >= shape.height || col >= shape.width || !!shape.blocks[row]![col],
    [shape],
  );

  const letterAt = useCallback((row: number, col: number): string => filled[row]?.[col] ?? '', [filled]);

  const isFull = useMemo(() => {
    if (!shape) {
      return false;
    }
    for (let row = 0; row < shape.height; row++) {
      for (let col = 0; col < shape.width; col++) {
        if (!shape.blocks[row]![col] && !(filled[row]?.[col] ?? '')) {
          return false;
        }
      }
    }
    return true;
  }, [filled, shape]);

  const writeAt = useCallback((row: number, col: number, letter: string) => {
    setFilled((previous) =>
      previous.map((line, r) => (r === row ? line.map((cell, c) => (c === col ? letter : cell)) : line)),
    );
    // A cell being retyped is no longer known-wrong, and no longer revealed.
    const key = cellKey(row, col);
    setWrong((previous) => (previous.has(key) ? new Set([...previous].filter((k) => k !== key)) : previous));
    setRevealed((previous) => (previous.has(key) ? new Set([...previous].filter((k) => k !== key)) : previous));
  }, []);

  /** First cell of a slot the solver hasn't filled, else its first cell. */
  const entryPoint = useCallback(
    (slot: CrosswordDisplaySlot): Coord => {
      const cells = slotCells(slot);
      return cells.find(({ row, col }) => !letterAt(row, col)) ?? cells[0]!;
    },
    [letterAt],
  );

  const selectSlot = useCallback(
    (slot: CrosswordDisplaySlot) => {
      setDirection(slot.direction);
      setCursor(entryPoint(slot));
      focusCapture();
    },
    [entryPoint, focusCapture],
  );

  const clickCell = useCallback(
    (row: number, col: number) => {
      if (isBlocked(row, col)) {
        return;
      }
      const at = slotsByCell.get(cellKey(row, col)) ?? {};
      const onCursor = cursor?.row === row && cursor?.col === col;
      const other: Direction = direction === 'across' ? 'down' : 'across';
      // Clicking the selected cell again flips orientation, when there is one to
      // flip to; clicking elsewhere keeps the orientation if that cell has a slot
      // for it.
      if (onCursor && at[other]) {
        setDirection(other);
      } else if (!at[direction] && at[other]) {
        setDirection(other);
      }
      setCursor({ row, col });
      focusCapture();
    },
    [cursor, direction, focusCapture, isBlocked, slotsByCell],
  );

  /** Move `delta` cells along the active slot; null when that leaves it. */
  const withinSlot = useCallback(
    (delta: number): Coord | null => {
      if (!activeSlot || !cursor) {
        return null;
      }
      const cells = slotCells(activeSlot);
      const index = cells.findIndex(({ row, col }) => row === cursor.row && col === cursor.col);
      const next = cells[index + delta];
      return next ?? null;
    },
    [activeSlot, cursor],
  );

  const typeLetter = useCallback(
    (letter: string) => {
      if (!cursor || locked) {
        return;
      }
      writeAt(cursor.row, cursor.col, letter);
      const next = withinSlot(1);
      if (next) {
        setCursor(next);
      }
    },
    [cursor, locked, withinSlot, writeAt],
  );

  const backspace = useCallback(() => {
    if (!cursor || locked) {
      return;
    }
    if (letterAt(cursor.row, cursor.col)) {
      writeAt(cursor.row, cursor.col, '');
      const back = withinSlot(-1);
      if (back) {
        setCursor(back);
      }
      return;
    }
    const back = withinSlot(-1);
    if (back) {
      setCursor(back);
      writeAt(back.row, back.col, '');
    }
  }, [cursor, letterAt, locked, withinSlot, writeAt]);

  /** Arrow keys: perpendicular to the current slot they turn, parallel they walk. */
  const step = useCallback(
    (delta: number, axis: Direction) => {
      if (!cursor || !shape) {
        return;
      }
      if (direction !== axis) {
        setDirection(axis);
        return;
      }
      let { row, col } = cursor;
      for (let guard = 0; guard < Math.max(shape.width, shape.height); guard++) {
        row = axis === 'down' ? row + delta : row;
        col = axis === 'across' ? col + delta : col;
        if (row < 0 || col < 0 || row >= shape.height || col >= shape.width) {
          return;
        }
        if (!isBlocked(row, col)) {
          setCursor({ row, col });
          return;
        }
      }
    },
    [cursor, direction, isBlocked, shape],
  );

  const jumpClue = useCallback(
    (delta: number) => {
      const total = orderedSlots.length;
      if (total === 0) {
        return;
      }
      const index = activeSlot ? orderedSlots.findIndex((slot) => slot.id === activeSlot.id) : -1;
      const at = (position: number) => orderedSlots[((position % total) + total) % total]!;
      const isComplete = (slot: CrosswordDisplaySlot) =>
        slotCells(slot).every(({ row, col }) => (filled[row]?.[col] ?? '') !== '');

      // Tab answers "where do I work next", so a clue the solver has already
      // finished is not an answer — walk past it. Revealed words count as
      // finished too, since their cells are filled.
      for (let offset = 1; offset <= total; offset++) {
        const candidate = at(index + delta * offset);
        if (!isComplete(candidate)) {
          selectSlot(candidate);
          return;
        }
      }

      // Every clue is filled in. Still move, so Tab never feels dead.
      selectSlot(at(index + delta));
    },
    [activeSlot, filled, orderedSlots, selectSlot],
  );

  const toggleDirection = useCallback(() => {
    if (!cursor) {
      return;
    }
    const other: Direction = direction === 'across' ? 'down' : 'across';
    if (slotsByCell.get(cellKey(cursor.row, cursor.col))?.[other]) {
      setDirection(other);
    }
  }, [cursor, direction, slotsByCell]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!shape || !cursor) {
        return;
      }
      const { key } = event;
      if (key === 'Tab') {
        event.preventDefault();
        jumpClue(event.shiftKey ? -1 : 1);
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        event.preventDefault();
        step(key === 'ArrowLeft' ? -1 : 1, 'across');
      } else if (key === 'ArrowUp' || key === 'ArrowDown') {
        event.preventDefault();
        step(key === 'ArrowUp' ? -1 : 1, 'down');
      } else if (key === 'Backspace') {
        event.preventDefault();
        backspace();
      } else if (key === 'Delete') {
        event.preventDefault();
        if (!locked) {
          writeAt(cursor.row, cursor.col, '');
        }
      } else if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        toggleDirection();
      } else if (/^[a-zA-Z]$/.test(key)) {
        event.preventDefault();
        typeLetter(key.toUpperCase());
      }
    },
    [backspace, cursor, jumpClue, locked, shape, step, toggleDirection, typeLetter, writeAt],
  );

  /**
   * Soft-keyboard path. Desktop key handling preventDefaults, so nothing reaches
   * here; on mobile this is the only signal we get.
   */
  const handleCaptureChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const typed = event.target.value.replace(CAPTURE_FILLER, '');
      if (event.target.value.length === 0) {
        backspace();
        return;
      }
      const letter = [...typed].reverse().find((character) => /^[a-zA-Z]$/.test(character));
      if (letter) {
        typeLetter(letter.toUpperCase());
      }
    },
    [backspace, typeLetter],
  );

  const writeCells = useCallback((cells: { row: number; col: number; letter: string }[], asRevealed = false) => {
    if (cells.length === 0) {
      return;
    }
    const byKey = new Map(cells.map((cell) => [cellKey(cell.row, cell.col), cell.letter]));
    setFilled((previous) => previous.map((line, row) => line.map((cell, col) => byKey.get(cellKey(row, col)) ?? cell)));
    const keys = [...byKey.keys()];
    if (asRevealed) {
      setRevealed((previous) => new Set([...previous, ...keys]));
    }
    setWrong((previous) => new Set([...previous].filter((key) => !byKey.has(key))));
  }, []);

  const markWrong = useCallback((keys: string[]) => setWrong(new Set(keys)), []);

  const clearAll = useCallback(() => {
    if (!shape || locked) {
      return;
    }
    setFilled(emptyLetters(shape));
    setWrong(new Set());
    setRevealed(new Set());
    focusCapture();
  }, [focusCapture, locked, shape]);

  return {
    filled,
    cursor,
    direction,
    activeSlot,
    activeCells,
    wrong,
    revealed,
    numberAt,
    acrossSlots,
    downSlots,
    isFull,
    captureRef,
    focusCapture,
    isBlocked,
    clickCell,
    selectSlot,
    handleKeyDown,
    handleCaptureChange,
    writeCells,
    markWrong,
    clearAll,
  };
};

export { CAPTURE_FILLER };

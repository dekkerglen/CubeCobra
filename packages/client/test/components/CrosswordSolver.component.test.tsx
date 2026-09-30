import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { CrosswordClueBar } from 'components/crossword/CrosswordClues';
import CrosswordGrid from 'components/crossword/CrosswordGrid';
import { CrosswordShape } from 'components/crossword/crosswordShape';
import { CAPTURE_FILLER, useCrosswordSolver } from 'components/crossword/useCrosswordSolver';
import { fitScrollDelta } from 'components/crossword/useSoftKeyboardFit';

/**
 * A fully open 3x3, which numbers as 1/2/3 along the top row plus 4 and 5 down the
 * left. Tab order is every Across by number then every Down, so the clue ring is
 * 1A, 4A, 5A, 1D, 2D, 3D — short enough to walk off either end in one step.
 */
const SHAPE: CrosswordShape = {
  width: 3,
  height: 3,
  blocks: [
    [false, false, false],
    [false, false, false],
    [false, false, false],
  ],
  slots: [
    { id: 'a1', number: 1, row: 0, col: 0, direction: 'across', length: 3, clue: 'One across' },
    { id: 'a4', number: 4, row: 1, col: 0, direction: 'across', length: 3, clue: 'Four across' },
    { id: 'a5', number: 5, row: 2, col: 0, direction: 'across', length: 3, clue: 'Five across' },
    { id: 'd1', number: 1, row: 0, col: 0, direction: 'down', length: 3, clue: 'One down' },
    { id: 'd2', number: 2, row: 0, col: 1, direction: 'down', length: 3, clue: 'Two down' },
    { id: 'd3', number: 3, row: 0, col: 2, direction: 'down', length: 3, clue: 'Three down' },
  ],
};

/** Grid above, clue bar below, exactly as both pages arrange them. */
const Harness: React.FC = () => {
  const solver = useCrosswordSolver({ shape: SHAPE });
  return (
    <>
      <CrosswordGrid shape={SHAPE} solver={solver} />
      <CrosswordClueBar solver={solver} />
    </>
  );
};

const capture = (): HTMLInputElement => screen.getByLabelText('Crossword letter entry') as HTMLInputElement;

/** The grid's outer box, which is what the scroll fit measures. */
const gridBox = (): HTMLElement => capture().parentElement as HTMLElement;

const cells = (): HTMLElement[] => Array.from(gridBox().querySelectorAll('[role="button"]'));

/** The clue bar renders "4A" next to the clue text; that label is the assertion. */
const activeClue = (): string | null => screen.getByLabelText('Previous clue').parentElement!.textContent;

const type = (letters: string) => {
  for (const letter of letters) {
    fireEvent.keyDown(capture(), { key: letter });
  }
};

describe('crossword solving keys', () => {
  it('starts on the first clue', () => {
    render(<Harness />);
    expect(activeClue()).toContain('1A');
    expect(activeClue()).toContain('One across');
  });

  it('advances to the next clue on Enter', () => {
    render(<Harness />);
    fireEvent.keyDown(capture(), { key: 'Enter' });
    expect(activeClue()).toContain('4A');
    expect(activeClue()).toContain('Four across');
  });

  it('skips a clue that is already filled in', () => {
    render(<Harness />);
    // Onto 4A and fill it, so it is no longer somewhere there is work to do.
    fireEvent.keyDown(capture(), { key: 'Enter' });
    type('ABC');
    expect(activeClue()).toContain('4A');

    // Back to 1A the long way round, which also has to skip the filled 4A.
    fireEvent.keyDown(capture(), { key: 'Enter', shiftKey: true });
    expect(activeClue()).toContain('1A');

    // Forwards from 1A the next unfilled clue is 5A, not 4A.
    fireEvent.keyDown(capture(), { key: 'Enter' });
    expect(activeClue()).toContain('5A');
  });

  it('wraps around either end of the clue order', () => {
    render(<Harness />);
    // Backwards off the front lands on the last clue, 3D.
    fireEvent.keyDown(capture(), { key: 'Enter', shiftKey: true });
    expect(activeClue()).toContain('3D');

    // Forwards off the back comes round to the first.
    fireEvent.keyDown(capture(), { key: 'Enter' });
    expect(activeClue()).toContain('1A');
  });

  it('still moves when every clue is complete, so Enter never feels dead', () => {
    render(<Harness />);
    // Three Across clues fill all nine cells, which completes the Downs too.
    type('ABC');
    fireEvent.keyDown(capture(), { key: 'Enter' });
    type('DEF');
    fireEvent.keyDown(capture(), { key: 'Enter' });
    type('GHI');
    expect(activeClue()).toContain('5A');

    fireEvent.keyDown(capture(), { key: 'Enter' });
    expect(activeClue()).toContain('1D');
  });

  it('keeps space toggling direction rather than advancing', () => {
    render(<Harness />);
    fireEvent.keyDown(capture(), { key: ' ' });
    expect(activeClue()).toContain('1D');
    expect(activeClue()).toContain('One down');

    fireEvent.keyDown(capture(), { key: ' ' });
    expect(activeClue()).toContain('1A');
  });
});

describe('crossword auto-advance', () => {
  /** Puts `letter` in one cell and leaves the cursor wherever typing sent it. */
  const fill = (index: number, letter: string) => {
    fireEvent.mouseDown(cells()[index]!);
    type(letter);
  };

  it('skips a cell that is already filled', () => {
    render(<Harness />);
    fill(1, 'X');

    // First and last of 1A, typed in sequence: the middle X must survive.
    fireEvent.mouseDown(cells()[0]!);
    type('AB');

    expect(cells()[0]!.textContent).toContain('A');
    expect(cells()[1]!.textContent).toContain('X');
    expect(cells()[2]!.textContent).toContain('B');
  });

  it('rests on the last cell when nothing ahead is empty', () => {
    render(<Harness />);
    fill(2, 'Z');
    fill(1, 'Y');

    // Both cells ahead are taken, so the cursor should not double back past Y.
    fireEvent.mouseDown(cells()[0]!);
    type('AB');

    expect(cells()[0]!.textContent).toContain('A');
    expect(cells()[1]!.textContent).toContain('Y');
    // The second keystroke landed on the word's last cell, not back on the Y.
    expect(cells()[2]!.textContent).toContain('B');
  });

  it('still lets the arrow keys reach a filled cell', () => {
    render(<Harness />);
    fill(1, 'X');

    fireEvent.mouseDown(cells()[0]!);
    fireEvent.keyDown(capture(), { key: 'ArrowRight' });
    type('Q');

    expect(cells()[1]!.textContent).toContain('Q');
  });

  it('still lets a click reach a filled cell', () => {
    render(<Harness />);
    fill(1, 'X');

    fireEvent.mouseDown(cells()[1]!);
    type('Q');

    expect(cells()[1]!.textContent).toContain('Q');
  });

  it('does not let backspace skip filled cells', () => {
    render(<Harness />);
    // Typed straight from the starting cursor: clicking (0,0) here would only flip
    // 1A to 1D, since that is the square the cursor already sits on.
    type('AB');
    expect(cells()[1]!.textContent).toContain('B');

    // A solver holding backspace is clearing letters, so every one has to be
    // reachable — the opposite of what typing wants.
    fireEvent.keyDown(capture(), { key: 'Backspace' });
    expect(cells()[1]!.textContent).not.toContain('B');

    fireEvent.keyDown(capture(), { key: 'Backspace' });
    expect(cells()[0]!.textContent).not.toContain('A');
  });
});

describe('crossword clue bar controls', () => {
  it('steps forward and back through the clues', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Next clue'));
    expect(activeClue()).toContain('4A');

    fireEvent.click(screen.getByLabelText('Next clue'));
    expect(activeClue()).toContain('5A');

    fireEvent.click(screen.getByLabelText('Previous clue'));
    expect(activeClue()).toContain('4A');
  });

  it('skips filled clues the same way Enter does', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Next clue'));
    type('ABC');
    fireEvent.click(screen.getByLabelText('Previous clue'));
    expect(activeClue()).toContain('1A');
  });

  it('does not take focus off the capture input', () => {
    render(<Harness />);
    // Cell (1,1), which is 4A across without flipping direction.
    fireEvent.mouseDown(cells()[4]!);
    expect(document.activeElement).toBe(capture());

    // The real browser blur comes from mousedown's default action, which the button
    // cancels; firing both is what checks that it does.
    fireEvent.mouseDown(screen.getByLabelText('Next clue'));
    fireEvent.click(screen.getByLabelText('Next clue'));
    expect(activeClue()).toContain('5A');
    expect(document.activeElement).toBe(capture());
  });
});

describe('crossword capture input', () => {
  it('is emptied back to the filler once a letter is accepted', () => {
    render(<Harness />);
    // What a soft keyboard gives us: the filler plus whatever it thinks it holds.
    fireEvent.change(capture(), { target: { value: `${CAPTURE_FILLER}Q` } });

    expect(cells()[0]!.textContent).toContain('Q');
    // The input is uncontrolled, so nothing but our own imperative reset could have
    // put this back — which is the whole of the predictive-text fix.
    expect(capture().value).toBe(CAPTURE_FILLER);
  });

  it('takes the newest letter when the keyboard resends its whole buffer', () => {
    render(<Harness />);
    fireEvent.change(capture(), { target: { value: `${CAPTURE_FILLER}ASDVASDF` } });

    expect(cells()[0]!.textContent).toContain('F');
    expect(capture().value).toBe(CAPTURE_FILLER);
  });

  it('reads a value shorter than the filler as a backspace', () => {
    render(<Harness />);
    fireEvent.change(capture(), { target: { value: `${CAPTURE_FILLER}Q` } });
    expect(cells()[0]!.textContent).toContain('Q');

    fireEvent.change(capture(), { target: { value: '' } });
    expect(cells()[0]!.textContent).not.toContain('Q');
    expect(capture().value).toBe(CAPTURE_FILLER);
  });

  it('consumes a composition that commits without a further input event, once', () => {
    render(<Harness />);
    // An autocorrect swapping out the word it had been composing: the field is left
    // holding text no change event ever announced.
    capture().value = `${CAPTURE_FILLER}XY`;
    fireEvent.compositionEnd(capture());

    expect(cells()[0]!.textContent).toContain('Y');
    expect(cells()[1]!.textContent).not.toContain('Y');
    expect(capture().value).toBe(CAPTURE_FILLER);
  });

  it('ignores an empty composition end, so nothing is typed twice', () => {
    render(<Harness />);
    fireEvent.change(capture(), { target: { value: `${CAPTURE_FILLER}Q` } });
    fireEvent.compositionEnd(capture());

    expect(cells()[0]!.textContent).toContain('Q');
    expect(cells()[1]!.textContent).not.toContain('Q');
  });
});

describe('fitScrollDelta', () => {
  // A phone: the keyboard has left 500px, and the grid plus clue bar is 444 tall.
  const FITS = { gridTop: 300, clueBarBottom: 744, viewportHeight: 500, viewportOffsetTop: 0 };

  it('flushes the top of the grid to the top of the visible strip when the pair fits', () => {
    // 300 down to 8, so the clue bar's bottom lands at 452 with room to spare.
    expect(fitScrollDelta(FITS)).toBe(292);
  });

  it('flushes the clue bar to the bottom when the pair is too tall to fit', () => {
    // 444 + padding will not go in 400, so the readable half wins and the grid's top
    // row runs off the top: 744 scrolls up to 392.
    expect(fitScrollDelta({ ...FITS, viewportHeight: 400 })).toBe(352);
  });

  it('gives the grid back the room a wrapped clue takes', () => {
    // Same strip, a clue bar one line taller: the pair no longer fits, so the anchor
    // flips and the scroll is measured off the taller bar.
    expect(fitScrollDelta({ ...FITS, clueBarBottom: 800, viewportHeight: 460 })).toBe(348);
  });

  it('measures from inside the visual viewport, not the layout one', () => {
    expect(fitScrollDelta({ ...FITS, viewportOffsetTop: 100 })).toBe(192);
  });

  it('declines a scroll too small to notice', () => {
    // Already all but flush: 4px off is jitter, not help.
    expect(fitScrollDelta({ ...FITS, gridTop: 12, clueBarBottom: 456 })).toBeNull();
  });
});

describe('crossword soft-keyboard fit', () => {
  const ORIGINAL_HEIGHT = window.innerHeight;
  let scrollBy: jest.SpyInstance;
  let listeners: Record<string, () => void>;

  /** A visual viewport of `height`, as Chrome for Android reports one. */
  const stubViewport = (height: number) => {
    listeners = {};
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        height,
        offsetTop: 0,
        addEventListener: (name: string, handler: () => void) => {
          listeners[name] = handler;
        },
        removeEventListener: () => {},
      },
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
    scrollBy = jest.spyOn(window, 'scrollBy').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    scrollBy.mockRestore();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: ORIGINAL_HEIGHT });
    // @ts-expect-error jsdom has no visualViewport to put back.
    delete window.visualViewport;
  });

  /** jsdom lays nothing out, so the two measured rects have to be supplied. */
  const measure = (gridTop: number, clueBarBottom: number) => {
    jest.spyOn(gridBox(), 'getBoundingClientRect').mockReturnValue({ top: gridTop, bottom: 0 } as DOMRect);
    jest
      .spyOn(screen.getByLabelText('Previous clue').parentElement as HTMLElement, 'getBoundingClientRect')
      .mockReturnValue({ top: 0, bottom: clueBarBottom } as DOMRect);
  };

  it('does not scroll when nothing is eating the viewport', () => {
    // A desktop browser: the visual viewport is the layout viewport.
    stubViewport(900);
    render(<Harness />);
    measure(300, 744);

    fireEvent.mouseDown(cells()[4]!);
    jest.runOnlyPendingTimers();

    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('does not scroll when the browser has no visual viewport at all', () => {
    render(<Harness />);
    measure(300, 744);

    fireEvent.mouseDown(cells()[4]!);
    jest.runOnlyPendingTimers();

    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('scrolls the grid and clue bar into the strip a keyboard leaves', () => {
    stubViewport(500);
    render(<Harness />);
    measure(300, 744);

    fireEvent.mouseDown(cells()[4]!);
    jest.runOnlyPendingTimers();

    expect(scrollBy).toHaveBeenCalledWith({ top: 292, behavior: 'smooth' });
  });

  it('refits when the keyboard changes height', () => {
    stubViewport(500);
    render(<Harness />);
    measure(300, 744);

    listeners.resize!();
    jest.runOnlyPendingTimers();

    // Nothing has focus, so there is no keyboard of ours to fit around.
    expect(scrollBy).not.toHaveBeenCalled();

    fireEvent.mouseDown(cells()[4]!);
    jest.runOnlyPendingTimers();
    expect(scrollBy).toHaveBeenCalledTimes(1);
  });

  it('leaves a solver who is scrolling alone', () => {
    stubViewport(500);
    render(<Harness />);
    measure(300, 744);

    fireEvent.mouseDown(cells()[4]!);
    fireEvent.touchMove(window);
    jest.runOnlyPendingTimers();

    expect(scrollBy).not.toHaveBeenCalled();
  });
});

import { RefObject, useCallback, useEffect, useRef } from 'react';

/**
 * Scrolls the grid and the active-clue bar into the strip of page a soft keyboard
 * leaves visible.
 *
 * Written against Chrome for Android, which since 108 defaults to
 * `interactive-widget=resizes-visual`: opening the keyboard shrinks the *visual*
 * viewport and leaves the layout viewport alone. So `window.innerHeight`, `100vh`
 * and every bounding rect keep their full-height values, nothing reflows, and the
 * bottom of the puzzle is simply behind the keyboard until something scrolls. That
 * something is this hook.
 *
 * The gate is that difference in heights, not a user-agent string: on a desktop
 * browser the visual viewport *is* the layout viewport, the difference is zero,
 * and every path below returns before touching the scroll position. A browser
 * without `visualViewport` at all takes the same exit.
 */

/** Below this, whatever is eating the window is not a keyboard. */
const KEYBOARD_MIN_HEIGHT = 120;

/** Breathing room at whichever edge we flush against. */
const EDGE_PADDING = 8;

/**
 * Chrome runs its own scroll-the-focused-element-into-view pass and the keyboard
 * animates in over several frames; both have to finish before the rects mean
 * anything.
 */
const SETTLE_MS = 250;

/** Smaller than this and the scroll is jitter rather than help. */
const MIN_SCROLL = 12;

/** How long the solver's own scrolling keeps us out of the way. */
const GESTURE_QUIET_MS = 600;

/** How long our own scroll does, so a smooth scroll cannot retrigger itself. */
const SELF_SCROLL_QUIET_MS = 700;

export interface FitGeometry {
  /** Top of the grid, in layout-viewport coordinates, i.e. a bounding rect's. */
  gridTop: number;
  /** Bottom of the clue bar, same coordinates. */
  clueBarBottom: number;
  /** The height the keyboard left over: `visualViewport.height`. */
  viewportHeight: number;
  /** Where the visual viewport sits inside the layout one: `offsetTop`. */
  viewportOffsetTop: number;
}

/**
 * How far to scroll to sit the grid and the clue bar in the visible strip. Null
 * when the move would be too small to be worth making.
 *
 * Subtracting `viewportOffsetTop` converts bounding-rect coordinates into
 * positions within that strip. Both are CSS pixels, and there is no scale term
 * because there is no zoom involved here.
 */
export const fitScrollDelta = ({
  gridTop,
  clueBarBottom,
  viewportHeight,
  viewportOffsetTop,
}: FitGeometry): number | null => {
  const top = gridTop - viewportOffsetTop;
  const bottom = clueBarBottom - viewportOffsetTop;
  // Flush the top of the grid to the top of the strip when the pair fits, which
  // leaves the clue bar — and the buttons under it — in the space below. When the
  // pair does not fit both edges cannot be honoured, and the clue is the half you
  // cannot solve without: flush its bottom edge to the bottom of the strip instead
  // and let the grid's top row run off the top.
  const fits = bottom - top + 2 * EDGE_PADDING <= viewportHeight;
  const delta = fits ? top - EDGE_PADDING : bottom - (viewportHeight - EDGE_PADDING);
  return Math.abs(delta) < MIN_SCROLL ? null : delta;
};

export interface SoftKeyboardFit {
  /** Goes on the grid's outer box. */
  gridRef: RefObject<HTMLDivElement>;
  /** Goes on the active-clue bar. */
  clueBarRef: RefObject<HTMLDivElement>;
  /**
   * Fit once things have settled. Called when the selection moves — deliberately
   * not per letter, so typing never yanks a solver who has scrolled somewhere on
   * purpose.
   */
  requestFit: () => void;
}

export const useSoftKeyboardFit = (captureRef: RefObject<HTMLInputElement>): SoftKeyboardFit => {
  const gridRef = useRef<HTMLDivElement>(null);
  const clueBarRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Until this moment, someone else's scroll owns the page. */
  const quietUntil = useRef(0);

  const fit = useCallback(() => {
    const viewport = window.visualViewport;
    const grid = gridRef.current;
    const clueBar = clueBarRef.current;
    if (!viewport || !grid || !clueBar) {
      return;
    }
    // No keyboard, no fit. This single line is what keeps desktop untouched.
    if (window.innerHeight - viewport.height < KEYBOARD_MIN_HEIGHT) {
      return;
    }
    // Only while the keyboard is ours, and only when no other scroll is in flight.
    if (document.activeElement !== captureRef.current || Date.now() < quietUntil.current) {
      return;
    }

    const delta = fitScrollDelta({
      gridTop: grid.getBoundingClientRect().top,
      // Measured rather than assumed: a clue long enough to wrap makes the bar
      // taller, and the fit has to hand that room back to it.
      clueBarBottom: clueBar.getBoundingClientRect().bottom,
      viewportHeight: viewport.height,
      viewportOffsetTop: viewport.offsetTop,
    });
    if (delta === null) {
      return;
    }
    quietUntil.current = Date.now() + SELF_SCROLL_QUIET_MS;
    window.scrollBy({ top: delta, behavior: 'smooth' });
  }, [captureRef]);

  const requestFit = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      fit();
    }, SETTLE_MS);
  }, [fit]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }
    // Gboard changes height when its suggestion strip appears or a layout swaps,
    // so `resize` fires while a solver may be mid-gesture. Their scroll wins.
    const holdOff = () => {
      quietUntil.current = Date.now() + GESTURE_QUIET_MS;
    };
    // `resize` is the keyboard opening, closing or changing height. `scroll` is
    // Chrome panning the visual viewport inside the layout viewport, which is what
    // it does as the keyboard appears; our own scrolling does not move that offset,
    // and the quiet window covers the case where a browser reports it anyway.
    viewport.addEventListener('resize', requestFit);
    viewport.addEventListener('scroll', requestFit);
    window.addEventListener('touchmove', holdOff, { passive: true });
    window.addEventListener('wheel', holdOff, { passive: true });
    return () => {
      viewport.removeEventListener('resize', requestFit);
      viewport.removeEventListener('scroll', requestFit);
      window.removeEventListener('touchmove', holdOff);
      window.removeEventListener('wheel', holdOff);
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    };
  }, [requestFit]);

  return { gridRef, clueBarRef, requestFit };
};

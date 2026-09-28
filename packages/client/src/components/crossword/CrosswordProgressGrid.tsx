import React from 'react';

import classNames from 'classnames';

/**
 * A live look at the generator mid-collapse, as streamed by
 * `/admin/crosswordlab/generate`.
 *
 * `cells` is row-major and encoded as the solver encodes it (see `WfcProgress`
 * in serverutils/crossword/wfc.ts, which is the definition this mirrors):
 *
 * - `-1` — decided black.
 * - `0` — collapsed: the cell is a letter and the shape is settled. *Which*
 *   letter isn't sent; it would triple the payload to say something that is
 *   still provisional until the grid finishes.
 * - `1..26` — undecided, and the number is how many letters the cell still
 *   allows.
 */
export interface CrosswordProgressSnapshot {
  cells: number[];
  size: number;
  steps: number;
  restarts: number;
  attempt: number;
  elapsedMs: number;
}

const BLOCK = -1;
const COLLAPSED = 0;
const MAX_LETTERS = 26;

/**
 * Colour for an undecided cell: blue at 26 letters still available, red at one.
 *
 * Hue runs the long way round — blue through indigo, purple and magenta into red
 * — rather than straight across grey, so no part of the ramp washes out in the
 * middle. But hue is the axis that deuteranopia and protanopia flatten, and
 * blue-versus-red is exactly the pair they flatten hardest, so lightness carries
 * the same information in parallel: dark and cool where the cell is wide open,
 * bright and warm where it is nearly pinned. Read with no colour vision at all
 * this is still a monotone "dim to bright" ramp pointing at the cells about to
 * collapse.
 *
 * The lightness range is chosen to sit clear of both themes' backgrounds — the
 * dark one is rgb(52 58 64) and the light one rgb(240 240 240), so the band from
 * 44% to 68% is visible against either.
 */
export const entropyColor = (letters: number): string => {
  const t = Math.min(1, Math.max(0, (MAX_LETTERS - letters) / (MAX_LETTERS - 1)));
  const hue = (215 + t * 150) % 360;
  const saturation = 55 + t * 22;
  const lightness = 44 + t * 24;
  return `hsl(${hue.toFixed(0)} ${saturation.toFixed(0)}% ${lightness.toFixed(0)}%)`;
};

/**
 * Settled-but-unknown. Deliberately off the ramp — near-zero saturation, and a
 * mid lightness that is lighter than the dark theme's background and darker than
 * the light theme's — so a finished cell never reads as a nearly-finished one.
 */
const COLLAPSED_COLOR = 'hsl(215 10% 52%)';

export interface CrosswordProgressGridProps {
  progress: CrosswordProgressSnapshot;
  /** CSS length capping the grid's side, as in CrosswordGrid. */
  maxWidth?: string;
  className?: string;
}

const cellColor = (value: number): string | undefined => {
  if (value === BLOCK) {
    return undefined; // bg-black, as the finished grid draws it
  }
  return value === COLLAPSED ? COLLAPSED_COLOR : entropyColor(value);
};

/**
 * Presentational only, and separate from CrosswordGrid on purpose: that one owns
 * the keystroke capture, the cursor, the clue numbering and the solver's typed
 * letters, none of which exist yet at this point. What the two share is the grid
 * box — square, 1px gaps over the border colour, one column per cell — so the
 * live view and the finished one occupy the same space and line up.
 */
const CrosswordProgressGrid: React.FC<CrosswordProgressGridProps> = ({ progress, maxWidth = '36rem', className }) => {
  const { cells, size } = progress;

  return (
    <div className={classNames('relative mx-auto w-full max-w-full', className)} style={{ maxWidth }}>
      <div
        className="grid aspect-square w-full gap-px border border-border bg-border"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        }}
        role="img"
        aria-label={`Generator progress: attempt ${progress.attempt}, ${progress.steps} collapse steps`}
      >
        {Array.from({ length: size * size }, (_, index) => {
          const value = cells[index] ?? MAX_LETTERS;
          return (
            <div
              key={index}
              className={classNames({ 'bg-black': value === BLOCK })}
              style={value === BLOCK ? undefined : { backgroundColor: cellColor(value) }}
            />
          );
        })}
      </div>
    </div>
  );
};

/** The ramp, spelled out, because an unlabelled gradient is a decoration. */
export const CrosswordProgressLegend: React.FC = () => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
    <span className="flex items-center gap-1">
      <span className="h-3 w-3 rounded-sm bg-black ring-1 ring-border" />
      black square
    </span>
    <span className="flex items-center gap-1">
      <span className="h-3 w-3 rounded-sm ring-1 ring-border" style={{ backgroundColor: COLLAPSED_COLOR }} />
      settled
    </span>
    <span className="flex items-center gap-1">
      26
      <span className="flex h-3 w-24 overflow-hidden rounded-sm ring-1 ring-border">
        {Array.from({ length: MAX_LETTERS }, (_, index) => (
          <span key={index} className="flex-1" style={{ backgroundColor: entropyColor(MAX_LETTERS - index) }} />
        ))}
      </span>
      1 letter left
    </span>
  </div>
);

export default CrosswordProgressGrid;

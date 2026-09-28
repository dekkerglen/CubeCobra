import React, { useEffect, useRef, useState } from 'react';

import classNames from 'classnames';

import { cellKey, CrosswordShape } from './crosswordShape';
import { CAPTURE_FILLER, CrosswordSolver } from './useCrosswordSolver';

export interface CrosswordGridProps {
  shape: CrosswordShape;
  solver: CrosswordSolver;
  /**
   * CSS length capping the grid's side. The grid is square and `w-full`, so this
   * is the one knob a page needs: pass an expression that also accounts for the
   * viewport height if the grid has to share the screen without scrolling.
   */
  maxWidth?: string;
  className?: string;
}

/**
 * The square of cells, plus the off-screen input that owns the keystrokes.
 *
 * Renders only what the solver typed. It is handed a CrosswordShape, which has no
 * letters in it, so there is nothing here that could put an answer on the screen.
 */
const CrosswordGrid: React.FC<CrosswordGridProps> = ({ shape, solver, maxWidth = '36rem', className }) => {
  const { filled, cursor, activeCells, wrong, revealed, numberAt, captureRef } = solver;

  // Cells are 1fr of a square box, so a letter has to be sized off the box rather
  // than off the page. Measured rather than guessed in vw: the grid shares its row
  // with the clue lists on desktop and is height-capped on short viewports, so its
  // width is not a fixed fraction of anything.
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);

  useEffect(() => {
    const element = boxRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setBoxWidth(width);
    });
    observer.observe(element);
    setBoxWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const fontSize = boxWidth
    ? `${((boxWidth / shape.width) * 0.58).toFixed(1)}px`
    : // Pre-measurement fallback, so the first paint isn't the wrong size: the vw
      // term is the phone case (the grid is about the viewport width), the px cap
      // is the desktop one (the grid has stopped growing at maxWidth).
      `min(${(47 / shape.width).toFixed(2)}vw, ${((576 / shape.width) * 0.58).toFixed(1)}px)`;

  return (
    <div className={classNames('relative mx-auto w-full max-w-full', className)} style={{ maxWidth }}>
      {/* Off-screen but focused: it owns the keystrokes and keeps the mobile
          keyboard open while the grid itself stays styled divs. */}
      <input
        ref={captureRef}
        className="absolute left-0 top-0 h-px w-px border-0 p-0 opacity-0"
        value={CAPTURE_FILLER}
        onChange={solver.handleCaptureChange}
        onKeyDown={solver.handleKeyDown}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-label="Crossword letter entry"
      />
      <div
        ref={boxRef}
        className="grid aspect-square w-full gap-px border border-border bg-border"
        style={{
          gridTemplateColumns: `repeat(${shape.width}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${shape.height}, minmax(0, 1fr))`,
          fontSize,
        }}
      >
        {shape.blocks.map((row, rowIndex) =>
          row.map((blocked, colIndex) => {
            const key = cellKey(rowIndex, colIndex);
            const number = numberAt.get(key);
            const onCursor = cursor?.row === rowIndex && cursor?.col === colIndex;
            return (
              <div
                key={key}
                role={blocked ? undefined : 'button'}
                tabIndex={-1}
                onMouseDown={(event) => {
                  // Keep focus on the capture input rather than letting the click
                  // blur it.
                  event.preventDefault();
                  solver.clickCell(rowIndex, colIndex);
                }}
                className={classNames('relative flex items-center justify-center font-semibold leading-none', {
                  'bg-black': blocked,
                  'cursor-pointer': !blocked,
                  'bg-amber-300/60': !blocked && onCursor,
                  'bg-amber-300/20': !blocked && !onCursor && activeCells.has(key),
                  'bg-bg': !blocked && !onCursor && !activeCells.has(key),
                })}
              >
                {!blocked && number !== undefined && (
                  <span
                    className="absolute left-[0.1em] top-0 font-normal text-text-secondary"
                    style={{ fontSize: '0.5em' }}
                  >
                    {number}
                  </span>
                )}
                {!blocked && (
                  <span
                    className={classNames(
                      // One text colour per cell, picked here rather than as
                      // competing classes — wrong beats revealed beats normal, and
                      // the cursor's amber fill needs dark ink.
                      wrong.has(key)
                        ? 'text-red-600'
                        : revealed.has(key)
                          ? 'text-cyan-600'
                          : onCursor
                            ? 'text-black'
                            : 'text-text',
                    )}
                  >
                    {filled[rowIndex]?.[colIndex]}
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
};

export default CrosswordGrid;

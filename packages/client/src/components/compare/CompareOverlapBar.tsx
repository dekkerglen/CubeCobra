import React from 'react';

import classNames from 'classnames';

import { COMPARE_SETS, CompareSet, CompareSides } from './CompareArt';

const artBackground = (sides: CompareSides, set: CompareSet): React.CSSProperties => {
  if (set === 'onlyA') return { backgroundImage: `url(${sides.a.image.uri})`, backgroundSize: 'cover' };
  if (set === 'onlyB') return { backgroundImage: `url(${sides.b.image.uri})`, backgroundSize: 'cover' };
  // The shared segment holds both arts, each on its own side.
  return {
    backgroundImage: `url(${sides.a.image.uri}), url(${sides.b.image.uri})`,
    backgroundSize: '50% 100%, 50% 100%',
    backgroundPosition: 'left center, right center',
    backgroundRepeat: 'no-repeat',
  };
};

interface CompareOverlapBarProps {
  sides: CompareSides;
  counts: Record<CompareSet, number>;
  focus: CompareSet | null;
  setFocus: (focus: CompareSet | null) => void;
}

/** How the two lists split, with each segment as wide as its share. Picking a segment shows only those cards. */
const CompareOverlapBar: React.FC<CompareOverlapBarProps> = ({ sides, counts, focus, setFocus }) => (
  <div className="flex w-full gap-1" role="group" aria-label="Show cards">
    {COMPARE_SETS.map((set) => {
      const active = focus === set;
      const past = (set === 'onlyA' && sides.a.past) || (set === 'onlyB' && sides.b.past);
      return (
        <button
          key={set}
          type="button"
          aria-pressed={active}
          title={sides.captions[set]}
          onClick={() => setFocus(active ? null : set)}
          className={classNames(
            'group relative h-14 min-w-[5.5rem] cursor-pointer sm:h-12 sm:min-w-[7.5rem] overflow-hidden rounded-md text-left text-white transition-all duration-200',
            {
              'ring-2 ring-button-primary ring-offset-2 ring-offset-bg': active,
              'opacity-40 hover:opacity-75': focus !== null && !active,
            },
          )}
          style={{ flexGrow: Math.max(counts[set], 1), flexBasis: 0 }}
        >
          <span
            className={classNames(
              'absolute inset-0 bg-center transition-transform duration-300 group-hover:scale-105',
              {
                grayscale: past,
              },
            )}
            style={artBackground(sides, set)}
          />
          <span className="absolute inset-0 bg-black/60" />
          {/* Count over caption on phones, where three segments share one narrow row. */}
          <span className="relative flex h-full flex-col justify-center px-2 sm:flex-row sm:items-center sm:justify-start sm:gap-2 sm:px-3 [text-shadow:0_1px_2px_rgb(0_0_0/0.8)]">
            <span className="text-base font-bold leading-tight sm:text-lg">{counts[set]}</span>
            <span className="truncate text-xxs font-semibold uppercase tracking-wider text-white/85 sm:text-xs">
              {sides.captions[set]}
            </span>
          </span>
        </button>
      );
    })}
  </div>
);

export default CompareOverlapBar;

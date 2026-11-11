import React from 'react';

import { StackIcon } from '@primer/octicons-react';
import classNames from 'classnames';

import { ArtChip, CompareSide, CompareSides } from './CompareArt';

// The seam runs from 58% along the top edge to 42% along the bottom, so the left cube owns the top-left
// and the right cube the bottom-right. Each label sits in its cube's larger corner.
const LEFT_WEDGE = 'polygon(0 0, 58% 0, 42% 100%, 0 100%)';
const RIGHT_WEDGE = 'polygon(58% 0, 100% 0, 100% 100%, 42% 100%)';

const SHADOW = '[text-shadow:0_1px_3px_rgb(0_0_0/0.8)]';

interface WedgeProps {
  side: CompareSide;
  clipPath: string;
  /** Darkens toward the corner the label sits in. */
  scrim: string;
}

const Wedge: React.FC<WedgeProps> = ({ side, clipPath, scrim }) => (
  <div className="absolute inset-0" style={{ clipPath }}>
    <div
      className={classNames('absolute inset-0 bg-cover bg-center', { 'grayscale sepia-[.3]': side.past })}
      style={{ backgroundImage: `url(${side.image.uri})` }}
    />
    <div className={classNames('absolute inset-0 from-black/85 via-black/45 to-black/10', scrim)} />
  </div>
);

interface SideLabelProps {
  side: CompareSide;
  align: 'start' | 'end';
  className?: string;
}

const SideLabel: React.FC<SideLabelProps> = ({ side, align, className }) => (
  <div
    className={classNames(
      'absolute flex flex-col gap-1 max-w-[60%] md:max-w-[40%] p-4 md:p-6',
      align === 'start' ? 'items-start text-left' : 'items-end text-right',
      className,
    )}
  >
    <span className="rounded bg-white/20 px-1.5 py-0.5 text-xxs font-semibold uppercase tracking-wider backdrop-blur-sm">
      {side.kicker}
    </span>
    {side.href ? (
      <a
        href={side.href}
        title={side.titleHint}
        className={classNames('block text-xl md:text-3xl font-bold leading-tight hover:underline', SHADOW)}
      >
        <span className="line-clamp-2">{side.title}</span>
      </a>
    ) : (
      <span
        title={side.titleHint}
        className={classNames('text-xl md:text-3xl font-bold leading-tight line-clamp-2', SHADOW)}
      >
        {side.title}
      </span>
    )}
    <span className={classNames('flex flex-wrap items-center gap-x-3 text-sm text-white/90', SHADOW)}>
      <span className="inline-flex items-center gap-1">
        <StackIcon size={14} />
        {side.cardCount} cards
      </span>
      {side.owner && (
        <span>
          by{' '}
          <a href={`/user/view/${side.owner.id}`} className="font-semibold hover:underline">
            {side.owner.username}
          </a>
        </span>
      )}
    </span>
  </div>
);

interface CompareHeroProps {
  sides: CompareSides;
  /** Cards the two lists share, before any filter. */
  shared: number;
}

const CompareHero: React.FC<CompareHeroProps> = ({ sides, shared }) => (
  <div className="relative h-80 md:h-64 overflow-hidden rounded-lg bg-black text-white shadow">
    <Wedge side={sides.a} clipPath={LEFT_WEDGE} scrim="bg-gradient-to-br" />
    <Wedge side={sides.b} clipPath={RIGHT_WEDGE} scrim="bg-gradient-to-tl" />
    <svg
      className="absolute inset-0 h-full w-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <line
        x1="58"
        y1="0"
        x2="42"
        y2="100"
        stroke="white"
        strokeOpacity="0.8"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>

    <SideLabel side={sides.a} align="start" className="top-0 left-0" />
    <SideLabel side={sides.b} align="end" className="bottom-0 right-0" />

    <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
      <span className="flex -space-x-4 md:-space-x-6">
        <ArtChip side={sides.a} size="lg" className="ring-white shadow-lg" />
        <ArtChip side={sides.b} size="lg" className="ring-white shadow-lg" />
      </span>
      <span className="whitespace-nowrap rounded-full bg-black/70 px-3 py-0.5 text-sm font-semibold ring-1 ring-white/30 backdrop-blur-sm">
        {shared} shared
      </span>
    </div>
  </div>
);

export default CompareHero;

import React from 'react';

import Image from '@utils/datatypes/Image';
import classNames from 'classnames';

/** The three ways a card can fall in a compare, in the order they are laid out: left cube, shared, right cube. */
export type CompareSet = 'onlyA' | 'both' | 'onlyB';

export const COMPARE_SETS: CompareSet[] = ['onlyA', 'both', 'onlyB'];

export interface CompareSide {
  /** Short role label, e.g. Base / Comparison, or Then / Now. */
  kicker: string;
  title: string;
  href?: string;
  /** Hover text for the title, e.g. the full timestamp of a point in time. */
  titleHint?: string;
  image: Image;
  cardCount: number;
  owner?: { id: string; username: string };
  /** The point-in-time side of a changelog compare, drawn desaturated. */
  past?: boolean;
}

export interface CompareSides {
  a: CompareSide;
  b: CompareSide;
  captions: Record<CompareSet, string>;
}

const CHIP_SIZES = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12 md:h-20 md:w-20',
};

interface ArtChipProps {
  side: CompareSide;
  size?: keyof typeof CHIP_SIZES;
  /** Ring color; the ring separates overlapping chips. */
  className?: string;
}

/** A side's cube art cropped into a circle. */
export const ArtChip: React.FC<ArtChipProps> = ({ side, size = 'sm', className = 'ring-bg' }) => (
  <span
    role="img"
    aria-label={side.title}
    title={`Art by ${side.image.artist}`}
    className={classNames(
      'inline-block shrink-0 rounded-full bg-cover bg-center ring-2',
      CHIP_SIZES[size],
      { grayscale: side.past },
      className,
    )}
    style={{ backgroundImage: `url(${side.image.uri})` }}
  />
);

interface SetChipsProps {
  set: CompareSet;
  sides: CompareSides;
  size?: keyof typeof CHIP_SIZES;
  className?: string;
}

/** The chip for one side, or for the shared set both chips overlapping like a Venn diagram. */
export const SetChips: React.FC<SetChipsProps> = ({ set, sides, size = 'sm', className = 'ring-bg' }) => {
  if (set === 'onlyA') return <ArtChip side={sides.a} size={size} className={className} />;
  if (set === 'onlyB') return <ArtChip side={sides.b} size={size} className={className} />;
  return (
    <span className="inline-flex shrink-0 -space-x-2">
      <ArtChip side={sides.a} size={size} className={className} />
      <ArtChip side={sides.b} size={size} className={className} />
    </span>
  );
};

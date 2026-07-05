import React from 'react';

import { HeartFillIcon, ZapIcon } from '@primer/octicons-react';
import { PatronLevels } from '@utils/datatypes/Patron';
import classNames from 'classnames';

interface PatronBadgeProps {
  className?: string;
}

interface PatronTierBadgeProps {
  level: number;
  className?: string;
}

// Shared layout + shimmer base for every user badge (patron tiers and admin).
export const BADGE_BASE_CLASSES =
  'patron-badge inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border whitespace-nowrap';

// Generic "Patron" badge — shown for anyone with a linked active Patreon account.
export const PatronBadge: React.FC<PatronBadgeProps> = ({ className }) => (
  <span
    title="Patreon supporter"
    className={classNames(BADGE_BASE_CLASSES, 'patron-badge-patron', className)}
    aria-label="Patron"
  >
    <HeartFillIcon size={10} />
    Patron
  </span>
);

const TIER_CLASS: Record<number, string> = {
  [PatronLevels['Cobra Hatchling']]: 'patron-badge-hatchling',
  [PatronLevels['Coiling Oracle']]: 'patron-badge-oracle',
  [PatronLevels['Lotus Cobra']]: 'patron-badge-lotus',
};

// Tier-specific badge (Hatchling / Oracle / Lotus Cobra). Returns null for the
// generic "Patron" level since the PatronBadge above already covers that case.
export const PatronTierBadge: React.FC<PatronTierBadgeProps> = ({ level, className }) => {
  const tierClass = TIER_CLASS[level];
  const label = PatronLevels[level];
  if (!tierClass || !label) return null;

  return (
    <span title={`${label} Patreon tier`} className={classNames(BADGE_BASE_CLASSES, tierClass, className)} aria-label={label}>
      <ZapIcon size={10} />
      {label}
    </span>
  );
};

export default PatronBadge;

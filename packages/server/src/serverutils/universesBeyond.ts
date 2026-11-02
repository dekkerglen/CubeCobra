import { isUniversesBeyond } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import { FilterFunction } from '@utils/filtering/FilterCards';

/**
 * The "hide Universes Beyond" user setting. Search and recommendations drop cards that only exist
 * as Universes Beyond printings; a card that also has a regular printing stays and is shown in it,
 * because the exclusion is applied as a filter and the filter also decides which printing is picked.
 */

// A query that asks for UB cards outright (`is:ub`, `has:universesbeyond`) gets them even with the
// setting on. Negated forms (`-is:ub`) don't match, since they exclude UB already.
const ASKS_FOR_UNIVERSES_BEYOND = /(^|[\s(])(is|has):(ub|universesbeyond)\b/i;

export const hidesUniversesBeyond = (
  user: { hideUniversesBeyond?: boolean } | undefined | null,
  filterText?: unknown,
): boolean =>
  !!user?.hideUniversesBeyond && !(typeof filterText === 'string' && ASKS_FOR_UNIVERSES_BEYOND.test(filterText));

const notUniversesBeyond = (card: Card): boolean => !card.details || !isUniversesBeyond(card.details);

export const NOT_UNIVERSES_BEYOND: FilterFunction = Object.assign(notUniversesBeyond, {
  fieldsUsed: [],
  stringify: '-is:ub',
});

/** `filter` with UB printings excluded. A null filter (empty query) becomes "everything but UB". */
export const excludeUniversesBeyond = (filter: FilterFunction | null): FilterFunction => {
  if (!filter) return NOT_UNIVERSES_BEYOND;
  // Keep fieldsUsed/stringify so callers that inspect the filter (set-scoped browse, include:extras)
  // see the user's query unchanged.
  return Object.assign((card: Card) => notUniversesBeyond(card) && filter(card), {
    fieldsUsed: filter.fieldsUsed,
    stringify: filter.stringify,
    describe: filter.describe,
  });
};

/** Applies the setting to a parsed search filter: unchanged unless this user hides UB. */
export const applyUniversesBeyondSetting = (
  filter: FilterFunction | null,
  user: { hideUniversesBeyond?: boolean } | undefined | null,
  filterText?: unknown,
): FilterFunction | null => (hidesUniversesBeyond(user, filterText) ? excludeUniversesBeyond(filter) : filter);

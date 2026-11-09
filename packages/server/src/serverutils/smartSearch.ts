import { CardDetails } from '@utils/datatypes/Card';

// Set codes for the Mystery Booster playtest cards (Gavin Verhey's "mystery
// event" / convention playtest cards). These aren't real, tournament-playable
// cards and shouldn't be suggested as cube additions.
const MYSTERY_PLAYTEST_SETS = new Set(['cmb1', 'cmb2']);

// Smart Search suggests cards to ADD to a cube, so it should never surface
// cards that can't sit in a normal cube list. Tokens are already dropped
// upstream (printedCardList excludes them); here we also drop basic lands and
// Mystery Booster playtest cards. Special-zone cards (conspiracies, planes,
// schemes, contraptions, ...) stay in: cubes do run them, and the user's
// filter already decides whether they show up.
export const isExcludedFromSmartSearch = (card: CardDetails): boolean => {
  const type = card.type ?? '';
  if (type.includes('Basic') && type.includes('Land')) return true;
  if (card.set && MYSTERY_PLAYTEST_SETS.has(card.set.toLowerCase())) return true;
  return false;
};

/**
 * Server-side adapter that produces the `LandMetaLookup` shape the manabase trim heuristics
 * expect, sourced from the bundled carddb plus a draft pool's basics list. Used by both the
 * bot deckbuilder and the HTTP deckbuild routes so they don't drift.
 */

import { isManaFixingLand } from '@utils/cardutil';
import type { LandMetaLookup } from '@utils/drafting/manabaseHeuristics';

import carddb, { cardFromId } from './carddb';

export const buildLandMetaLookup = (oracles: string[], basics: any[]): LandMetaLookup => {
  const lookup: LandMetaLookup = {};
  for (const oracle of oracles) {
    if (lookup[oracle]) continue;
    const cardIds = carddb.oracleToId[oracle];
    if (!cardIds || !cardIds[0]) continue;
    const card = cardFromId(cardIds[0]);
    lookup[oracle] = {
      name: card.name,
      type: card.type,
      colorIdentity: card.color_identity,
      producedMana: card.produced_mana,
      isManaFixingLand: isManaFixingLand(card) || undefined,
    };
  }
  for (const basic of basics) {
    const oracleId = basic?.oracle_id;
    if (!oracleId || lookup[oracleId]) continue;
    lookup[oracleId] = {
      name: basic.name,
      type: basic.type ?? 'Basic Land',
      colorIdentity: basic.color_identity ?? [],
      producedMana: basic.produced_mana ?? [],
    };
  }
  return lookup;
};

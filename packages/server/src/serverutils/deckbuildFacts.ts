import { isManaFixingLand } from '@utils/cardutil';
import type { OracleFacts, OracleFactsMap } from '@utils/drafting/deckbuildCore';

import carddb, { cardFromId, getOracleForMl } from './carddb';

/**
 * Precompute, from the card database, everything the carddb-free deckbuild core needs to
 * know about a set of oracle ids: the ML oracle mapping, land / conspiracy flags, and the
 * manabase metadata (name, type, colors, produced mana, fixer flag).
 *
 * The server calls this to (a) drive its own batchDeckbuild wrapper and (b) build the job
 * payload the bot-deckbuild lambda consumes — so the lambda never touches carddb.
 *
 * Mirrors the exact carddb lookups the original inlined algorithm used (cardFromId of the
 * first id for `oracleToId[oracle]`).
 */
export const computeDeckbuildFacts = (oracles: Iterable<string>): OracleFactsMap => {
  const facts: OracleFactsMap = {};
  for (const oracle of oracles) {
    if (facts[oracle]) continue;

    const oracleIds = carddb.oracleToId[oracle];
    const card = oracleIds && oracleIds[0] ? cardFromId(oracleIds[0]) : null;
    const type = card?.type ?? '';

    const entry: OracleFacts = {
      mlOracle: getOracleForMl(oracle, null),
      isLand: type.includes('Land'),
      isConspiracyOrVanguard: type.includes('Conspiracy') || type.includes('Vanguard'),
      name: card?.name ?? oracle,
      type,
      colorIdentity: card?.color_identity ?? [],
      producedMana: card?.produced_mana ?? [],
      isManaFixingLand: card ? isManaFixingLand(card) || undefined : undefined,
    };
    facts[oracle] = entry;
  }
  return facts;
};

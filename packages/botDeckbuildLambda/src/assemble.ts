import { assessColors as assessDeckColors } from '@utils/drafting/assessColors';
import type { DeckbuildJobCard, DeckbuildJobSeat, OracleFactsMap } from '@utils/drafting/deckbuildCore';
import { setupPicks } from '@utils/draftutil';

/**
 * Map the core's oracle-based result back to the seat's card indices and grid positions,
 * mirroring serverutils/botDeckBuilder.buildBotDecks — but using the precomputed row/col from
 * the job instead of carddb. Returns the seat's mainboard/sideboard plus the mainboard cards
 * (for naming).
 */
export const assembleSeat = (
  seat: DeckbuildJobSeat,
  basics: DeckbuildJobCard[],
  result: { mainboard: string[]; sideboard: string[] },
): { mainboard: number[][][]; sideboard: number[][][]; mainboardCards: DeckbuildJobCard[] } => {
  const pool = [...seat.pool];
  const mainboardCards: DeckbuildJobCard[] = [];

  for (const oracle of result.mainboard) {
    const poolIdx = pool.findIndex((c) => c.oracle === oracle);
    if (poolIdx === -1) {
      const basic = basics.find((b) => b.oracle === oracle);
      if (basic) mainboardCards.push(basic);
    } else {
      mainboardCards.push(pool[poolIdx]!);
      pool.splice(poolIdx, 1);
    }
  }

  const mainboard = setupPicks(2, 8);
  for (const c of mainboardCards) {
    if (mainboard[c.row]?.[c.col]) {
      mainboard[c.row]![c.col]!.push(c.index);
    }
  }

  // Everything left in the pool (never basics) goes to the sideboard by column.
  const sideboard = setupPicks(1, 8);
  for (const c of pool) {
    if (sideboard[0]?.[c.col]) {
      sideboard[0]![c.col]!.push(c.index);
    }
  }

  return { mainboard, sideboard, mainboardCards };
};

/** The deck's colour string (e.g. "WU" or "C"), via the shared @utils color heuristic. */
export const assessColors = (mainboardCards: DeckbuildJobCard[], facts: OracleFactsMap): string => {
  const cards = mainboardCards
    .map((c) => facts[c.oracle])
    .filter((f): f is NonNullable<typeof f> => !!f)
    .map((f) => ({ isLand: f.isLand, colorIdentity: f.colorIdentity }));
  return assessDeckColors(cards).join('');
};

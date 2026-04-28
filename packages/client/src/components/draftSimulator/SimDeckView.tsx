import React, { useMemo } from 'react';

import type { BuiltDeck, CardMeta } from '@utils/datatypes/SimulationReport';

import { DeckStacksStatic } from '../DeckCard';
import Text from '../base/Text';

export const CMC_COLS = 8;

/** Build piles + a minimal cards array compatible with DeckStacksStatic from oracle ID lists.
 *  Rows: 0 = Creatures, 1 = Non-Creatures, 2 = Lands. Columns: CMC 0–7+. */
export function buildPilesFromOracles(
  oracleIds: string[],
  cardMeta: Record<string, CardMeta>,
): { piles: number[][][]; cards: { cardID: string; details: { oracle_id: string; name: string; image_normal: string } }[] } {
  const cards: { cardID: string; details: { oracle_id: string; name: string; image_normal: string } }[] = [];
  const oracleToIndex: Record<string, number> = {};
  for (const id of oracleIds) {
    if (oracleToIndex[id] !== undefined) continue;
    const meta = cardMeta[id];
    oracleToIndex[id] = cards.length;
    cards.push({ cardID: id, details: { oracle_id: id, name: meta?.name ?? id, image_normal: meta?.imageUrl ?? '' } });
  }

  const piles: number[][][] = Array.from({ length: 3 }, () =>
    Array.from({ length: CMC_COLS }, () => [] as number[]),
  );

  for (const id of oracleIds) {
    const meta = cardMeta[id];
    const typeLower = (meta?.type ?? '').toLowerCase();
    const row = typeLower.includes('land') ? 2 : typeLower.includes('creature') ? 0 : 1;
    const col = Math.min(CMC_COLS - 1, Math.max(0, Math.floor(meta?.cmc ?? 0)));
    piles[row]![col]!.push(oracleToIndex[id]!);
  }

  const nonEmptyPiles = piles.filter((row) => row.some((col) => col.length > 0));
  return { piles: nonEmptyPiles, cards };
}

const SimDeckView: React.FC<{
  deck: BuiltDeck;
  cardMeta: Record<string, CardMeta>;
}> = ({ deck, cardMeta }) => {
  const { piles: mainPiles, cards } = useMemo(
    () => buildPilesFromOracles(deck.mainboard, cardMeta),
    [deck.mainboard, cardMeta],
  );
  const { piles: sbPiles, cards: sbCards } = useMemo(
    () => buildPilesFromOracles(deck.sideboard, cardMeta),
    [deck.sideboard, cardMeta],
  );

  return (
    <div className="overflow-x-auto">
      <DeckStacksStatic piles={mainPiles} cards={cards} />
      {deck.sideboard.length > 0 && (
        <>
          <div className="px-3 py-2 border-t border-border">
            <Text semibold lg>
              Sideboard ({deck.sideboard.length})
            </Text>
          </div>
          <DeckStacksStatic piles={sbPiles} cards={sbCards} />
        </>
      )}
    </div>
  );
};

export default SimDeckView;

// Builds the CardMeta map the draft-simulator clustering + chart components expect,
// from a cube's Card list. Shared by the record-analysis run orchestrator (which
// passes the ML remapping) and the dashboard (which rebuilds it for the reused
// simulator chart/detail components without needing to persist it in the run).

import { cardOracleId, isManaFixingLand } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import type { CardMeta } from '@utils/datatypes/SimulationReport';

export function buildCardMeta(cubeCards: Card[], remapping: Record<string, string> = {}): Record<string, CardMeta> {
  const cardMeta: Record<string, CardMeta> = {};
  for (const card of cubeCards) {
    const oracle = cardOracleId(card);
    if (!oracle || cardMeta[oracle]) continue;
    const d = card.details;
    cardMeta[oracle] = {
      name: d?.name ?? oracle,
      imageUrl: card.imgUrl || d?.image_normal || d?.image_small || '',
      colorIdentity: d?.color_identity ?? [],
      elo: d?.elo ?? 1200,
      cmc: d?.cmc ?? 0,
      type: d?.type ?? '',
      producedMana: d?.produced_mana ?? [],
      mlOracleId: remapping[oracle] && remapping[oracle] !== oracle ? remapping[oracle] : undefined,
      isManaFixingLand: (d ? isManaFixingLand(d) : false) || undefined,
    };
  }
  return cardMeta;
}

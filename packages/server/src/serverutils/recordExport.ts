import { cardName, cardOracleId } from '@utils/cardutil';
import DraftType from '@utils/datatypes/Draft';
import RecordType from '@utils/datatypes/Record';
import { RecordExportCard, RecordExportDeck, RecordExportEntry } from '@utils/datatypes/RecordExport';

import { cardFromId, getIdsFromName, getVersionsByOracleId } from './carddb';

// One record (plus its uploaded decks, if any) in the export format. Decks come
// from the record's draft: seat i belongs to player i.
export const recordToExportEntry = (record: RecordType, draft?: DraftType): RecordExportEntry => {
  const entry: RecordExportEntry = {
    id: record.id,
    name: record.name,
    date: record.date,
    description: record.description ?? '',
    players: record.players.map((p) => (p.userId ? { name: p.name, userId: p.userId } : { name: p.name })),
    rounds: record.matches ?? [],
    trophy: record.trophy ?? [],
  };
  if (record.overrides && Object.keys(record.overrides).length > 0) entry.overrides = record.overrides;

  if (draft?.seats && draft.cards) {
    const toCards = (indices: number[]): RecordExportCard[] =>
      indices
        .map((index) => draft.cards[index])
        .filter((card) => !!card)
        .map((card) => {
          const oracleId = cardOracleId(card!);
          return oracleId ? { name: cardName(card!), oracleId } : { name: cardName(card!) };
        });

    const decks: { [playerName: string]: RecordExportDeck } = {};
    record.players.forEach((player, i) => {
      const seat = draft.seats[i];
      if (!seat) return;
      const mainboard = toCards(seat.mainboard?.flat(3) ?? []);
      if (mainboard.length === 0) return;
      decks[player.name] = { mainboard, sideboard: toCards(seat.sideboard?.flat(3) ?? []) };
    });
    if (Object.keys(decks).length > 0) entry.decks = decks;
  }

  return entry;
};

// The oracle id for an exported card: its oracle id when we know it, else a lookup by name.
export const resolveExportCard = (card: RecordExportCard): string | null => {
  const { name, oracleId } = typeof card === 'string' ? { name: card, oracleId: undefined } : card;
  if (oracleId && getVersionsByOracleId(oracleId).length > 0) return oracleId;
  const [id] = getIdsFromName(name?.trim() ?? '');
  const resolved = id ? cardFromId(id).oracle_id : '';
  return resolved || null;
};

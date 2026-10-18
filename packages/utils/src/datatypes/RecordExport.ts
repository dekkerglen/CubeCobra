import { PlayerList, Round, WinLossDraw } from './Record';

export const RECORD_EXPORT_FORMAT = 'cubecobra-records';
export const RECORD_EXPORT_VERSION = 1;

// A card in an exported deck. On import the oracle id wins when it's present and
// known; otherwise the card is looked up by name. A bare string is a name.
export type RecordExportCard = { name: string; oracleId?: string } | string;

export interface RecordExportDeck {
  mainboard: RecordExportCard[];
  sideboard?: RecordExportCard[];
}

// One record, self-contained: players, rounds and decks all refer to players by name.
export interface RecordExportEntry {
  id?: string; // the record's id where it was exported from; ignored on import
  name: string;
  date: number; // ms since epoch
  description?: string;
  players: PlayerList;
  rounds?: Round[];
  trophy?: string[];
  overrides?: { [playerName: string]: WinLossDraw };
  decks?: { [playerName: string]: RecordExportDeck };
}

export interface RecordExportFile {
  format: typeof RECORD_EXPORT_FORMAT;
  version: number;
  exportedAt?: string;
  source?: { cubeId: string; cubeName: string };
  records: RecordExportEntry[];
}

import DraftType from '@utils/datatypes/Draft';
import RecordType from '@utils/datatypes/Record';
import { recordToExportEntry, resolveExportCard } from 'serverutils/recordExport';

jest.mock('serverutils/carddb', () => ({
  getVersionsByOracleId: (oracle: string) => (oracle === 'bolt-oracle' ? ['bolt-id'] : []),
  getIdsFromName: (name: string) => (name.toLowerCase() === 'lightning bolt' ? ['bolt-id'] : []),
  cardFromId: (id: string) => ({ oracle_id: id === 'bolt-id' ? 'bolt-oracle' : '' }),
}));

const card = (name: string, oracle_id: string) => ({ cardID: `${oracle_id}-id`, details: { name, oracle_id } });

const record: RecordType = {
  id: 'rec1',
  cube: 'cube1',
  date: 1000,
  name: 'Friday Draft',
  description: 'desc',
  players: [{ name: 'Andy', userId: 'user1' }, { name: 'Sam' }, { name: 'Lee' }],
  matches: [{ matches: [{ p1: 'Andy', p2: 'Sam', results: [2, 1, 0] }] }],
  trophy: ['Andy'],
  draft: 'draft1',
};

describe('recordToExportEntry', () => {
  it('exports players, rounds and each seat as that player’s deck', () => {
    const draft = {
      cards: [card('Lightning Bolt', 'bolt-oracle'), card('Counterspell', 'cs-oracle'), card('Opt', 'opt-oracle')],
      seats: [
        { mainboard: [[[0], []]], sideboard: [[[2]]] },
        { mainboard: [[[1]]], sideboard: [] },
        { mainboard: [[[]]], sideboard: [] }, // Lee never uploaded a deck
      ],
    } as unknown as DraftType;

    const entry = recordToExportEntry(record, draft);

    expect(entry.players).toEqual([{ name: 'Andy', userId: 'user1' }, { name: 'Sam' }, { name: 'Lee' }]);
    expect(entry.rounds).toEqual(record.matches);
    expect(entry.trophy).toEqual(['Andy']);
    expect(entry.decks).toEqual({
      Andy: {
        mainboard: [{ name: 'Lightning Bolt', oracleId: 'bolt-oracle' }],
        sideboard: [{ name: 'Opt', oracleId: 'opt-oracle' }],
      },
      Sam: { mainboard: [{ name: 'Counterspell', oracleId: 'cs-oracle' }], sideboard: [] },
    });
  });

  it('leaves decks out when the record has no draft', () => {
    expect(recordToExportEntry({ ...record, draft: undefined }).decks).toBeUndefined();
  });
});

describe('resolveExportCard', () => {
  it('uses a known oracle id', () => {
    expect(resolveExportCard({ name: 'whatever', oracleId: 'bolt-oracle' })).toBe('bolt-oracle');
  });

  it('falls back to the name when the oracle id is unknown', () => {
    expect(resolveExportCard({ name: 'Lightning Bolt', oracleId: 'stale' })).toBe('bolt-oracle');
  });

  it('accepts a bare name', () => {
    expect(resolveExportCard('lightning bolt')).toBe('bolt-oracle');
  });

  it('returns null for a card it cannot find', () => {
    expect(resolveExportCard('Not A Card')).toBeNull();
  });
});

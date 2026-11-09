// Fixtures are built inside the factories: @swc/jest hoists `jest.mock` above module-scope
// declarations, so an outer const would be in the TDZ when the factory runs.
jest.mock('serverutils/carddb', () => {
  const cards: Record<string, any> = {
    bolt: { scryfall_id: 'bolt-id', oracle_id: 'bolt', name: 'Lightning Bolt', set: 'm10', collector_number: '1' },
    guide: { scryfall_id: 'guide-id', oracle_id: 'guide', name: 'Goblin Guide', set: 'zen', collector_number: '1' },
    newbie: { scryfall_id: 'newbie-id', oracle_id: 'newbie', name: 'Newbie', set: 'new', collector_number: '1' },
  };
  const byName: Record<string, string> = { 'lightning bolt': 'bolt', 'goblin guide': 'guide', newbie: 'newbie' };
  return {
    cardFromId: (id: string) => Object.values(cards).find((card) => card.scryfall_id === id) ?? { error: true },
    getIdsFromName: (name: string) =>
      byName[name.toLowerCase()] ? [cards[byName[name.toLowerCase()]!].scryfall_id] : [],
    getMostReasonable: (name: string) => cards[byName[name.toLowerCase()] ?? ''] ?? null,
    // "Newbie" is outside the model's vocabulary; Goblin Guide stands in for it.
    getOracleForMl: (oracle: string) => (oracle === 'newbie' ? 'guide' : oracle),
    getReasonableCardByOracle: (oracle: string) => cards[oracle],
  };
});

jest.mock('serverutils/cardCatalog', () => ({
  __esModule: true,
  default: { oracleToIndex: { bolt: 0, guide: 1 } },
}));

jest.mock('serverutils/ml', () => ({
  draftOrThrow: jest.fn(),
  isMlServiceError: (err: any) => err?.fromMl === true,
}));

import { draftOrThrow } from 'serverutils/ml';

import { draftHandler } from '../../../../src/router/routes/tool/api/mlplayground/draft';
import { call } from '../../../test-utils/transport';

describe('POST /tool/api/mlplayground/draft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rates the pack given the pool, mapping stand-ins back to the pasted cards', async () => {
    (draftOrThrow as jest.Mock).mockResolvedValue([
      { oracle: 'guide', rating: 0.6 },
      { oracle: 'bolt', rating: 0.4 },
    ]);

    const res = await call(draftHandler).withBody({ pack: 'Lightning Bolt\nNewbie', pool: 'Goblin Guide' }).send();

    expect(res.status).toBe(200);
    // Substitution is on by default, as for draft bots.
    expect(draftOrThrow).toHaveBeenCalledWith(['bolt', 'guide'], ['guide']);
    expect(res.body.picks).toEqual([
      { cardID: 'newbie-id', oracle: 'newbie', name: 'Newbie', rating: 0.6 },
      { cardID: 'bolt-id', oracle: 'bolt', name: 'Lightning Bolt', rating: 0.4 },
    ]);
    expect(res.body.pack.cards[1]).toMatchObject({ status: 'substituted', substituteName: 'Goblin Guide' });
  });

  it('sends unknown cards as they are when substitution is off', async () => {
    (draftOrThrow as jest.Mock).mockResolvedValue([{ oracle: 'bolt', rating: 1 }]);

    const res = await call(draftHandler).withBody({ pack: 'Lightning Bolt\nNewbie', substitute: false }).send();

    expect(draftOrThrow).toHaveBeenCalledWith(['bolt', 'newbie'], []);
    expect(res.body.picks.map((pick: any) => [pick.name, pick.rating])).toEqual([
      ['Lightning Bolt', 1],
      ['Newbie', null],
    ]);
  });

  it('answers 400 for an empty pack without calling the model', async () => {
    const res = await call(draftHandler).withBody({ pack: 'Not A Card', pool: '' }).send();

    expect(res.status).toBe(400);
    expect(draftOrThrow).not.toHaveBeenCalled();
  });

  it('answers 503 when the recommender is unavailable', async () => {
    (draftOrThrow as jest.Mock).mockRejectedValue(Object.assign(new Error('timeout'), { fromMl: true }));

    const res = await call(draftHandler).withBody({ pack: 'Lightning Bolt' }).send();

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, mlUnavailable: true });
  });
});

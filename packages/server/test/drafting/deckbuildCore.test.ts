import { type OracleFactsMap, runBatchDeckbuild } from '@utils/drafting/deckbuildCore';

const spell = (oracle: string) => ({
  mlOracle: oracle,
  isLand: false,
  isConspiracyOrVanguard: false,
  name: oracle,
  type: 'Creature',
  colorIdentity: ['W'],
  producedMana: [] as string[],
});

const land = (oracle: string) => ({
  mlOracle: oracle,
  isLand: true,
  isConspiracyOrVanguard: false,
  name: oracle,
  type: 'Land',
  colorIdentity: ['W'],
  producedMana: ['W'],
});

describe('runBatchDeckbuild (carddb-free core)', () => {
  const facts: OracleFactsMap = {
    s1: spell('s1'),
    s2: spell('s2'),
    s3: spell('s3'),
    l1: land('l1'),
    cv1: {
      mlOracle: 'cv1',
      isLand: false,
      isConspiracyOrVanguard: true,
      name: 'cv1',
      type: 'Conspiracy',
      colorIdentity: [],
      producedMana: [],
    },
    bW: { ...land('bW'), name: 'Plains', type: 'Basic Land' },
  };

  it('respects spell/land limits, excludes conspiracies, and sideboards the rest', async () => {
    const batchBuild = jest.fn(async () => [
      [
        { oracle: 's1', rating: 1 },
        { oracle: 's2', rating: 0.9 },
        { oracle: 'l1', rating: 0.8 },
        { oracle: 's3', rating: 0.7 },
        { oracle: 'cv1', rating: 0.6 },
      ],
    ]);
    // No reranks — keep the manabase trim a no-op so the assertions stay deterministic.
    const batchDraft = jest.fn(async (inputs: { pack: string[]; pool: string[] }[]) => inputs.map(() => []));

    const [result] = await runBatchDeckbuild(
      [{ poolOracles: ['s1', 's2', 's3', 'l1', 'cv1'], basicsOracles: ['bW'], maxSpells: 2, maxLands: 1 }],
      facts,
      { batchBuild, batchDraft },
    );

    expect(batchBuild).toHaveBeenCalledTimes(1);

    // Both spells are mainboarded; the third spell is over the spell cap and the conspiracy
    // is never mainboarded.
    expect(result!.mainboard).toEqual(expect.arrayContaining(['s1', 's2']));
    expect(result!.mainboard).not.toContain('s3');
    expect(result!.mainboard).not.toContain('cv1');

    // Exactly maxSpells + maxLands cards, and the manabase step gave it a land (either the
    // drafted land or a basic swapped in for it).
    expect(result!.mainboard).toHaveLength(3);
    expect(result!.mainboard.some((oracle) => facts[oracle]?.isLand)).toBe(true);

    // Everything left over — including the over-cap spell and the conspiracy — sideboards.
    expect(result!.sideboard).toEqual(expect.arrayContaining(['s3', 'cv1']));
  });

  it('returns an empty result for no entries without calling ML', async () => {
    const batchBuild = jest.fn();
    const batchDraft = jest.fn();
    const out = await runBatchDeckbuild([], facts, { batchBuild, batchDraft });
    expect(out).toEqual([]);
    expect(batchBuild).not.toHaveBeenCalled();
  });
});

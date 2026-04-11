import {
  buildSeatMlMaps,
  calculateBasicsForDeck,
  chooseBestMappedOracle,
  colorDemandPerSource,
} from '../../src/utils/draftBot';

describe('buildSeatMlMaps', () => {
  it('tracks multiple originals for a shared ML oracle', () => {
    const maps = buildSeatMlMaps(['black-lotus-a', 'black-lotus-b', 'sol-ring'], {
      'black-lotus-a': 'shared-power',
      'black-lotus-b': 'shared-power',
    });

    expect(maps.toMl['black-lotus-a']).toBe('shared-power');
    expect(maps.toMl['black-lotus-b']).toBe('shared-power');
    expect(maps.toMl['sol-ring']).toBe('sol-ring');
    expect(maps.fromMl['shared-power']).toEqual(['black-lotus-a', 'black-lotus-b']);
  });
});

describe('chooseBestMappedOracle', () => {
  it('maps ranked ML results back through fromMl', () => {
    const remainingCounts: Record<string, number> = { 'black-lotus-a': 0, 'black-lotus-b': 1 };
    const choice = chooseBestMappedOracle(
      [{ oracle: 'shared-power', rating: 1.5 }],
      remainingCounts,
      {},
      { 'shared-power': ['black-lotus-b', 'black-lotus-a'] },
    );

    expect(choice.oracle).toBe('black-lotus-b');
    expect(choice.score).toBe(1.5);
  });
});

describe('colorDemandPerSource', () => {
  it('uses color identity for nonlands and produced mana for lands', () => {
    const pips = colorDemandPerSource([
      { type: 'Creature', colorIdentity: ['U'], parsedCost: [] },
      { type: 'Land', colorIdentity: [], producedMana: ['B'] },
    ]);

    expect(pips.U).toBe(1);
    expect(pips.B).toBe(0);
  });
});

describe('calculateBasicsForDeck', () => {
  it('chooses basics from color identity even when parsedCost is empty', () => {
    const basics = [
      {
        oracleId: 'plains',
        name: 'Plains',
        imageUrl: '',
        colorIdentity: ['W'],
        producedMana: ['W'],
        type: 'Basic Land',
      },
      {
        oracleId: 'forest',
        name: 'Forest',
        imageUrl: '',
        colorIdentity: ['G'],
        producedMana: ['G'],
        type: 'Basic Land',
      },
    ];

    const chosen = calculateBasicsForDeck(
      ['llanowar-elves'],
      basics,
      {
        'llanowar-elves': {
          type: 'Creature',
          colorIdentity: ['G'],
          parsedCost: [],
          producedMana: [],
        },
      },
      2,
    );

    expect(chosen).toEqual(['forest']);
  });
});

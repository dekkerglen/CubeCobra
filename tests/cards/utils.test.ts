import { cardManaSymbols } from '../../src/client/utils/cardutil';
import {
  getCardCountByColor,
  getCurveByColors,
  getFetchableColors,
  getManaSymbolCount,
  getSourcesDistribution,
} from '../../src/client/utils/deckutil';
import Card from '../../src/datatypes/Card';
import { createBasicLand, createCard, createCardFromDetails } from '../test-utils/data';

describe('getManaSymbolCount', () => {
  it('should return the count of each mana symbols found in the deck', () => {
    const result = getManaSymbolCount([
      createCardFromDetails({ parsed_cost: ['1', 'w', 'w'] }),
      createCardFromDetails({ parsed_cost: ['3', 'w'] }),
      createCardFromDetails({ parsed_cost: ['w', 'b'] }),
      createCardFromDetails({ parsed_cost: ['1', 'b', 'b'] }),
      createCardFromDetails({ parsed_cost: ['3', 'w-u', 'w-b'] }),
      createCardFromDetails({ parsed_cost: ['c-w', 'c-w', 'c-w'] }),
    ]);

    expect(result).not.toBe(undefined);
    expect(result).toEqual({
      W: 9,
      U: 1,
      B: 4,
      R: 0,
      G: 0,
      C: 3,
      total: 17,
    });
  });
});

describe('getCardColors', () => {
  it('should return the number of cards of each color in the deck', () => {
    const result = getCardCountByColor([
      createCard({ colors: ['W'] }),
      createCard({ colors: ['W'] }),
      createCard({ colors: ['W', 'B'] }),
      createCard({ colors: ['B'] }),
    ]);

    expect(result).not.toBe(undefined);
    expect(result).toEqual({
      W: 3,
      U: 0,
      B: 2,
      R: 0,
      G: 0,
      C: 0,
      total: 4,
    });
  });
});

describe('getFetchableColors', () => {
  it('should return all fetchable colors using a fetch land', () => {
    const deck: Card[] = [
      createBasicLand('Plains'),
      createBasicLand('Mountain'),
      createCardFromDetails({
        name: 'Steam Vents',
        type: 'Land — Island Mountain',
        oracle_text: '{T}: Add {U} or {R}.',
        produced_mana: ['U', 'R'],
      }),
      createCardFromDetails({
        name: 'Plateau',
        type: 'Land — Mountain Plains',
        oracle_text: '{T}: Add {R} or {W}.',
        produced_mana: ['W', 'R'],
      }),
    ];

    const aridMesa: Card = createCardFromDetails({
      name: 'Arid Mesa',
      type: 'Land',
      oracle_text:
        '{T}, Pay 1 life, Sacrifice Arid Mesa: Search your library for a Mountain or Plains card, put it onto the battlefield, then shuffle.',
    });

    expect(getFetchableColors(deck, aridMesa)).toEqual(new Set(['R', 'W', 'U']));
  });

  it('should return all available basics with fabled passage', () => {
    const deck: Card[] = [
      createBasicLand('Island'),
      createBasicLand('Swamp'),
      createCardFromDetails({
        name: 'Plateau',
        type: 'Land — Mountain Plains',
        oracle_text: '{T}: Add {R} or {W}.',
        produced_mana: ['W', 'R'],
      }),
    ];

    const fabledPassage: Card = createCardFromDetails({
      name: 'Fabled Passage',
      type: 'Land',
      oracle_text:
        '{T}, Sacrifice Fabled Passage: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
    });

    expect(getFetchableColors(deck, fabledPassage)).toEqual(new Set(['U', 'B']));
  });

  it('should return nothing when not providing a fetch land', () => {
    const deck: Card[] = [createBasicLand('Plains'), createBasicLand('Mountain')];

    const nonFetchLand: Card = createCardFromDetails({
      name: 'Castle Ardenvale',
      type: 'Land',
      oracle_text: '{T}: Add {W}.\n{2WW}, {T}: Create a 1/1 white Human creature token.',
    });

    expect(getFetchableColors(deck, nonFetchLand)).toEqual(new Set());
  });

  it('should support special fetch cases', () => {
    const deck: Card[] = [
      createBasicLand('Plains'),
      createBasicLand('Mountain'),
      createBasicLand('Mountain'),
      createBasicLand('Island'),
      createBasicLand('Swamp'),
    ];

    const myriadLandscape = createCardFromDetails({
      name: 'Myriad Landscape',
      type: 'Land',
      oracle_id: '2549bc57-9ffb-4053-9f10-f2a5f792b845',
      oracle_text:
        'Myriad Landscape enters tapped.\n{T}: Add {C}.\n{2}, {T}, Sacrifice Myriad Landscape: Search your library for up to two basic land cards that share a land type, put them onto the battlefield tapped, then shuffle.',
    });

    expect(getFetchableColors(deck, myriadLandscape)).toEqual(new Set(['W', 'R', 'U', 'B']));
  });
});

describe('getSourcesDistribution', () => {
  it('should calculate source distribution for a deck', () => {
    const deck: Card[] = [
      createBasicLand('Plains'), // W
      createBasicLand('Plains'), // W
      createBasicLand('Swamp'), // B
      createCardFromDetails({
        name: "Xander's Lounge",
        type: 'Land - Island Swamp Mountain',
        produced_mana: ['U', 'B', 'R'],
      }), // U B R
      createCardFromDetails({
        name: 'Plateau',
        type: 'Land - Mountain Plains',
        produced_mana: ['W', 'R'],
      }), // W R
      createCardFromDetails({
        name: 'Fabled Passage',
        type: 'Land',
        oracle_text:
          '{T}, Sacrifice Fabled Passage: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
      }), // All basics: W, W, B
      createCardFromDetails({
        name: 'Scalding Tarn',
        type: 'Land',
        oracle_text:
          '{T}, Pay 1 life, Sacrifice Scalding Tarn: Search your library for an Island or Mountain card, put it onto the battlefield, then shuffle.',
      }), // U, B, R, W
      createCardFromDetails({
        name: 'Ancient Tomb',
        type: 'Land',
        oracle_text: `{T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.`,
        produced_mana: ['C'],
      }),
    ];

    const result = getSourcesDistribution(deck);
    expect(result).toEqual({
      W: 5,
      U: 2,
      B: 4,
      R: 3,
      C: 1,
      G: 0,
      total: 8,
    });
  });
});

describe('curveByColor', () => {
  it('should calculate the mana curve grouped by color', () => {
    const deck: Card[] = [
      createCard({ cmc: 1, colors: ['G'] }),
      createCard({ cmc: 1, colors: ['R'] }),
      createCard({ cmc: 5, colors: ['W'] }),
      createCard({ cmc: 5, colors: ['U'] }),
      createCard({ cmc: 2, colors: ['B'] }),
      createCard({ cmc: 3, colors: ['W', 'B'] }),
      createCard({ cmc: 4, colors: [] }),
      createCard({ cmc: 10, colors: ['G'] }),
    ];

    const buckets = [1, 2, 3, 4];

    expect(getCurveByColors(deck, buckets)).toEqual({
      W: [0, 0, 1, 1], // cmc: 3 and 5
      U: [0, 0, 0, 1], // cmc 5
      B: [0, 1, 1, 0], // cmc 2 and 3
      R: [1, 0, 0, 0], // cmc 1
      G: [1, 0, 0, 1], // cmc 1 and 10
      C: [0, 0, 0, 1], // cmc 4
    });
  });
});

describe('cardManaSymbols', () => {
  it('should get all symbols with basic symbols', () => {
    expect(cardManaSymbols(createCardFromDetails({ parsed_cost: ['2', 'W', 'B'] }))).toEqual(['W', 'B']);
    expect(cardManaSymbols(createCardFromDetails({ parsed_cost: ['1', 'U', 'U', 'U'] }))).toEqual(['U', 'U', 'U']);
    expect(cardManaSymbols(createCardFromDetails({ parsed_cost: ['5', 'X'] }))).toEqual([]);
  });

  it('should separate hybrid mana symbols', () => {
    expect(cardManaSymbols(createCardFromDetails({ parsed_cost: ['2', 'W-U', 'G-U'] }))).toEqual(['W', 'U', 'G', 'U']);
    expect(cardManaSymbols(createCardFromDetails({ parsed_cost: ['C-U', 'C-B', 'C-R'] }))).toEqual([
      'C',
      'U',
      'C',
      'B',
      'C',
      'R',
    ]);
    expect(cardManaSymbols(createCardFromDetails({ parsed_cost: ['G-P', 'G-W-P', 'G'] }))).toEqual([
      'G',
      'G',
      'W',
      'G',
    ]);
  });

  it('should separate generic-color hybrid mana and ignore generic cost', () => {
    expect(cardManaSymbols(createCardFromDetails({ parsed_cost: ['2', '2-U', '2-W'] }))).toEqual(['U', 'W']);
  });

  it('should ignore values that are not mana costs', () => {
    expect(cardManaSymbols(createCardFromDetails({ parsed_cost: ['U-G', 'X-Y'] }))).toEqual([]);
    expect(cardManaSymbols(createCardFromDetails({ parsed_cost: ['G-X', 'G-5'] }))).toEqual([]);
    expect(cardManaSymbols(createCardFromDetails({ parsed_cost: ['X', '2-X'] }))).toEqual([]);
  });
});

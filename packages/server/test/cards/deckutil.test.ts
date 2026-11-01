import {
  DECK_COLOR_NAMES,
  DeckColorName,
  DeckColorStat,
  DeckColorStats,
  getCardCountByColor,
  getCurveByColors,
  getDeckColorStats,
  getFetchableColors,
  getManaSymbolCount,
  getSourcesDistribution,
  percentOf,
} from '@client/utils/deckutil';
import { cardGames, cardManaSymbols, reasonableCard } from '@utils/cardutil';
import Card, { CardDetails } from '@utils/datatypes/Card';

import {
  createBasicLand,
  createCard,
  createCardDetails,
  createCardFromDetails,
  createCardWithoutDetails,
} from '../test-utils/data';

describe('percentOf', () => {
  it('returns a whole-number percentage', () => {
    expect(percentOf(1, 4)).toEqual(25);
    expect(percentOf(2, 3)).toEqual(67);
  });

  it('returns 0 when the denominator is 0', () => {
    expect(percentOf(0, 0)).toEqual(0);
    expect(percentOf(5, 0)).toEqual(0);
  });
});

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

  it('counts a card with no colors as colorless', () => {
    const result = getCardCountByColor([
      createCard({ colors: ['W'] }),
      createCard({ colors: [] }),
      createCard({ colors: [] }),
    ]);

    expect(result).toEqual({ W: 1, U: 0, B: 0, R: 0, G: 0, C: 2, total: 3 });
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

describe('reasonableCard', () => {
  const overridesForNormalDetails: Partial<CardDetails> = {
    isExtra: false,
    promo: false,
    digital: false,
    isToken: false,
    set: 'dom',
    set_type: 'expansion',
    border_color: 'black',
    promo_types: undefined,
    language: 'en',
    collector_number: '270',
    layout: 'normal',
  };

  it('Regular details are reasonable', async () => {
    const details = createCardDetails(overridesForNormalDetails);

    expect(reasonableCard(details)).toBeTruthy();
  });

  it('Extras are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, isExtra: true });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Promos are reasonable if not excluded by set_type', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, promo: true });

    expect(reasonableCard(details)).toBeTruthy();
  });

  it('Digital cards are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, digital: true });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Tokens are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, isToken: true });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Non-english cards are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, language: 'fr' });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Must not be a promo based on collector number to be reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, collector_number: '177★' });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Cards with flavor name are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, hasFlavorName: true });

    expect(reasonableCard(details)).toBeFalsy();
  });

  describe('set_type', () => {
    it('Masterpiece is not reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, set_type: 'masterpiece' });

      expect(reasonableCard(details)).toBeFalsy();
    });

    it('Memorabilia is not reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, set_type: 'memorabilia' });

      expect(reasonableCard(details)).toBeFalsy();
    });

    it('Undefined is reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, set_type: undefined });

      expect(reasonableCard(details)).toBeTruthy();
    });

    it('Token is not reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, set_type: 'token' });

      expect(reasonableCard(details)).toBeFalsy();
    });

    it('Promo set_type is not reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, set_type: 'promo' });

      expect(reasonableCard(details)).toBeFalsy();
    });

    it('Funny is reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, set_type: 'funny' });

      expect(reasonableCard(details)).toBeTruthy();
    });
  });

  describe('set', () => {
    it('The List (plst) is not reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, set: 'plst' });

      expect(reasonableCard(details)).toBeFalsy();
    });
  });

  describe('promo_types', () => {
    it('Boosterfun is reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, promo_types: ['boosterfun'] });

      expect(reasonableCard(details)).toBeTruthy();
    });

    it('Promopack is not reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, promo_types: ['promopack'] });

      expect(reasonableCard(details)).toBeFalsy();
    });

    it('Universes beyond is reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, promo_types: ['universesbeyond'] });

      expect(reasonableCard(details)).toBeTruthy();
    });

    it('UB with source-material promo types is reasonable', async () => {
      const details = createCardDetails({
        ...overridesForNormalDetails,
        promo_types: ['ffiii', 'sourcematerial', 'universesbeyond'],
      });

      expect(reasonableCard(details)).toBeTruthy();
    });

    it('UB with unreasonable promo types is not reasonable', async () => {
      const details = createCardDetails({
        ...overridesForNormalDetails,
        promo_types: ['universesbeyond', 'prerelease'],
      });

      expect(reasonableCard(details)).toBeFalsy();
    });

    it('Surgefoil is reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, promo_types: ['surgefoil'] });

      expect(reasonableCard(details)).toBeTruthy();
    });
  });

  describe('layout', () => {
    it('Art series is not reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, layout: 'art_series' });

      expect(reasonableCard(details)).toBeFalsy();
    });

    it('Double faced tokens are not reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, layout: 'double_faced_token' });

      expect(reasonableCard(details)).toBeFalsy();
    });

    it('Scheme is not reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, layout: 'scheme' });

      expect(reasonableCard(details)).toBeFalsy();
    });

    it('Planar is not reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, layout: 'planar' });

      expect(reasonableCard(details)).toBeFalsy();
    });

    it('Vanguard is not reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, layout: 'vanguard' });

      expect(reasonableCard(details)).toBeFalsy();
    });

    it('Token is not reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, layout: 'token' });

      expect(reasonableCard(details)).toBeFalsy();
    });

    it('Emblem is not reasonable', async () => {
      const details = createCardDetails({ ...overridesForNormalDetails, layout: 'emblem' });

      expect(reasonableCard(details)).toBeFalsy();
    });
  });
});

describe('cardGames', () => {
  it('Default is empty', async () => {
    const card = createCardFromDetails({ games: undefined });

    expect(cardGames(card)).toEqual([]);
  });

  it('Returns the games the card exists in', async () => {
    const card = createCardFromDetails({ games: ['paper', 'arena'] });

    expect(cardGames(card)).toEqual(['paper', 'arena']);
  });
});

describe('getDeckColorStats', () => {
  const statFor = (stats: DeckColorStats, color: DeckColorName): DeckColorStat =>
    stats.colors.find((stat) => stat.color === color)!;

  const createSpell = (overrides: Partial<CardDetails>): Card =>
    createCardFromDetails({ type: 'Instant', colors: [], parsed_cost: [], cmc: 0, ...overrides });

  const createDualLand = (): Card =>
    createCardFromDetails({ type: 'Land', colors: [], parsed_cost: [], cmc: 0, produced_mana: ['R', 'G'] });

  it('excludes lands from spellCount, cardCount, symbolCount and the curve', () => {
    const stats = getDeckColorStats([
      createSpell({ colors: ['R'], parsed_cost: ['1', 'r'], cmc: 2 }),
      createBasicLand('Mountain'),
      createDualLand(),
    ]);

    expect(stats.spellCount).toEqual(1);
    expect(stats.landCount).toEqual(2);

    const red = statFor(stats, 'Red');
    expect(red.cardCount).toEqual(1);
    expect(red.symbolCount).toEqual(1);
    expect(red.symbolTotal).toEqual(1);
    expect(red.curve).toEqual([0, 0, 1, 0, 0, 0]);
    expect(red.sources).toEqual(2);
    expect(red.sourceTotal).toEqual(2);

    const colorless = statFor(stats, 'Colorless');
    expect(colorless.cardCount).toEqual(0);
    expect(colorless.curve).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('counts a two-color card once in each of its colors', () => {
    const stats = getDeckColorStats([createSpell({ colors: ['R', 'G'], parsed_cost: ['r', 'g'], cmc: 2 })]);

    expect(stats.spellCount).toEqual(1);
    expect(statFor(stats, 'Red').cardCount).toEqual(1);
    expect(statFor(stats, 'Green').cardCount).toEqual(1);
  });

  it('counts a colorless spell toward Colorless', () => {
    const stats = getDeckColorStats([
      createSpell({ type: 'Artifact', colors: [], parsed_cost: ['2'], cmc: 2 }),
      createSpell({ colors: ['W'], parsed_cost: ['w'], cmc: 1 }),
    ]);

    expect(stats.spellCount).toEqual(2);
    expect(statFor(stats, 'Colorless').cardCount).toEqual(1);
  });

  it('reports curveMax as the largest bucket across every color', () => {
    const stats = getDeckColorStats([
      createSpell({ colors: ['R'], parsed_cost: ['r'], cmc: 1 }),
      createSpell({ colors: ['R'], parsed_cost: ['r'], cmc: 1 }),
      createSpell({ colors: ['R'], parsed_cost: ['r'], cmc: 1 }),
      createSpell({ colors: ['G'], parsed_cost: ['g'], cmc: 1 }),
    ]);

    expect(stats.curveMax).toEqual(3);
    expect(statFor(stats, 'Red').curve).toEqual([0, 3, 0, 0, 0, 0]);
    expect(statFor(stats, 'Green').curve).toEqual([0, 1, 0, 0, 0, 0]);
  });

  it('returns zeroed stats and a curveMax of 1 for an empty deck', () => {
    const stats = getDeckColorStats([]);

    expect(stats.spellCount).toEqual(0);
    expect(stats.landCount).toEqual(0);
    expect(stats.curveMax).toEqual(1);
    expect(stats.colors.map((stat) => stat.color)).toEqual([...DECK_COLOR_NAMES]);
    expect(stats.colors.map((stat) => stat.symbol)).toEqual(['W', 'U', 'B', 'R', 'G', 'C']);

    for (const stat of stats.colors) {
      expect(stat.cardCount).toEqual(0);
      expect(stat.symbolCount).toEqual(0);
      expect(stat.symbolTotal).toEqual(0);
      expect(stat.curve).toEqual([0, 0, 0, 0, 0, 0]);
      expect(stat.sources).toEqual(0);
      expect(stat.sourceTotal).toEqual(0);
    }
  });

  it('handles a deck of only lands', () => {
    const stats = getDeckColorStats([createBasicLand('Mountain'), createBasicLand('Mountain'), createDualLand()]);

    expect(stats.spellCount).toEqual(0);
    expect(stats.landCount).toEqual(3);
    expect(stats.curveMax).toEqual(1);
    expect(stats.colors.map((stat) => stat.cardCount)).toEqual([0, 0, 0, 0, 0, 0]);

    expect(statFor(stats, 'Red').sources).toEqual(3);
    expect(statFor(stats, 'Green').sources).toEqual(1);
    expect(statFor(stats, 'Red').sourceTotal).toEqual(3);
  });

  it('treats a card without details as a colorless spell', () => {
    const stats = getDeckColorStats([createCardWithoutDetails()]);

    expect(stats.spellCount).toEqual(1);
    expect(stats.landCount).toEqual(0);

    const colorless = statFor(stats, 'Colorless');
    expect(colorless.cardCount).toEqual(1);
    expect(colorless.curve).toEqual([1, 0, 0, 0, 0, 0]);
  });

  it('counts a modal double-faced card with a land back as both a spell and a mana source', () => {
    const stats = getDeckColorStats([
      createSpell({
        type: 'Sorcery // Land',
        colors: ['G'],
        parsed_cost: ['1', 'g'],
        cmc: 2,
        produced_mana: ['G'],
      }),
    ]);

    expect(stats.spellCount).toEqual(1);
    expect(stats.landCount).toEqual(1);
    expect(statFor(stats, 'Green').cardCount).toEqual(1);
    expect(statFor(stats, 'Green').curve).toEqual([0, 0, 1, 0, 0, 0]);
    expect(statFor(stats, 'Green').sources).toEqual(1);
    expect(statFor(stats, 'Green').sourceTotal).toEqual(1);
  });

  it('still excludes a card whose front face is a land', () => {
    const stats = getDeckColorStats([
      createSpell({ type: 'Land // Land', colors: [], parsed_cost: [], cmc: 0, produced_mana: ['G'] }),
    ]);

    expect(stats.spellCount).toEqual(0);
    expect(stats.landCount).toEqual(1);
    expect(statFor(stats, 'Green').sources).toEqual(1);
  });

  it('reports every spell as colorless when none has a color', () => {
    const stats = getDeckColorStats([
      createSpell({ type: 'Artifact', colors: [], parsed_cost: ['2'], cmc: 2 }),
      createSpell({ type: 'Artifact', colors: [], parsed_cost: ['3'], cmc: 3 }),
    ]);

    expect(stats.spellCount).toEqual(2);
    expect(statFor(stats, 'Colorless').cardCount).toEqual(2);
    expect(stats.colors.map((stat) => stat.cardCount)).toEqual([0, 0, 0, 0, 0, 2]);
  });

  it('folds mana values above the top bucket into the 5+ bucket', () => {
    const stats = getDeckColorStats([createSpell({ type: 'Sorcery', colors: ['R'], parsed_cost: ['7', 'r'], cmc: 8 })]);

    expect(statFor(stats, 'Red').curve).toEqual([0, 0, 0, 0, 0, 1]);
  });
});

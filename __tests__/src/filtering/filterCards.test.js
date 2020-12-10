import { makeFilter } from 'filtering/FilterCards';
import { expectOperator } from '../../helpers';

const fixturesPath = 'fixtures';
const cubefixture = require('../../../fixtures/examplecube');

const carddb = require('../../../serverjs/cards');

const COLOR_IDENTITY_ACCESSOR = (card) => card.colors ?? card.details.color_identity;

const setCounts = (cards, propertyAccessor) => {
  let greenCardCount = 0;
  let colorlessCardCount = 0;
  let goldWithGreenCount = 0;
  cards.forEach((card) => {
    const prop = propertyAccessor(card);
    if (prop.length === 0) {
      colorlessCardCount += 1;
    } else if (prop.length === 1) {
      if (prop[0] === 'G') {
        greenCardCount += 1;
      } else if (prop[0] === 'C') {
        colorlessCardCount += 1;
      }
    } else if (prop.includes('G')) {
      goldWithGreenCount += 1;
    }
  });
  return [greenCardCount, colorlessCardCount, goldWithGreenCount];
};

const countsByCount = (cards, propertyAccessor, operator) => {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const card of cards) {
    const prop = propertyAccessor(card);
    if (operator === '=' || operator === ':') {
      counts[prop.length] += 1;
    } else if (operator === '>') {
      for (let i = 0; i < prop.length; i++) counts[i] += 1;
    } else if (operator === '>=') {
      for (let i = 0; i <= prop.length; i++) counts[i] += 1;
    } else if (operator === '<') {
      for (let i = prop.length + 1; i < counts.length; i++) counts[i] += 1;
    } else if (operator === '<=') {
      for (let i = prop.length; i < counts.length; i++) counts[i] += 1;
    } else if (operator === '!=') {
      for (let i = 0; i < counts.length; i++) {
        if (i !== prop.length) counts[i] += 1;
      }
    }
  }
  return counts;
};

describe('filter', () => {
  describe('makeFilter', () => {
    let exampleCube;
    beforeAll(() => {
      exampleCube = JSON.parse(JSON.stringify(cubefixture.exampleCube));
      return carddb.initializeCardDb(fixturesPath, true).then(() => {
        exampleCube.cards.forEach((card) => {
          card.details = carddb.cardFromId(card.cardID);
        });
      });
    });
    it('properly filters names and returns a valid object', () => {
      const { filter } = makeFilter('castle');
      const castles = exampleCube.cards.filter(filter);
      const expectedCastles = [
        {
          tags: ['New'],
          colors: ['W'],
          status: 'Not Owned',
          cmc: 0,
          cardID: '7f910495-8bd7-4134-a281-c16fd666d5cc',
          type_line: 'Land',
          addedTmsp: '2019-09-28T20:58:35.095Z',
          details: {
            color_identity: ['W'],
            set: 'eld',
            collector_number: '238',
            promo: false,
            digital: false,
            isToken: false,
            border_color: 'black',
            name: 'Castle Ardenvale',
            name_lower: 'castle ardenvale',
            oracle_id: 'f8f4fc60-725d-46d8-8e8f-e68e00d20589',
            mtgo_id: 78622,
            full_name: 'Castle Ardenvale [eld-238]',
            artist: 'Volkan Baǵa',
            scryfall_uri: 'https://scryfall.com/card/eld/238/castle-ardenvale?utm_source=api',
            rarity: 'rare',
            oracle_text:
              'Castle Ardenvale enters the battlefield tapped unless you control a Plains.\n{T}: Add {W}.\n{2}{W}{W}, {T}: Create a 1/1 white Human creature token.',
            _id: '7f910495-8bd7-4134-a281-c16fd666d5cc',
            cmc: 0,
            legalities: {
              Standard: 'legal',
              Future: 'legal',
              Historic: 'legal',
              Pioneer: 'legal',
              Modern: 'legal',
              Legacy: 'legal',
              Pauper: 'not_legal',
              Vintage: 'legal',
              Penny: 'legal',
              Commander: 'legal',
              Brawl: 'legal',
              Duel: 'legal',
              Oldschool: 'not_legal',
            },
            parsed_cost: [''],
            colors: [],
            type: 'Land',
            full_art: false,
            language: 'en',
            tcgplayer_id: 199390,
            tokens: ['94057dc6-e589-4a29-9bda-90f5bece96c4'],
            image_small:
              'https://img.scryfall.com/cards/small/front/7/f/7f910495-8bd7-4134-a281-c16fd666d5cc.jpg?1572491161',
            image_normal:
              'https://img.scryfall.com/cards/normal/front/7/f/7f910495-8bd7-4134-a281-c16fd666d5cc.jpg?1572491161',
            art_crop:
              'https://img.scryfall.com/cards/art_crop/front/7/f/7f910495-8bd7-4134-a281-c16fd666d5cc.jpg?1572491161',
            colorcategory: 'l',
          },
        },
        {
          tags: ['New'],
          colors: ['R'],
          status: 'Not Owned',
          cmc: 0,
          cardID: '8bb8512e-6913-4be6-8828-24cfcbec042e',
          type_line: 'Land',
          addedTmsp: '2019-09-28T20:58:35.096Z',
          details: {
            color_identity: ['R'],
            set: 'eld',
            collector_number: '239',
            promo: false,
            digital: false,
            isToken: false,
            border_color: 'black',
            name: 'Castle Embereth',
            name_lower: 'castle embereth',
            oracle_id: '91fbb25b-8521-483f-88b0-77778d25f7fd',
            mtgo_id: 78624,
            full_name: 'Castle Embereth [eld-239]',
            artist: 'Jaime Jones',
            scryfall_uri: 'https://scryfall.com/card/eld/239/castle-embereth?utm_source=api',
            rarity: 'rare',
            oracle_text:
              'Castle Embereth enters the battlefield tapped unless you control a Mountain.\n{T}: Add {R}.\n{1}{R}{R}, {T}: Creatures you control get +1/+0 until end of turn.',
            _id: '8bb8512e-6913-4be6-8828-24cfcbec042e',
            cmc: 0,
            legalities: {
              Standard: 'legal',
              Future: 'legal',
              Historic: 'legal',
              Pioneer: 'legal',
              Modern: 'legal',
              Legacy: 'legal',
              Pauper: 'not_legal',
              Vintage: 'legal',
              Penny: 'legal',
              Commander: 'legal',
              Brawl: 'legal',
              Duel: 'legal',
              Oldschool: 'not_legal',
            },
            parsed_cost: [''],
            colors: [],
            type: 'Land',
            full_art: false,
            language: 'en',
            tcgplayer_id: 199286,
            image_small:
              'https://img.scryfall.com/cards/small/front/8/b/8bb8512e-6913-4be6-8828-24cfcbec042e.jpg?1572491168',
            image_normal:
              'https://img.scryfall.com/cards/normal/front/8/b/8bb8512e-6913-4be6-8828-24cfcbec042e.jpg?1572491168',
            art_crop:
              'https://img.scryfall.com/cards/art_crop/front/8/b/8bb8512e-6913-4be6-8828-24cfcbec042e.jpg?1572491168',
            colorcategory: 'l',
          },
        },
        {
          tags: ['New'],
          colors: ['G'],
          status: 'Not Owned',
          cmc: 0,
          cardID: 'e3c2c66c-f7f0-41d5-a805-a129aeaf1b75',
          type_line: 'Land',
          addedTmsp: '2019-09-28T20:58:35.100Z',
          details: {
            color_identity: ['G'],
            set: 'eld',
            collector_number: '240',
            promo: false,
            digital: false,
            isToken: false,
            border_color: 'black',
            name: 'Castle Garenbrig',
            name_lower: 'castle garenbrig',
            oracle_id: 'de75e5dd-8a52-406c-b55c-96d686885500',
            mtgo_id: 78626,
            full_name: 'Castle Garenbrig [eld-240]',
            artist: 'Adam Paquette',
            scryfall_uri: 'https://scryfall.com/card/eld/240/castle-garenbrig?utm_source=api',
            rarity: 'rare',
            oracle_text:
              'Castle Garenbrig enters the battlefield tapped unless you control a Forest.\n{T}: Add {G}.\n{2}{G}{G}, {T}: Add six {G}. Spend this mana only to cast creature spells or activate abilities of creatures.',
            _id: 'e3c2c66c-f7f0-41d5-a805-a129aeaf1b75',
            cmc: 0,
            legalities: {
              Standard: 'legal',
              Future: 'legal',
              Historic: 'legal',
              Pioneer: 'legal',
              Modern: 'legal',
              Legacy: 'legal',
              Pauper: 'not_legal',
              Vintage: 'legal',
              Penny: 'legal',
              Commander: 'legal',
              Brawl: 'legal',
              Duel: 'legal',
              Oldschool: 'not_legal',
            },
            parsed_cost: [''],
            colors: [],
            type: 'Land',
            full_art: false,
            language: 'en',
            tcgplayer_id: 199288,
            image_small:
              'https://img.scryfall.com/cards/small/front/e/3/e3c2c66c-f7f0-41d5-a805-a129aeaf1b75.jpg?1572491176',
            image_normal:
              'https://img.scryfall.com/cards/normal/front/e/3/e3c2c66c-f7f0-41d5-a805-a129aeaf1b75.jpg?1572491176',
            art_crop:
              'https://img.scryfall.com/cards/art_crop/front/e/3/e3c2c66c-f7f0-41d5-a805-a129aeaf1b75.jpg?1572491176',
            colorcategory: 'l',
          },
        },
        {
          tags: ['New'],
          colors: ['B'],
          status: 'Not Owned',
          cmc: 0,
          cardID: '195383c1-4723-40b0-ba53-298dfd8e30d0',
          type_line: 'Land',
          addedTmsp: '2019-09-28T20:58:35.100Z',
          details: {
            color_identity: ['B'],
            set: 'eld',
            collector_number: '241',
            promo: false,
            digital: false,
            isToken: false,
            border_color: 'black',
            name: 'Castle Locthwain',
            name_lower: 'castle locthwain',
            oracle_id: 'be811e70-aaaa-41f3-bf9e-5d3f9f719b49',
            mtgo_id: 78628,
            full_name: 'Castle Locthwain [eld-241]',
            artist: 'Titus Lunter',
            scryfall_uri: 'https://scryfall.com/card/eld/241/castle-locthwain?utm_source=api',
            rarity: 'rare',
            oracle_text:
              'Castle Locthwain enters the battlefield tapped unless you control a Swamp.\n{T}: Add {B}.\n{1}{B}{B}, {T}: Draw a card, then you lose life equal to the number of cards in your hand.',
            _id: '195383c1-4723-40b0-ba53-298dfd8e30d0',
            cmc: 0,
            legalities: {
              Standard: 'legal',
              Future: 'legal',
              Historic: 'legal',
              Pioneer: 'legal',
              Modern: 'legal',
              Legacy: 'legal',
              Pauper: 'not_legal',
              Vintage: 'legal',
              Penny: 'legal',
              Commander: 'legal',
              Brawl: 'legal',
              Duel: 'legal',
              Oldschool: 'not_legal',
            },
            parsed_cost: [''],
            colors: [],
            type: 'Land',
            full_art: false,
            language: 'en',
            tcgplayer_id: 199388,
            image_small:
              'https://img.scryfall.com/cards/small/front/1/9/195383c1-4723-40b0-ba53-298dfd8e30d0.jpg?1572491183',
            image_normal:
              'https://img.scryfall.com/cards/normal/front/1/9/195383c1-4723-40b0-ba53-298dfd8e30d0.jpg?1572491183',
            art_crop:
              'https://img.scryfall.com/cards/art_crop/front/1/9/195383c1-4723-40b0-ba53-298dfd8e30d0.jpg?1572491183',
            colorcategory: 'l',
          },
        },
        {
          tags: ['New'],
          colors: ['U'],
          status: 'Not Owned',
          cmc: 0,
          cardID: '0a8b9d37-e89c-44ad-bd1b-51cb06ec3e0b',
          type_line: 'Land',
          addedTmsp: '2019-09-28T20:58:35.101Z',
          details: {
            color_identity: ['U'],
            set: 'eld',
            collector_number: '242',
            promo: false,
            digital: false,
            isToken: false,
            border_color: 'black',
            name: 'Castle Vantress',
            name_lower: 'castle vantress',
            oracle_id: 'cdf41cf4-4e77-453d-be5b-0abbbd358934',
            mtgo_id: 78630,
            full_name: 'Castle Vantress [eld-242]',
            artist: 'John Avon',
            scryfall_uri: 'https://scryfall.com/card/eld/242/castle-vantress?utm_source=api',
            rarity: 'rare',
            oracle_text:
              'Castle Vantress enters the battlefield tapped unless you control an Island.\n{T}: Add {U}.\n{2}{U}{U}, {T}: Scry 2.',
            _id: '0a8b9d37-e89c-44ad-bd1b-51cb06ec3e0b',
            cmc: 0,
            legalities: {
              Standard: 'legal',
              Future: 'legal',
              Historic: 'legal',
              Pioneer: 'legal',
              Modern: 'legal',
              Legacy: 'legal',
              Pauper: 'not_legal',
              Vintage: 'legal',
              Penny: 'legal',
              Commander: 'legal',
              Brawl: 'legal',
              Duel: 'legal',
              Oldschool: 'not_legal',
            },
            parsed_cost: [''],
            colors: [],
            type: 'Land',
            full_art: false,
            language: 'en',
            tcgplayer_id: 199284,
            image_small:
              'https://img.scryfall.com/cards/small/front/0/a/0a8b9d37-e89c-44ad-bd1b-51cb06ec3e0b.jpg?1572491190',
            image_normal:
              'https://img.scryfall.com/cards/normal/front/0/a/0a8b9d37-e89c-44ad-bd1b-51cb06ec3e0b.jpg?1572491190',
            art_crop:
              'https://img.scryfall.com/cards/art_crop/front/0/a/0a8b9d37-e89c-44ad-bd1b-51cb06ec3e0b.jpg?1572491190',
            colorcategory: 'l',
          },
        },
      ];
      expect(castles).toEqual(expectedCastles);
    });

    it('properly filters oracle text', () => {
      const { filter } = makeFilter('o:flying');
      const countFlyers = exampleCube.cards
        .map((card) => {
          return card.details.oracle_text.toLowerCase().indexOf('flying') === -1 ? 0 : 1;
        })
        .reduce((total, inc) => total + inc, 0);

      const flyers = exampleCube.cards.filter(filter);
      expect(flyers).toHaveLength(countFlyers);
    });

    describe('color filters', () => {
      let greenCardCount;
      let colorlessCardCount;
      let goldWithGreenCount;

      beforeAll(() => {
        [greenCardCount, colorlessCardCount, goldWithGreenCount] = setCounts(
          exampleCube.cards,
          (card) => card.details.colors,
        );
      });

      const testColors = (operator, expectedCount, expectation) => {
        let { filter } = makeFilter(`c${operator}green`);

        let filteredCards = exampleCube.cards.filter(filter);
        expect(filteredCards).toHaveLength(expectedCount);
        filteredCards.forEach(expectation);

        filteredCards = exampleCube.cards.filter(filter);
        expect(filteredCards).toHaveLength(expectedCount);
        filteredCards.forEach(expectation);

        // handle color abbreviation
        ({ filter } = makeFilter(`c${operator}g`));

        filteredCards = exampleCube.cards.filter(filter);
        expect(filteredCards).toHaveLength(expectedCount);
        filteredCards.forEach(expectation);

        filteredCards = exampleCube.cards.filter(filter);
        expect(filteredCards).toHaveLength(expectedCount);
        filteredCards.forEach(expectation);
      };

      it('the = operator filters for mono-color cards', () => {
        testColors('=', greenCardCount, (card) => {
          expect(card.details.colors).toEqual(['G']);
        });
      });

      it('the >= operator filters for color-including cards', () => {
        testColors('>=', greenCardCount + goldWithGreenCount, (card) => {
          expect(card.details.colors).toEqual(expect.arrayContaining(['G']));
        });
      });

      it('the <= operator filters for colorless and mono-color cards', () => {
        testColors('<=', greenCardCount + colorlessCardCount, (card) => {
          expect(card.details.colors).not.toEqual(expect.arrayContaining(['W', 'U', 'B', 'R']));
        });
      });

      it('the > operator filters for multi-color cards including a color', () => {
        testColors('>', goldWithGreenCount, (card) => {
          expect(card.details.colors).not.toBe(['G']);
          expect(card.details.colors).toContain('G');
        });
      });

      it('the < operator filters for colorless cards', () => {
        testColors('<', colorlessCardCount, (card) => {
          expect(card.details.colors).toEqual([]);
        });
      });

      const testColorCount = (operator, numColors, expectedCount) => {
        const { filter } = makeFilter(`c${operator}${numColors}`);
        const cards = exampleCube.cards.filter(filter);
        cards.forEach((card) => {
          expectOperator(card.details.colors.length, operator, numColors);
        });
        expect(cards).toHaveLength(expectedCount);
      };

      describe('color counting', () => {
        it('the = operator filters for exact color count', () => {
          testColorCount('=', 0, 8);
          testColorCount('=', 1, 46);
          testColorCount('=', 2, 11);
          testColorCount('=', 3, 0);
          testColorCount('=', 4, 0);
          testColorCount('=', 5, 0);
        });

        it('the < operator filters for less-than this many colors', () => {
          testColorCount('<', 1, 8);
          testColorCount('<', 2, 54);
          testColorCount('<', 3, 65);
          testColorCount('<', 4, 65);
          testColorCount('<', 5, 65);
        });

        it('the <= operator filters for less-than-or-equal-to this many colors', () => {
          testColorCount('<=', 0, 8);
          testColorCount('<=', 1, 54);
          testColorCount('<=', 2, 65);
          testColorCount('<=', 3, 65);
          testColorCount('<=', 4, 65);
          testColorCount('<=', 5, 65);
        });

        it('the > operator filters for greater-than this many colors', () => {
          testColorCount('>', 0, 57);
          testColorCount('>', 1, 11);
          testColorCount('>', 2, 0);
          testColorCount('>', 3, 0);
          testColorCount('>', 4, 0);
        });

        it('the >= operator filters for greater-than-or-equal-to this many colors', () => {
          testColorCount('>=', 0, 65);
          testColorCount('>=', 1, 57);
          testColorCount('>=', 2, 11);
          testColorCount('>=', 3, 0);
          testColorCount('>=', 4, 0);
          testColorCount('>=', 5, 0);
        });

        it('the != operator filters for cmc not-equal to this many colors', () => {
          testColorCount('!=', 0, 57);
          testColorCount('!=', 1, 19);
          testColorCount('!=', 2, 54);
          testColorCount('!=', 3, 65);
          testColorCount('!=', 4, 65);
          testColorCount('!=', 5, 65);
        });
      });
    });

    describe('color identity filters', () => {
      let greenCardCount;
      let colorlessCardCount;
      let goldWithGreenCount;

      const testColors = (operator, expectedCount, expectation) => {
        let { filter } = makeFilter(`ci${operator}green`);

        let filteredCards = exampleCube.cards.filter(filter);
        filteredCards.forEach(expectation);
        expect(filteredCards).toHaveLength(expectedCount);

        // handle color abbreviation
        ({ filter } = makeFilter(`ci${operator}g`));

        filteredCards = exampleCube.cards.filter(filter);
        filteredCards.forEach(expectation);
        expect(filteredCards).toHaveLength(expectedCount);
      };

      beforeAll(() => {
        [greenCardCount, colorlessCardCount, goldWithGreenCount] = setCounts(
          exampleCube.cards,
          COLOR_IDENTITY_ACCESSOR,
        );
      });

      it('the = operator filters for mono-color cards', () => {
        testColors('=', greenCardCount, (card) => {
          expect(card.details.color_identity).toEqual(['G']);
        });
      });

      it('the >= operator filters for color-including cards', () => {
        testColors('>=', greenCardCount + goldWithGreenCount, (card) => {
          expect(card.details.color_identity).toEqual(expect.arrayContaining(['G']));
        });
      });

      it('the <= operator filters for colorless and mono-color cards', () => {
        testColors('<=', greenCardCount + colorlessCardCount, (card) => {
          expect(card.details.color_identity).not.toEqual(expect.arrayContaining(['W', 'U', 'B', 'R']));
        });
      });

      it('the > operator filters for multi-color cards including a color', () => {
        testColors('>', goldWithGreenCount, (card) => {
          expect(COLOR_IDENTITY_ACCESSOR(card)).not.toBe(['G']);
          expect(COLOR_IDENTITY_ACCESSOR(card)).toContain('G');
        });
      });

      it('the < operator filters for colorless cards', () => {
        testColors('<', colorlessCardCount, (card) => {
          expect(COLOR_IDENTITY_ACCESSOR(card)).toEqual([]);
        });
      });
      const testColorCount = (operator) => {
        const counts = countsByCount(exampleCube.cards, COLOR_IDENTITY_ACCESSOR, operator);
        for (let numColors = 0; numColors < counts.length; numColors++) {
          const expectedCount = counts[numColors];
          const { filter } = makeFilter(`ci${operator}${numColors}`);
          const cards = exampleCube.cards.filter(filter);
          cards.forEach((card) => {
            expectOperator(COLOR_IDENTITY_ACCESSOR(card).length, operator, numColors);
          });
          expect(cards).toHaveLength(expectedCount);
        }
      };

      describe('color identity counting', () => {
        it('the = operator filters for exact color identity count', () => {
          testColorCount('=');
        });

        it('the < operator filters for less-than color identity count', () => {
          testColorCount('<');
        });

        it('the <= operator filters for less-than-or-equal-to color identity count', () => {
          testColorCount('<=');
        });

        it('the > operator filters for greater-than color identity count', () => {
          testColorCount('>');
        });

        it('the >= operator filters for greater-than-or-equal-to color identity count', () => {
          testColorCount('>=');
        });

        it('the != operator filters for cmc not-equal to color identity count', () => {
          testColorCount('!=');
        });
      });
    });

    describe('mana filtering', () => {
      it('correctly filters by mana cost', () => {
        const { filter } = makeFilter('mana=1W');
        const oneAndAWhiteCards = exampleCube.cards.filter(filter);
        oneAndAWhiteCards.forEach((card) => {
          expect(card.details.parsed_cost).toEqual(expect.arrayContaining(['1', 'w']));
        });
        expect(oneAndAWhiteCards).toHaveLength(3);
      });
    });

    describe('cmc filtering', () => {
      it('the = operator filters for exact cmc', () => {
        const { filter } = makeFilter('cmc=1');
        const oneCmcCards = exampleCube.cards.filter(filter);
        oneCmcCards.forEach((card) => {
          expect(card.details.cmc).toEqual(1);
        });
        expect(oneCmcCards).toHaveLength(7);
      });

      it('the < operator filters for less-than cmc', () => {
        const { filter } = makeFilter('cmc<1');
        const ltOneCmcCards = exampleCube.cards.filter(filter);
        ltOneCmcCards.forEach((card) => {
          expect(card.details.cmc).toBeLessThan(1);
        });
        expect(ltOneCmcCards).toHaveLength(7);
      });

      it('the <= operator filters for less-than-or-equal-to cmc', () => {
        const { filter } = makeFilter('cmc<=1');
        const ltEqOneCmcCards = exampleCube.cards.filter(filter);
        ltEqOneCmcCards.forEach((card) => {
          expect(card.details.cmc).toBeLessThanOrEqual(1);
        });
        expect(ltEqOneCmcCards).toHaveLength(14);
      });

      it('the > operator filters for greater-than cmc', () => {
        const { filter } = makeFilter('cmc>5');
        const gtFiveCmcCards = exampleCube.cards.filter(filter);
        gtFiveCmcCards.forEach((card) => {
          expect(card.details.cmc).toBeGreaterThan(5);
        });
        expect(gtFiveCmcCards).toHaveLength(6);
      });

      it('the >= operator filters for greater-than-or-equal-to cmc', () => {
        const { filter } = makeFilter('cmc>=5');
        const gtEqFiveCmcCards = exampleCube.cards.filter(filter);
        gtEqFiveCmcCards.forEach((card) => {
          expect(card.details.cmc).toBeGreaterThanOrEqual(5);
        });
        expect(gtEqFiveCmcCards).toHaveLength(9);
      });

      it('the != operator filters for cmc not-equal to', () => {
        const { filter } = makeFilter('cmc!=5');
        const notEqual5CmcCards = exampleCube.cards.filter(filter);
        notEqual5CmcCards.forEach((card) => {
          expect(card.details.cmc).not.toEqual(5);
        });
        expect(notEqual5CmcCards).toHaveLength(62);
      });
    });

    describe('type filtering', () => {
      it('filters by card type', () => {
        const { filter } = makeFilter('type:creature');
        const creatureCards = exampleCube.cards.filter(filter);
        creatureCards.forEach((card) => {
          expect(card.details.type).toContain('Creature');
        });
        expect(creatureCards).toHaveLength(40);
      });
    });

    describe('set filtering', () => {
      it('filters by set', () => {
        const { filter } = makeFilter('set=ELD');
        const eldraineCards = exampleCube.cards.filter(filter);
        eldraineCards.forEach((card) => {
          expect(card.details.set).toContain('eld');
        });

        expect(eldraineCards).toHaveLength(exampleCube.cards.length);
      });
    });

    describe('P/T filtering', () => {
      const expectations = [
        {
          title: 'the = operator exact-matches power/toughness',
          tests: [
            {
              filter: 'power=4',
              lookup: ['details', 'power'],
              expectedValue: 4,
              matcherName: 'toEqual',
            },
            {
              filter: 'toughness=4',
              lookup: ['details', 'toughness'],
              expectedValue: 4,
              matcherName: 'toEqual',
            },
          ],
        },
        {
          title: 'the < operator performs less-than matches for power/toughness',
          tests: [
            {
              filter: 'power<4',
              lookup: ['details', 'power'],
              expectedValue: 4,
              matcherName: 'toBeLessThan',
            },
            {
              filter: 'toughness<4',
              lookup: ['details', 'toughness'],
              expectedValue: 4,
              matcherName: 'toBeLessThan',
            },
          ],
        },
        {
          title: 'the > operator performs greater-than matches for power/toughness',
          tests: [
            {
              filter: 'power>4',
              lookup: ['details', 'power'],
              expectedValue: 4,
              matcherName: 'toBeGreaterThan',
            },
            {
              filter: 'toughness>4',
              lookup: ['details', 'toughness'],
              expectedValue: 4,
              matcherName: 'toBeGreaterThan',
            },
          ],
        },
        {
          title: 'the >= operator performs greater-than-or-equal-to matches for power/toughness',
          tests: [
            {
              filter: 'power>=3',
              lookup: ['details', 'power'],
              expectedValue: 3,
              matcherName: 'toBeGreaterThanOrEqual',
            },
            {
              filter: 'toughness>=3',
              lookup: ['details', 'toughness'],
              expectedValue: 3,
              matcherName: 'toBeGreaterThanOrEqual',
            },
          ],
        },
        {
          title: 'the <= operator performs less-than-or-equal-to matches for power/toughness',
          tests: [
            {
              filter: 'toughness<=3',
              lookup: ['details', 'toughness'],
              expectedValue: 3,
              matcherName: 'toBeLessThanOrEqual',
            },
            {
              filter: 'power<=3',
              lookup: ['details', 'power'],
              expectedValue: 3,
              matcherName: 'toBeLessThanOrEqual',
            },
          ],
        },
      ];

      expectations.forEach((expectation) => {
        it(expectation.title, () => {
          expectation.tests.forEach((test) => {
            const { filter } = makeFilter(test.filter);
            const cards = exampleCube.cards.filter(filter);
            cards.forEach((card) => {
              let value = card;
              test.lookup.forEach((key) => {
                value = value[key];
              });
              expect(parseInt(value, 10))[test.matcherName](test.expectedValue);
            });
          });
        });
      });
    });

    describe('rarity filtering', () => {
      const expectations = [
        {
          title: 'the = operator exact-matches rarity',
          tests: [
            {
              filter: 'rarity=c',
              lookup: ['details', 'rarity'],
              expectedValue: 'common',
              matcherName: 'toEqual',
            },
            {
              filter: 'rarity=u',
              lookup: ['details', 'rarity'],
              expectedValue: 'uncommon',
              matcherName: 'toEqual',
            },
            {
              filter: 'rarity=r',
              lookup: ['details', 'rarity'],
              expectedValue: 'rare',
              matcherName: 'toEqual',
            },
            {
              filter: 'rarity=m',
              lookup: ['details', 'rarity'],
              expectedValue: 'mythic',
              matcherName: 'toEqual',
            },
          ],
        },
        {
          title: 'the > operator matches higher rarity',
          tests: [
            {
              filter: 'rarity>c',
              lookup: ['details', 'rarity'],
              expectedValue: 'common',
              matcherName: 'toEqual',
              not: true,
            },
            {
              filter: 'rarity>u',
              lookup: ['details', 'rarity'],
              expectedValue: ['uncommon', 'common'],
              matcherName: 'arrayContaining',
              not: true,
            },
            {
              filter: 'rarity>r',
              lookup: ['details', 'rarity'],
              expectedValue: ['uncommon', 'common', 'rare'],
              matcherName: 'arrayContaining',
              not: true,
            },
          ],
        },
        {
          title: 'the < operator matches lower rarity',
          tests: [
            {
              filter: 'rarity<m',
              lookup: ['details', 'rarity'],
              expectedValue: 'mythic',
              matcherName: 'toEqual',
              not: true,
            },
            {
              filter: 'rarity<r',
              lookup: ['details', 'rarity'],
              expectedValue: ['rare', 'mythic'],
              matcherName: 'arrayContaining',
              not: true,
            },
            {
              filter: 'rarity<u',
              lookup: ['details', 'rarity'],
              expectedValue: ['uncommon', 'rare', 'mythic'],
              matcherName: 'arrayContaining',
              not: true,
            },
            {
              filter: 'rarity<c',
              lookup: ['details', 'rarity'],
              expectedValue: ['uncommon', 'rare', 'mythic'],
              matcherName: 'arrayContaining',
              not: true,
            },
          ],
        },
      ];

      expectations.forEach((expectation) => {
        it(expectation.title, () => {
          expectation.tests.forEach((test) => {
            const { filter } = makeFilter(test.filter);
            const cards = exampleCube.cards.filter(filter);
            cards.forEach((card) => {
              // eslint-disable-next-line prefer-const
              let { expectedValue, matcherName, not } = test;
              let value = card;
              test.lookup.forEach((key) => {
                value = value[key];
              });
              let expected = expect(value);
              if (not) {
                // not.arrayContaining is a special case
                if (matcherName === 'arrayContaining') {
                  matcherName = 'toEqual';
                  expectedValue = expect.not.arrayContaining(expectedValue);
                } else {
                  expected = expected.not;
                }
              }
              expected[matcherName](expectedValue);
            });
          });
        });
      });
    });
  });
});

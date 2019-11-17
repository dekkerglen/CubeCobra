const carddb = require('../../serverjs/cards');
const fixturesPath = 'fixtures';
const cubefixture = require('../../fixtures/examplecube');

import Filter from '../../src/util/Filter';

describe('filter', () => {
  describe('tokenizeInput', () => {
    let tokens;
    beforeEach(() => {
      tokens = [];
    });
    it('tokenizes =', () => {
      Filter.tokenizeInput('rarity=common', tokens);
      expect(tokens).toEqual([{
        arg: 'common',
        category: 'rarity',
        not: false,
        operand: '=',
        type: 'token'
      }]);
    });
    it('tokenizes >', () => {
      Filter.tokenizeInput('rarity>common', tokens);
      expect(tokens).toEqual([{
        arg: 'common',
        category: 'rarity',
        not: false,
        operand: '>',
        type: 'token'
      }]);
    });
    it('tokenizes <', () => {
      Filter.tokenizeInput('rarity<common', tokens);
      expect(tokens).toEqual([{
        arg: 'common',
        category: 'rarity',
        not: false,
        operand: '<',
        type: 'token'
      }]);
    });
    it('tokenizes >=', () => {
      Filter.tokenizeInput('rarity>=common', tokens);
      expect(tokens).toEqual([{
        arg: 'common',
        category: 'rarity',
        not: false,
        operand: '>=',
        type: 'token'
      }]);
    });
    it('tokenizes <=', () => {
      Filter.tokenizeInput('rarity<=common', tokens);
      expect(tokens).toEqual([{
        arg: 'common',
        category: 'rarity',
        not: false,
        operand: '<=',
        type: 'token'
      }]);
    });
    it('tokenizes !=', () => {
      Filter.tokenizeInput('rarity!=common', tokens);
      expect(tokens).toEqual([{
        arg: 'common',
        category: 'rarity',
        not: false,
        operand: '!=',
        type: 'token'
      }]);
    });
    it('tokenizes negated =', () => {
      Filter.tokenizeInput('-rarity=common', tokens);
      expect(tokens).toEqual([{
        arg: 'common',
        category: 'rarity',
        not: true,
        operand: '=',
        type: 'token'
      }]);
    });
    it('tokenizes negated >', () => {
      Filter.tokenizeInput('-rarity>common', tokens);
      expect(tokens).toEqual([{
        arg: 'common',
        category: 'rarity',
        not: true,
        operand: '>',
        type: 'token'
      }]);
    });
    it('tokenizes negated <', () => {
      Filter.tokenizeInput('-rarity<common', tokens);
      expect(tokens).toEqual([{
        arg: 'common',
        category: 'rarity',
        not: true,
        operand: '<',
        type: 'token'
      }]);
    });
    it('tokenizes negated <=', () => {
      Filter.tokenizeInput('-rarity<=common', tokens);
      expect(tokens).toEqual([{
        arg: 'common',
        category: 'rarity',
        not: true,
        operand: '<=',
        type: 'token'
      }]);
    });
    it('tokenizes negated >=', () => {
      Filter.tokenizeInput('-rarity>=common', tokens);
      expect(tokens).toEqual([{
        arg: 'common',
        category: 'rarity',
        not: true,
        operand: '>=',
        type: 'token'
      }]);
    });
  });

  describe('filterCard', () => {
    let exampleCube;
    beforeAll(() => {
      exampleCube = JSON.parse(JSON.stringify(cubefixture.exampleCube));
      return carddb.initializeCardDb(fixturesPath, true).then(() => {
        exampleCube.cards.forEach(function(card, index) {
          card.details = carddb.cardFromId(card.cardID);
        });
      });
    });
    it('properly filters names and returns a valid object', () => {
      let tokens = [];
      Filter.tokenizeInput('castle', tokens);
      const castleFilters = [Filter.parseTokens(tokens)];
      const castles = exampleCube.cards.filter((card) => Filter.filterCard(card, castleFilters));
      const expectedCastles = [{
          addedTmsp: '2019-09-28T20:58:35.095Z',
          cardID: '6f1383eb-aa7d-4d3b-bee4-8cffba9ae846',
          cmc: 0,
          colors: ['W'],
          details: {
            _id: '6f1383eb-aa7d-4d3b-bee4-8cffba9ae846',
            art_crop: 'https://img.scryfall.com/cards/art_crop/front/6/f/6f1383eb-aa7d-4d3b-bee4-8cffba9ae846.jpg?1568809426',
            artist: 'Volkan Baǵa',
            border_color: 'black',
            cmc: 0,
            collector_number: '386',
            color_identity: ['W'],
            colorcategory: 'l',
            colors: [],
            digital: false,
            full_name: 'Castle Ardenvale [celd-386]',
            image_normal: 'https://img.scryfall.com/cards/normal/front/6/f/6f1383eb-aa7d-4d3b-bee4-8cffba9ae846.jpg?1568809426',
            image_small: 'https://img.scryfall.com/cards/small/front/6/f/6f1383eb-aa7d-4d3b-bee4-8cffba9ae846.jpg?1568809426',
            legalities: {
              Legacy: false,
              Modern: false,
              Pauper: false,
              Standard: false,
            },
            name: 'Castle Ardenvale',
            name_lower: 'castle ardenvale',
            oracle_text: 'Castle Ardenvale enters the battlefield tapped unless you control a Plains.\n' +
              '{T}: Add {W}.\n' +
              '{2}{W}{W}, {T}: Create a 1/1 white Human creature token.',
            parsed_cost: [''],
            promo: true,
            rarity: 'rare',
            scryfall_uri: 'https://scryfall.com/card/celd/386/castle-ardenvale?utm_source=api',
            set: 'celd',
            type: 'Land',
          },
          status: 'Not Owned',
          tags: ['New'],
          type_line: 'Land',
        },
        {
          addedTmsp: '2019-09-28T20:58:35.096Z',
          cardID: '9954b9bb-21e7-40af-aaa7-b2001b8d1d45',
          cmc: 0,
          colors: ['R'],
          details: {
            _id: '9954b9bb-21e7-40af-aaa7-b2001b8d1d45',
            art_crop: 'https://img.scryfall.com/cards/art_crop/front/9/9/9954b9bb-21e7-40af-aaa7-b2001b8d1d45.jpg?1568809445',
            artist: 'Jaime Jones',
            border_color: 'black',
            cmc: 0,
            collector_number: '387',
            color_identity: ['R'],
            colorcategory: 'l',
            colors: [],
            digital: false,
            full_name: 'Castle Embereth [celd-387]',
            image_normal: 'https://img.scryfall.com/cards/normal/front/9/9/9954b9bb-21e7-40af-aaa7-b2001b8d1d45.jpg?1568809445',
            image_small: 'https://img.scryfall.com/cards/small/front/9/9/9954b9bb-21e7-40af-aaa7-b2001b8d1d45.jpg?1568809445',
            legalities: {
              Legacy: false,
              Modern: false,
              Pauper: false,
              Standard: false,
            },
            name: 'Castle Embereth',
            name_lower: 'castle embereth',
            oracle_text: 'Castle Embereth enters the battlefield tapped unless you control a Mountain.\n{T}: Add {R}.\n{1}{R}{R}, {T}: Creatures you control get +1/+0 until end of turn.',
            parsed_cost: [''],
            promo: true,
            rarity: 'rare',
            scryfall_uri: 'https://scryfall.com/card/celd/387/castle-embereth?utm_source=api',
            set: 'celd',
            type: 'Land',
          },
          status: 'Not Owned',
          tags: ['New'],
          type_line: 'Land',
        },
        {
          addedTmsp: '2019-09-28T20:58:35.100Z',
          cardID: 'aca10c34-010a-4a9f-a747-2592c4d58c5d',
          cmc: 0,
          colors: ['G'],
          details: {
            _id: 'aca10c34-010a-4a9f-a747-2592c4d58c5d',
            art_crop: 'https://img.scryfall.com/cards/art_crop/front/a/c/aca10c34-010a-4a9f-a747-2592c4d58c5d.jpg?1568796969',
            artist: 'Adam Paquette',
            border_color: 'black',
            cmc: 0,
            collector_number: '388',
            color_identity: ['G'],
            colorcategory: 'l',
            colors: [],
            digital: false,
            full_name: 'Castle Garenbrig [celd-388]',
            image_normal: 'https://img.scryfall.com/cards/normal/front/a/c/aca10c34-010a-4a9f-a747-2592c4d58c5d.jpg?1568796969',
            image_small: 'https://img.scryfall.com/cards/small/front/a/c/aca10c34-010a-4a9f-a747-2592c4d58c5d.jpg?1568796969',
            legalities: {
              Legacy: false,
              Modern: false,
              Pauper: false,
              Standard: false,
            },
            name: 'Castle Garenbrig',
            name_lower: 'castle garenbrig',
            oracle_text: 'Castle Garenbrig enters the battlefield tapped unless you control a Forest.\n{T}: Add {G}.\n{2}{G}{G}, {T}: Add six {G}. Spend this mana only to cast creature spells or activate abilities of creatures.',
            parsed_cost: [''],
            promo: true,
            rarity: 'rare',
            scryfall_uri: 'https://scryfall.com/card/celd/388/castle-garenbrig?utm_source=api',
            set: 'celd',
            type: 'Land',
          },
          status: 'Not Owned',
          tags: ['New'],
          type_line: 'Land',
        },
        {
          addedTmsp: '2019-09-28T20:58:35.100Z',
          cardID: '12b8c2e6-5256-4e7e-8d7d-4b386419780a',
          cmc: 0,
          colors: ['B'],
          details: {
            _id: '12b8c2e6-5256-4e7e-8d7d-4b386419780a',
            art_crop: 'https://img.scryfall.com/cards/art_crop/front/1/2/12b8c2e6-5256-4e7e-8d7d-4b386419780a.jpg?1568814474',
            artist: 'Titus Lunter',
            border_color: 'black',
            cmc: 0,
            collector_number: '389',
            color_identity: ['B'],
            colorcategory: 'l',
            colors: [],
            digital: false,
            full_name: 'Castle Locthwain [celd-389]',
            image_normal: 'https://img.scryfall.com/cards/normal/front/1/2/12b8c2e6-5256-4e7e-8d7d-4b386419780a.jpg?1568814474',
            image_small: 'https://img.scryfall.com/cards/small/front/1/2/12b8c2e6-5256-4e7e-8d7d-4b386419780a.jpg?1568814474',
            legalities: {
              Legacy: false,
              Modern: false,
              Pauper: false,
              Standard: false,
            },
            name: 'Castle Locthwain',
            name_lower: 'castle locthwain',
            oracle_text: 'Castle Locthwain enters the battlefield tapped unless you control a Swamp.\n{T}: Add {B}.\n{1}{B}{B}, {T}: Draw a card, then you lose life equal to the number of cards in your hand.',
            parsed_cost: [''],
            promo: true,
            rarity: 'rare',
            scryfall_uri: 'https://scryfall.com/card/celd/389/castle-locthwain?utm_source=api',
            set: 'celd',
            type: 'Land',
          },
          status: 'Not Owned',
          tags: ['New'],
          type_line: 'Land',
        },
        {
          addedTmsp: '2019-09-28T20:58:35.101Z',
          cardID: '4113eeed-9399-4b59-a6d9-7d40190853c5',
          cmc: 0,
          colors: ['U'],
          details: {
            _id: '4113eeed-9399-4b59-a6d9-7d40190853c5',
            art_crop: 'https://img.scryfall.com/cards/art_crop/front/4/1/4113eeed-9399-4b59-a6d9-7d40190853c5.jpg?1568703454',
            artist: 'John Avon',
            border_color: 'black',
            cmc: 0,
            collector_number: '390',
            color_identity: ['U'],
            colorcategory: 'l',
            colors: [],
            digital: false,
            full_name: 'Castle Vantress [celd-390]',
            image_normal: 'https://img.scryfall.com/cards/normal/front/4/1/4113eeed-9399-4b59-a6d9-7d40190853c5.jpg?1568703454',
            image_small: 'https://img.scryfall.com/cards/small/front/4/1/4113eeed-9399-4b59-a6d9-7d40190853c5.jpg?1568703454',
            legalities: {
              Legacy: false,
              Modern: false,
              Pauper: false,
              Standard: false,
            },
            name: 'Castle Vantress',
            name_lower: 'castle vantress',
            oracle_text: 'Castle Vantress enters the battlefield tapped unless you control an Island.\n{T}: Add {U}.\n{2}{U}{U}, {T}: Scry 2.',
            parsed_cost: [''],
            promo: true,
            rarity: 'rare',
            scryfall_uri: 'https://scryfall.com/card/celd/390/castle-vantress?utm_source=api',
            set: 'celd',
            type: 'Land',
          },
          status: 'Not Owned',
          tags: ['New'],
          type_line: 'Land',
        },
      ];
      expect(castles).toEqual(expectedCastles);
    });

    it('properly filters oracle text', () => {
      let tokens = [];
      Filter.tokenizeInput('o:flying', tokens);
      const flyingFilter = [Filter.parseTokens(tokens)];
      const flyers = exampleCube.cards.filter((card) => Filter.filterCard(card, flyingFilter));
      expect(flyers).toHaveLength(5);
    });

    describe('color filters', () => {
      let tokens;
      beforeEach(() => {
        tokens = [];
      });

      it('the = operator filters for mono-color cards', () => {
        Filter.tokenizeInput('c:green', tokens);
        const greenFilter = [Filter.parseTokens(tokens)];
        const monoGreenCards = exampleCube.cards.filter((card) => Filter.filterCard(card, greenFilter));
        expect(monoGreenCards).toHaveLength(4);
        monoGreenCards.forEach((card) => {
          expect(card.details.colors).toEqual(['G']);
        });
      });

      it('the >= operator filters for color-including cards', () => {
        Filter.tokenizeInput('c>=green', tokens);
        const greenPlusFilter = [Filter.parseTokens(tokens)];
        const greenCards = exampleCube.cards.filter((card) => Filter.filterCard(card, greenPlusFilter));
        expect(greenCards).toHaveLength(8);
        greenCards.forEach((card) => {
          expect(card.details.colors).toEqual(expect.arrayContaining(['G']));
        });
      });

      it('the <= operator filters for colorless and mono-color cards', () => {
        Filter.tokenizeInput('c<=green', tokens);
        const greenOrColorlessFilter = [Filter.parseTokens(tokens)];
        const greenOrColorlessCards = exampleCube.cards.filter((card) =>
          Filter.filterCard(card, greenOrColorlessFilter),
        );
        expect(greenOrColorlessCards).toHaveLength(12);
        greenOrColorlessCards.forEach((card) => {
          expect(card.details.colors).not.toEqual(expect.arrayContaining(['W', 'U', 'B', 'R']));
        });
      });

      it('the > operator filters for multi-color cards including a color', () => {
        Filter.tokenizeInput('c>green', tokens);
        const greenMulticolorFilter = [Filter.parseTokens(tokens)];
        const greenGoldCards = exampleCube.cards.filter((card) => Filter.filterCard(card, greenMulticolorFilter));
        expect(greenGoldCards).toHaveLength(4);
        greenGoldCards.forEach((card) => {
          expect(card.details.colors).not.toBe(['G']);
          expect(card.details.colors).toContain('G');
        });
      });

      it('the < operator filters for colorless cards', () => {
        Filter.tokenizeInput('c<green', tokens);
        const colorlessFilter = [Filter.parseTokens(tokens)];
        const colorlessCards = exampleCube.cards.filter((card) => Filter.filterCard(card, colorlessFilter));
        expect(colorlessCards).toHaveLength(8);
        colorlessCards.forEach((card) => {
          expect(card.details.colors).toEqual([]);
        });
      });
    });

    describe('mana filtering', () => {
      let tokens;
      beforeEach(() => {
        tokens = [];
      });

      it('correctly filters by mana cost', () => {
        Filter.tokenizeInput('mana:1W', tokens);
        const oneAndAWhiteFilter = [Filter.parseTokens(tokens)];
        const oneAndAWhiteCards = exampleCube.cards.filter((card) => Filter.filterCard(card, oneAndAWhiteFilter));
        expect(oneAndAWhiteCards).toHaveLength(3);
        oneAndAWhiteCards.forEach((card) => {
          expect(card.details.parsed_cost).toEqual(expect.arrayContaining(['1', 'w']));
        });
      });
    });

    describe('cmc filtering', () => {
      let tokens;
      beforeEach(() => {
        tokens = [];
      });

      it('the = operator filters for exact cmc', () => {
        Filter.tokenizeInput('cmc=1', tokens);
        const oneCmcFilter = [Filter.parseTokens(tokens)];
        const oneCmcCards = exampleCube.cards.filter((card) => Filter.filterCard(card, oneCmcFilter));
        expect(oneCmcCards).toHaveLength(7);
        oneCmcCards.forEach((card) => {
          expect(card.details.cmc).toEqual(1);
        });
      });

      it('the < operator filters for less-than cmc', () => {
        Filter.tokenizeInput('cmc<1', tokens);
        const ltOneCmcFilter = [Filter.parseTokens(tokens)];
        const ltOneCmcCards = exampleCube.cards.filter((card) => Filter.filterCard(card, ltOneCmcFilter));
        expect(ltOneCmcCards).toHaveLength(7);
        ltOneCmcCards.forEach((card) => {
          expect(card.details.cmc).toEqual(0);
        });
      });

      it('the <= operator filters for less-than-or-equal-to cmc', () => {
        Filter.tokenizeInput('cmc<=1', tokens);
        const ltEqOneCmcFilter = [Filter.parseTokens(tokens)];
        const ltEqOneCmcCards = exampleCube.cards.filter((card) => Filter.filterCard(card, ltEqOneCmcFilter));
        expect(ltEqOneCmcCards).toHaveLength(14);
        ltEqOneCmcCards.forEach((card) => {
          expect(card.details.cmc).toBeLessThanOrEqual(1);
        });
      });

      it('the > operator filters for greater-than cmc', () => {
        Filter.tokenizeInput('cmc>5', tokens);
        const gtFiveCmcFilter = [Filter.parseTokens(tokens)];
        const gtFiveCmcCards = exampleCube.cards.filter((card) => Filter.filterCard(card, gtFiveCmcFilter));
        expect(gtFiveCmcCards).toHaveLength(6);
        gtFiveCmcCards.forEach((card) => {
          expect(card.details.cmc).toBeGreaterThan(5);
        });
      });

      it('the >= operator filters for greater-than-or-equal-to cmc', () => {
        Filter.tokenizeInput('cmc>=5', tokens);
        const gtEqFiveCmcFilter = [Filter.parseTokens(tokens)];
        const gtEqFiveCmcCards = exampleCube.cards.filter((card) => Filter.filterCard(card, gtEqFiveCmcFilter));
        expect(gtEqFiveCmcCards).toHaveLength(9);
        gtEqFiveCmcCards.forEach((card) => {
          expect(card.details.cmc).toBeGreaterThanOrEqual(5);
        });
      });

      it('the != operator filters for cmc not-equal to', () => {
        Filter.tokenizeInput('cmc!=5', tokens);
        const notEqual5CmcFilter = [Filter.parseTokens(tokens)];
        const notEqual5CmcCards = exampleCube.cards.filter((card) => Filter.filterCard(card, notEqual5CmcFilter));
        expect(notEqual5CmcCards).toHaveLength(62);
        notEqual5CmcCards.forEach((card) => {
          expect(card.details.cmc).not.toEqual(5);
        });
      });
    });

    describe('type filtering', () => {
      let tokens;
      beforeEach(() => {
        tokens = [];
      });

      it('filters by card type', () => {
        Filter.tokenizeInput('type=creature', tokens);
        const creatureFilter = [Filter.parseTokens(tokens)];
        const creatureCards = exampleCube.cards.filter((card) => Filter.filterCard(card, creatureFilter));
        expect(creatureCards).toHaveLength(40);
        creatureCards.forEach((card) => {
          expect(card.details.type).toContain('Creature');
        });
      });
    });

    describe('set filtering', () => {
      let tokens;
      beforeEach(() => {
        tokens = [];
      });

      it('filters by set', () => {
        Filter.tokenizeInput('set=ELD', tokens);
        const eldraineFilter = [Filter.parseTokens(tokens)];
        const eldraineCards = exampleCube.cards.filter((card) => Filter.filterCard(card, eldraineFilter));
        expect(eldraineCards).toHaveLength(exampleCube.cards.length);
        eldraineCards.forEach((card) => {
          expect(card.details.set).toContain('eld');
        });
      });
    });

    describe('P/T filtering', () => {
      let tokens;
      let expectations = [{
          title: 'the = operator exact-matches power/toughness',
          tests: [{
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
          tests: [{
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
          tests: [{
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
          title: 'the >= operator performs greater-than-or-eqal-to matches for power/toughness',
          tests: [{
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
          title: 'the <= operator performs greater-than-or-eqal-to matches for power/toughness',
          tests: [{
              filter: 'power<=3',
              lookup: ['details', 'power'],
              expectedValue: 3,
              matcherName: 'toBeLessThanOrEqual',
            },
            {
              filter: 'toughness<=3',
              lookup: ['details', 'toughness'],
              expectedValue: 3,
              matcherName: 'toBeLessThanOrEqual',
            },
          ],
        },
      ];

      expectations.forEach((expectation) => {
        it(expectation.title, () => {
          expectation.tests.forEach((test) => {
            tokens = [];
            Filter.tokenizeInput(test.filter, tokens);
            const cards = exampleCube.cards.filter((card) => Filter.filterCard(card, [Filter.parseTokens(tokens)]));
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
  });
});
const carddb = require('../../serverjs/cards');
const fixturesPath = 'fixtures';
const cubefixture = require('../../fixtures/examplecube');
const sinon = require('sinon');
const methods = require('../../serverjs/draftutil');
let CardRating = require('../../models/cardrating');

import Filter from '../../src/util/Filter';
import { expectOperator } from '../helpers';

describe('getDraftBots', () => {
  it('can get the correct number of draft bots', () => {
    const params = {
      seats: 5,
    };
    const result = methods.getDraftBots(params);
    expect(result.length).toBe(params.seats - 1);
  });

  it('can get bots with the correct properties', () => {
    const allColors = ['W', 'U', 'B', 'R', 'G'];
    const params = {
      seats: 2,
    };
    const result = methods.getDraftBots(params);

    expect(result[0].length).toBe(2);
    expect(allColors.includes(result[0][0])).toBe(true);
    expect(allColors.includes(result[0][1])).toBe(true);
    expect(result[0][0] === result[0][1]).toBe(false);
  });
});

describe('getCardratings', () => {
  beforeEach(() => {
    sinon.stub(CardRating, 'find');
  });

  afterEach(() => {
    CardRating.find.restore();
  });

  it('returns a mapping of card names to values', () => {
    var dummyModel = {
      value: 1,
      picks: 1,
      name: 'Giant Growth',
    };
    var expected = {};
    expected[dummyModel.name] = dummyModel.value;
    CardRating.find.yields(null, [dummyModel]);
    var callback = sinon.stub();
    methods.getCardRatings([], CardRating, callback);
    sinon.assert.calledWith(callback, expected);
  });

  it('returns an empty dict when there are no ratings present ', () => {
    var expected = {};
    CardRating.find.yields(null, []);
    var callback = sinon.stub();
    methods.getCardRatings([], CardRating, callback);
    sinon.assert.calledWith(callback, expected);
  });
});

describe('getDraftFormat', () => {
  let exampleCube;

  it('returns the default format if params are < 0', () => {
    let params = {
      id: -1,
      seats: 4,
      packs: 3,
      cards: 2,
    };
    const format = methods.getDraftFormat(params, exampleCube);
    let expected_format = [
      ['*', '*'], // pack 1 (* is any card)
      ['*', '*'], // pack 2
      ['*', '*'], // pack 3
    ];
    expected_format.custom = false;
    expected_format.multiples = false;

    expect(format).toEqual(expected_format);
    expect(format.custom).toBe(false);
    expect(format.multiples).toBe(false);
  });

  describe('returns a custom format if params are > 0', () => {
    let params;
    beforeAll(() => {
      params = { id: 0, seats: 8 }; // packs and cards determined by custom format
      exampleCube = {};
      exampleCube.draft_formats = [];
      exampleCube.draft_formats[0] = {}; // mock
    });

    let expectedFilters = function(...args) {
      let expectedFormat = [];
      args.forEach((filterText) => {
        if (filterText !== null) {
          let tokens = [];
          Filter.tokenizeInput(filterText, tokens);
          filterText = Filter.parseTokens(tokens);
        }
        expectedFormat.push([filterText]);
      });
      return expectedFormat;
    };

    describe.each([
      [
        'example filters - 1 pack, 1 card',
        '[["rarity:Mythic,tag:New,identity>1"]]', // filter JSON
        false, // multiples
        [[expectedFilters('rarity:Mythic', 'tag:New', 'identity>1')]],
      ],
      [
        'example filters - 1 pack, 2 cards, allow multiples',
        '[["rarity:Mythic,tag:New,identity>1", "tag:mytag"]]', // filter JSON
        true, // multiples
        [[expectedFilters('rarity:Mythic', 'tag:New', 'identity>1'), expectedFilters('tag:mytag')]],
      ],
      [
        'backwards compatible tags',
        '[["mytag,*,*"]]', // filter JSON
        false, // multiples
        [[expectedFilters('tag:mytag', null, null)]],
      ],
      [
        'mixed filters and tags with multiple packs with different card counts',
        '[["rarity:Mythic,mytag"],["*"],["rarity:mythic,rarity:common","*"]]', // filter JSON
        false, // multiples
        [
          [expectedFilters('rarity:Mythic', 'tag:mytag')], // pack 1
          [[[null]]], // pack 2
          [expectedFilters('rarity:Mythic', 'rarity:common'), [[null]]], // pack 3
        ],
      ],
    ])('%s', (name, packsFormat, multiples, expected) => {
      test(`returns expected format`, () => {
        exampleCube.draft_formats[params.id].packs = packsFormat;
        exampleCube.draft_formats[params.id].multiples = multiples;
        // NOTE: Because format array als incudes properties (which we aren't testing in this test)
        // we need to convert to json to compare safely.
        // See https://github.com/facebook/jest/issues/8475
        let formatJSON = JSON.stringify(methods.getDraftFormat(params, exampleCube));
        let expectedJSON = JSON.stringify(expected);
        expect(formatJSON).toEqual(expectedJSON);
      });

      test(`returned has correct multiples value`, () => {
        exampleCube.draft_formats[params.id].packs = packsFormat;
        exampleCube.draft_formats[params.id].multiples = multiples;
        expect(methods.getDraftFormat(params, exampleCube).multiples).toEqual(multiples);
      });

      test(`returned format is marked as custom`, () => {
        exampleCube.draft_formats[params.id].packs = packsFormat;
        exampleCube.draft_formats[params.id].multiples = multiples;
        expect(methods.getDraftFormat(params, exampleCube).custom).toEqual(true);
      });
    });
  });
});

describe('createDraft', () => {
  let format, cards, bots, seats;
  beforeAll(() => {
    format = [];
    cards = [];
    bots = [];
    seats = 8;
  });

  it('returns an error if no cards supplied', () => {
    cards = [];
    bots = ['fakebot'];
    expect(() => {
      methods.createDraft(format, cards, bots, seats);
    }).toThrow(/no cards/);
  });

  it('returns an error if no bots supplied', () => {
    cards = ['mockcard'];
    bots = [];
    expect(() => {
      methods.createDraft(format, cards, bots, seats);
    }).toThrow(/no bots/);
  });

  it('returns an error if seats < 2', () => {
    cards = ['mockcards'];
    bots = ['mockbot'];
    expect(() => {
      methods.createDraft(format, cards, bots, 1);
    }).toThrow(/invalid seats/);
    expect(() => {
      methods.createDraft(format, cards, bots, null);
    }).toThrow(/invalid seats/);
    expect(() => {
      methods.createDraft(format, cards, bots, -1);
    }).toThrow(/invalid seats/);
  });

  it('sets the intitial state of the draft', () => {
    let exampleCube = JSON.parse(JSON.stringify(cubefixture.exampleCube));
    let promise = carddb.initializeCardDb(fixturesPath, true).then(() => {
      exampleCube.cards.forEach(function(card, index) {
        card.details = carddb.cardFromId(card.cardID);
      });
    });
    return promise.then(() => {
      cards = exampleCube.cards;
      bots = ['mockbot'];
      format = methods.getDraftFormat({ id: -1, packs: 1, cards: 15, seats: seats }, exampleCube);
      let draft = methods.createDraft(format, cards, bots, 8);
      expect(draft.pickNumber).toEqual(1);
      expect(draft.packNumber).toEqual(1);
      expect(draft).toHaveProperty('packs');
      expect(draft).toHaveProperty('packs');
      expect(draft).toHaveProperty('bots');
      // CoreMongooseArray causing trouble, so we check length and use stringify
      expect(draft.bots.length).toEqual(1);
      let initial_stateJSON = JSON.stringify(draft.initial_state);
      let packsJSON = JSON.stringify(draft.packs);
      expect(initial_stateJSON).toEqual(packsJSON);
    });
  });
});

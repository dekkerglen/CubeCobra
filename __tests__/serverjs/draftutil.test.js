var sinon = require('sinon');

const methods = require('../../serverjs/draftutil');

let CardRating = require('../../models/cardrating');

beforeEach(() => {
  sinon.stub(CardRating, 'find');
});

afterEach(() => {
  CardRating.find.restore();
});

test('it can get the correct number of draft bots', () => {
  const params = {
    seats: 5,
  };
  const result = methods.getDraftBots(params);
  expect(result.length).toBe(params.seats - 1);
});

test('it can get bots with the correct properties', () => {
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

test('it returns the index of the first instance of a tag from a list of cards', () => {
  const cards = [
    {},
    {},
    {
      tags: ['test'],
    },
    {
      tags: ['test'],
    },
  ];
  const tag = 'TEST';
  const result = methods.indexOfTag(cards, tag);

  expect(result).toBe(2);
});

test('it returns -1 if a tag is not found in a list of cards', () => {
  const cards = [{}, {}];
  const tag = 'TEST';
  const result = methods.indexOfTag(cards, tag);

  expect(result).toBe(-1);
});

test('getCardRatings returns a mapping of card names to values', () => {
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

test('getCardRatings returns an empty dict when there are no ratings present ', () => {
  var expected = {};
  CardRating.find.yields(null, []);
  var callback = sinon.stub();
  methods.getCardRatings([], CardRating, callback);
  sinon.assert.calledWith(callback, expected);
});

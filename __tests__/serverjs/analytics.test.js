const analytics = require('../../serverjs/analytics');
const carddb = require('../../serverjs/cards');
const cubefixture = require('../../fixtures/examplecube');

const fixturesPath = 'fixtures';

beforeEach(() => {});

afterEach(() => {});

test('GetColorCat returns the expected results', () => {
  expect(analytics.GetColorCat('land', [])).toBe('l');
  expect(analytics.GetColorCat('creature', [])).toBe('c');
  expect(analytics.GetColorCat('creature', ['G', 'R'])).toBe('m');
  expect(analytics.GetColorCat('creature', ['G'])).toBe('g');
});

test('GetColorIdentity returns the expected results', () => {
  expect(analytics.GetColorIdentity([])).toBe('Colorless');
  expect(analytics.GetColorIdentity(['G', 'R'])).toBe('Multicolored');
  expect(analytics.GetColorIdentity(['G'])).toBe('Green');
});

test('GetTypeByColorIdentity returns valid counts', () => {
  expect.assertions(1);
  var promise = carddb.initializeCardDb(fixturesPath, true);
  return promise.then(function() {
    var expected = {
      Artifacts: {
        Black: 0,
        Blue: 2,
        Colorless: 1,
        Green: 0,
        Multi: 0,
        Red: 1,
        Total: 5,
        White: 1,
      },
      Creatures: {
        Black: 7,
        Blue: 7,
        Colorless: 1,
        Green: 6,
        Multi: 4,
        Red: 6,
        Total: 40,
        White: 9,
      },
      Enchantments: {
        Black: 0,
        Blue: 1,
        Colorless: 0,
        Green: 1,
        Multi: 3,
        Red: 1,
        Total: 7,
        White: 1,
      },
      Instants: {
        Black: 0,
        Blue: 0,
        Colorless: 0,
        Green: 0,
        Multi: 0,
        Red: 0,
        Total: 1,
        White: 1,
      },
      Lands: {
        Black: 1,
        Blue: 1,
        Colorless: 2,
        Green: 1,
        Multi: 0,
        Red: 1,
        Total: 7,
        White: 1,
      },
      Planeswalkers: {
        Black: 0,
        Blue: 1,
        Colorless: 0,
        Green: 0,
        Multi: 1,
        Red: 0,
        Total: 2,
        White: 0,
      },
      Sorceries: {
        Black: 0,
        Blue: 0,
        Colorless: 0,
        Green: 0,
        Multi: 2,
        Red: 1,
        Total: 3,
        White: 0,
      },
      Total: {
        Black: 8,
        Blue: 12,
        Colorless: 4,
        Green: 8,
        Multi: 10,
        Red: 10,
        Total: 65,
        White: 13,
      },
    };
    var result = analytics.GetTypeByColorIdentity(cubefixture.exampleCube.cards, carddb);
    expect(result).toEqual(expected);
  });
});

test('GetColorIdentityCounts returns valid counts', () => {
  expect.assertions(1);
  var expected = {
    Abzan: 0,
    Azorius: 1,
    Bant: 0,
    Black: 11,
    Blue: 15,
    Boros: 2,
    Colorless: 4,
    Dimir: 1,
    Esper: 0,
    FiveColor: 0,
    Golgari: 1,
    Green: 12,
    Grixis: 0,
    Gruul: 1,
    Izzet: 1,
    Jeskai: 0,
    Jund: 0,
    Mardu: 0,
    Naya: 0,
    NonBlack: 0,
    NonBlue: 0,
    NonGreen: 0,
    NonRed: 0,
    NonWhite: 0,
    Orzhov: 1,
    Rakdos: 0,
    Red: 14,
    Selesnya: 2,
    Simic: 0,
    Sultai: 0,
    Temur: 0,
    White: 19,
  };
  var promise = carddb.initializeCardDb(fixturesPath, true);
  return promise.then(function() {
    var result = analytics.GetColorIdentityCounts(cubefixture.exampleCube.cards, carddb);
    expect(result).toEqual(expected);
  });
});

test('GetCurve returns a valid curve structure', () => {
  expect.assertions(1);
  var expected = {
    black: [0, 1, 2, 3, 0, 1, 0, 0, 0, 0],
    blue: [0, 1, 3, 7, 0, 0, 0, 0, 0, 0],
    colorless: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    green: [0, 2, 2, 1, 1, 0, 1, 0, 0, 0],
    multi: [0, 0, 3, 1, 3, 1, 2, 0, 0, 0],
    red: [0, 1, 1, 3, 3, 0, 1, 0, 0, 0],
    total: [0, 7, 16, 19, 7, 3, 5, 1, 0, 0],
    white: [0, 2, 4, 4, 0, 1, 1, 0, 0, 0],
  };
  var promise = carddb.initializeCardDb(fixturesPath, true);
  return promise.then(function() {
    var result = analytics.GetCurve(cubefixture.exampleCube.cards, carddb);
    expect(result).toEqual(expected);
  });
});

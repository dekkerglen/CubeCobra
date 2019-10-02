const analytics = require("../../serverjs/analytics");
const carddb = require("../../serverjs/cards");
const cubefixture = require("../../fixtures/examplecube");

const fixturesPath = "fixtures";

beforeEach(() => {});

afterEach(() => {});

test("GetColorCat returns the expected results", () => {
  expect(analytics.GetColorCat('land', [])).toBe('l');
  expect(analytics.GetColorCat('creature', [])).toBe('c');
  expect(analytics.GetColorCat('creature', ['G', 'R'])).toBe('m');
  expect(analytics.GetColorCat('creature', ['G'])).toBe('g');
});

test("GetColorIdentity returns the expected results", () => {
  expect(analytics.GetColorIdentity([])).toBe('Colorless');
  expect(analytics.GetColorIdentity(["G", "R"])).toBe('Multicolored');
  expect(analytics.GetColorIdentity(["G"])).toBe('Green');
});

test("GetTypeByColor returns valid counts", () => {
  expect.assertions(1);
  var promise = carddb.initializeCardDb(fixturesPath, true);
  return promise.then(function() {
    var expected = {
      "Artifacts": {
        "Black": 0,
        "Blue": 2,
        "Colorless": 1,
        "Green": 0,
        "Multi": 0,
        "Red": 1,
        "Total": 5,
        "White": 1
      },
      "Creatures": {
        "Black": 7,
        "Blue": 7,
        "Colorless": 0,
        "Green": 7,
        "Multi": 4,
        "Red": 6,
        "Total": 40,
        "White": 9
      },
      "Enchantments": {
        "Black": 0,
        "Blue": 1,
        "Colorless": 0,
        "Green": 1,
        "Multi": 3,
        "Red": 1,
        "Total": 7,
        "White": 1
      },
      "Instants": {
        "Black": 0,
        "Blue": 0,
        "Colorless": 0,
        "Green": 1,
        "Multi": 0,
        "Red": 0,
        "Total": 1,
        "White": 0
      },
      "Lands": {
        "Black": 0,
        "Blue": 0,
        "Colorless": 7,
        "Green": 0,
        "Multi": 0,
        "Red": 0,
        "Total": 7,
        "White": 0
      },
      "Planeswalkers": {
        "Black": 0,
        "Blue": 0,
        "Colorless": 0,
        "Green": 0,
        "Multi": 2,
        "Red": 0,
        "Total": 2,
        "White": 0
      },
      "Sorceries": {
        "Black": 0,
        "Blue": 0,
        "Colorless": 0,
        "Green": 0,
        "Multi": 2,
        "Red": 1,
        "Total": 3,
        "White": 0
      },
      "Total": {
        "Black": 7,
        "Blue": 10,
        "Colorless": 8,
        "Green": 9,
        "Multi": 11,
        "Red": 9,
        "Total": 65,
        "White": 11
      }
    };
    var result = analytics.GetTypeByColor(cubefixture.exampleCube.cards, carddb);
    expect(result).toEqual(expected);
  });
});

test("GetColorCounts", () => {});
test("GetCurve", () => {});
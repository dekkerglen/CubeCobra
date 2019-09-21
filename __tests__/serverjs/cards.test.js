const carddb = require("../../serverjs/cards");
const fixturesPath = "__tests__/fixtures";
const firstLetterCount = 21;
const fixtureCardCount = 100;

beforeEach(() => {});

afterEach(() => {});

test("initializeCardDb loads files properly", () => {
  expect.assertions(6);
  var promise = carddb.initializeCardDb(fixturesPath);
  return promise.then(function() {
    expect(Object.keys(carddb.cardtree).length).toBe(firstLetterCount);
    expect(Object.keys(carddb.imagedict).length).toBe(fixtureCardCount);
    expect(Object.keys(carddb.cardimages).length).toBe(fixtureCardCount);
    expect(carddb.cardnames.length).toBe(fixtureCardCount);
    expect(Object.keys(carddb.full_names).length).toBe(firstLetterCount);
    expect(Object.keys(carddb.nameToId).length).toBe(fixtureCardCount);
  });
});

test("cardFromId", () => {});
test("getCardDetails", () => {});

test("normalizedName normalized ascii correctly", () => {
  const rawName = "Garruk, Primal Hunter";
  const expected = "garruk, primal hunter";
  const result = carddb.normalizedName({
    "name": rawName
  });
  expect(result).toBe(expected);
});

test("normalizedName normalizes unicode correctly", () => {
  const rawName = "Ætherspouts";
  const expected = "ætherspouts";
  const result = carddb.normalizedName({
    "name": rawName
  });
  expect(result).toBe(expected);
});

test("allIds", () => {});

test("loadJSONFile loads a JSON file into the correct attribute", () => {
  expect.assertions(1);
  const attribute = "testAttribute";
  return carddb.loadJSONFile(fixturesPath + "/names.json", attribute).then(function() {
    expect(carddb[attribute].length).toBe(fixtureCardCount);
  });
});

test("getPlaceholderCard", () => {});
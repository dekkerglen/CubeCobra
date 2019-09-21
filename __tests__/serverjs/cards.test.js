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

test("allIds correctly maps a cardname to an ID", () => {
  expect.assertions(2);
  var promise = carddb.initializeCardDb(fixturesPath);
  return promise.then(function() {
    const expected = "ee4d196e-7ce4-4dc1-9d58-102a89aca2a4";
    const result = carddb.allIds({
      "name": "Rankle, Master of Pranks"
    });
    expect(result.length).toBe(1);
    expect(result[0]).toBe(expected);
  });
});

test("loadJSONFile loads a JSON file into the correct attribute", () => {
  expect.assertions(1);
  const attribute = "testAttribute";
  return carddb.loadJSONFile(fixturesPath + "/names.json", attribute).then(function() {
    expect(carddb[attribute].length).toBe(fixtureCardCount);
  });
});

test("getPlaceholderCard", () => {
  const _id = "abckggght";
  const expected = {
    _id: _id,
    set: '',
    collector_number: '',
    promo: false,
    digital: false,
    full_name: 'Invalid Card',
    name: 'Invalid Card',
    name_lower: 'Invalid Card',
    artist: '',
    scryfall_uri: '',
    rarity: '',
    legalities: {},
    oracle_text: '',
    image_normal: 'https://img.scryfall.com/errors/missing.jpg',
    cmc: 0,
    type: '',
    colors: [],
    color_identity: [],
    parsed_cost: [],
    colorcategory: 'c',
    error: true
  };
  expect(carddb.getPlaceholderCard(_id)).toEqual(expected);
});
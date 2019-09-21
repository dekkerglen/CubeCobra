const carddb = require("../../serverjs/cards");
const fixturesPath = "__tests__/fixtures";
const firstLetterCount = 21;
const fixtureCardCount = 100;
var placeholderCard = {
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

test("cardFromId returns a well-formed card object", () => {
  expect.assertions(1);
  const _id = "ee4d196e-7ce4-4dc1-9d58-102a89aca2a4";
  const expected = {
    "_id": "ee4d196e-7ce4-4dc1-9d58-102a89aca2a4",
    "art_crop": "https://img.scryfall.com/cards/art_crop/front/e/e/ee4d196e-7ce4-4dc1-9d58-102a89aca2a4.jpg?1567700630",
    "artist": "Dmitry Burmak",
    "border_color": "borderless",
    "cmc": 4,
    "collector_number": "356",
    "color_identity": ["B"],
    "colorcategory": "b",
    "colors": ["B"],
    "digital": false,
    "full_name": "Rankle, Master of Pranks [celd-356]",
    "image_normal": "https://img.scryfall.com/cards/normal/front/e/e/ee4d196e-7ce4-4dc1-9d58-102a89aca2a4.jpg?1567700630",
    "image_small": "https://img.scryfall.com/cards/small/front/e/e/ee4d196e-7ce4-4dc1-9d58-102a89aca2a4.jpg?1567700630",
    "legalities": {
      "Legacy": false,
      "Modern": false,
      "Pauper": false,
      "Standard": false
    },
    "name": "Rankle, Master of Pranks",
    "name_lower": "rankle, master of pranks",
    "oracle_text": "Flying, haste\nWhenever Rankle, Master of Pranks deals combat damage to a player, choose any number —\n• Each player discards a card.\n• Each player loses 1 life and draws a card.\n• Each player sacrifices a creature.",
    "parsed_cost": ["b", "b", "2"],
    "power": "3",
    "promo": true,
    "rarity": "mythic",
    "scryfall_uri": "https://scryfall.com/card/celd/356/rankle-master-of-pranks?utm_source=api",
    "set": "celd",
    "toughness": "3",
    "type": "Legendary Creature — Faerie Rogue"
  };
  var promise = carddb.initializeCardDb(fixturesPath);
  return promise.then(function() {
    const result = carddb.cardFromId(_id);
    expect(result).toEqual(expected);
  });
});

test("cardFromId returns a placeholder card object when given a nonexistent ID", () => {
  expect.assertions(1);
  const _id = "not real";
  var expected = placeholderCard;
  expected._id = _id;
  var promise = carddb.initializeCardDb(fixturesPath);
  return promise.then(function() {
    const result = carddb.cardFromId(_id);
    expect(result).toEqual(expected);
  });
});

test("getCardDetails returns a well-formed card object", () => {
  expect.assertions(1);
  const _id = "ee4d196e-7ce4-4dc1-9d58-102a89aca2a4";
  const expected = {
    "_id": "ee4d196e-7ce4-4dc1-9d58-102a89aca2a4",
    "art_crop": "https://img.scryfall.com/cards/art_crop/front/e/e/ee4d196e-7ce4-4dc1-9d58-102a89aca2a4.jpg?1567700630",
    "artist": "Dmitry Burmak",
    "border_color": "borderless",
    "cmc": 4,
    "collector_number": "356",
    "color_identity": ["B"],
    "colorcategory": "b",
    "colors": ["B"],
    "digital": false,
    "display_image": "https://img.scryfall.com/cards/normal/front/e/e/ee4d196e-7ce4-4dc1-9d58-102a89aca2a4.jpg?1567700630",
    "full_name": "Rankle, Master of Pranks [celd-356]",
    "image_normal": "https://img.scryfall.com/cards/normal/front/e/e/ee4d196e-7ce4-4dc1-9d58-102a89aca2a4.jpg?1567700630",
    "image_small": "https://img.scryfall.com/cards/small/front/e/e/ee4d196e-7ce4-4dc1-9d58-102a89aca2a4.jpg?1567700630",
    "legalities": {
      "Legacy": false,
      "Modern": false,
      "Pauper": false,
      "Standard": false
    },
    "name": "Rankle, Master of Pranks",
    "name_lower": "rankle, master of pranks",
    "oracle_text": "Flying, haste\nWhenever Rankle, Master of Pranks deals combat damage to a player, choose any number —\n• Each player discards a card.\n• Each player loses 1 life and draws a card.\n• Each player sacrifices a creature.",
    "parsed_cost": ["b", "b", "2"],
    "power": "3",
    "promo": true,
    "rarity": "mythic",
    "scryfall_uri": "https://scryfall.com/card/celd/356/rankle-master-of-pranks?utm_source=api",
    "set": "celd",
    "toughness": "3",
    "type": "Legendary Creature — Faerie Rogue"
  };
  var promise = carddb.initializeCardDb(fixturesPath);
  return promise.then(function() {
    const result = carddb.getCardDetails({
      "cardID": _id
    });
    expect(result).toEqual(expected);
  });
});

test("getCardDetails returns a placeholder card object when given a nonexistent ID", () => {
  expect.assertions(1);
  const _id = "not real";
  var expected = placeholderCard;
  expected._id = _id;
  var promise = carddb.initializeCardDb(fixturesPath);
  return promise.then(function() {
    const result = carddb.getCardDetails({
      "cardID": _id
    });
    expect(result).toEqual(expected);
  });
});

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
  var expected = placeholderCard;
  expected._id = _id;
  expect(carddb.getPlaceholderCard(_id)).toEqual(expected);
});
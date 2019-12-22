const carddb = require('../../serverjs/cards');
const fixturesPath = 'fixtures';
const firstLetterCount = 21;
const fixtureCardCount = 99;
var placeholderCard = {
  set: '',
  collector_number: '',
  promo: false,
  digital: false,
  full_name: 'Invalid Card',
  name: 'Invalid Card',
  name_lower: 'invalid card',
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
  error: true,
};

afterEach(() => {
  carddb.unloadCardDb();
});

test('initializeCardDb loads files properly', () => {
  expect.assertions(6);
  var promise = carddb.initializeCardDb(fixturesPath, true);
  return promise.then(function() {
    expect(Object.keys(carddb.cardtree).length).toBe(firstLetterCount);
    expect(Object.keys(carddb.imagedict).length).toBe(fixtureCardCount);
    expect(Object.keys(carddb.cardimages).length).toBe(fixtureCardCount);
    expect(carddb.cardnames.length).toBe(fixtureCardCount);
    expect(Object.keys(carddb.full_names).length).toBe(firstLetterCount);
    expect(Object.keys(carddb.nameToId).length).toBe(fixtureCardCount);
  });
});

test('unloadCardDb unloads the card database correctly', () => {
  expect.assertions(6);
  var promise = carddb.initializeCardDb(fixturesPath, true);
  return promise.then(function() {
    carddb.unloadCardDb();
    expect(carddb.cardtree).toBe(undefined);
    expect(carddb.imagedict).toBe(undefined);
    expect(carddb.cardimages).toBe(undefined);
    expect(carddb.cardnames).toBe(undefined);
    expect(carddb.full_names).toBe(undefined);
    expect(carddb.nameToId).toBe(undefined);
  });
});

const _RankleMasterofFixtures = {
  _id: '93c2c11d-dfc3-4ba9-8c0f-a98114090396',
  color_identity: ['B'],
  set: 'eld',
  collector_number: '101',
  promo: false,
  digital: false,
  isToken: false,
  border_color: 'black',
  name: 'Rankle, Master of Pranks',
  name_lower: 'rankle, master of pranks',
  full_name: 'Rankle, Master of Pranks [eld-101]',
  artist: 'Dmitry Burmak',
  scryfall_uri: 'https://scryfall.com/card/eld/101/rankle-master-of-pranks?utm_source=api',
  rarity: 'mythic',
  oracle_text:
    'Flying, haste\nWhenever Rankle, Master of Pranks deals combat damage to a player, choose any number —\n• Each player discards a card.\n• Each player loses 1 life and draws a card.\n• Each player sacrifices a creature.',
  cmc: 4,
  legalities: {
    Legacy: true,
    Modern: true,
    Standard: true,
    Pauper: false,
  },
  parsed_cost: ['b', 'b', '2'],
  colors: ['B'],
  type: 'Legendary Creature — Faerie Rogue',
  full_art: false,
  language: 'en',
  tcgplayer_id: 198584,
  power: '3',
  toughness: '3',
  image_small: 'https://img.scryfall.com/cards/small/front/9/3/93c2c11d-dfc3-4ba9-8c0f-a98114090396.jpg?1572490217',
  image_normal: 'https://img.scryfall.com/cards/normal/front/9/3/93c2c11d-dfc3-4ba9-8c0f-a98114090396.jpg?1572490217',
  art_crop: 'https://img.scryfall.com/cards/art_crop/front/9/3/93c2c11d-dfc3-4ba9-8c0f-a98114090396.jpg?1572490217',
  colorcategory: 'b',
};

test('cardFromId returns a well-formed card object', () => {
  expect.assertions(1);
  const _id = _RankleMasterofFixtures._id;
  const expected = _RankleMasterofFixtures;
  var promise = carddb.initializeCardDb(fixturesPath, true);
  return promise.then(function() {
    const result = carddb.cardFromId(_id);
    expect(result).toEqual(expected);
  });
});

test('cardFromId returns a placeholder card object when given a nonexistent ID', () => {
  expect.assertions(1);
  const _id = 'not real';
  var expected = placeholderCard;
  expected._id = _id;
  var promise = carddb.initializeCardDb(fixturesPath, true);
  return promise.then(function() {
    const result = carddb.cardFromId(_id);
    expect(result).toEqual(expected);
  });
});

test('getCardDetails returns a well-formed card object', () => {
  expect.assertions(1);
  const _id = _RankleMasterofFixtures._id;
  let expected = _RankleMasterofFixtures;
  // getCardDetails includes 'display_image' atrribute
  expected.display_image =
    'https://img.scryfall.com/cards/normal/front/9/3/93c2c11d-dfc3-4ba9-8c0f-a98114090396.jpg?1572490217';
  var promise = carddb.initializeCardDb(fixturesPath, true);
  return promise.then(function() {
    const result = carddb.getCardDetails({
      cardID: _id,
    });
    expect(result).toEqual(expected);
  });
});

test('getCardDetails returns a placeholder card object when given a nonexistent ID', () => {
  expect.assertions(1);
  const _id = 'not real';
  var expected = placeholderCard;
  expected._id = _id;
  var promise = carddb.initializeCardDb(fixturesPath, true);
  return promise.then(function() {
    const result = carddb.getCardDetails({
      cardID: _id,
    });
    expect(result).toEqual(expected);
  });
});

test('normalizedName normalized ascii correctly', () => {
  const rawName = 'Garruk, Primal Hunter';
  const expected = 'garruk, primal hunter';
  const result = carddb.normalizedName({
    name: rawName,
  });
  expect(result).toBe(expected);
});

test('normalizedName normalizes unicode correctly', () => {
  const rawName = 'Ætherspouts';
  const expected = 'ætherspouts';
  const result = carddb.normalizedName({
    name: rawName,
  });
  expect(result).toBe(expected);
});

test('allIds correctly maps a cardname to an ID', () => {
  expect.assertions(2);
  var promise = carddb.initializeCardDb(fixturesPath, true);
  return promise.then(function() {
    const expected = _RankleMasterofFixtures._id;
    const result = carddb.allIds({
      name: 'Rankle, Master of Pranks',
    });
    expect(result.length).toBe(1);
    expect(result[0]).toBe(expected);
  });
});

test('loadJSONFile loads a JSON file into the correct attribute', () => {
  expect.assertions(1);
  const attribute = 'testAttribute';
  return carddb.loadJSONFile(fixturesPath + '/names.json', attribute).then(function() {
    expect(carddb[attribute].length).toBe(fixtureCardCount);
  });
});

test('getPlaceholderCard', () => {
  const _id = 'abckggght';
  var expected = placeholderCard;
  expected._id = _id;
  expect(carddb.getPlaceholderCard(_id)).toEqual(expected);
});

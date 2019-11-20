const rimraf = require('rimraf');
const updatecards = require('../../serverjs/updatecards');
const carddb = require('../../serverjs/cards');
const examplecards = require('../../fixtures/examplecards');
const fs = require('fs');
const cardsFixturePath = 'fixtures/cards_small.json';

const convertedExampleCard = {
  color_identity: ['R'],
  set: 'uma',
  collector_number: '154',
  promo: false,
  digital: false,
  isToken: false,
  border_color: 'black',
  name: 'Vexing Devil',
  name_lower: 'vexing devil',
  full_name: 'Vexing Devil [uma-154]',
  artist: 'Lucas Graciano',
  scryfall_uri: 'https://scryfall.com/card/uma/154/vexing-devil?utm_source=api',
  rarity: 'rare',
  oracle_text:
    'When Vexing Devil enters the battlefield, any opponent may have it deal 4 damage to them. If a player does, sacrifice Vexing Devil.',
  _id: 'a5ebb551-6b0d-45fa-88c8-3746214094f6',
  cmc: 1,
  legalities: {
    Legacy: true,
    Modern: true,
    Standard: false,
    Pauper: false,
  },
  parsed_cost: ['r'],
  colors: ['R'],
  type: 'Creature — Devil',
  tcgplayer_id: 180776,
  power: '4',
  toughness: '3',
  image_small: 'https://img.scryfall.com/cards/small/front/a/5/a5ebb551-6b0d-45fa-88c8-3746214094f6.jpg?1547517462',
  image_normal: 'https://img.scryfall.com/cards/normal/front/a/5/a5ebb551-6b0d-45fa-88c8-3746214094f6.jpg?1547517462',
  art_crop: 'https://img.scryfall.com/cards/art_crop/front/a/5/a5ebb551-6b0d-45fa-88c8-3746214094f6.jpg?1547517462',
  colorcategory: 'r',
};

const convertedExampleDoubleFacedCardFlipFace = {
  color_identity: ['G'],
  set: 'dka',
  collector_number: '125',
  promo: false,
  digital: false,
  isToken: false,
  border_color: 'black',
  name: 'Moonscarred Werewolf',
  name_lower: 'moonscarred werewolf',
  full_name: 'Moonscarred Werewolf [dka-125]',
  artist: 'Cynthia Sheppard',
  scryfall_uri: 'https://scryfall.com/card/dka/125/scorned-villager-moonscarred-werewolf?utm_source=api',
  rarity: 'common',
  oracle_text: undefined,
  _id: '6f35e364-81d9-4888-993b-acc7a53d963c2',
  cmc: 0,
  legalities: {
    Legacy: false,
    Modern: false,
    Standard: false,
    Pauper: false,
  },
  parsed_cost: [],
  colors: ['G'],
  type: 'Creature — Werewolf',
  tcgplayer_id: 57617,
  power: '2',
  toughness: '2',
  image_small: undefined,
  image_normal: undefined,
  art_crop: undefined,
  colorcategory: 'g',
};

const convertFnToAttribute = {
  convertName: 'name',
  convertId: '_id',
  convertLegalities: 'legalities',
  convertType: 'type',
  convertColors: 'colors',
  convertParsedCost: 'parsed_cost',
  convertCmc: 'cmc',
};

beforeEach(() => {
  rimraf.sync('private');
  updatecards.initializeCatalog();
});

afterEach(() => {
  rimraf.sync('private');
});

test('updateCardbase creates the expected files', () => {
  expect.assertions(7);
  var noopPromise = new Promise((resolve, reject) => {
    process.nextTick(() => {
      resolve();
    });
  });
  var downloadMock = jest.fn();
  downloadMock.mockReturnValue(noopPromise);
  var initialDownloadDefaultCards = updatecards.downloadDefaultCards;
  updatecards.downloadDefaultCards = downloadMock;
  return updatecards.updateCardbase(cardsFixturePath).then(function() {
    expect(fs.existsSync('private/cardtree.json')).toBe(true);
    expect(fs.existsSync('private/imagedict.json')).toBe(true);
    expect(fs.existsSync('private/cardimages.json')).toBe(true);
    expect(fs.existsSync('private/names.json')).toBe(true);
    expect(fs.existsSync('private/carddict.json')).toBe(true);
    expect(fs.existsSync('private/nameToId.json')).toBe(true);
    expect(fs.existsSync('private/full_names.json')).toBe(true);
  });
  updatecards.downloadDefaultCards = initialDownloadDefaultCards;
});

test("addCardToCatalog successfully adds a card's information to the internal structures", () => {
  const card = convertedExampleCard;
  updatecards.addCardToCatalog(card);
  var catalog = updatecards.catalog;
  const normalizedFullName = card.full_name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normalizedName = carddb.normalizedName(card);
  const expectedImagedictStructure = {
    uri: card.art_crop,
    artist: card.artist,
  };
  const expectedCardimagesStructure = {
    image_normal: card.image_normal,
  };
  expect(Object.keys(catalog.dict).length).toBe(1);
  expect(catalog.dict[card._id]).toEqual(card);
  expect(Object.keys(catalog.imagedict).length).toBe(1);
  expect(catalog.imagedict[normalizedFullName]).toEqual(expectedImagedictStructure);
  expect(Object.keys(catalog.cardimages).length).toBe(1);
  expect(catalog.cardimages[normalizedName]).toEqual(expectedCardimagesStructure);
  expect(Object.keys(catalog.nameToId).length).toBe(1);
  expect(catalog.nameToId[normalizedName]).toEqual([card._id]);
  expect(Object.keys(catalog.names).length).toBe(1);
  expect(Object.keys(catalog.full_names).length).toBe(1);
});

test("addCardToCatalog successfully adds a double-faced card's information to the internal structures", () => {
  const card = convertedExampleDoubleFacedCardFlipFace;
  updatecards.addCardToCatalog(card, true);
  var catalog = updatecards.catalog;
  const normalizedFullName = card.full_name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normalizedName = carddb.normalizedName(card);
  const expectedImagedictStructure = {
    uri: card.art_crop,
    artist: card.artist,
  };
  expect(Object.keys(catalog.dict).length).toBe(1);
  expect(catalog.dict[card._id]).toEqual(card);
  expect(Object.keys(catalog.imagedict).length).toBe(1);
  expect(catalog.imagedict[normalizedFullName]).toEqual(expectedImagedictStructure);
  expect(Object.keys(catalog.cardimages).length).toBe(0);
  expect(Object.keys(catalog.nameToId).length).toBe(1);
  expect(catalog.nameToId[normalizedName]).toEqual([card._id]);
  expect(Object.keys(catalog.names).length).toBe(1);
  expect(Object.keys(catalog.full_names).length).toBe(1);
});

test('initializeCatalog clears the updatecards structures', () => {
  expect.assertions(6);
  var contents = fs.readFileSync(cardsFixturePath);
  var cards = JSON.parse(contents);
  return updatecards.saveAllCards(cards).then(function() {
    updatecards.initializeCatalog();
    expect(Object.keys(updatecards.catalog.dict).length).toBe(0);
    expect(updatecards.catalog.names.length).toBe(0);
    expect(Object.keys(updatecards.catalog.nameToId).length).toBe(0);
    expect(updatecards.catalog.full_names.length).toBe(0);
    expect(Object.keys(updatecards.catalog.imagedict).length).toBe(0);
    expect(Object.keys(updatecards.catalog.cardimages).length).toBe(0);
  });
});

test('saveAllCards creates the expected files', () => {
  expect.assertions(7);
  var contents = fs.readFileSync(cardsFixturePath);
  var cards = JSON.parse(contents);
  return updatecards.saveAllCards(cards).then(function() {
    expect(fs.existsSync('private/cardtree.json')).toBe(true);
    expect(fs.existsSync('private/imagedict.json')).toBe(true);
    expect(fs.existsSync('private/cardimages.json')).toBe(true);
    expect(fs.existsSync('private/names.json')).toBe(true);
    expect(fs.existsSync('private/carddict.json')).toBe(true);
    expect(fs.existsSync('private/nameToId.json')).toBe(true);
    expect(fs.existsSync('private/full_names.json')).toBe(true);
  });
});

test('convertCard returns a correctly converted card object', () => {
  const result = updatecards.convertCard(examplecards.exampleCard);
  expect(result).toEqual(convertedExampleCard);
});

var attribute;
for (var convertFn in convertFnToAttribute) {
  attribute = convertFnToAttribute[convertFn];
  test(convertFn + " properly converts a card's " + attribute, () => {
    const result = updatecards[convertFn](examplecards.exampleCard);
    expect(result).toBe(convertedExampleCard[attribute]);
  });
}

test('convertCard returns a correctly converted double-faced card object', () => {
  const result = updatecards.convertCard(examplecards.exampleDoubleFacedCard, true);
  expect(result).toEqual(convertedExampleDoubleFacedCardFlipFace);
});

var attribute;
for (var convertFn in convertFnToAttribute) {
  attribute = convertFnToAttribute[convertFn];
  test(convertFn + " properly converts a double-faced card's " + attribute, () => {
    const result = updatecards[convertFn](examplecards.exampleDoubleFacedCard, true);
    expect(result).toBe(convertedExampleDoubleFacedCardFlipFace[attribute]);
  });
}

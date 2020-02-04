const fs = require('fs');
const rimraf = require('rimraf');

const updatecards = require('../../serverjs/updatecards');
const carddb = require('../../serverjs/cards');
const examplecards = require('../../fixtures/examplecards');
const cardutil = require('../../dist/utils/Card.js');

const cardsFixturePath = 'fixtures/cards_small.json';

const convertedExampleCard = {
  color_identity: ['R', 'W'],
  set: 'eld',
  collector_number: '194',
  promo: false,
  digital: false,
  isToken: false,
  border_color: 'black',
  name: 'Inspiring Veteran',
  name_lower: 'inspiring veteran',
  full_name: 'Inspiring Veteran [eld-194]',
  artist: 'Scott Murphy',
  scryfall_uri: 'https://scryfall.com/card/eld/194/inspiring-veteran?utm_source=api',
  rarity: 'uncommon',
  oracle_text: 'Other Knights you control get +1/+1.',
  _id: '0c3f372d-259d-4a31-9491-2d369b3f3f8b',
  oracle_id: 'aa1a63dd-acb1-465f-8970-667b8d7c57c9',
  cmc: 2,
  legalities: {
    Legacy: true,
    Modern: true,
    Standard: true,
    Pioneer: true,
    Pauper: false,
  },
  parsed_cost: ['w', 'r'],
  colors: ['R', 'W'],
  type: 'Creature — Human Knight',
  full_art: false,
  language: 'en',
  tcgplayer_id: 198561,
  power: '2',
  toughness: '2',
  image_small: 'https://img.scryfall.com/cards/small/front/0/c/0c3f372d-259d-4a31-9491-2d369b3f3f8b.jpg?1572490775',
  image_normal: 'https://img.scryfall.com/cards/normal/front/0/c/0c3f372d-259d-4a31-9491-2d369b3f3f8b.jpg?1572490775',
  art_crop: 'https://img.scryfall.com/cards/art_crop/front/0/c/0c3f372d-259d-4a31-9491-2d369b3f3f8b.jpg?1572490775',
  colorcategory: 'm',
};

const convertedExampleDoubleFacedCard = {
  _id: '6f35e364-81d9-4888-993b-acc7a53d963c',
  art_crop: 'https://img.scryfall.com/cards/art_crop/front/6/f/6f35e364-81d9-4888-993b-acc7a53d963c.jpg?1562921188',
  artist: 'Cynthia Sheppard',
  border_color: 'black',
  cmc: 2,
  collector_number: '125',
  color_identity: ['G'],
  colorcategory: 'g',
  colors: ['G'],
  digital: false,
  full_art: false,
  full_name: 'Scorned Villager [dka-125]',
  image_flip: 'https://img.scryfall.com/cards/normal/back/6/f/6f35e364-81d9-4888-993b-acc7a53d963c.jpg?1562921188',
  image_normal: 'https://img.scryfall.com/cards/normal/front/6/f/6f35e364-81d9-4888-993b-acc7a53d963c.jpg?1562921188',
  image_small: 'https://img.scryfall.com/cards/small/front/6/f/6f35e364-81d9-4888-993b-acc7a53d963c.jpg?1562921188',
  isToken: false,
  language: 'en',
  legalities: {
    Legacy: true,
    Modern: true,
    Pauper: true,
    Pioneer: false,
    Standard: false,
  },
  name: 'Scorned Villager',
  name_lower: 'scorned villager',
  oracle_id: '52855f90-19c1-46c9-8eed-88b3c1722bb0',
  oracle_text:
    '{T}: Add {G}.\nAt the beginning of each upkeep, if no spells were cast last turn, transform Scorned Villager.\nVigilance\n{T}: Add {G}{G}.\nAt the beginning of each upkeep, if a player cast two or more spells last turn, transform Moonscarred Werewolf.',
  parsed_cost: [''],
  power: '1',
  promo: false,
  rarity: 'common',
  scryfall_uri: 'https://scryfall.com/card/dka/125/scorned-villager-moonscarred-werewolf?utm_source=api',
  set: 'dka',
  tcgplayer_id: 57617,
  toughness: '1',
  type: 'Creature — Human Werewolf',
};

const convertedExampleDoubleFacedCardFlipFace = {
  color_identity: ['G'],
  set: 'dka',
  collector_number: '125',
  promo: false,
  digital: false,
  isToken: false,
  language: 'en',
  border_color: 'black',
  name: 'Moonscarred Werewolf',
  name_lower: 'moonscarred werewolf',
  full_art: false,
  full_name: 'Moonscarred Werewolf [dka-125]',
  artist: 'Cynthia Sheppard',
  scryfall_uri: 'https://scryfall.com/card/dka/125/scorned-villager-moonscarred-werewolf?utm_source=api',
  rarity: 'common',
  oracle_text:
    '{T}: Add {G}.\nAt the beginning of each upkeep, if no spells were cast last turn, transform Scorned Villager.\nVigilance\n{T}: Add {G}{G}.\nAt the beginning of each upkeep, if a player cast two or more spells last turn, transform Moonscarred Werewolf.',
  _id: '6f35e364-81d9-4888-993b-acc7a53d963c2',
  oracle_id: '52855f90-19c1-46c9-8eed-88b3c1722bb0',
  cmc: 0,
  language: 'en',
  legalities: {
    Legacy: false,
    Modern: false,
    Standard: false,
    Pioneer: false,
    Pauper: false,
  },
  parsed_cost: [],
  colors: ['G'],
  type: 'Creature — Werewolf',
  tcgplayer_id: 57617,
  power: '2',
  toughness: '2',
  image_flip: 'https://img.scryfall.com/cards/normal/back/6/f/6f35e364-81d9-4888-993b-acc7a53d963c.jpg?1562921188',
  image_normal: 'https://img.scryfall.com/cards/normal/back/6/f/6f35e364-81d9-4888-993b-acc7a53d963c.jpg?1562921188',
  image_small: 'https://img.scryfall.com/cards/small/back/6/f/6f35e364-81d9-4888-993b-acc7a53d963c.jpg?1562921188',
  art_crop: 'https://img.scryfall.com/cards/art_crop/back/6/f/6f35e364-81d9-4888-993b-acc7a53d963c.jpg?1562921188',

  colorcategory: 'g',
};

const convertedExampleAdventureCard = {
  _id: '06bd1ad2-fb5d-4aef-87d1-13a341c686fa',
  art_crop: 'https://img.scryfall.com/cards/art_crop/front/0/6/06bd1ad2-fb5d-4aef-87d1-13a341c686fa.jpg?1572490543',
  artist: 'Gabor Szikszai',
  border_color: 'black',
  cmc: 1,
  collector_number: '155',
  color_identity: ['G'],
  colorcategory: 'g',
  colors: ['G'],
  digital: false,
  full_art: false,
  full_name: 'Flaxen Intruder [eld-155]',
  image_normal: 'https://img.scryfall.com/cards/normal/front/0/6/06bd1ad2-fb5d-4aef-87d1-13a341c686fa.jpg?1572490543',
  image_small: 'https://img.scryfall.com/cards/small/front/0/6/06bd1ad2-fb5d-4aef-87d1-13a341c686fa.jpg?1572490543',
  isToken: false,
  language: 'en',
  legalities: {
    Legacy: true,
    Modern: true,
    Pauper: false,
    Pioneer: true,
    Standard: true,
  },
  name: 'Flaxen Intruder',
  name_lower: 'flaxen intruder',
  oracle_id: 'bacedc99-46d9-4757-8a27-8df77d7c2f02',
  oracle_text:
    'Whenever Flaxen Intruder deals combat damage to a player, you may sacrifice it. When you do, destroy target artifact or enchantment.\nCreate three 2/2 green Bear creature tokens. (Then exile this card. You may cast the creature later from exile.)',
  parsed_cost: ['g', 'g', '5', 'split', 'g'],
  power: '1',
  promo: false,
  rarity: 'uncommon',
  scryfall_uri: 'https://scryfall.com/card/eld/155/flaxen-intruder-welcome-home?utm_source=api',
  set: 'eld',
  tcgplayer_id: 198574,
  toughness: '2',
  type: 'Creature — Human Berserker',
};

const convertedExampleAdventureCardAdventure = {
  _id: '06bd1ad2-fb5d-4aef-87d1-13a341c686fa2',
  art_crop: 'https://img.scryfall.com/cards/art_crop/front/0/6/06bd1ad2-fb5d-4aef-87d1-13a341c686fa.jpg?1572490543',
  artist: 'Gabor Szikszai',
  border_color: 'black',
  cmc: 0, // Adventures do not have cmc
  collector_number: '155',
  color_identity: ['G'],
  colorcategory: 'g',
  colors: [], // Adventures do not have colors, they use the main cards colors
  digital: false,
  full_art: false,
  full_name: 'Welcome Home [eld-155]',
  image_normal: 'https://img.scryfall.com/cards/normal/front/0/6/06bd1ad2-fb5d-4aef-87d1-13a341c686fa.jpg?1572490543',
  image_small: 'https://img.scryfall.com/cards/small/front/0/6/06bd1ad2-fb5d-4aef-87d1-13a341c686fa.jpg?1572490543',
  isToken: false,
  language: 'en',
  legalities: { Legacy: true, Modern: true, Standard: true, Pauper: false },
  name: 'Welcome Home',
  name_lower: 'welcome home',
  oracle_text:
    'Create three 2/2 green Bear creature tokens. (Then exile this card. You may cast the creature later from exile.)',
  parsed_cost: ['g', 'g', '5'],
  promo: false,
  rarity: 'uncommon',
  scryfall_uri: 'https://scryfall.com/card/eld/155/flaxen-intruder-welcome-home?utm_source=api',
  set: 'eld',
  tcgplayer_id: 198574,
  type: 'Sorcery — Adventure',
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
  rimraf.sync('private-test');
  updatecards.initializeCatalog();
});

afterEach(() => {
  rimraf.sync('private-test');
});

test('updateCardbase creates the expected files', () => {
  expect.assertions(8);
  var noopPromise = new Promise((resolve, reject) => {
    process.nextTick(() => {
      resolve();
    });
  });
  var downloadMock = jest.fn();
  downloadMock.mockReturnValue(noopPromise);
  var initialDownloadDefaultCards = updatecards.downloadDefaultCards;
  updatecards.downloadDefaultCards = downloadMock;
  return updatecards.updateCardbase(cardsFixturePath, 'private-test').then(function() {
    expect(fs.existsSync('private-test/cardtree.json')).toBe(true);
    expect(fs.existsSync('private-test/imagedict.json')).toBe(true);
    expect(fs.existsSync('private-test/cardimages.json')).toBe(true);
    expect(fs.existsSync('private-test/names.json')).toBe(true);
    expect(fs.existsSync('private-test/carddict.json')).toBe(true);
    expect(fs.existsSync('private-test/nameToId.json')).toBe(true);
    expect(fs.existsSync('private-test/english.json')).toBe(true);
    expect(fs.existsSync('private-test/full_names.json')).toBe(true);
  });
  updatecards.downloadDefaultCards = initialDownloadDefaultCards;
});

test("addCardToCatalog successfully adds a card's information to the internal structures", () => {
  const card = convertedExampleCard;
  updatecards.addCardToCatalog(card);
  var catalog = updatecards.catalog;
  const normalizedFullName = cardutil.normalizeName(card.full_name);
  const normalizedName = cardutil.normalizeName(card.name);
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
  expect(Object.keys(catalog.english).length).toBe(0);
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
  expect(Object.keys(catalog.english).length).toBe(0);
  expect(Object.keys(catalog.names).length).toBe(1);
  expect(Object.keys(catalog.full_names).length).toBe(1);
});

test('addLanguageMapping successfully adds a language mapping to the internal structures', () => {
  const card = convertedExampleCard;
  updatecards.addCardToCatalog(card);
  updatecards.addLanguageMapping(examplecards.exampleForeignCard);

  const catalog = updatecards.catalog;
  expect(Object.keys(catalog.english).length).toBe(1);
  expect(catalog.english[examplecards.exampleForeignCard.id]).toBe(card._id);
});

test('initializeCatalog clears the updatecards structures', () => {
  expect.assertions(7);
  return updatecards.saveAllCards(cardsFixturePath, 'private-test').then(function() {
    updatecards.initializeCatalog();
    expect(Object.keys(updatecards.catalog.dict).length).toBe(0);
    expect(updatecards.catalog.names.length).toBe(0);
    expect(Object.keys(updatecards.catalog.nameToId).length).toBe(0);
    expect(Object.keys(updatecards.catalog.english).length).toBe(0);
    expect(updatecards.catalog.full_names.length).toBe(0);
    expect(Object.keys(updatecards.catalog.imagedict).length).toBe(0);
    expect(Object.keys(updatecards.catalog.cardimages).length).toBe(0);
  });
});

test('saveAllCards creates the expected files', () => {
  expect.assertions(8);
  return updatecards.saveAllCards(cardsFixturePath, 'private-test').then(function() {
    expect(fs.existsSync('private-test/cardtree.json')).toBe(true);
    expect(fs.existsSync('private-test/imagedict.json')).toBe(true);
    expect(fs.existsSync('private-test/cardimages.json')).toBe(true);
    expect(fs.existsSync('private-test/names.json')).toBe(true);
    expect(fs.existsSync('private-test/carddict.json')).toBe(true);
    expect(fs.existsSync('private-test/nameToId.json')).toBe(true);
    expect(fs.existsSync('private-test/english.json')).toBe(true);
    expect(fs.existsSync('private-test/full_names.json')).toBe(true);
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

test('convertCard returns a correctly converted double-faced card', () => {
  const result = updatecards.convertCard(examplecards.exampleDoubleFacedCard, false);
  expect(result).toEqual(convertedExampleDoubleFacedCard);
});

test('convertCard returns a correctly converted double-faced card flip face object', () => {
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

test('convertCard returns a correctly converted Adventure card object', () => {
  const result = updatecards.convertCard(examplecards.exampleAdventureCard, false);
  expect(result).toEqual(convertedExampleAdventureCard);
});

for (var convertFn in convertFnToAttribute) {
  attribute = convertFnToAttribute[convertFn];
  test(convertFn + " properly converts an Adventure card's creature " + attribute, () => {
    const result = updatecards[convertFn](examplecards.exampleAdventureCard, false);
    expect(result).toBe(convertedExampleAdventureCard[attribute]);
  });
}
for (var convertFn in convertFnToAttribute) {
  attribute = convertFnToAttribute[convertFn];
  test(convertFn + " properly converts an Adventure card's Adventure  " + attribute, () => {
    const result = updatecards[convertFn](examplecards.exampleAdventureCard, true);
    expect(result).toBe(convertedExampleAdventureCardAdventure[attribute]);
  });
}

describe('convertName', () => {
  test('handles ampersands', () => {
    let card = { name: 'Kharis & the Beholder', layout: '' };
    const result = updatecards.convertName(card);
    expect(result).toBe('Kharis & the Beholder');
  });
  test('handles double quotes', () => {
    let card = { name: 'Kharis "The Beholder"', layout: '' };
    const result = updatecards.convertName(card);
    expect(result).toBe('Kharis "The Beholder"');
  });
  test('handles single quotes', () => {
    let card = { name: "Kharis 'The Beholder'", layout: '' };
    const result = updatecards.convertName(card);
    expect(result).toBe("Kharis 'The Beholder'");
  });
  test('handles angle brackets', () => {
    let card = { name: 'Kharis <The Beholder>', layout: '' };
    const result = updatecards.convertName(card);
    expect(result).toBe('Kharis <The Beholder>');
  });
  test('handles question mark', () => {
    let card = { name: 'Question Elemental?', layout: '' };
    const result = updatecards.convertName(card);
    expect(result).toBe('Question Elemental?');
  });
  test('handles multi-face (first face)', () => {
    let card = { name: 'Kharis // The Beholder', layout: 'flip' };
    const result = updatecards.convertName(card);
    expect(result).toBe('Kharis');
  });
  test('handles multi-face (second face)', () => {
    let card = { name: 'Kharis // The Beholder', layout: 'flip' };
    const result = updatecards.convertName(card, true);
    expect(result).toBe('The Beholder');
  });
  test('handles split card', () => {
    let card = { name: 'Kharis // The Beholder', layout: 'split' };
    const result = updatecards.convertName(card);
    expect(result).toBe('Kharis // The Beholder');
  });
});

const fs = require('fs');
const rimraf = require('rimraf');

const updatecards = require('../../serverjs/updatecards');
const carddb = require('../../serverjs/cards');
const examplecards = require('../../fixtures/examplecards');
const cardutil = require('../../dist/utils/Card.js');

const emptyFixturePath = 'fixtures/empty.json';
const cardsFixturePath = 'fixtures/cards_small.json';

const convertedExampleCard = {
  color_identity: ['R', 'W'],
  set: 'eld',
  collector_number: '194',
  promo: false,
  digital: false,
  isToken: false,
  border_color: 'black',
  mtgo_id: 78532,
  name: 'Inspiring Veteran',
  name_lower: 'inspiring veteran',
  full_name: 'Inspiring Veteran [eld-194]',
  artist: 'Scott Murphy',
  scryfall_uri: 'https://scryfall.com/card/eld/194/inspiring-veteran?utm_source=api',
  rarity: 'uncommon',
  released_at: '2019-10-04',
  set_name: 'Throne of Eldraine',
  oracle_text: 'Other Knights you control get +1/+1.',
  _id: '0c3f372d-259d-4a31-9491-2d369b3f3f8b',
  oracle_id: 'aa1a63dd-acb1-465f-8970-667b8d7c57c9',
  cmc: 2,
  legalities: {
    Brawl: 'legal',
    Commander: 'legal',
    Historic: 'legal',
    Legacy: 'legal',
    Modern: 'legal',
    Pauper: 'not_legal',
    Penny: 'legal',
    Pioneer: 'legal',
    Standard: 'legal',
    Vintage: 'legal',
  },
  elo: 1200,
  embedding: [0, 0],
  prices: {
    usd: 0.19,
    usd_foil: 0.62,
    eur: null,
    tix: 0.03,
  },
  parsed_cost: ['w', 'r'],
  colors: ['R', 'W'],
  type: 'Creature — Human Knight',
  full_art: false,
  language: 'en',
  layout: 'normal',
  tcgplayer_id: 198561,
  power: '2',
  toughness: '2',
  image_small: 'https://img.scryfall.com/cards/small/front/0/c/0c3f372d-259d-4a31-9491-2d369b3f3f8b.jpg?1572490775',
  image_normal: 'https://img.scryfall.com/cards/normal/front/0/c/0c3f372d-259d-4a31-9491-2d369b3f3f8b.jpg?1572490775',
  art_crop: 'https://img.scryfall.com/cards/art_crop/front/0/c/0c3f372d-259d-4a31-9491-2d369b3f3f8b.jpg?1572490775',
  colorcategory: 'm',
  foil: true,
  nonfoil: true,
  popularity: 0,
  pickCount: 0,
  cubeCount: 0,
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
  set_name: 'Dark Ascension',
  released_at: '2012-02-03',
  image_flip: 'https://img.scryfall.com/cards/normal/back/6/f/6f35e364-81d9-4888-993b-acc7a53d963c.jpg?1562921188',
  image_normal: 'https://img.scryfall.com/cards/normal/front/6/f/6f35e364-81d9-4888-993b-acc7a53d963c.jpg?1562921188',
  image_small: 'https://img.scryfall.com/cards/small/front/6/f/6f35e364-81d9-4888-993b-acc7a53d963c.jpg?1562921188',
  isToken: false,
  language: 'en',
  legalities: {
    Brawl: 'not_legal',
    Commander: 'legal',
    Historic: 'not_legal',
    Legacy: 'legal',
    Modern: 'legal',
    Pauper: 'legal',
    Penny: 'legal',
    Pioneer: 'not_legal',
    Standard: 'not_legal',
    Vintage: 'legal',
  },
  elo: 1300,
  embedding: [0, 1],
  prices: {
    usd: 0.19,
    usd_foil: 0.62,
    eur: null,
    tix: 0.03,
  },
  mtgo_id: 43357,
  name: 'Scorned Villager',
  name_lower: 'scorned villager',
  oracle_id: '52855f90-19c1-46c9-8eed-88b3c1722bb0',
  oracle_text:
    '{T}: Add {G}.\nAt the beginning of each upkeep, if no spells were cast last turn, transform Scorned Villager.\nVigilance\n{T}: Add {G}{G}.\nAt the beginning of each upkeep, if a player cast two or more spells last turn, transform Moonscarred Werewolf.',
  parsed_cost: ['g', '1'],
  power: '1',
  promo: false,
  layout: 'transform',
  rarity: 'common',
  scryfall_uri: 'https://scryfall.com/card/dka/125/scorned-villager-moonscarred-werewolf?utm_source=api',
  set: 'dka',
  tcgplayer_id: 57617,
  toughness: '1',
  type: 'Creature — Human Werewolf',
  foil: true,
  nonfoil: true,
  popularity: 0,
  pickCount: 0,
  cubeCount: 0,
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
  released_at: '2012-02-03',
  set_name: 'Dark Ascension',
  artist: 'Cynthia Sheppard',
  scryfall_uri: 'https://scryfall.com/card/dka/125/scorned-villager-moonscarred-werewolf?utm_source=api',
  rarity: 'common',
  oracle_text:
    'Vigilance\n{T}: Add {G}{G}.\nAt the beginning of each upkeep, if a player cast two or more spells last turn, transform Moonscarred Werewolf.',
  _id: '6f35e364-81d9-4888-993b-acc7a53d963c2',
  oracle_id: '52855f90-19c1-46c9-8eed-88b3c1722bb0',
  cmc: 0,
  legalities: {
    Brawl: 'not_legal',
    Commander: 'not_legal',
    Historic: 'not_legal',
    Legacy: 'not_legal',
    Modern: 'not_legal',
    Pauper: 'not_legal',
    Penny: 'not_legal',
    Pioneer: 'not_legal',
    Standard: 'not_legal',
    Vintage: 'not_legal',
  },
  elo: 1400,
  embedding: [1, 0],
  prices: {
    usd: 0.19,
    usd_foil: 0.62,
    eur: null,
    tix: 0.03,
  },
  mtgo_id: 43357,
  parsed_cost: [],
  colors: [],
  type: 'Creature — Werewolf',
  tcgplayer_id: 57617,
  layout: 'transform',
  power: '2',
  toughness: '2',
  image_normal: 'https://img.scryfall.com/cards/normal/back/6/f/6f35e364-81d9-4888-993b-acc7a53d963c.jpg?1562921188',
  image_small: 'https://img.scryfall.com/cards/small/back/6/f/6f35e364-81d9-4888-993b-acc7a53d963c.jpg?1562921188',
  art_crop: 'https://img.scryfall.com/cards/art_crop/back/6/f/6f35e364-81d9-4888-993b-acc7a53d963c.jpg?1562921188',
  colorcategory: 'g',
  foil: true,
  nonfoil: true,
  popularity: 0,
  pickCount: 0,
  cubeCount: 0,
};

const convertedExampleDoubleFacedPlaneswalkerCard = {
  color_identity: ['B'],
  set: 'ori',
  collector_number: '106',
  promo: false,
  digital: false,
  isToken: false,
  border_color: 'black',
  name: 'Liliana, Heretical Healer',
  name_lower: 'liliana, heretical healer',
  full_name: 'Liliana, Heretical Healer [ori-106]',
  released_at: '2015-07-17',
  set_name: 'Magic Origins',
  artist: 'Karla Ortiz',
  scryfall_uri: 'https://scryfall.com/card/ori/106/liliana-heretical-healer-liliana-defiant-necromancer?utm_source=api',
  rarity: 'mythic',
  oracle_text:
    'Lifelink\n' +
    "Whenever another nontoken creature you control dies, exile Liliana, Heretical Healer, then return her to the battlefield transformed under her owner's control. If you do, create a 2/2 black Zombie creature token.\n" +
    '+2: Each player discards a card.\n' +
    '−X: Return target nonlegendary creature card with converted mana cost X from your graveyard to the battlefield.\n' +
    '−8: You get an emblem with "Whenever a creature dies, return it to the battlefield under your control at the beginning of the next end step."',
  _id: '9f25e1cf-eeb4-458d-8fb2-b3a2f86bdd54',
  oracle_id: 'b96a8ad2-3d86-459b-a34f-19c9dc07c3c4',
  cmc: 3,
  legalities: {
    Brawl: 'not_legal',
    Commander: 'legal',
    Historic: 'not_legal',
    Legacy: 'legal',
    Modern: 'legal',
    Pauper: 'not_legal',
    Penny: 'not_legal',
    Pioneer: 'legal',
    Standard: 'not_legal',
    Vintage: 'legal',
  },
  elo: 1500,
  embedding: [1, 1],
  prices: {
    usd: 12.98,
    usd_foil: 22.46,
    eur: 9.8,
    tix: 1.78,
  },
  mtgo_id: 57940,
  parsed_cost: ['b', 'b', '1'],
  colors: ['B'],
  type: 'Legendary Creature — Human Cleric',
  full_art: false,
  language: 'en',
  tcgplayer_id: 96603,
  power: '2',
  layout: 'transform',
  toughness: '3',
  image_small: 'https://img.scryfall.com/cards/small/front/9/f/9f25e1cf-eeb4-458d-8fb2-b3a2f86bdd54.jpg?1562033824',
  image_normal: 'https://img.scryfall.com/cards/normal/front/9/f/9f25e1cf-eeb4-458d-8fb2-b3a2f86bdd54.jpg?1562033824',
  art_crop: 'https://img.scryfall.com/cards/art_crop/front/9/f/9f25e1cf-eeb4-458d-8fb2-b3a2f86bdd54.jpg?1562033824',
  image_flip: 'https://img.scryfall.com/cards/normal/back/9/f/9f25e1cf-eeb4-458d-8fb2-b3a2f86bdd54.jpg?1562033824',
  colorcategory: 'b',
  tokens: ['e5ccae95-95c2-4d11-aa68-5c80ecf90fd2', 'd75f984f-2e11-4f52-b3b0-dd9d94a2dd74'],
  foil: true,
  nonfoil: true,
  popularity: 0,
  pickCount: 0,
  cubeCount: 0,
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
  set_name: 'Throne of Eldraine',
  released_at: '2019-10-04',
  image_normal: 'https://img.scryfall.com/cards/normal/front/0/6/06bd1ad2-fb5d-4aef-87d1-13a341c686fa.jpg?1572490543',
  image_small: 'https://img.scryfall.com/cards/small/front/0/6/06bd1ad2-fb5d-4aef-87d1-13a341c686fa.jpg?1572490543',
  isToken: false,
  language: 'en',
  legalities: {
    Brawl: 'legal',
    Commander: 'legal',
    Historic: 'legal',
    Legacy: 'legal',
    Modern: 'legal',
    Pauper: 'not_legal',
    Penny: 'legal',
    Pioneer: 'legal',
    Standard: 'legal',
    Vintage: 'legal',
  },
  elo: 1600,
  embedding: [0, 0],
  prices: {
    usd: 0.19,
    usd_foil: 0.62,
    eur: null,
    tix: 0.03,
  },
  mtgo_id: 78444,
  name: 'Flaxen Intruder',
  name_lower: 'flaxen intruder',
  layout: 'adventure',
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
  tokens: ['b0f09f9e-e0f9-4ed8-bfc0-5f1a3046106e'],
  toughness: '2',
  type: 'Creature — Human Berserker',
  foil: true,
  nonfoil: true,
  popularity: 0,
  pickCount: 0,
  cubeCount: 0,
};

const convertedExampleAdventureCardAdventure = {
  _id: '06bd1ad2-fb5d-4aef-87d1-13a341c686fa2',
  art_crop: 'https://img.scryfall.com/cards/art_crop/front/0/6/06bd1ad2-fb5d-4aef-87d1-13a341c686fa.jpg?1572490543',
  artist: 'Gabor Szikszai',
  border_color: 'black',
  cmc: 0, // Adventures don't have cmc
  collector_number: '155',
  color_identity: [], // Adventure's don't have color identitty
  colorcategory: 'g',
  colors: ['G'], // Adventures do not have colors, they use the main cards colors
  digital: false,
  full_art: false,
  full_name: 'Flaxen Intruder [eld-155]',
  set_name: 'Throne of Eldraine',
  released_at: '2019-10-04',
  image_normal: 'https://img.scryfall.com/cards/normal/front/0/6/06bd1ad2-fb5d-4aef-87d1-13a341c686fa.jpg?1572490543',
  image_small: 'https://img.scryfall.com/cards/small/front/0/6/06bd1ad2-fb5d-4aef-87d1-13a341c686fa.jpg?1572490543',
  isToken: false,
  language: 'en',
  layout: 'adventure',
  // ADventure's don't have legalities
  legalities: {
    Brawl: 'not_legal',
    Commander: 'not_legal',
    Historic: 'not_legal',
    Legacy: 'not_legal',
    Modern: 'not_legal',
    Pauper: 'not_legal',
    Penny: 'not_legal',
    Pioneer: 'not_legal',
    Standard: 'not_legal',
    Vintage: 'not_legal',
  },
  elo: 1200,
  embedding: [0, 0],
  prices: {
    usd: 1,
    usd_foil: 2,
    eur: 3,
    tix: 4,
  },
  name: 'Welcome Home',
  name_lower: 'welcome home',
  oracle_text:
    'Create three 2/2 green Bear creature tokens. (Then exile this card. You may cast the creature later from exile.)',
  parsed_cost: [], // Adventure's don't have parsed cost
  promo: false,
  rarity: 'uncommon',
  scryfall_uri: 'https://scryfall.com/card/eld/155/flaxen-intruder-welcome-home?utm_source=api',
  set: 'eld',
  tcgplayer_id: 198574,
  type: 'Sorcery — Adventure',
  foil: true,
  nonfoil: true,
  popularity: 0,
  pickCount: 0,
  cubeCount: 0,
};

const convertedExampleNonFoilCard = {
  color_identity: ['U'],
  set: 'tmp',
  collector_number: '82',
  promo: false,
  digital: false,
  isToken: false,
  border_color: 'black',
  mtgo_id: 9609,
  name: 'Rootwater Hunter',
  name_lower: 'rootwater hunter',
  full_name: 'Rootwater Hunter [tmp-82]',
  artist: 'Brom',
  scryfall_uri: 'https://scryfall.com/card/tmp/82/rootwater-hunter?utm_source=api',
  rarity: 'common',
  released_at: '1997-10-14',
  set_name: 'Tempest',
  oracle_text: '{T}: Rootwater Hunter deals 1 damage to any target.',
  _id: 'cdf7ea34-2cde-4ec5-9b12-99b0002da986',
  oracle_id: '8e42ed82-8b56-46ad-a1ca-e29689a9d030',
  cmc: 3,
  legalities: {
    Brawl: 'not_legal',
    Commander: 'legal',
    Historic: 'not_legal',
    Legacy: 'legal',
    Modern: 'not_legal',
    Pauper: 'legal',
    Penny: 'legal',
    Pioneer: 'not_legal',
    Standard: 'not_legal',
    Vintage: 'legal',
  },
  elo: 1200,
  embedding: [0, 0],
  prices: {
    usd: 0.17,
    usd_foil: null,
    eur: 0.07,
    tix: 0.09,
  },
  parsed_cost: ['u', '2'],
  colors: ['U'],
  type: 'Creature — Merfolk',
  full_art: false,
  language: 'en',
  layout: 'normal',
  tcgplayer_id: 5698,
  power: '1',
  toughness: '1',
  image_small:
    'https://c1.scryfall.com/file/scryfall-cards/small/front/c/d/cdf7ea34-2cde-4ec5-9b12-99b0002da986.jpg?1562056856',
  image_normal:
    'https://c1.scryfall.com/file/scryfall-cards/normal/front/c/d/cdf7ea34-2cde-4ec5-9b12-99b0002da986.jpg?1562056856',
  art_crop:
    'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/c/d/cdf7ea34-2cde-4ec5-9b12-99b0002da986.jpg?1562056856',
  colorcategory: 'u',
  foil: false,
  nonfoil: true,
  popularity: 0,
  pickCount: 0,
  cubeCount: 0,
};

const mockRatings = [
  {
    name: 'Inspiring Veteran',
    elo: 1200,
    embedding: [0, 0],
  },
  {
    name: 'Scorned Villager',
    elo: 1300,
    embedding: [0, 1],
  },
  {
    name: 'Moonscarred Werewolf',
    elo: 1400,
    embedding: [1, 0],
  },
  {
    name: 'Liliana, Heretical Healer',
    elo: 1500,
    embedding: [1, 1],
  },
  {
    name: 'Flaxen Intruder',
    elo: 1600,
    embedding: [0, 0],
  },
  {
    name: 'Rootwater Hunter',
    elo: 1200,
    embedding: [0, 0],
  },
];

const fnToAttributeTable = [
  ['convertName', 'name'],
  ['convertId', '_id'],
  ['convertLegalities', 'legalities'],
  ['convertType', 'type'],
  ['convertColors', 'colors'],
  ['convertParsedCost', 'parsed_cost'],
  ['convertCmc', 'cmc'],
];

beforeEach(() => {
  rimraf.sync('private-test');
  updatecards.initializeCatalog();
  for (const rating of mockRatings) {
    updatecards.catalog.elodict[rating.name] = rating.elo;
    updatecards.catalog.embeddingdict[rating.name] = rating.embedding;
  }
});

afterEach(() => {
  rimraf.sync('private-test');
});

test('updateCardbase creates the expected files', () => {
  expect.assertions(8);
  const noopPromise = new Promise((resolve) => {
    process.nextTick(() => {
      resolve();
    });
  });
  const downloadMock = jest.fn();
  downloadMock.mockReturnValue(noopPromise);
  const initialDownloadDefaultCards = updatecards.downloadDefaultCards;
  updatecards.downloadDefaultCards = downloadMock;
  return updatecards.updateCardbase(mockRatings, [], 'private-test', cardsFixturePath, emptyFixturePath).then(() => {
    expect(fs.existsSync('private-test/cardtree.json')).toBe(true);
    expect(fs.existsSync('private-test/imagedict.json')).toBe(true);
    expect(fs.existsSync('private-test/cardimages.json')).toBe(true);
    expect(fs.existsSync('private-test/names.json')).toBe(true);
    expect(fs.existsSync('private-test/carddict.json')).toBe(true);
    expect(fs.existsSync('private-test/nameToId.json')).toBe(true);
    expect(fs.existsSync('private-test/english.json')).toBe(true);
    expect(fs.existsSync('private-test/full_names.json')).toBe(true);
    updatecards.downloadDefaultCards = initialDownloadDefaultCards;
  });
}, 10000);

test("addCardToCatalog successfully adds a card's information to the internal structures", () => {
  const card = convertedExampleCard;
  updatecards.addCardToCatalog(card);
  const { catalog } = updatecards;
  const normalizedFullName = cardutil.normalizeName(card.full_name);
  const normalizedName = cardutil.normalizeName(card.name);
  const expectedImagedictStructure = {
    uri: card.art_crop,
    id: card._id,
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
  const { catalog } = updatecards;
  const normalizedFullName = card.full_name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normalizedName = carddb.normalizedName(card);
  const expectedImagedictStructure = {
    uri: card.art_crop,
    id: card._id,
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

  const { catalog } = updatecards;
  expect(Object.keys(catalog.english).length).toBe(1);
  expect(catalog.english[examplecards.exampleForeignCard.id]).toBe(card._id);
});

test('initializeCatalog clears the updatecards structures', () => {
  expect.assertions(7);
  return updatecards.saveAllCards(mockRatings, [], 'private-test', cardsFixturePath, emptyFixturePath).then(() => {
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
  return updatecards.saveAllCards(mockRatings, [], 'private-test', cardsFixturePath, emptyFixturePath).then(() => {
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

test('convertCard returns a correctly converted non-foil card object', () => {
  const result = updatecards.convertCard(examplecards.exampleNonFoilCard);
  expect(result).toEqual(convertedExampleNonFoilCard);
});

test('convertCard returns a correctly converted double-faced card', () => {
  const result = updatecards.convertCard(examplecards.exampleDoubleFacedCard, false);
  expect(result).toEqual(convertedExampleDoubleFacedCard);
});

test('convertCard returns a correctly converted double-faced card flip face object', () => {
  const result = updatecards.convertCard(examplecards.exampleDoubleFacedCard, true);
  expect(result).toEqual(convertedExampleDoubleFacedCardFlipFace);
});

test('convertCard returns a correctly converted double-faced planeswalker card', () => {
  const result = updatecards.convertCard(examplecards.exampleDoubleFacedPlaneswalkerCard, false);
  expect(result).toEqual(convertedExampleDoubleFacedPlaneswalkerCard);
});

test('convertCard returns a correctly converted Adventure card object', () => {
  const result = updatecards.convertCard(examplecards.exampleAdventureCard, false);
  expect(result).toEqual(convertedExampleAdventureCard);
});

describe.each(fnToAttributeTable)('%s properly converts %s', (convertFn, attribute) => {
  test('for standard card', () => {
    const result = updatecards[convertFn](examplecards.exampleCard);
    expect(result).toEqual(convertedExampleCard[attribute]);
  });

  test('for a double-faced card', () => {
    const result = updatecards[convertFn](examplecards.exampleDoubleFacedCard, false);
    expect(result).toEqual(convertedExampleDoubleFacedCard[attribute]);
  });

  test("for Adventure card's creature", () => {
    const result = updatecards[convertFn](examplecards.exampleAdventureCard, false);
    expect(result).toEqual(convertedExampleAdventureCard[attribute]);
  });

  test("for Adventure card's Adventure", () => {
    const result = updatecards[convertFn](examplecards.exampleAdventureCard, true);
    expect(result).toEqual(convertedExampleAdventureCardAdventure[attribute]);
  });
});

describe('convertName', () => {
  test('handles ampersands', () => {
    const card = { name: 'Kharis & the Beholder', layout: '' };
    const result = updatecards.convertName(card);
    expect(result).toBe('Kharis & the Beholder');
  });
  test('handles double quotes', () => {
    const card = { name: 'Kharis "The Beholder"', layout: '' };
    const result = updatecards.convertName(card);
    expect(result).toBe('Kharis "The Beholder"');
  });
  test('handles single quotes', () => {
    const card = { name: "Kharis 'The Beholder'", layout: '' };
    const result = updatecards.convertName(card);
    expect(result).toBe("Kharis 'The Beholder'");
  });
  test('handles angle brackets', () => {
    const card = { name: 'Kharis <The Beholder>', layout: '' };
    const result = updatecards.convertName(card);
    expect(result).toBe('Kharis <The Beholder>');
  });
  test('handles question mark', () => {
    const card = { name: 'Question Elemental?', layout: '' };
    const result = updatecards.convertName(card);
    expect(result).toBe('Question Elemental?');
  });
  test('handles multi-face (first face)', () => {
    const card = { name: 'Kharis // The Beholder', layout: 'flip' };
    const result = updatecards.convertName(card);
    expect(result).toBe('Kharis');
  });
  test('handles multi-face (second face)', () => {
    const card = { name: 'Kharis // The Beholder', layout: 'flip' };
    const result = updatecards.convertName(card, true);
    expect(result).toBe('The Beholder');
  });
  test('handles split card', () => {
    const card = { name: 'Kharis // The Beholder', layout: 'split' };
    const result = updatecards.convertName(card);
    expect(result).toBe('Kharis // The Beholder');
  });
});

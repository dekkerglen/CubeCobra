const rimraf = require("rimraf");
const updatecards = require("../../serverjs/updatecards");
const fs = require('fs');

const exampleCard = {
  object: 'card',
  id: 'a5ebb551-6b0d-45fa-88c8-3746214094f6',
  oracle_id: 'b582e485-c024-47f0-ad6f-b918d32288ba',
  multiverse_ids: [456750],
  mtgo_id: 70381,
  tcgplayer_id: 180776,
  name: 'Vexing Devil',
  lang: 'en',
  released_at: '2018-12-07',
  uri: 'https://api.scryfall.com/cards/a5ebb551-6b0d-45fa-88c8-3746214094f6',
  scryfall_uri: 'https://scryfall.com/card/uma/154/vexing-devil?utm_source=api',
  layout: 'normal',
  highres_image: true,
  image_uris: {
    small: 'https://img.scryfall.com/cards/small/front/a/5/a5ebb551-6b0d-45fa-88c8-3746214094f6.jpg?1547517462',
    normal: 'https://img.scryfall.com/cards/normal/front/a/5/a5ebb551-6b0d-45fa-88c8-3746214094f6.jpg?1547517462',
    large: 'https://img.scryfall.com/cards/large/front/a/5/a5ebb551-6b0d-45fa-88c8-3746214094f6.jpg?1547517462',
    png: 'https://img.scryfall.com/cards/png/front/a/5/a5ebb551-6b0d-45fa-88c8-3746214094f6.png?1547517462',
    art_crop: 'https://img.scryfall.com/cards/art_crop/front/a/5/a5ebb551-6b0d-45fa-88c8-3746214094f6.jpg?1547517462',
    border_crop: 'https://img.scryfall.com/cards/border_crop/front/a/5/a5ebb551-6b0d-45fa-88c8-3746214094f6.jpg?1547517462'
  },
  mana_cost: '{R}',
  cmc: 1,
  type_line: 'Creature — Devil',
  oracle_text: 'When Vexing Devil enters the battlefield, any opponent may have it deal 4 damage to them. If a player does, sacrifice Vexing Devil.',
  power: '4',
  toughness: '3',
  colors: ['R'],
  color_identity: ['R'],
  legalities: {
    standard: 'not_legal',
    future: 'not_legal',
    modern: 'legal',
    legacy: 'legal',
    pauper: 'not_legal',
    vintage: 'legal',
    penny: 'not_legal',
    commander: 'legal',
    brawl: 'not_legal',
    duel: 'legal',
    oldschool: 'not_legal'
  },
  games: ['mtgo', 'paper'],
  reserved: false,
  foil: true,
  nonfoil: true,
  oversized: false,
  promo: false,
  reprint: true,
  variation: false,
  set: 'uma',
  set_name: 'Ultimate Masters',
  set_type: 'masters',
  set_uri: 'https://api.scryfall.com/sets/2ec77b94-6d47-4891-a480-5d0b4e5c9372',
  set_search_uri: 'https://api.scryfall.com/cards/search?order=set&q=e%3Auma&unique=prints',
  scryfall_set_uri: 'https://scryfall.com/sets/uma?utm_source=api',
  rulings_uri: 'https://api.scryfall.com/cards/a5ebb551-6b0d-45fa-88c8-3746214094f6/rulings',
  prints_search_uri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Ab582e485-c024-47f0-ad6f-b918d32288ba&unique=prints',
  collector_number: '154',
  digital: false,
  rarity: 'rare',
  flavor_text: 'It\'s not any fun until someone loses an eye.',
  card_back_id: '0aeebaf5-8c7d-4636-9e82-8c27447861f7',
  artist: 'Lucas Graciano',
  artist_ids: ['ce98f39c-7cdd-47e6-a520-6c50443bb4c2'],
  illustration_id: '58c3ac80-3359-44f1-b7f3-542926fdce1f',
  border_color: 'black',
  frame: '2015',
  frame_effects: [''],
  full_art: false,
  textless: false,
  booster: true,
  story_spotlight: false,
  edhrec_rank: 7474,
  related_uris: {
    gatherer: 'https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=456750',
    tcgplayer_decks: 'https://decks.tcgplayer.com/magic/deck/search?contains=Vexing+Devil&page=1&partner=Scryfall&utm_campaign=affiliate&utm_medium=scryfall&u tm_source=scryfall',
    edhrec: 'https://edhrec.com/route/?cc=Vexing+Devil',
    mtgtop8: 'https://mtgtop8.com/search?MD_check=1&SB_check=1&cards=Vexing+Devil'
  }
}

beforeEach(() => {
  rimraf.sync("private");
});

afterEach(() => {
  rimraf.sync("private");
});

test("updateCardbase creates the expected files", () => {
  expect.assertions(7);
  var noopPromise = new Promise((resolve, reject) => {
    process.nextTick(() => {
      resolve();
    });
  });
  var downloadMock = jest.fn();
  downloadMock.mockReturnValue(noopPromise);
  updatecards.downloadDefaultCards = downloadMock;
  return updatecards.updateCardbase('__tests__/fixtures/cards_small.json').then(function() {
    expect(fs.existsSync('private/cardtree.json')).toBe(true);
    expect(fs.existsSync('private/imagedict.json')).toBe(true);
    expect(fs.existsSync('private/cardimages.json')).toBe(true);
    expect(fs.existsSync('private/names.json')).toBe(true);
    expect(fs.existsSync('private/carddict.json')).toBe(true);
    expect(fs.existsSync('private/nameToId.json')).toBe(true);
    expect(fs.existsSync('private/full_names.json')).toBe(true);
  });
});

test("addCardToCatalog", () => {
  // make internal members public, verify that they have been populated
});

test("saveAllCards", () => {
  // do in test what updateCardbase does before call to saveAllCards
  // use that as input to saveallcards for test
  // requires an unload function to be run before every test
});

test("convertCard", () => {
  const expected = {
    color_identity: ['R'],
    set: 'uma',
    collector_number: '154',
    promo: false,
    digital: false,
    border_color: 'black',
    name: 'Vexing Devil',
    name_lower: 'vexing devil',
    full_name: 'Vexing Devil [uma-154]',
    artist: 'Lucas Graciano',
    scryfall_uri: 'https://scryfall.com/card/uma/154/vexing-devil?utm_source=api',
    rarity: 'rare',
    oracle_text: 'When Vexing Devil enters the battlefield, any opponent may have it deal 4 damage to them. If a player does, sacrifice Vexing Devil.',
    _id: 'a5ebb551-6b0d-45fa-88c8-3746214094f6',
    cmc: 1,
    legalities: {
      Legacy: true,
      Modern: true,
      Standard: false,
      Pauper: false
    },
    parsed_cost: ['r'],
    colors: ['R'],
    type: 'Creature — Devil',
    tcgplayer_id: 180776,
    power: '3',
    image_small: 'https://img.scryfall.com/cards/small/front/a/5/a5ebb551-6b0d-45fa-88c8-3746214094f6.jpg?1547517462',
    image_normal: 'https://img.scryfall.com/cards/normal/front/a/5/a5ebb551-6b0d-45fa-88c8-3746214094f6.jpg?1547517462',
    art_crop: 'https://img.scryfall.com/cards/art_crop/front/a/5/a5ebb551-6b0d-45fa-88c8-3746214094f6.jpg?1547517462',
    colorcategory: 'r'
  };
  const result = updatecards.convertCard(exampleCard);
  expect(result).toEqual(expected);
});
/*
test("convertCard with isExtra", () => {
  // XXX requires DFC
  //const result = updatecards.convertCard(exampleCard, true);
});
test("convertName", () => {});
test("convertId", () => {});
test("convertLegality", () => {});
test("convertType", () => {});
test("convertColors", () => {});
test("convertParsedCost", () => {});
test("convertCmc", () => {});
*/
const rimraf = require("rimraf");
const updatecards = require("../../serverjs/updatecards");
const examplecards = require("../../fixtures/examplecards");
const fs = require('fs');

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
  return updatecards.updateCardbase('fixtures/cards_small.json').then(function() {
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
  const result = updatecards.convertCard(examplecards.exampleCard);
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
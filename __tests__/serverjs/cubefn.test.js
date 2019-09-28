const cubefn = require("../../serverjs/cubefn");
const carddb = require("../../serverjs/cards");
const cubefixture = require("../../fixtures/examplecube");
let Cube = require('../../models/cube');

const fixturesPath = "fixtures";

const exampleBasics = {
  "plains": {
    color_identity: ['W'],
    set: 'unh',
    collector_number: '136',
    promo: false,
    digital: false,
    border_color: 'black',
    name: 'Plains',
    name_lower: 'plains',
    full_name: 'Plains [unh-136]',
    artist: 'John Avon',
    scryfall_uri: 'https://scryfall.com/card/unh/136/plains?utm_source=api',
    rarity: 'common',
    oracle_text: '({T}: Add {W}.)',
    _id: '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
    cmc: 0,
    legalities: {
      Legacy: true,
      Modern: true,
      Standard: true,
      Pauper: true
    },
    parsed_cost: [''],
    colors: [],
    type: 'Basic Land — Plains',
    tcgplayer_id: 37909,
    image_small: 'https://img.scryfall.com/cards/small/front/1/d/1d7dba1c-a702-43c0-8fca-e47bbad4a00f.jpg?1565989378',
    image_normal: 'https://img.scryfall.com/cards/normal/front/1/d/1d7dba1c-a702-43c0-8fca-e47bbad4a00f.jpg?1565989378',
    art_crop: 'https://img.scryfall.com/cards/art_crop/front/1/d/1d7dba1c-a702-43c0-8fca-e47bbad4a00f.jpg?1565989378',
    colorcategory: 'l',
  },
  "mountain": {
    color_identity: ['R'],
    set: 'unh',
    collector_number: '139',
    promo: false,
    digital: false,
    border_color: 'black',
    name: 'Mountain',
    name_lower: 'mountain',
    full_name: 'Mountain [unh-139]',
    artist: 'John Avon',
    scryfall_uri: 'https://scryfall.com/card/unh/139/mountain?utm_source=api',
    rarity: 'common',
    oracle_text: '({T}: Add {R}.)',
    _id: '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
    cmc: 0,
    legalities: {
      Legacy: true,
      Modern: true,
      Standard: true,
      Pauper: true
    },
    parsed_cost: [''],
    colors: [],
    type: 'Basic Land — Mountain',
    tcgplayer_id: 37896,
    image_small: 'https://img.scryfall.com/cards/small/front/4/2/42232ea6-e31d-46a6-9f94-b2ad2416d79b.jpg?1565989372',
    image_normal: 'https://img.scryfall.com/cards/normal/front/4/2/42232ea6-e31d-46a6-9f94-b2ad2416d79b.jpg?1565989372',
    art_crop: 'https://img.scryfall.com/cards/art_crop/front/4/2/42232ea6-e31d-46a6-9f94-b2ad2416d79b.jpg?1565989372',
    colorcategory: 'l',
  },
  "forest": {
    color_identity: ['G'],
    set: 'unh',
    collector_number: '140',
    promo: false,
    digital: false,
    border_color: 'black',
    name: 'Forest',
    name_lower: 'forest',
    full_name: 'Forest [unh-140]',
    artist: 'John Avon',
    scryfall_uri: 'https://scryfall.com/card/unh/140/forest?utm_source=api',
    rarity: 'common',
    oracle_text: '({T}: Add {G}.)',
    _id: '19e71532-3f79-4fec-974f-b0e85c7fe701',
    cmc: 0,
    legalities: {
      Legacy: true,
      Modern: true,
      Standard: true,
      Pauper: true
    },
    parsed_cost: [''],
    colors: [],
    type: 'Basic Land — Forest',
    tcgplayer_id: 37859,
    image_small: 'https://img.scryfall.com/cards/small/front/1/9/19e71532-3f79-4fec-974f-b0e85c7fe701.jpg?1565989358',
    image_normal: 'https://img.scryfall.com/cards/normal/front/1/9/19e71532-3f79-4fec-974f-b0e85c7fe701.jpg?1565989358',
    art_crop: 'https://img.scryfall.com/cards/art_crop/front/1/9/19e71532-3f79-4fec-974f-b0e85c7fe701.jpg?1565989358',
    colorcategory: 'l',
  },
  "swamp": {
    color_identity: ['B'],
    set: 'unh',
    collector_number: '138',
    promo: false,
    digital: false,
    border_color: 'black',
    name: 'Swamp',
    name_lower: 'swamp',
    full_name: 'Swamp [unh-138]',
    artist: 'John Avon',
    scryfall_uri: 'https://scryfall.com/card/unh/138/swamp?utm_source=api',
    rarity: 'common',
    oracle_text: '({T}: Add {B}.)',
    _id: '8365ab45-6d78-47ad-a6ed-282069b0fabc',
    cmc: 0,
    legalities: {
      Legacy: true,
      Modern: true,
      Standard: true,
      Pauper: true
    },
    parsed_cost: [''],
    colors: [],
    type: 'Basic Land — Swamp',
    tcgplayer_id: 37935,
    image_small: 'https://img.scryfall.com/cards/small/front/8/3/8365ab45-6d78-47ad-a6ed-282069b0fabc.jpg?1565989387',
    image_normal: 'https://img.scryfall.com/cards/normal/front/8/3/8365ab45-6d78-47ad-a6ed-282069b0fabc.jpg?1565989387',
    art_crop: 'https://img.scryfall.com/cards/art_crop/front/8/3/8365ab45-6d78-47ad-a6ed-282069b0fabc.jpg?1565989387',
    colorcategory: 'l',
  },
  "island": {
    color_identity: ['U'],
    set: 'unh',
    collector_number: '137',
    promo: false,
    digital: false,
    border_color: 'black',
    name: 'Island',
    name_lower: 'island',
    full_name: 'Island [unh-137]',
    artist: 'John Avon',
    scryfall_uri: 'https://scryfall.com/card/unh/137/island?utm_source=api',
    rarity: 'common',
    oracle_text: '({T}: Add {U}.)',
    _id: '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
    cmc: 0,
    legalities: {
      Legacy: true,
      Modern: true,
      Standard: true,
      Pauper: true
    },
    parsed_cost: [''],
    colors: [],
    type: 'Basic Land — Island',
    tcgplayer_id: 37875,
    image_small: 'https://img.scryfall.com/cards/small/front/0/c/0c4eaecf-dd4c-45ab-9b50-2abe987d35d4.jpg?1565989364',
    image_normal: 'https://img.scryfall.com/cards/normal/front/0/c/0c4eaecf-dd4c-45ab-9b50-2abe987d35d4.jpg?1565989364',
    art_crop: 'https://img.scryfall.com/cards/art_crop/front/0/c/0c4eaecf-dd4c-45ab-9b50-2abe987d35d4.jpg?1565989364',
    colorcategory: 'l',
  }
};

beforeEach(() => {});

afterEach(() => {});

test("get_cube_id returns urlAlias when defined", () => {
  const testCube = {
    urlAlias: "a",
    shortID: "bbb",
    _id: "c"
  };
  const result = cubefn.get_cube_id(testCube);
  expect(result).toBe(testCube.urlAlias);
});

test("get_cube_id returns shortId when urlAlias is not present", () => {
  const testCube = {
    shortID: "bbb",
    _id: "c"
  };
  const result = cubefn.get_cube_id(testCube);
  expect(result).toBe(testCube.shortID);
});

test("get_cube_id returns _id when other ID fields are not present", () => {
  const testCube = {
    _id: "c"
  };
  const result = cubefn.get_cube_id(testCube);
  expect(result).toBe(testCube._id);
});

test("build_id_query returns a simple query when passed a 24-character alphanumeric string", () => {
  const testId = "a1a1a1a1a1a1a1a1a1a1a1a1";
  const result = cubefn.build_id_query(testId);
  expect(result._id).toBe(testId);
});

test("build_id_query returns a boolean query when passed a non-alphanumeric string", () => {
  const testId = "a1a-a1a1a1a1a1a1a1a1a1a1";
  const result = cubefn.build_id_query(testId);
  const condition = result["$or"];
  expect(condition.length).toBe(2);
  expect(condition[0].shortID).toBe(testId);
  expect(condition[1].urlAlias).toBe(testId);
});

test("cardsAreEquivalent returns true for two equivalent cards", () => {
  const testCard1 = {
    cardID: "abcdef",
    status: "Owned",
    cmc: 1,
    type_line: "Creature - Hound",
    tags: ["New"],
    colors: ["W"],
    randomField: "y"
  };
  const testCard2 = JSON.parse(JSON.stringify(testCard1));
  const result = cubefn.cardsAreEquivalent(testCard1, testCard2);
  expect(result).toBe(true);
});

test("cardsAreEquivalent returns false for two nonequivalent cards", () => {
  const testCard1 = {
    cardID: "abcdef",
    status: "Owned",
    cmc: 1,
    type_line: "Creature - Hound",
    tags: ["New"],
    colors: ["W"],
    randomField: "y"
  };
  const testCard2 = JSON.parse(JSON.stringify(testCard1));
  testCard2.cmc = 2;
  const result = cubefn.cardsAreEquivalent(testCard1, testCard2);
  expect(result).toBe(false);
});

test("intToLegality returns the expected values", () => {
  expect(cubefn.intToLegality(0)).toBe("Vintage");
  expect(cubefn.intToLegality(1)).toBe("Legacy");
  expect(cubefn.intToLegality(2)).toBe("Modern");
  expect(cubefn.intToLegality(3)).toBe("Standard");
  expect(cubefn.intToLegality(4)).toBe(undefined);
});

test("legalityToInt returns the expected values", () => {
  expect(cubefn.legalityToInt("Vintage")).toBe(0);
  expect(cubefn.legalityToInt("Legacy")).toBe(1);
  expect(cubefn.legalityToInt("Modern")).toBe(2);
  expect(cubefn.legalityToInt("Standard")).toBe(3);
  expect(cubefn.legalityToInt("not a format")).toBe(undefined);
});

test("generate_short_id returns a valid short ID", async () => {
  var dummyModel = {
    "shortID": "1x",
    "urlAlias": "a real alias"
  };
  var queryMockPromise = new Promise((resolve, reject) => {
    process.nextTick(() => {
      resolve([dummyModel]);
    });
  });
  var queryMock = jest.fn();
  queryMock.mockReturnValue(queryMockPromise);
  var initialCubeFind = Cube.find;
  Cube.find = queryMock;
  var result = await cubefn.generate_short_id();
  expect(result).toBe("1y");
  Cube.find = initialCubeFind;
});

test("getBasics returns the expected set of basic lands", () => {
  const basicLands = ["Plains", "Island", "Swamp", "Mountain", "Forest"];
  const mockNameToId = {
    'plains': ['1d7dba1c-a702-43c0-8fca-e47bbad4a00f'],
    'mountain': ['42232ea6-e31d-46a6-9f94-b2ad2416d79b'],
    'forest': ['19e71532-3f79-4fec-974f-b0e85c7fe701'],
    'swamp': ['8365ab45-6d78-47ad-a6ed-282069b0fabc'],
    'island': ['0c4eaecf-dd4c-45ab-9b50-2abe987d35d4']
  };
  const expectedDisplayImages = {
    'plains': "https://img.scryfall.com/cards/normal/front/1/d/1d7dba1c-a702-43c0-8fca-e47bbad4a00f.jpg?1565989378",
    'mountain': "https://img.scryfall.com/cards/normal/front/4/2/42232ea6-e31d-46a6-9f94-b2ad2416d79b.jpg?1565989372",
    'forest': "https://img.scryfall.com/cards/normal/front/1/9/19e71532-3f79-4fec-974f-b0e85c7fe701.jpg?1565989358",
    'swamp': "https://img.scryfall.com/cards/normal/front/8/3/8365ab45-6d78-47ad-a6ed-282069b0fabc.jpg?1565989387",
    'island': "https://img.scryfall.com/cards/normal/front/0/c/0c4eaecf-dd4c-45ab-9b50-2abe987d35d4.jpg?1565989364"
  };
  var mockCarddict = {};
  var expected = {};
  var exampleLand, expectedLandObject;
  basicLands.forEach(function(name) {
    mockCarddict[mockNameToId[name.toLowerCase()]] = exampleBasics[name.toLowerCase()];
    exampleLand = exampleBasics[name.toLowerCase()];
    expectedLandObject = {
      // copy necessary because getBasics modifies carddb (bad)
      'details': JSON.parse(JSON.stringify(exampleLand))
    };
    expectedLandObject.details.display_image = expectedDisplayImages[name.toLowerCase()];
    expected[name] = expectedLandObject;
  });
  const initialCarddict = carddb._carddict;
  const initialNameToId = carddb.nameToId;

  carddb._carddict = mockCarddict;
  carddb.nameToId = mockNameToId;

  const result = cubefn.getBasics(carddb);
  expect(result).toEqual(expected);
  basicLands.forEach(function(name) {
    expect(result[name].details).toEqual(expected[name].details);
  });

  carddb._carddict = initialCarddict;
  carddb.nameToId = initialNameToId;
});

test("selectionContainsCard", () => {});

test("setCubeType correctly sets the type and card_count of its input cube", () => {
  expect.assertions(2);
  var exampleCube = JSON.parse(JSON.stringify(cubefixture.exampleCube));
  var promise = carddb.initializeCardDb(fixturesPath, true);
  return promise.then(function() {
    var result = cubefn.setCubeType(exampleCube, carddb);
    expect(result.card_count).toBe(exampleCube.cards.length);
    expect(result.type).toBe("Vintage");
  });
});

test("sanitize", () => {});
test("addAutocard", () => {});
test("generatePack", () => {});
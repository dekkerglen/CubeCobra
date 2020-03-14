const sinon = require('sinon');
const cubefn = require('../../serverjs/cubefn');
const carddb = require('../../serverjs/cards');
const util = require('../../serverjs/util');
const cubefixture = require('../../fixtures/examplecube');
const landsfixture = require('../../fixtures/examplelands');
const Cube = require('../../models/cube');

const fixturesPath = 'fixtures';

beforeEach(() => {
  sinon.stub(Cube, 'findOne');
});

afterEach(() => {
  Cube.findOne.restore();
  carddb.unloadCardDb();
});

test('getCubeId returns urlAlias when defined', () => {
  const testCube = {
    urlAlias: 'a',
    shortID: 'bbb',
    _id: 'c',
  };
  const result = cubefn.getCubeId(testCube);
  expect(result).toBe(testCube.urlAlias);
});

test('getCubeId returns shortId when urlAlias is not present', () => {
  const testCube = {
    shortID: 'bbb',
    _id: 'c',
  };
  const result = cubefn.getCubeId(testCube);
  expect(result).toBe(testCube.shortID);
});

test('getCubeId returns _id when other ID fields are not present', () => {
  const testCube = {
    _id: 'c',
  };
  const result = cubefn.getCubeId(testCube);
  expect(result).toBe(testCube._id);
});

test('buildIdQuery returns a simple query when passed a 24-character alphanumeric string', () => {
  const testId = 'a1a1a1a1a1a1a1a1a1a1a1a1';
  const result = cubefn.buildIdQuery(testId);
  expect(result._id).toBe(testId);
});

test('buildIdQuery returns a boolean query when passed a non-alphanumeric string', () => {
  const testId = 'a1a-a1a1a1a1a1a1a1a1a1a1';
  const result = cubefn.buildIdQuery(testId);
  const condition = result.$or;
  expect(condition.length).toBe(2);
  expect(condition[0].shortID).toBe(testId);
  expect(condition[1].urlAlias).toBe(testId);
});

test('cardsAreEquivalent returns true for two equivalent cards', () => {
  const testCard1 = {
    cardID: 'abcdef',
    status: 'Owned',
    cmc: 1,
    type_line: 'Creature - Hound',
    tags: ['New'],
    colors: ['W'],
    randomField: 'y',
    finish: 'Foil',
  };
  const testCard2 = JSON.parse(JSON.stringify(testCard1));
  const result = cubefn.cardsAreEquivalent(testCard1, testCard2);
  expect(result).toBe(true);
});

test('cardsAreEquivalent returns false for two nonequivalent cards', () => {
  const testCard1 = {
    cardID: 'abcdef',
    status: 'Owned',
    cmc: 1,
    type_line: 'Creature - Hound',
    tags: ['New'],
    colors: ['W'],
    randomField: 'y',
  };
  const testCard2 = JSON.parse(JSON.stringify(testCard1));
  testCard2.cmc = 2;
  const result = cubefn.cardsAreEquivalent(testCard1, testCard2);
  expect(result).toBe(false);
});

test('intToLegality returns the expected values', () => {
  expect(cubefn.intToLegality(0)).toBe('Vintage');
  expect(cubefn.intToLegality(1)).toBe('Legacy');
  expect(cubefn.intToLegality(2)).toBe('Modern');
  expect(cubefn.intToLegality(3)).toBe('Pioneer');
  expect(cubefn.intToLegality(4)).toBe('Standard');
  expect(cubefn.intToLegality(5)).toBe(undefined);
});

test('legalityToInt returns the expected values', () => {
  expect(cubefn.legalityToInt('Vintage')).toBe(0);
  expect(cubefn.legalityToInt('Legacy')).toBe(1);
  expect(cubefn.legalityToInt('Modern')).toBe(2);
  expect(cubefn.legalityToInt('Pioneer')).toBe(3);
  expect(cubefn.legalityToInt('Standard')).toBe(4);
  expect(cubefn.legalityToInt('not a format')).toBe(undefined);
});

test('generateShortId returns a valid short ID', async () => {
  const dummyModel = {
    shortID: '1x',
    urlAlias: 'a real alias',
  };
  const queryMockPromise = new Promise((resolve) => {
    process.nextTick(() => {
      resolve([dummyModel]);
    });
  });
  const queryMock = jest.fn();
  queryMock.mockReturnValue(queryMockPromise);
  const initialCubeFind = Cube.find;
  Cube.find = queryMock;
  const result = await cubefn.generateShortId();
  expect(result).toBe('1y');
  Cube.find = initialCubeFind;
});

test('generateShortId returns a valid short ID with profanity', async () => {
  const dummyModel = {
    shortID: '1x',
    urlAlias: 'a real alias',
  };
  const queryMockPromise = new Promise((resolve) => {
    process.nextTick(() => {
      resolve([dummyModel]);
    });
  });
  const queryMock = jest.fn().mockReturnValue(queryMockPromise);
  const initialCubeFind = Cube.find;
  Cube.find = queryMock;
  const initialHasProfanity = util.hasProfanity;
  const mockHasProfanity = jest
    .fn()
    .mockReturnValue(false)
    .mockReturnValueOnce(true);
  util.hasProfanity = mockHasProfanity;
  const result = await cubefn.generateShortId();
  expect(result).toBe('1z');
  Cube.find = initialCubeFind;
  util.hasProfanity = initialHasProfanity;
});

test('getBasics returns the expected set of basic lands', () => {
  const basicLands = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
  const mockNameToId = {
    plains: ['1d7dba1c-a702-43c0-8fca-e47bbad4a00f'],
    mountain: ['42232ea6-e31d-46a6-9f94-b2ad2416d79b'],
    forest: ['19e71532-3f79-4fec-974f-b0e85c7fe701'],
    swamp: ['8365ab45-6d78-47ad-a6ed-282069b0fabc'],
    island: ['0c4eaecf-dd4c-45ab-9b50-2abe987d35d4'],
  };
  const expectedDisplayImages = {
    plains: 'https://img.scryfall.com/cards/normal/front/1/d/1d7dba1c-a702-43c0-8fca-e47bbad4a00f.jpg?1565989378',
    mountain: 'https://img.scryfall.com/cards/normal/front/4/2/42232ea6-e31d-46a6-9f94-b2ad2416d79b.jpg?1565989372',
    forest: 'https://img.scryfall.com/cards/normal/front/1/9/19e71532-3f79-4fec-974f-b0e85c7fe701.jpg?1565989358',
    swamp: 'https://img.scryfall.com/cards/normal/front/8/3/8365ab45-6d78-47ad-a6ed-282069b0fabc.jpg?1565989387',
    island: 'https://img.scryfall.com/cards/normal/front/0/c/0c4eaecf-dd4c-45ab-9b50-2abe987d35d4.jpg?1565989364',
  };
  const mockCarddict = {};
  const expected = {};
  let exampleLand;
  let expectedLandObject;
  for (const name of basicLands) {
    mockCarddict[mockNameToId[name.toLowerCase()]] = landsfixture.exampleBasics[name.toLowerCase()];
    exampleLand = landsfixture.exampleBasics[name.toLowerCase()];
    const details = JSON.parse(JSON.stringify(exampleLand));
    expectedLandObject = {
      // copy necessary because getBasics modifies carddb (bad)
      type_line: details.type,
      cmc: 0,
      cardID: mockNameToId[name.toLowerCase()][0],
      details,
    };
    expectedLandObject.details.image_normal = expectedDisplayImages[name.toLowerCase()];
    expected[name] = expectedLandObject;
  }
  const initialCarddict = carddb._carddict;
  const initialNameToId = carddb.nameToId;

  carddb._carddict = mockCarddict;
  carddb.nameToId = mockNameToId;

  const result = cubefn.getBasics(carddb);
  expect(result).toEqual(expected);
  for (const name of basicLands) {
    expect(result[name].details).toEqual(expected[name].details);
  }

  carddb._carddict = initialCarddict;
  carddb.nameToId = initialNameToId;
});

test('setCubeType correctly sets the type and card_count of its input cube', () => {
  expect.assertions(4);
  const exampleCube = JSON.parse(JSON.stringify(cubefixture.exampleCube));
  const promise = carddb.initializeCardDb(fixturesPath, true);
  return promise.then(() => {
    const result = cubefn.setCubeType(exampleCube, carddb);
    expect(result.card_count).toBe(exampleCube.cards.length);
    expect(result.type).toBe('Standard');
    expect(exampleCube.card_count).toBe(exampleCube.cards.length);
    expect(exampleCube.type).toBe('Standard');
  });
});

test('sanitize allows the correct tags', () => {
  const exampleHtml =
    '<html><head></head><body><div>lkgdfsge</div><strong>kjggggsgggg</strong><ol><li>gfgwwerer</li></ol></body></html>';
  const expected = '<div>lkgdfsge</div><strong>kjggggsgggg</strong><ol><li>gfgwwerer</li></ol>';
  const result = cubefn.sanitize(exampleHtml);
  expect(result).toBe(expected);
});

test('addAutocard correctly replaces autocard format strings', () => {
  expect.assertions(1);
  const promise = carddb.initializeCardDb(fixturesPath, true);
  return promise.then(() => {
    const exampleHtml = '<div>lkgdfsge</div><strong>[[Embercleave]]</strong><ol><li>gfgwwerer</li></ol>';
    const expected =
      '<div>lkgdfsge</div><strong><a class="autocard" card="https://img.scryfall.com/cards/normal/front/a/a/aaae15dd-11b6-4421-99e9-365c7fe4a5d6.jpg?1572490333">Embercleave</a></strong><ol><li>gfgwwerer</li></ol>';
    const result = cubefn.addAutocard(exampleHtml, carddb);
    expect(result).toBe(expected);
  });
});

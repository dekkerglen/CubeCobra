const sinon = require('sinon');

const cubefn = require('../../serverjs/cubefn');
const util = require('../../serverjs/util');

const cubefixture = require('../../fixtures/examplecube');
const landsfixture = require('../../fixtures/examplelands');

const Cube = require('../../models/cube');

const { arraysEqual } = require('../../src/utils/Util.js');

const fixturesPath = 'fixtures';

beforeEach(() => {
  sinon.stub(Cube, 'findOne');
});

afterEach(() => {
  Cube.findOne.restore();
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

test('sanitize allows the correct tags', () => {
  const exampleHtml =
    '<html><head></head><body><div>lkgdfsge</div><strong>kjggggsgggg</strong><ol><li>gfgwwerer</li></ol></body></html>';
  const expected = '<div>lkgdfsge</div><strong>kjggggsgggg</strong><ol><li>gfgwwerer</li></ol>';
  const result = cubefn.sanitize(exampleHtml);
  expect(result).toBe(expected);
});

const util = require('../../serverjs/util');

beforeEach(() => {});

afterEach(() => {});

test('shuffle returns an array when called without a seed', () => {
  const arrayToShuffle = [1, 2, 3, 4, 5, 6];
  const result = util.shuffle(arrayToShuffle);
  expect(result.length).toBe(arrayToShuffle.length);
});

test('shuffle returns an array when called with a seed', () => {
  const arrayToShuffle = [1, 2, 3, 4, 5, 6];
  const result = util.shuffle(arrayToShuffle, Date.now());
  expect(result.length).toBe(arrayToShuffle.length);
});

test('turnToTree returns a valid prefix tree', () => {
  const arrayToTree = ['tes', 'trail', 'another'];
  const result = util.turnToTree(arrayToTree);
  expect(Object.keys(result).length).toBe(2);
  expect(Object.keys(result.t).length).toBe(2);
  expect(Object.keys(result.a).length).toBe(1);
});

test('binaryInsert inserts to an empty array', () => {
  const testArray = [];
  const initialLength = testArray.length;
  const testValue = 1;
  util.binaryInsert(testValue, testArray);
  expect(testArray.length).toBe(initialLength + 1);
  expect(testArray[0]).toBe(testValue);
});

test('binaryInsert inserts new maximum correctly to a sorted array', () => {
  const testArray = [1, 2, 3, 4];
  const initialLength = testArray.length;
  const testValue = 5;
  util.binaryInsert(testValue, testArray);
  expect(testArray.length).toBe(initialLength + 1);
  expect(testArray[testArray.length - 1]).toBe(testValue);
});

test('binaryInsert inserts new minimum correctly to a sorted array', () => {
  const testArray = [1, 2, 3, 4];
  const initialLength = testArray.length;
  const testValue = 0;
  util.binaryInsert(testValue, testArray);
  expect(testArray.length).toBe(initialLength + 1);
  expect(testArray[0]).toBe(testValue);
});

test('binaryInsert inserts new median correctly to a sorted array', () => {
  const testArray = [1, 2, 4, 5];
  const initialLength = testArray.length;
  const testValue = 3;
  util.binaryInsert(testValue, testArray);
  expect(testArray.length).toBe(initialLength + 1);
  expect(testArray[initialLength / 2]).toBe(testValue);
});

test('binaryInsert does not fail when input array is unsorted', () => {
  const testArray = [1, 2, 9, 4];
  const initialLength = testArray.length;
  const testValue = 5;
  util.binaryInsert(testValue, testArray);
  expect(testArray.length).toBe(initialLength + 1);
});

test('addCardToCube adds a well-formed object', () => {
  const testCube = {
    cards: [],
  };
  const initialLength = testCube.cards.length;
  const testCard = {
    color_identity: 'W',
    cmc: 1,
    _id: 'abcdef',
    type: 'creature',
  };
  util.addCardToCube(testCube, testCard);
  expect(testCube.cards.length).toBe(initialLength + 1);
  const result = testCube.cards[0];
  expect(result.tags.length).toBe(0);
  expect(result.status).toBe('Owned');
  expect(result.finish).toBe('Non-foil');
  expect(result.colors).toBe(testCard.color_identity);
  expect(result.cmc).toBe(testCard.cmc);
  expect(result.cardID).toBe(testCard._id);
  expect(result.type_line).toBe(testCard.type);
  expect(result.imgUrl).toBe(undefined);
});

test('addCardToCube declines to add invalid card', () => {
  const testCube = {
    cards: [],
  };
  const initialLength = testCube.cards.length;
  const testCard = {
    error: true,
  };
  util.addCardToCube(testCube, testCard);
  expect(testCube.cards.length).toBe(initialLength);
});

test('addCardToCube allows custom tags', () => {
  const testCube = {
    cards: [],
  };
  const initialLength = testCube.cards.length;
  const testCard = {
    color_identity: 'W',
    cmc: 1,
    _id: 'abcdef',
    type: 'creature',
  };
  util.addCardToCube(testCube, testCard, ['Tag']);
  expect(testCube.cards.length).toBe(initialLength + 1);
  const result = testCube.cards[0];
  expect(result.tags.length).toBe(1);
  expect(result.tags[0]).toBe('Tag');
});

test('getCardImageURL returns imgUrl when defined', () => {
  const testCard = {
    details: {
      image_normal: 'normal ol image',
    },
    imgUrl: 'an image url',
  };
  const result = util.getCardImageURL(testCard);
  expect(result).toBe(testCard.imgUrl);
});

test('getCardImageURL falls back to image_normal', () => {
  const testCard = {
    details: {
      image_normal: 'normal ol image',
    },
  };
  const result = util.getCardImageURL(testCard);
  expect(result).toBe(testCard.details.image_normal);
});

test('arraysEqual returns true for equal arrays', () => {
  const testArrayA = [1, 2, 3, 4];
  const testArrayB = [1, 2, 3, 4];
  const result = util.arraysEqual(testArrayA, testArrayB);
  expect(result).toBe(true);
});

test('arraysEqual returns false for unequal arrays', () => {
  const testArrayA = [1, 2, 3, 5];
  const testArrayB = [1, 2, 3, 4];
  const result = util.arraysEqual(testArrayA, testArrayB);
  expect(result).toBe(false);
});

test('CSVtoArray returns an array of the correct length when commas are included in values', () => {
  const testCSV = '"a,g","b","c"';
  const result = util.CSVtoArray(testCSV);
  expect(result.length).toBe(3);
});

test('generateEditToken does not generate the same token on sequential calls', () => {
  const firstResult = util.generateEditToken();
  const secondResult = util.generateEditToken();
  expect(firstResult).not.toBe(secondResult);
});

test('toBase36 returns the base36 representation of its input', () => {
  const testInput = 69;
  const expected = testInput.toString(36);
  const result = util.toBase36(testInput);
  expect(result).toBe(expected);
});

test('fromBase36 returns the base10 int representation of its input', () => {
  const testInt = 69;
  const testInput = testInt.toString(36);
  const expected = parseInt(testInput, 36);
  const result = util.fromBase36(testInput);
  expect(result).toBe(expected);
});

test('hasProfanity returns true for strings containing profanity', () => {
  const testString = 'the quick brown fox jumped over the lazy ass dog';
  const result = util.hasProfanity(testString);
  expect(result).toBe(true);
});

test('hasProfanity returns false for strings not containing profanity', () => {
  const testString = 'the quick brown fox jumped over the lazy dog';
  const result = util.hasProfanity(testString);
  expect(result).toBe(false);
});

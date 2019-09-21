const util = require("../../serverjs/util");

beforeEach(() => {});

afterEach(() => {});

test("shuffle returns an array when called without a seed", () => {
  const arrayToShuffle = [1, 2, 3, 4, 5, 6];
  const result = util.shuffle(arrayToShuffle);
  expect(result.length).toBe(arrayToShuffle.length);
});

test("shuffle returns an array when called with a seed", () => {
  const arrayToShuffle = [1, 2, 3, 4, 5, 6];
  const result = util.shuffle(arrayToShuffle, Date.now());
  expect(result.length).toBe(arrayToShuffle.length);
});

test("turnToTree returns a valid prefix tree", () => {
  const arrayToTree = ["tes", "trail", "another"];
  const result = util.turnToTree(arrayToTree);
  expect(Object.keys(result).length).toBe(2);
  expect(Object.keys(result.t).length).toBe(2);
  expect(Object.keys(result.a).length).toBe(1);
});

test("binaryInsert inserts to an empty array", () => {
  var testArray = [];
  var initialLength = testArray.length;
  var testValue = 1;
  util.binaryInsert(testValue, testArray);
  expect(testArray.length).toBe(initialLength + 1);
  expect(testArray[0]).toBe(testValue);
});

test("binaryInsert inserts new maximum correctly to a sorted array", () => {
  var testArray = [1, 2, 3, 4];
  var initialLength = testArray.length;
  var testValue = 5;
  util.binaryInsert(testValue, testArray);
  expect(testArray.length).toBe(initialLength + 1);
  expect(testArray[testArray.length - 1]).toBe(testValue);
});

test("binaryInsert inserts new minimum correctly to a sorted array", () => {
  var testArray = [1, 2, 3, 4];
  var initialLength = testArray.length;
  var testValue = 0;
  util.binaryInsert(testValue, testArray);
  expect(testArray.length).toBe(initialLength + 1);
  expect(testArray[0]).toBe(testValue);
});

test("binaryInsert inserts new median correctly to a sorted array", () => {
  var testArray = [1, 2, 4, 5];
  var initialLength = testArray.length;
  var testValue = 3;
  util.binaryInsert(testValue, testArray);
  expect(testArray.length).toBe(initialLength + 1);
  expect(testArray[initialLength / 2]).toBe(testValue);
});

test("binaryInsert does not fail when input array is unsorted", () => {
  var testArray = [1, 2, 9, 4];
  var initialLength = testArray.length;
  var testValue = 5;
  util.binaryInsert(testValue, testArray);
  expect(testArray.length).toBe(initialLength + 1);
});

test("addCardToCube adds a well-formed object", () => {
  var testCube = {
    "cards": []
  };
  var initialLength = testCube.cards.length;
  const testCard = {
    color_identity: "W",
    cmc: 1,
    _id: "abcdef",
    type: "creature"
  };
  const addedTmsp = new Date();
  util.addCardToCube(testCube, testCard, undefined, addedTmsp);
  expect(testCube.cards.length).toBe(initialLength + 1);
  const result = testCube.cards[0];
  expect(result.tags.length).toBe(1);
  expect(result.tags[0]).toBe("New");
  expect(result.status).toBe("Not Owned");
  expect(result.colors).toBe(testCard.color_identity);
  expect(result.cmc).toBe(testCard.cmc);
  expect(result.cardID).toBe(testCard._id);
  expect(result.type_line).toBe(testCard.type);
  expect(result.addedTmsp).toBe(addedTmsp);
  expect(result.imgUrl).toBe(undefined);
});

test("addCardToCube allows card id to be overridden", () => {
  var testCube = {
    "cards": []
  };
  var initialLength = testCube.cards.length;
  const testCard = {
    color_identity: "W",
    cmc: 1,
    _id: "abcdef",
    type: "creature"
  };
  const addedTmsp = new Date();
  const idOverride = "new id ___";
  util.addCardToCube(testCube, testCard, idOverride, addedTmsp);
  expect(testCube.cards.length).toBe(initialLength + 1);
  const result = testCube.cards[0];
  expect(result.cardID).toBe(idOverride);
});

test("getCardImageURL returns imgUrl when defined", () => {
  const testCard = {
    details: {
      image_normal: "normal ol image"
    },
    imgUrl: "an image url"
  };
  const result = util.getCardImageURL(testCard);
  expect(result).toBe(testCard.imgUrl);
});

test("getCardImageURL falls back to image_normal", () => {
  const testCard = {
    details: {
      image_normal: "normal ol image"
    }
  };
  const result = util.getCardImageURL(testCard);
  expect(result).toBe(testCard.details.image_normal);
});

test("arraysEqual returns true for equal arrays", () => {
  const testArrayA = [1, 2, 3, 4];
  const testArrayB = [1, 2, 3, 4];
  const result = util.arraysEqual(testArrayA, testArrayB);
  expect(result).toBe(true);
});

test("arraysEqual returns false for unequal arrays", () => {
  const testArrayA = [1, 2, 3, 5];
  const testArrayB = [1, 2, 3, 4];
  const result = util.arraysEqual(testArrayA, testArrayB);
  expect(result).toBe(false);
});

test("CSVtoArray returns an array of the correct length when commas are included in values", () => {
  const testCSV = '"a,g","b","c"';
  const result = util.CSVtoArray(testCSV);
  expect(result.length).toBe(3);
});

test("generate_edit_token does not generate the same token on sequential calls", () => {
  const firstResult = util.generate_edit_token();
  const secondResult = util.generate_edit_token();
  expect(firstResult).not.toBe(secondResult);
});

test("to_base_36 returns the base36 representation of its input", () => {
  const testInput = 69;
  const expected = testInput.toString(36);
  const result = util.to_base_36(testInput);
  expect(result).toBe(expected);
});

test("from_base_36 returns the base10 int representation of its input", () => {
  const testInt = 69;
  const testInput = testInt.toString(36);
  const expected = parseInt(testInput, 36);
  const result = util.from_base_36(testInput);
  expect(result).toBe(expected);
});

test("has_profanity returns true for strings containing profanity", () => {
  const testString = "the quick brown fox jumped over the lazy ass dog";
  const result = util.has_profanity(testString);
  expect(result).toBe(true);
});

test("has_profanity returns false for strings not containing profanity", () => {
  const testString = "the quick brown fox jumped over the lazy dog";
  const result = util.has_profanity(testString);
  expect(result).toBe(false);
});
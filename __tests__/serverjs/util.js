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
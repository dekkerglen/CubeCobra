var sinon = require("sinon");

const util = require("../../serverjs/util");

beforeEach(() => {
});

afterEach(() => {
});

test("shuffle returns an array when called without a seed", () => {
    const arrayToShuffle = [1,2,3,4,5,6];
    const result = util.shuffle(arrayToShuffle);
    expect(result.length).toBe(arrayToShuffle.length);
});

test("shuffle returns an array when called with a seed", () => {
    const arrayToShuffle = [1,2,3,4,5,6];
    const result = util.shuffle(arrayToShuffle, Date.now());
    expect(result.length).toBe(arrayToShuffle.length);
});

test("turnToTree", () => {
    const arrayToTree = ["tes", "trail", "another"];
    const result = util.turnToTree(arrayToTree);
    expect(Object.keys(result).length).toBe(2);
    expect(Object.keys(result.t).length).toBe(2);
    expect(Object.keys(result.a).length).toBe(1);
});

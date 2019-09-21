const carddb = require("../../serverjs/cards");

beforeEach(() => {});

afterEach(() => {});

test("initializeCardDb loads files properly", () => {
  expect.assertions(1);
  var fixtureCardCount = 100;
  var firstLetterCount = 21;
  var promise = carddb.initializeCardDb("__tests__/fixtures");
  return promise.then(function() {
    expect(Object.keys(carddb.cardtree).length).toBe(firstLetterCount);
    expect(Object.keys(carddb.imagedict).length).toBe(fixtureCardCount);
    expect(Object.keys(carddb.cardimages).length).toBe(fixtureCardCount);
    expect(carddb.cardnames.length).toBe(fixtureCardCount);
    expect(carddb.full_names.length).toBe(fixtureCardCount);
    expect(Object.keys(carddb.nameToId).length).toBe(fixtureCardCount);
  });
});
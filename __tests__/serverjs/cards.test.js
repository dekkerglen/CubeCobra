const carddb = require("../../serverjs/cards");

beforeEach(() => {});

afterEach(() => {});

test("stub", () => {
  expect.assertions(1);
  var promise = carddb.initializeCardDb("__tests__/fixtures");
  return promise.then(function() {
    expect(carddb.cardnames.length).toBe(100);
  });
});
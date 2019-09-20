const carddb = require("../../serverjs/cards");

beforeEach(() => {});

afterEach(() => {});

test("stub", () => {
  expect.assertions(2);
  var promise = carddb.initializeCardDb("__tests__/fixtures");
  return promise.then(function() {
    expect(carddb.cardnames).not.toBe(undefined);
    expect(carddb.cardnames.length).not.toBe(0);
  });
});
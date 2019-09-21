const updatecards = require("../../serverjs/updatecards");
const fs = require('fs');

test("updateCardBase", () => {
  expect.assertions(1);
  var promise = new Promise((resolve, reject) => {
    process.nextTick(() => {
      resolve();
    });
  });
  var downloadMock = jest.fn();
  downloadMock.mockReturnValue(promise);
  updatecards.downloadDefaultCards = downloadMock;
  return updatecards.updateCardbase('__tests__/fixtures/cards_small.json').then(function() {
    const exists = fs.existsSync('private/imagedict.json');
    expect(exists).toBe(true);
  });
});
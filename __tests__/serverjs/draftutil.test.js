const methods = require("../../serverjs/draftutil");

test("it can get the correct number of draft bots", () => {
  const params = {
    seats: 5
  };
  const result = methods.getDraftBots(params);

  // The number of bots should be number of seats - 1
  expect(result.length).toBe(4);
});

test("it can get bots with the correct properties", () => {
  const params = {
    seats: 2
  };
  const result = methods.getDraftBots(params);

  // Bots should have two random colors selected
  expect(result[0].length).toBe(2);
  expect(
    result[0][0] == "W" ||
      result[0][0] == "U" ||
      result[0][0] == "B" ||
      result[0][0] == "R" ||
      result[0][0] == "G"
  ).toBe(true);
  expect(
    result[0][1] == "W" ||
      result[0][1] == "U" ||
      result[0][1] == "B" ||
      result[0][1] == "R" ||
      result[0][1] == "G"
  ).toBe(true);
});

test("it returns the index of the first instance of a tag from a list of cards", () => {
  const cards = [{}, {}, { tags: ["test"] }, { tags: ["test"] }];
  const tag = "TEST";
  const result = methods.indexOfTag(cards, tag);

  expect(result).toBe(2);
});

test("it returns -1 if a tag is not found in a list of cards", () => {
  const cards = [{}, {}];
  const tag = "TEST";
  const result = methods.indexOfTag(cards, tag);

  expect(result).toBe(-1);
});

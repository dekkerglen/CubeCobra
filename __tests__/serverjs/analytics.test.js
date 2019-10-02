const analytics = require("../../serverjs/analytics");

beforeEach(() => {});

afterEach(() => {});

test("GetColorCat returns the expected results", () => {
  expect(analytics.GetColorCat('land', [])).toBe('l');
  expect(analytics.GetColorCat('creature', [])).toBe('c');
  expect(analytics.GetColorCat('creature', ['G', 'R'])).toBe('m');
  expect(analytics.GetColorCat('creature', ['G'])).toBe('g');
});

test("GetColorIdentity returns the expected results", () => {
  expect(analytics.GetColorIdentity([])).toBe('Colorless');
  expect(analytics.GetColorIdentity(["G", "R"])).toBe('Multicolored');
  expect(analytics.GetColorIdentity(["G"])).toBe('Green');
});

test("GetTypeByColor", () => {});
test("GetColorCounts", () => {});
test("GetCurve", () => {});
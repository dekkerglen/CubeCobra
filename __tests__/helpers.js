function expectOperator(test, operator, number) {
  switch (operator) {
    case '=':
      return expect(test).toEqual(number);
    case '<':
      return expect(test).toBeLessThan(number);
    case '<=':
      return expect(test).toBeLessThanOrEqual(number);
    case '>':
      return expect(test).toBeGreaterThan(number);
    case '>=':
      return expect(test).toBeGreaterThanOrEqual(number);
    case '!=':
      return expect(test).not.toEqual(number);
  }
}

module.exports = { expectOperator };

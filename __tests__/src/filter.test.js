const Filter = require('../../src/util/Filter');

describe('Filter', () => {
  describe('tokenizeInput', () => {
    it('Tokenizes all operators properly', () => {
      test('tokenize equality', () => {
        expect(Filter.tokenizeInput('rarity=common')).toBe('1234');
      })
    })
  });
})

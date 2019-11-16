import Filter from '../../src/util/Filter';

describe('filter', () => {
  describe('tokenizeInput', () => {
    let tokens;
    beforeEach(() => {
      tokens = [];
    });
    it('tokenizes =', () => {
      Filter.tokenizeInput('rarity=common', tokens)
      expect(tokens).toEqual([{
        "arg": "common",
        "category": "rarity",
        "not": false,
        "operand": "=",
        "type": "token"
      }]);
    });
    it('tokenizes >', () => {
      Filter.tokenizeInput('rarity>common', tokens)
      expect(tokens).toEqual([{
        "arg": "common",
        "category": "rarity",
        "not": false,
        "operand": ">",
        "type": "token"
      }]);
    });
    it('tokenizes <', () => {
      Filter.tokenizeInput('rarity<common', tokens)
      expect(tokens).toEqual([{
        "arg": "common",
        "category": "rarity",
        "not": false,
        "operand": "<",
        "type": "token"
      }]);
    });
    it('tokenizes >=', () => {
      Filter.tokenizeInput('rarity>=common', tokens)
      expect(tokens).toEqual([{
        "arg": "common",
        "category": "rarity",
        "not": false,
        "operand": ">=",
        "type": "token"
      }]);
    });
    it('tokenizes <=', () => {
      Filter.tokenizeInput('rarity<=common', tokens)
      expect(tokens).toEqual([{
        "arg": "common",
        "category": "rarity",
        "not": false,
        "operand": "<=",
        "type": "token"
      }]);
    });
    it('tokenizes !=', () => {
      Filter.tokenizeInput('rarity!=common', tokens)
      expect(tokens).toEqual([{
        "arg": "common",
        "category": "rarity",
        "not": false,
        "operand": "!=",
        "type": "token"
      }]);
    });
    it('tokenizes negated =', () => {
      Filter.tokenizeInput('-rarity=common', tokens)
      expect(tokens).toEqual([{
        "arg": "common",
        "category": "rarity",
        "not": true,
        "operand": "=",
        "type": "token"
      }]);
    });
    it('tokenizes negated >', () => {
      Filter.tokenizeInput('-rarity>common', tokens)
      expect(tokens).toEqual([{
        "arg": "common",
        "category": "rarity",
        "not": true,
        "operand": ">",
        "type": "token"
      }]);
    });
    it('tokenizes negated <', () => {
      Filter.tokenizeInput('-rarity<common', tokens)
      expect(tokens).toEqual([{
        "arg": "common",
        "category": "rarity",
        "not": true,
        "operand": "<",
        "type": "token"
      }]);
    });
    it('tokenizes negated <=', () => {
      Filter.tokenizeInput('-rarity<=common', tokens)
      expect(tokens).toEqual([{
        "arg": "common",
        "category": "rarity",
        "not": true,
        "operand": "<=",
        "type": "token"
      }]);
    });
    it('tokenizes negated >=', () => {
      Filter.tokenizeInput('-rarity>=common', tokens)
      expect(tokens).toEqual([{
        "arg": "common",
        "category": "rarity",
        "not": true,
        "operand": ">=",
        "type": "token"
      }]);
    });
  });
})
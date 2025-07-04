import {
  legalitySuperCondition,
  propertyComparisonOperation,
  setElementOperation,
} from '../../src/client/filtering/FuncOperations';
import { createCardFromDetails } from '../test-utils/data';

describe('setElementOperation', () => {
  it('Invalid operator', async () => {
    const result = () => setElementOperation('+=', 'Tag');
    expect(result).toThrow(Error);
    expect(result).toThrow('Unrecognized operator');
  });

  it('Equality operator matching', async () => {
    //Predicate values are lowercased by the nearley grammar
    const filterer = setElementOperation('=', 'fetch');

    //The filter function for tags lowercases the inputs
    const tags = ['brazen', 'Fetch', 'Kindred'];
    expect(filterer(tags)).toBeTruthy();
  });

  it('Equality operator NOT matching', async () => {
    //Predicate values are lowercased by the nearley grammar
    const filterer = setElementOperation('=', 'travel');

    //The filter function for tags lowercases the inputs
    const tags = ['brazen', 'Fetch', 'Kindred'];
    expect(filterer(tags)).toBeFalsy();
  });

  it('Contains operator matching', async () => {
    //Predicate values are lowercased by the nearley grammar
    const filterer = setElementOperation(':', 'fetch');

    //The filter function for tags lowercases the inputs
    const tags = ['brazen', 'Fetch Land', 'Kindred'];
    expect(filterer(tags)).toBeTruthy();
  });

  it('Contains operator NOT matching', async () => {
    //Predicate values are lowercased by the nearley grammar
    const filterer = setElementOperation(':', 'rap');

    //The filter function for tags lowercases the inputs
    const tags = ['brazen', 'Fetch Land', 'Kindred'];
    expect(filterer(tags)).toBeFalsy();
  });

  it.each(['!=', '<>'])('Inequality operator matching (%s)', async (op) => {
    //Predicate values are lowercased by the nearley grammar
    const filterer = setElementOperation(op, 'fetch');

    //The filter function for tags lowercases the inputs
    const tags = ['brazen', 'Fetch', 'Kindred'];
    expect(filterer(tags)).toBeFalsy();
  });

  it.each(['!=', '<>'])('Inequality operator NOT matching (%s)', async (op) => {
    //Predicate values are lowercased by the nearley grammar
    const filterer = setElementOperation(op, 'transit');

    //The filter function for tags lowercases the inputs
    const tags = ['brazen', 'Fetch', 'Kindred'];
    expect(filterer(tags)).toBeTruthy();
  });
});

describe('propertyComparisonOperation', () => {
  it('Invalid operator', () => {
    const result = () => propertyComparisonOperation('+=');
    expect(result).toThrow(Error);
    expect(result).toThrow('Unrecognized operator');
  });

  it.each([[':', '=']])('Equality operator matching (%s)', (op) => {
    const filterer = propertyComparisonOperation(op);
    expect(filterer(5, 5)).toBeTruthy();
    expect(filterer('test', 'test')).toBeTruthy();
  });

  it.each([[':', '=']])('Equality operator NOT matching (%s)', (op) => {
    const filterer = propertyComparisonOperation(op);
    expect(filterer(5, 6)).toBeFalsy();
    expect(filterer('test', 'different')).toBeFalsy();
  });

  it.each(['!=', '<>'])('Inequality operator matching (%s)', (op) => {
    const filterer = propertyComparisonOperation(op);
    expect(filterer(5, 6)).toBeTruthy();
    expect(filterer('test', 'different')).toBeTruthy();
  });

  it.each(['!=', '<>'])('Inequality operator NOT matching (%s)', (op) => {
    const filterer = propertyComparisonOperation(op);
    expect(filterer(5, 5)).toBeFalsy();
    expect(filterer('test', 'test')).toBeFalsy();
  });

  it('Less than operator matching', () => {
    const filterer = propertyComparisonOperation('<');
    expect(filterer(4, 5)).toBeTruthy();
  });

  it('Less than operator NOT matching', () => {
    const filterer = propertyComparisonOperation('<');
    expect(filterer(5, 5)).toBeFalsy();
    expect(filterer(6, 5)).toBeFalsy();
  });

  it('Less than or equal operator matching', () => {
    const filterer = propertyComparisonOperation('<=');
    expect(filterer(4, 5)).toBeTruthy();
    expect(filterer(5, 5)).toBeTruthy();
  });

  it('Less than or equal operator NOT matching', () => {
    const filterer = propertyComparisonOperation('<=');
    expect(filterer(6, 5)).toBeFalsy();
  });

  it('Greater than operator matching', () => {
    const filterer = propertyComparisonOperation('>');
    expect(filterer(6, 5)).toBeTruthy();
  });

  it('Greater than operator NOT matching', () => {
    const filterer = propertyComparisonOperation('>');
    expect(filterer(5, 5)).toBeFalsy();
    expect(filterer(4, 5)).toBeFalsy();
  });

  it('Greater than or equal operator matching', () => {
    const filterer = propertyComparisonOperation('>=');
    expect(filterer(6, 5)).toBeTruthy();
    expect(filterer(5, 5)).toBeTruthy();
  });

  it('Greater than or equal operator NOT matching', () => {
    const filterer = propertyComparisonOperation('>=');
    expect(filterer(4, 5)).toBeFalsy();
  });
});

describe('legalitySuperCondition', () => {
  it('returns true if card is legal in vintage', () => {
    const card = createCardFromDetails({ legalities: { Vintage: 'legal' } });
    const cond = legalitySuperCondition(':', 'vintage');
    expect(cond(card)).toBe(true);
  });

  it('returns true if card is restricted in vintage', () => {
    const card = createCardFromDetails({ legalities: { Vintage: 'restricted' } });
    const cond = legalitySuperCondition(':', 'vintage');
    expect(cond(card)).toBe(true);
  });

  it('returns false if card is banned in vintage', () => {
    const card = createCardFromDetails({ legalities: { Vintage: 'banned' } });
    const cond = legalitySuperCondition(':', 'vintage');
    expect(cond(card)).toBe(false);
  });

  it('returns false if card has no vintage legality', () => {
    const card = createCardFromDetails({ legalities: { Legacy: 'legal' } });
    const cond = legalitySuperCondition(':', 'vintage');
    expect(cond(card)).toBe(false);
  });

  it('returns true for other formats if legal', () => {
    const card = createCardFromDetails({ legalities: { Modern: 'legal' } });
    const cond = legalitySuperCondition(':', 'modern');
    expect(cond(card)).toBe(true);
  });

  it('returns false for other formats if not legal', () => {
    const card = createCardFromDetails({ legalities: { Modern: 'banned' } });
    const cond = legalitySuperCondition(':', 'modern');
    expect(cond(card)).toBe(false);
  });

  it('returns false for vintage with != if card is legal or restricted', () => {
    const cardLegal = createCardFromDetails({ legalities: { Vintage: 'legal' } });
    const cardRestricted = createCardFromDetails({ legalities: { Vintage: 'restricted' } });
    const cond = legalitySuperCondition('!=', 'vintage');
    expect(cond(cardLegal)).toBe(false);
    expect(cond(cardRestricted)).toBe(false);
  });

  it('returns true for vintage with != if card is banned', () => {
    const card = createCardFromDetails({ legalities: { Vintage: 'banned' } });
    const cond = legalitySuperCondition('!=', 'vintage');
    expect(cond(card)).toBe(true);
  });

  it('returns true for vintage with != if card has no vintage legality', () => {
    const card = createCardFromDetails({ legalities: { Legacy: 'legal' } });
    const cond = legalitySuperCondition('!=', 'vintage');
    expect(cond(card)).toBe(true);
  });

  it('returns false for modern with != if card is legal', () => {
    const card = createCardFromDetails({ legalities: { Modern: 'legal' } });
    const cond = legalitySuperCondition('!=', 'modern');
    expect(cond(card)).toBe(false);
  });

  it('returns true for modern with != if card is banned', () => {
    const card = createCardFromDetails({ legalities: { Modern: 'banned' } });
    const cond = legalitySuperCondition('!=', 'modern');
    expect(cond(card)).toBe(true);
  });

  it('returns true for modern with != if card has no modern legality', () => {
    const card = createCardFromDetails({ legalities: { Legacy: 'legal' } });
    const cond = legalitySuperCondition('!=', 'modern');
    expect(cond(card)).toBe(true);
  });
});

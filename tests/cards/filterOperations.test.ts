import { setElementOperation } from '../../src/client/filtering/FuncOperations';

describe('setElementOperation', () => {
  it('Invalid operator', async () => {
    const result = () => setElementOperation('+=', 'Tag');
    expect(result).toThrow(Error);
    expect(result).toThrow('Unrecognized operator');
  });

  it('Equality operators', async () => {
    const result = () => setElementOperation('+=', 'Tag');
    expect(result).toThrow(Error);
    expect(result).toThrow('Unrecognized operator');
  });

  it.each([':', '='])('Equality operator matching (%s)', async (op) => {
    //Predicate values are lowercased by the nearley grammar
    const filterer = setElementOperation(op, 'fetch');

    //The filter function for tags lowercases the inputs
    const tags = ['brazen', 'Fetch', 'Kindred'];
    expect(filterer(tags)).toBeTruthy();
  });

  it.each([':', '='])('Equality operator NOT matching (%s)', async (op) => {
    //Predicate values are lowercased by the nearley grammar
    const filterer = setElementOperation(op, 'travel');

    //The filter function for tags lowercases the inputs
    const tags = ['brazen', 'Fetch', 'Kindred'];
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

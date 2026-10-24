import { isReservedBoardKey, validateBoardDefinitions } from '@utils/datatypes/Cube';

describe('isReservedBoardKey', () => {
  it.each(['__proto__', 'constructor', 'prototype', 'id', 'version', 'hasOwnProperty', 'toString'])(
    'reserves %s',
    (key) => expect(isReservedBoardKey(key)).toBe(true),
  );

  it.each(['mainboard', 'maybeboard', 'basics', 'tokens', 'tostring'])('allows %s', (key) =>
    expect(isReservedBoardKey(key)).toBe(false),
  );
});

describe('validateBoardDefinitions', () => {
  it('accepts ordinary boards', () => {
    expect(validateBoardDefinitions([{ name: 'Mainboard' }, { name: 'Side Board' }])).toEqual({ valid: true });
  });

  it.each(['__proto__', 'Constructor', 'PROTOTYPE', 'Pro to type', 'Version', 'Id'])(
    'rejects the reserved name %s',
    (name) => {
      const result = validateBoardDefinitions([{ name: 'Mainboard' }, { name }]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("can't be used as a board name");
    },
  );

  it.each([[{ name: 'Mainboard' }], [[{ name: 7 }]], [[null]], ['Mainboard']])(
    'rejects malformed input %p',
    (boards) => {
      expect(validateBoardDefinitions(boards as any).valid).toBe(false);
    },
  );
});

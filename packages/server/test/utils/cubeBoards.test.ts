import {
  isReservedBoardKey,
  MAX_CARD_IMAGE_URL_LENGTH,
  safeCardImageUrl,
  sanitizeCardImageUrls,
  validateBoardDefinitions,
} from '@utils/datatypes/Cube';

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

describe('card image URLs', () => {
  it('accepts http(s) URLs up to the length limit', () => {
    expect(safeCardImageUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(safeCardImageUrl(`https://example.com/${'a'.repeat(MAX_CARD_IMAGE_URL_LENGTH)}`)).toBeUndefined();
  });

  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'data:image/png;base64,AAAA', '/relative.png', 42, null])(
    'rejects %p',
    (value) => expect(safeCardImageUrl(value)).toBeUndefined(),
  );

  it('drops unsafe values in place but keeps empty ones', () => {
    const card: any = {
      cardID: 'x',
      imgUrl: 'ftp://example.com/a.png',
      imgBackUrl: '',
      voucher_cards: [{ cardID: 'y', imgUrl: 'https://example.com/b.png', imgBackUrl: 'javascript:1' }],
    };
    sanitizeCardImageUrls(card);
    expect(card).not.toHaveProperty('imgUrl');
    expect(card.imgBackUrl).toBe('');
    expect(card.voucher_cards[0]).toEqual({ cardID: 'y', imgUrl: 'https://example.com/b.png' });
  });
});

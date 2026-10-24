import {
  cardBannedIn,
  cardCmc,
  cardFinish,
  cardLegalIn,
  cardRestrictedIn,
  cardWordCount,
  isCardFoil,
  isFoilFinish,
} from '@utils/cardutil';
import { getSafeReferrer } from 'serverutils/util';

import { createCard, createCardDetails, createCardFromDetails } from '../test-utils/data';

describe('getSafeReferrer', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.DOMAIN = 'cubecobra.com';
    process.env.HTTP_ONLY = 'false';
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('returns null when no referrer header exists', () => {
    const req = {
      header: jest.fn().mockReturnValue(null),
    } as any;

    const result = getSafeReferrer(req);
    expect(result).toBeNull();
    expect(req.header).toHaveBeenCalledWith('Referrer');
  });

  it('returns null for external domain referrer', () => {
    const req = {
      header: jest.fn().mockReturnValue('https://example.com/some/path'),
    } as any;

    const result = getSafeReferrer(req);
    expect(result).toBeNull();
  });

  it('returns pathname for valid internal referrer', () => {
    const req = {
      header: jest.fn().mockReturnValue('https://cubecobra.com/cube/view/123'),
    } as any;

    const result = getSafeReferrer(req);
    expect(result).toBe('/cube/view/123');
  });

  it('returns null for a same-site path that is a protocol-relative URL', () => {
    for (const referrer of ['https://cubecobra.com//evil.com', 'https://cubecobra.com/\\evil.com']) {
      const req = {
        header: jest.fn().mockReturnValue(referrer),
      } as any;

      expect(getSafeReferrer(req)).toBeNull();
    }
  });

  it('handles non-root relative urls', () => {
    const req = {
      header: jest.fn().mockReturnValue('not-a-url'),
    } as any;

    const result = getSafeReferrer(req);
    expect(result).toBe('/not-a-url');
  });

  it('allows the www subdomain of the app', () => {
    const req = {
      header: jest.fn().mockReturnValue('https://www.cubecobra.com/cube/view/123'),
    } as any;

    const result = getSafeReferrer(req);
    expect(result).toBe('/cube/view/123');
  });

  it('ignores query parameters and hash', () => {
    const req = {
      header: jest.fn().mockReturnValue('https://cubecobra.com/cube/view/123?sort=name#top'),
    } as any;

    const result = getSafeReferrer(req);
    expect(result).toBe('/cube/view/123');
  });

  it('handles relative URLs correctly', () => {
    const req = {
      header: jest.fn().mockReturnValue('/cube/view/123'),
    } as any;

    const result = getSafeReferrer(req);
    expect(result).toBe('/cube/view/123');
  });

  it('handles path manipulation urls', () => {
    const req = {
      header: jest.fn().mockReturnValue('../cube/../blog/view/123'),
    } as any;

    const result = getSafeReferrer(req);
    expect(result).toBe('/blog/view/123');
  });

  it('returns null for different subdomain and relative paths', () => {
    const req = {
      header: jest.fn().mockReturnValue('https://example.com/../blog/view/123'),
    } as any;

    const result = getSafeReferrer(req);
    expect(result).toBeNull();
  });
});

describe('cardCmc', () => {
  it('returns cmc from card details', () => {
    const card = createCardFromDetails({
      cmc: 3,
    });
    expect(cardCmc(card)).toBe(3);
  });

  it('returns cmc from card override', () => {
    const card = createCard({
      cmc: 11,
    });
    expect(cardCmc(card)).toBe(11);
  });

  it('returns 0 if no details exist', () => {
    const card = createCard({
      details: undefined,
    });
    expect(cardCmc(card)).toBe(0);
  });

  it('handles string decimal cmc values', () => {
    const card = createCard({
      cmc: '3.5',
    });
    expect(cardCmc(card)).toBe(3.5);
  });

  it('handles string number cmc values', () => {
    const card = createCard({
      cmc: '15',
    });
    expect(cardCmc(card)).toBe(15);
  });

  it('handles string zero cmc values', () => {
    const card = createCard({
      cmc: '0',
    });
    expect(cardCmc(card)).toBe(0);
  });

  it('handles 0 cmc', () => {
    const card = createCard({
      cmc: 0,
    });
    expect(cardCmc(card)).toBe(0);
  });

  it('defaults to details cmc if card cmc is not parseable', () => {
    const card = createCard({
      details: createCardDetails({
        cmc: 4,
      }),
    });
    card.cmc = 'not a number' as any;
    expect(cardCmc(card)).toBe(4);
  });

  it('defaults to details cmc if card cmc is empty', () => {
    const card = createCard({
      details: createCardDetails({
        cmc: 4,
      }),
    });
    card.cmc = '' as any;
    expect(cardCmc(card)).toBe(4);
  });
});

describe('cardLegalIn', () => {
  it('returns formats where card is legal', () => {
    const card = createCardFromDetails({
      legalities: {
        standard: 'legal',
        modern: 'legal',
        legacy: 'banned',
        vintage: 'restricted',
      },
    });
    expect(cardLegalIn(card)).toEqual(['standard', 'modern']);
  });

  it('returns empty array if no formats are legal', () => {
    const card = createCardFromDetails({
      legalities: {
        standard: 'banned',
        modern: 'banned',
      },
    });
    expect(cardLegalIn(card)).toEqual([]);
  });

  it('returns empty array if legalities is empty', () => {
    const card = createCardFromDetails({
      legalities: {},
    });
    expect(cardLegalIn(card)).toEqual([]);
  });
});

describe('cardBannedIn', () => {
  it('returns formats where card is banned', () => {
    const card = createCardFromDetails({
      legalities: {
        standard: 'legal',
        modern: 'banned',
        legacy: 'banned',
        vintage: 'restricted',
      },
    });
    expect(cardBannedIn(card)).toEqual(['modern', 'legacy']);
  });

  it('returns empty array if no formats are banned', () => {
    const card = createCardFromDetails({
      legalities: {
        standard: 'legal',
        modern: 'legal',
      },
    });
    expect(cardBannedIn(card)).toEqual([]);
  });

  it('returns empty array if legalities is empty', () => {
    const card = createCardFromDetails({
      legalities: {},
    });
    expect(cardBannedIn(card)).toEqual([]);
  });
});

describe('cardRestrictedIn', () => {
  it('returns formats where card is restricted', () => {
    const card = createCardFromDetails({
      legalities: {
        standard: 'legal',
        modern: 'banned',
        legacy: 'legal',
        vintage: 'restricted',
      },
    });
    expect(cardRestrictedIn(card)).toEqual(['vintage']);
  });

  it('returns empty array if no formats are restricted', () => {
    const card = createCardFromDetails({
      legalities: {
        standard: 'legal',
        modern: 'banned',
      },
    });
    expect(cardRestrictedIn(card)).toEqual([]);
  });

  it('returns empty array if legalities is empty', () => {
    const card = createCardFromDetails({
      legalities: {},
    });
    expect(cardRestrictedIn(card)).toEqual([]);
  });
});

describe('Foiling', () => {
  it('Foils', () => {
    const card = createCard({
      finish: 'Foil',
    });
    expect(cardFinish(card)).toEqual('Foil');
    expect(isCardFoil(card)).toBeTruthy();
  });

  it('Non-foil', () => {
    const card = createCard({
      finish: 'Non-foil',
    });
    expect(cardFinish(card)).toEqual('Non-foil');
    expect(isCardFoil(card)).toBeFalsy();
  });

  it('Etched', () => {
    const card = createCard({
      finish: 'Etched',
    });
    expect(cardFinish(card)).toEqual('Etched');
    expect(isCardFoil(card)).toBeTruthy();
  });

  it('Alt-foil', () => {
    const card = createCard({
      finish: 'Alt-foil',
    });
    expect(cardFinish(card)).toEqual('Alt-foil');
    expect(isCardFoil(card)).toBeTruthy();
  });

  it('Any finish is allowed', () => {
    const card = createCard({
      finish: 'Galaxy hyper mega foil',
    });
    expect(cardFinish(card)).toEqual('Galaxy hyper mega foil');
    expect(isCardFoil(card)).toBeTruthy();
  });

  it('isFoilFinish', () => {
    expect(isFoilFinish('Non-foil')).toBeFalsy();
    expect(isFoilFinish('Foil')).toBeTruthy();
    expect(isFoilFinish('Etched')).toBeTruthy();
    expect(isFoilFinish('Alt-foil')).toBeTruthy();
  });
});

describe('cardWordCount', () => {
  it('Treats spaces and newlines as word separators', () => {
    const cardWithMultilineText = createCardFromDetails({
      oracle_text: 'A B\nC',
    });

    expect(cardWordCount(cardWithMultilineText)).toBe(3);
  });
});

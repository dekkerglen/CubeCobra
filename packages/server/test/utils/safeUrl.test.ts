import { safeHttpUrl, safeRelativePath } from '@utils/safeUrl';

describe('safeHttpUrl', () => {
  it('accepts absolute http(s) URLs', () => {
    expect(safeHttpUrl('https://example.com/a?b=c')).toBe('https://example.com/a?b=c');
    expect(safeHttpUrl('  http://example.com  ')).toBe('http://example.com/');
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<b>x</b>',
    'vbscript:x',
    '/relative',
    '//evil.com',
    '',
    42,
    null,
  ])('rejects %p', (input) => {
    expect(safeHttpUrl(input)).toBeNull();
  });
});

describe('safeRelativePath', () => {
  it('accepts same-site paths', () => {
    expect(safeRelativePath('/cube/list/abc?view=table')).toBe('/cube/list/abc?view=table');
  });

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'relative', '/ok\r\nSet-Cookie: x'])(
    'rejects %p',
    (input) => {
      expect(safeRelativePath(input)).toBeNull();
    },
  );
});

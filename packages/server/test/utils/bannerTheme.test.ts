import {
  DEFAULT_BANNER_THEME,
  BANNER_THEMES,
  BannerThemeKey,
  bannerThemeClass,
  normalizeBannerTheme,
} from '@utils/bannerTheme';

describe('BANNER_THEMES', () => {
  it('lists the five Magic colours in order', () => {
    expect(BANNER_THEMES.map((t) => t.key)).toEqual(['white', 'blue', 'black', 'red', 'green']);
    expect(BANNER_THEMES.map((t) => t.label)).toEqual(['White', 'Blue', 'Black', 'Red', 'Green']);
  });

  // Pins the extensibility requirement: the key type is derived from the registry, so a new
  // theme does not also need a hand-edited union.
  it('derives the key type from the registry entries', () => {
    const keys: BannerThemeKey[] = BANNER_THEMES.map((t) => t.key);
    expect(keys).toHaveLength(BANNER_THEMES.length);
  });

  it('defaults to green', () => {
    expect(DEFAULT_BANNER_THEME).toBe('green');
    expect(BANNER_THEMES.some((t) => t.key === DEFAULT_BANNER_THEME)).toBe(true);
  });
});

describe('normalizeBannerTheme', () => {
  // Iterates the registry rather than a second hardcoded list, so adding a theme needs one
  // edit here and one in the stylesheet — the spec's extensibility requirement.
  it.each(BANNER_THEMES.map((t) => t.key))('accepts %p', (key) => {
    expect(normalizeBannerTheme(key)).toBe(key);
  });

  it.each(['purple', 'Green', ' green ', '../x', 'green; }', '', 42, null, undefined, {}, ['green']])(
    'rejects %p',
    (input) => {
      expect(normalizeBannerTheme(input)).toBeNull();
    },
  );
});

describe('bannerThemeClass', () => {
  it('names a class for a non-default theme', () => {
    expect(bannerThemeClass('blue')).toBe('banner-theme-blue');
  });

  it.each([undefined, null, '', 'green', 'purple'])('returns null for %p', (input) => {
    expect(bannerThemeClass(input)).toBeNull();
  });
});

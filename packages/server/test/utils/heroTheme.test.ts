import { DEFAULT_HERO_THEME, HERO_THEMES, HeroThemeKey, heroThemeClass, normalizeHeroTheme } from '@utils/heroTheme';

describe('HERO_THEMES', () => {
  it('lists the five Magic colours in order', () => {
    expect(HERO_THEMES.map((t) => t.key)).toEqual(['white', 'blue', 'black', 'red', 'green']);
    expect(HERO_THEMES.map((t) => t.label)).toEqual(['White', 'Blue', 'Black', 'Red', 'Green']);
  });

  // Pins the extensibility requirement: the key type is derived from the registry, so a new
  // theme does not also need a hand-edited union.
  it('derives the key type from the registry entries', () => {
    const keys: HeroThemeKey[] = HERO_THEMES.map((t) => t.key);
    expect(keys).toHaveLength(HERO_THEMES.length);
  });

  it('defaults to green', () => {
    expect(DEFAULT_HERO_THEME).toBe('green');
    expect(HERO_THEMES.some((t) => t.key === DEFAULT_HERO_THEME)).toBe(true);
  });
});

describe('normalizeHeroTheme', () => {
  // Iterates the registry rather than a second hardcoded list, so adding a theme needs one
  // edit here and one in the stylesheet — the spec's extensibility requirement.
  it.each(HERO_THEMES.map((t) => t.key))('accepts %p', (key) => {
    expect(normalizeHeroTheme(key)).toBe(key);
  });

  it.each(['purple', 'Green', ' green ', '../x', 'green; }', '', 42, null, undefined, {}, ['green']])(
    'rejects %p',
    (input) => {
      expect(normalizeHeroTheme(input)).toBeNull();
    },
  );
});

describe('heroThemeClass', () => {
  it('names a class for a non-default theme', () => {
    expect(heroThemeClass('blue')).toBe('hero-theme-blue');
  });

  it.each([undefined, null, '', 'green', 'purple'])('returns null for %p', (input) => {
    expect(heroThemeClass(input)).toBeNull();
  });
});

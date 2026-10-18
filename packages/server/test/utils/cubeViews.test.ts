import { findViewBySlug, validateViewDefinitions, ViewDefinition, viewNameToSlug } from '@utils/datatypes/Cube';

import { createCube } from '../test-utils/data';

const view = (name: string, overrides?: Partial<ViewDefinition>): ViewDefinition => ({
  name,
  boards: ['mainboard'],
  displayView: 'table',
  defaultSorts: ['Color Category', 'Types-Multicolor', 'Mana Value', 'Alphabetical'],
  ...overrides,
});

const cubeWithViews = (...names: string[]) => createCube({ views: names.map((name) => view(name)) });

describe('viewNameToSlug', () => {
  it.each([
    ['Mainboard', 'mainboard'],
    ['Base Packs', 'base-packs'],
    ['Base-Packs', 'base-packs'],
    ['R&D', 'r-d'],
    ['Pauper #1', 'pauper-1'],
    ['Draft/Play', 'draft-play'],
    ['Loreseeker/Booster Tutor', 'loreseeker-booster-tutor'],
    ['Cube+', 'cube'],
    ['  Spaced  Out  ', 'spaced-out'],
    ['Español', 'español'],
    ['日本語', '日本語'],
    ['!!!', ''],
  ])('%s -> %s', (input, expected) => expect(viewNameToSlug(input)).toBe(expected));

  // Regression: viewNameToKey percent-encoded its output, so writing it through
  // URLSearchParams encoded it a second time ("R&D" -> view=r%2526d) and the
  // value never resolved back to a view on reload.
  it.each([
    'Mainboard',
    'Base Packs',
    'R&D',
    'Pauper #1',
    'Draft/Play',
    'Loreseeker/Booster Tutor',
    'Cube+',
    'Español',
  ])('survives a URLSearchParams round trip unchanged: %s', (name) => {
    const slug = viewNameToSlug(name);
    const params = new URLSearchParams();
    params.set('view', slug);
    expect(new URLSearchParams(params.toString()).get('view')).toBe(slug);
  });
});

describe('findViewBySlug', () => {
  const cube = cubeWithViews('Mainboard', 'Base Packs', 'R&D', 'Loreseeker/Booster Tutor');

  it('finds a view by its slug', () => expect(findViewBySlug(cube, 'base-packs')?.name).toBe('Base Packs'));

  it('finds a view whose name contains special characters', () =>
    expect(findViewBySlug(cube, 'r-d')?.name).toBe('R&D'));

  it('finds a view whose name contains a slash', () =>
    expect(findViewBySlug(cube, 'loreseeker-booster-tutor')?.name).toBe('Loreseeker/Booster Tutor'));

  it('resolves legacy links that carried the display name', () => {
    expect(findViewBySlug(cube, 'Base Packs')?.name).toBe('Base Packs');
    expect(findViewBySlug(cube, 'Mainboard')?.name).toBe('Mainboard');
    expect(findViewBySlug(cube, 'Loreseeker/Booster Tutor')?.name).toBe('Loreseeker/Booster Tutor');
  });

  it('falls back to the cube default views when none are configured', () =>
    expect(findViewBySlug(createCube(), 'maybeboard')?.name).toBe('Maybeboard'));

  it('returns the first match when two views share a slug', () =>
    expect(findViewBySlug(cubeWithViews('Base Packs', 'Base-Packs'), 'base-packs')?.name).toBe('Base Packs'));

  it('returns undefined when nothing matches', () => {
    expect(findViewBySlug(cube, 'nonexistent')).toBeUndefined();
    expect(findViewBySlug(cube, 'r%26d')).toBeUndefined();
    expect(findViewBySlug(cube, '')).toBeUndefined();
    expect(findViewBySlug(cube, null)).toBeUndefined();
  });
});

describe('validateViewDefinitions', () => {
  it('accepts views with distinct slugs', () =>
    expect(validateViewDefinitions([view('Mainboard'), view('Base Packs')])).toEqual({ valid: true }));

  it('rejects views whose names resolve to the same link name', () =>
    expect(validateViewDefinitions([view('Base Packs'), view('Base-Packs')])).toEqual({
      valid: false,
      error: 'Two views share the link name "base-packs". Rename one of them.',
    }));

  it('rejects a view name with no letters or numbers to slug', () =>
    expect(validateViewDefinitions([view('!!!')])).toEqual({
      valid: false,
      error: 'View name "!!!" must contain at least one letter or number.',
    }));
});

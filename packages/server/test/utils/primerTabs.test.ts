import {
  findTabIndexBySlug,
  nextNewTabTitle,
  PrimerTab,
  prependToPrimaryTab,
  primerTabsFromLegacy,
  slugifyTabTitle,
  validatePrimerTabs,
} from '@utils/primerTabs';

const tab = (title: string, content = ''): PrimerTab => ({ title, content });

describe('slugifyTabTitle', () => {
  it.each([
    ['Primer', 'primer'],
    ['Design Notes!', 'design-notes'],
    ['  Español  ', 'español'],
    ['日本語', '日本語'],
    ['A -- B', 'a-b'],
    ['!!!', ''],
    ['🙂', ''],
  ])('%s -> %s', (input, expected) => expect(slugifyTabTitle(input)).toBe(expected));
});

describe('primerTabsFromLegacy', () => {
  it('wraps a description', () => expect(primerTabsFromLegacy('hi')).toEqual([tab('Primer', 'hi')]));
  it('handles missing', () => expect(primerTabsFromLegacy(undefined)).toEqual([tab('Primer', '')]));
});

describe('validatePrimerTabs', () => {
  it('accepts a valid list', () => expect(validatePrimerTabs([tab('Primer', 'x'), tab('Español', 'y')])).toBeNull());
  it('rejects non-arrays / bad shapes', () => {
    expect(validatePrimerTabs('nope')).toBe('Invalid primer tabs.');
    expect(validatePrimerTabs([{ title: 'a' }])).toBe('Invalid primer tabs.');
  });
  it('rejects zero tabs', () => expect(validatePrimerTabs([])).toBe('Primer must have at least one tab.'));
  it('rejects 11 tabs', () =>
    expect(validatePrimerTabs(Array.from({ length: 11 }, (_, i) => tab(`T${i}`)))).toBe(
      'Primer cannot have more than 10 tabs.',
    ));
  it('rejects blank title', () => expect(validatePrimerTabs([tab('   ')])).toBe('Every tab needs a title.'));
  it('rejects 51-char title', () =>
    expect(validatePrimerTabs([tab('a'.repeat(51))])).toBe('Tab titles must be 50 characters or fewer.'));
  it('rejects unsluggable title', () =>
    expect(validatePrimerTabs([tab('!!!')])).toBe('Tab title "!!!" must contain at least one letter or number.'));
  it('rejects duplicate slugs', () =>
    expect(validatePrimerTabs([tab('Notes'), tab('notes!')])).toBe(
      'Two tabs share the link name "notes". Rename one of them.',
    ));
  it('allows exactly 100,000 total chars, rejects 100,001', () => {
    expect(validatePrimerTabs([tab('A', 'x'.repeat(60_000)), tab('B', 'x'.repeat(40_000))])).toBeNull();
    expect(validatePrimerTabs([tab('A', 'x'.repeat(60_000)), tab('B', 'x'.repeat(40_001))])).toBe(
      'Primer is 100,001 characters; the limit is 100,000 across all tabs.',
    );
  });
});

describe('findTabIndexBySlug', () => {
  const tabs = [tab('Primer'), tab('Español'), tab('日本語')];
  it('finds by slug', () => expect(findTabIndexBySlug(tabs, 'español')).toBe(1));
  it('finds non-Latin', () => expect(findTabIndexBySlug(tabs, '日本語')).toBe(2));
  it('normalizes hand-typed non-Latin titles', () => expect(findTabIndexBySlug(tabs, 'Español')).toBe(1));
  it('normalizes titles with spaces', () =>
    expect(findTabIndexBySlug([tab('Primer'), tab('Design Notes')], 'Design Notes')).toBe(1));
  it('falls back to 0', () => {
    expect(findTabIndexBySlug(tabs, 'missing')).toBe(0);
    expect(findTabIndexBySlug(tabs, '')).toBe(0);
    expect(findTabIndexBySlug(tabs, null)).toBe(0);
  });
});

describe('nextNewTabTitle', () => {
  it('starts at New Tab', () => expect(nextNewTabTitle([tab('Primer')])).toBe('New Tab'));
  it('dedupes', () => expect(nextNewTabTitle([tab('New Tab'), tab('New Tab 2')])).toBe('New Tab 3'));
});

describe('prependToPrimaryTab', () => {
  it('prepends to first tab only, without mutating input', () => {
    const tabs = [tab('Primer', 'body'), tab('Español', 'cuerpo')];
    expect(prependToPrimaryTab(tabs, 'Cloned\n\n')).toEqual([
      tab('Primer', 'Cloned\n\nbody'),
      tab('Español', 'cuerpo'),
    ]);
    expect(tabs[0]!.content).toBe('body');
  });
});

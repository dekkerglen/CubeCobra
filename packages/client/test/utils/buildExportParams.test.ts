import { buildExportParams } from 'utils/buildExportParams';

describe('buildExportParams', () => {
  const base = {
    isFilterUsed: false,
    filterInput: '',
    isSortUsed: false,
    sortPrimary: null,
    sortSecondary: null,
    sortTertiary: null,
    sortQuaternary: null,
    exportAllBoards: false,
    currentViewBoards: ['mainboard'],
    showUnsorted: false,
  };

  const paramsOf = (overrides: Partial<typeof base> = {}) =>
    new URLSearchParams(buildExportParams({ ...base, ...overrides }));

  it('asks for unsorted cards when the cube shows them', () => {
    expect(paramsOf({ showUnsorted: true }).get('showother')).toBe('true');
  });

  it('does not ask for unsorted cards when the cube hides them', () => {
    expect(paramsOf({ showUnsorted: false }).get('showother')).toBeNull();
  });

  it('carries showother even when the sort checkbox is off, since the download still sorts', () => {
    expect(paramsOf({ showUnsorted: true, isSortUsed: false }).get('showother')).toBe('true');
  });

  it('includes the filter only when the filter checkbox is on', () => {
    expect(paramsOf({ isFilterUsed: true, filterInput: 'is:custom' }).get('filter')).toBe('is:custom');
    expect(paramsOf({ isFilterUsed: false, filterInput: 'is:custom' }).get('filter')).toBeNull();
  });

  it('includes the sorts only when the sort checkbox is on', () => {
    const on = paramsOf({ isSortUsed: true, sortPrimary: 'Color Category', sortSecondary: 'Rarity' });
    expect(on.get('primary')).toBe('Color Category');
    expect(on.get('secondary')).toBe('Rarity');

    expect(paramsOf({ isSortUsed: false, sortPrimary: 'Color Category' }).get('primary')).toBeNull();
  });

  it('exports every board or just the current view', () => {
    expect(paramsOf({ exportAllBoards: true }).get('allBoards')).toBe('1');
    expect(paramsOf({ exportAllBoards: true }).get('boards')).toBeNull();
    expect(paramsOf({ exportAllBoards: false, currentViewBoards: ['mainboard', 'basics'] }).get('boards')).toBe(
      'mainboard,basics',
    );
  });
});

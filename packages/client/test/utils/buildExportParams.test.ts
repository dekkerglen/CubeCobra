import { buildExportParams, ExportParamsOptions } from 'utils/buildExportParams';

describe('buildExportParams', () => {
  const base: ExportParamsOptions = {
    isFilterUsed: false,
    filterInput: '',
    exportAllBoards: false,
    currentViewBoards: ['mainboard'],
  };

  const paramsOf = (overrides: Partial<ExportParamsOptions> = {}) =>
    new URLSearchParams(buildExportParams({ ...base, ...overrides }));

  it('always sends the fixed export sort, whatever the cube or page is set to', () => {
    const params = paramsOf();
    expect(params.get('primary')).toBe('Color Category');
    expect(params.get('secondary')).toBe('Types-Multicolor');
    expect(params.get('tertiary')).toBe('Mana Value');
    expect(params.get('quaternary')).toBe('Alphabetical');
  });

  it('always asks for unsorted cards, so nothing in scope is dropped', () => {
    expect(paramsOf().get('showother')).toBe('true');
  });

  it('never asks the endpoint to skip sorting', () => {
    expect(paramsOf().get('nosort')).toBeNull();
  });

  it('includes the filter only when the filter checkbox is on', () => {
    expect(paramsOf({ isFilterUsed: true, filterInput: 'is:custom' }).get('filter')).toBe('is:custom');
    expect(paramsOf({ isFilterUsed: false, filterInput: 'is:custom' }).get('filter')).toBeNull();
  });

  it('exports every board or just the current view', () => {
    expect(paramsOf({ exportAllBoards: true }).get('allBoards')).toBe('1');
    expect(paramsOf({ exportAllBoards: true }).get('boards')).toBeNull();
    expect(paramsOf({ exportAllBoards: false, currentViewBoards: ['mainboard', 'basics'] }).get('boards')).toBe(
      'mainboard,basics',
    );
  });
});

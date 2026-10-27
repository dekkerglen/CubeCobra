import {
  basicsBoardSelectOptions,
  basicsBoardToSelectValue,
  selectValueToBasicsBoard,
} from '../../src/utils/basicsBoardSelect';

describe('basicsBoardToSelectValue', () => {
  it('shows an unset board as the default', () => {
    expect(basicsBoardToSelectValue(undefined)).toBe('Default');
  });

  it('shows the opt-out as None', () => {
    expect(basicsBoardToSelectValue('None')).toBe('None');
  });

  it('shows a stored board key as itself', () => {
    expect(basicsBoardToSelectValue('basics')).toBe('basics');
  });

  it('normalizes a capitalized board name to its key', () => {
    expect(basicsBoardToSelectValue('Basics')).toBe('basics');
  });
});

describe('selectValueToBasicsBoard', () => {
  it('stores nothing for the default', () => {
    expect(selectValueToBasicsBoard('Default')).toBeUndefined();
  });

  it('stores the None sentinel', () => {
    expect(selectValueToBasicsBoard('None')).toBe('None');
  });

  it('stores a board key', () => {
    expect(selectValueToBasicsBoard('extras')).toBe('extras');
  });

  it('keeps boards named None or Default distinct from the sentinels', () => {
    expect(selectValueToBasicsBoard('none')).toBe('none');
    expect(selectValueToBasicsBoard('default')).toBe('default');
  });
});

describe('basicsBoardSelectOptions', () => {
  it('lists the default and None ahead of the cube boards', () => {
    expect(basicsBoardSelectOptions([{ name: 'Mainboard' }, { name: 'None' }])).toEqual([
      { value: 'Default', label: 'Default (Basics)' },
      { value: 'None', label: 'None' },
      { value: 'mainboard', label: 'Mainboard' },
      { value: 'none', label: 'None (board)' },
    ]);
  });
});

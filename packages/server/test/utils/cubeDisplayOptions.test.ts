import { CUBE_DISPLAY_OPTION_KEYS, DEFAULT_CUBE_DISPLAY_OPTIONS, getCubeDisplayOptions } from '@utils/datatypes/Cube';

import { createCube } from '../test-utils/data';

const withoutDisplayFields = () => {
  const cube: Record<string, any> = createCube();
  for (const key of CUBE_DISPLAY_OPTION_KEYS) {
    delete cube[key];
  }
  return cube;
};

describe('getCubeDisplayOptions', () => {
  it('returns the defaults for a cube with no display fields', () => {
    expect(getCubeDisplayOptions(withoutDisplayFields())).toEqual(DEFAULT_CUBE_DISPLAY_OPTIONS);
    expect(getCubeDisplayOptions(undefined)).toEqual(DEFAULT_CUBE_DISPLAY_OPTIONS);
  });

  it('uses the expected defaults', () => {
    expect(DEFAULT_CUBE_DISPLAY_OPTIONS).toEqual({
      showUnsorted: false,
      collapseDuplicateCards: false,
      showInlineTagEmojis: false,
      showTagQuickFilters: true,
      showAllBoards: false,
      useBaseCardData: false,
      showTagColors: true,
    });
  });

  it('keeps stored false over a true default', () => {
    const options = getCubeDisplayOptions({
      ...withoutDisplayFields(),
      showTagQuickFilters: false,
      showTagColors: false,
    });
    expect(options.showTagQuickFilters).toBe(false);
    expect(options.showTagColors).toBe(false);
  });

  it('keeps stored true over a false default', () => {
    const options = getCubeDisplayOptions({ ...withoutDisplayFields(), showAllBoards: true, useBaseCardData: true });
    expect(options.showAllBoards).toBe(true);
    expect(options.useBaseCardData).toBe(true);
  });

  it('ignores non-boolean stored values', () => {
    expect(getCubeDisplayOptions({ ...withoutDisplayFields(), showUnsorted: 'yes' as any }).showUnsorted).toBe(false);
  });
});

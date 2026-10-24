import Cube from '@utils/datatypes/Cube';
import { DraftFormat } from '@utils/datatypes/Draft';

import { cubeOffersStandardDraft, getDraftFormatOptions, offersStandardDraft } from '../../src/utils/draftFormats';

const format = (title: string): DraftFormat => ({ title }) as unknown as DraftFormat;

const cube = (overrides: Partial<Cube> = {}): Cube => ({ id: 'cube-1', ...overrides }) as unknown as Cube;

describe('offersStandardDraft', () => {
  it('offers standard draft when it is enabled', () => {
    expect(offersStandardDraft(true, 2)).toBe(true);
  });

  it('withholds standard draft when it is disabled and a custom format can take its place', () => {
    expect(offersStandardDraft(false, 1)).toBe(false);
  });

  it('keeps standard draft when it is disabled but there is no custom format to fall back to', () => {
    expect(offersStandardDraft(false, 0)).toBe(true);
  });
});

describe('cubeOffersStandardDraft', () => {
  it('reads the disable flag off the cube', () => {
    expect(cubeOffersStandardDraft(cube({ formats: [format('Custom')] }))).toBe(true);
    expect(cubeOffersStandardDraft(cube({ formats: [format('Custom')], disableDraft: true }))).toBe(false);
  });

  it('treats a missing formats array as no custom formats', () => {
    expect(cubeOffersStandardDraft(cube({ disableDraft: true }))).toBe(true);
  });
});

describe('getDraftFormatOptions', () => {
  it('prepends standard draft to the custom formats', () => {
    expect(getDraftFormatOptions([format('Powered'), format('Peasant')], true)).toEqual([
      { value: '-1', label: 'Standard Draft' },
      { value: '0', label: 'Powered' },
      { value: '1', label: 'Peasant' },
    ]);
  });

  it('drops standard draft when it is disabled', () => {
    expect(getDraftFormatOptions([format('Powered')], false)).toEqual([{ value: '0', label: 'Powered' }]);
  });

  it('never returns an empty list', () => {
    expect(getDraftFormatOptions([], false)).toEqual([{ value: '-1', label: 'Standard Draft' }]);
    expect(getDraftFormatOptions(undefined, false)).toEqual([{ value: '-1', label: 'Standard Draft' }]);
  });

  it('falls back to a positional label for an untitled format', () => {
    expect(getDraftFormatOptions([format('')], true)).toEqual([
      { value: '-1', label: 'Standard Draft' },
      { value: '0', label: 'Format 1' },
    ]);
  });

  it('returns a fresh standard draft option each call', () => {
    const first = getDraftFormatOptions([], true);
    const second = getDraftFormatOptions([], true);

    expect(first[0]).not.toBe(second[0]);
  });
});

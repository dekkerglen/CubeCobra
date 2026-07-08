import { isExtraCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import { filterIncludesExtras, makeFilter } from '@utils/filtering/FilterCards';

const details = (overrides: Partial<CardDetails>): CardDetails =>
  ({ layout: 'normal', set_type: 'expansion', set: 'abc', digital: false, ...overrides }) as CardDetails;

describe('isExtraCard', () => {
  it('treats a normal game piece as non-extra', () => {
    expect(isExtraCard(details({}))).toBe(false);
  });

  it('flags every extra category', () => {
    expect(isExtraCard(details({ isToken: true }))).toBe(true);
    expect(isExtraCard(details({ isExtra: true }))).toBe(true);
    expect(isExtraCard(details({ digital: true }))).toBe(true);
    expect(isExtraCard(details({ layout: 'art_series' }))).toBe(true);
    expect(isExtraCard(details({ layout: 'emblem' }))).toBe(true);
    expect(isExtraCard(details({ layout: 'planar' }))).toBe(true);
    expect(isExtraCard(details({ set_type: 'memorabilia' }))).toBe(true);
    expect(isExtraCard(details({ set_type: 'token' }))).toBe(true);
    // Gavin's Unknown Event cards, hidden by CubeCobra policy even though
    // Scryfall itself does not classify them as extras.
    expect(isExtraCard(details({ set: 'unk' }))).toBe(true);
  });
});

describe('include:extras search directive', () => {
  it('parses as a valid directive and is detected', () => {
    const { err, filter } = makeFilter('t:creature include:extras');
    expect(err).toBeFalsy();
    expect(filterIncludesExtras(filter)).toBe(true);
  });

  it('matches everything (does not restrict results on its own)', () => {
    const { filter } = makeFilter('include:extras');
    expect(filter!({ details: details({}) } as any)).toBe(true);
  });

  it('is not reported on a normal query', () => {
    const { filter } = makeFilter('t:creature');
    expect(filterIncludesExtras(filter)).toBe(false);
  });
});

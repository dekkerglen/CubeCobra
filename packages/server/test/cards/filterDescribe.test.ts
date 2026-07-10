import { filterToReadableString, makeFilter } from '@utils/filtering/FilterCards';

const describeOf = (filterText: string): string | undefined => {
  const result = makeFilter(filterText);
  expect(result.err).toBeFalsy();
  return result.filter?.describe;
};

describe('Filter pseudo-English descriptions', () => {
  it('describes numeric conditions', () => {
    expect(describeOf('mv>=3')).toBe('mana value is 3 or more');
    expect(describeOf('mv:2')).toBe('mana value is 2');
    expect(describeOf('mv<4')).toBe('mana value is less than 4');
    expect(describeOf('loy>=4')).toBe('loyalty is 4 or more');
  });

  it('describes color conditions', () => {
    expect(describeOf('c:w')).toBe('color includes White');
    expect(describeOf('c=wu')).toBe('color is exactly White and Blue');
    expect(describeOf('c:c')).toBe('color includes colorless');
    expect(describeOf('c:m')).toBe('color is multicolored');
  });

  it('describes color identity conditions', () => {
    expect(describeOf('ci:wu')).toBe('color identity is within White and Blue');
  });

  it('describes string conditions', () => {
    expect(describeOf('t:creature')).toBe('type contains "creature"');
    expect(describeOf('o:flying')).toBe('oracle text contains "flying"');
    expect(describeOf('Bird')).toBe('name contains "bird"');
    expect(describeOf('name="Ambush Viper"')).toBe('name is "ambush viper"');
  });

  it('describes rarity ordinally', () => {
    expect(describeOf('r>=rare')).toBe('rarity is rare or higher');
    expect(describeOf('r:common')).toBe('rarity is common');
  });

  it('describes mana cost and power/toughness comparison', () => {
    expect(describeOf('mana:{2}{w}')).toBe('mana cost contains {2}{W}');
    expect(describeOf('pow>tou')).toBe('power is greater than toughness');
  });

  it('describes legality, banned, and categories', () => {
    expect(describeOf('legal:modern')).toBe('is legal in Modern');
    expect(describeOf('banned:modern')).toBe('is banned in Modern');
    expect(describeOf('is:dfc')).toBe('it is a double-faced card');
    expect(describeOf('is:fetchland')).toBe('it is a fetch land');
    expect(describeOf('is:ub')).toBe('it is a Universes Beyond card');
    expect(describeOf('not:reprint')).toBe('it is not a reprint');
    expect(describeOf('tag:aggro')).toBe('tags contains "aggro"');
  });

  it('describes negation and connectors', () => {
    expect(describeOf('-t:land')).toBe('not (type contains "land")');
    expect(describeOf('c:w t:creature')).toBe('color includes White and type contains "creature"');
    expect(describeOf('c:w or c:u')).toBe('color includes White or color includes Blue');
  });

  it('parenthesizes mixed and/or for clarity', () => {
    expect(describeOf('c:w and c:u or c:r')).toBe(
      '(color includes White and color includes Blue) or color includes Red',
    );
  });

  it('describes the include:extras directive', () => {
    expect(describeOf('include:extras')).toBe('extra printings (tokens, emblems, etc.) are included');
  });

  it('frames a full readable sentence', () => {
    expect(filterToReadableString(makeFilter('mv>=3').filter)).toBe('Matching cards where mana value is 3 or more.');
    expect(filterToReadableString(makeFilter('is:fetchland').filter)).toBe('Matching cards where it is a fetch land.');
    expect(filterToReadableString(null)).toBe('Matching all cards.');
    expect(filterToReadableString(makeFilter('').filter)).toBe('Matching all cards.');
  });

  it('does not alter filter matching behavior (fieldsUsed parity)', () => {
    expect(makeFilter('c:w').filter?.fieldsUsed).toEqual(['colors']);
    expect(makeFilter('c:w t:creature').filter?.fieldsUsed).toEqual(['colors', 'type_line']);
  });
});

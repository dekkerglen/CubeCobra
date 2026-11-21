import { assessColors, type ColorAssessCard, deckColors } from '@utils/drafting/assessColors';

const spell = (parsedCost: string[], colorIdentity: string[]): ColorAssessCard => ({
  isLand: false,
  colorIdentity,
  parsedCost,
});

const copies = (n: number, card: ColorAssessCard): ColorAssessCard[] => Array.from({ length: n }, () => card);

// 10 green and 10 blue spells.
const simic = (): ColorAssessCard[] => [
  ...copies(10, spell(['1', 'g'], ['G'])),
  ...copies(10, spell(['1', 'u'], ['U'])),
];

describe('assessColors', () => {
  it('keeps colors over 10% of the non-land cards, ignoring lands', () => {
    const cards = [
      ...simic(),
      ...copies(3, spell(['r'], ['R'])),
      ...copies(17, { isLand: true, colorIdentity: ['R'], parsedCost: [] }),
    ];
    expect(assessColors(cards)).toEqual(['U', 'R', 'G']);
    expect(assessColors([...simic(), ...copies(2, spell(['r'], ['R']))])).toEqual(['U', 'G']);
  });

  it('is colorless with no colored costs', () => {
    expect(assessColors(copies(5, spell(['3'], [])))).toEqual(['C']);
    expect(assessColors([])).toEqual(['C']);
  });

  it("doesn't count mana rocks by the colors they tap for", () => {
    const signet = spell(['2'], ['U', 'R']);
    expect(assessColors([...simic(), ...copies(3, signet)])).toEqual(['U', 'G']);
  });

  it('counts a hybrid card only toward the colors the deck already plays', () => {
    const selesnyaHybrid = spell(['1', 'g-w', 'g-w'], ['G', 'W']);
    const { colors, counts } = deckColors([...simic(), ...copies(3, selesnyaHybrid)]);
    expect(colors).toEqual(['U', 'G']);
    expect(counts).toEqual({ W: 0, U: 10, B: 0, R: 0, G: 13 });
  });

  it('counts a hybrid card toward all its colors when the deck plays none of them', () => {
    const borosHybrid = spell(['r-w'], ['R', 'W']);
    expect(assessColors([...copies(20, spell(['g'], ['G'])), ...copies(3, borosHybrid)])).toEqual(['W', 'R', 'G']);
  });

  it("doesn't count a hybrid pip that the card's own colors can pay", () => {
    const card = spell(['1', 'g', 'g-w'], ['G', 'W']);
    expect(assessColors([...simic(), ...copies(3, card)])).toEqual(['U', 'G']);
  });

  it('falls back to color identity without a parsed cost', () => {
    const cards = [...simic(), ...copies(3, { isLand: false, colorIdentity: ['G', 'W'] })];
    expect(assessColors(cards)).toEqual(['W', 'U', 'G']);
  });
});

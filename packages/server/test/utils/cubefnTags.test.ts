import { CubeCards } from '@utils/datatypes/Cube';
import { buildTagColors, cubeCardTags } from 'serverutils/cubefn';

const card = (tags: string[]) => ({ cardID: `c-${tags.join('-')}`, tags }) as any;

// A cube with a user-created board beyond the three defaults. Tag collection has to
// cover every board, not just mainboard and maybeboard.
const cardsWithCustomBoard = () =>
  ({
    mainboard: [card(['ramp'])],
    maybeboard: [card(['removal'])],
    basics: [card(['land'])],
    'mytestboard/test': [card(['custom'])],
  }) as unknown as CubeCards;

describe('cubeCardTags', () => {
  it('collects tags from every board', () => {
    expect(cubeCardTags(cardsWithCustomBoard()).sort()).toEqual(['custom', 'land', 'ramp', 'removal']);
  });

  it('ignores the non-array id property on the cards object', () => {
    const cards = { ...cardsWithCustomBoard(), id: 'cube-id' } as unknown as CubeCards;
    expect(cubeCardTags(cards).sort()).toEqual(['custom', 'land', 'ramp', 'removal']);
  });

  it('tolerates a cube with no maybeboard', () => {
    const cards = { mainboard: [card(['ramp'])] } as unknown as CubeCards;
    expect(cubeCardTags(cards)).toEqual(['ramp']);
  });
});

describe('buildTagColors', () => {
  it('adds an entry for a tag that only exists on a custom board', () => {
    const cube = { tagColors: [] };
    const result = buildTagColors(cube, cardsWithCustomBoard());
    expect(result.map((t) => t.tag).sort()).toEqual(['custom', 'land', 'ramp', 'removal']);
  });

  it('keeps an existing color for a tag that only exists on a custom board', () => {
    const cube = { tagColors: [{ tag: 'custom', color: 'Red' }] };
    const result = buildTagColors(cube, cardsWithCustomBoard());
    expect(result).toContainEqual({ tag: 'custom', color: 'Red' });
  });

  it('drops a color whose tag is no longer on any board', () => {
    const cube = { tagColors: [{ tag: 'gone', color: 'Blue' }] };
    const result = buildTagColors(cube, cardsWithCustomBoard());
    expect(result.map((t) => t.tag)).not.toContain('gone');
  });
});

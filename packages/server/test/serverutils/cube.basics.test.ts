import { CubeCards } from '@utils/datatypes/Cube';
import { addBasics, basicsBoardFor, getBasicCardsFromCube } from 'serverutils/cube';

jest.mock('serverutils/carddb', () => ({
  ...jest.requireActual('serverutils/carddb'),
  cardFromId: jest.fn((id: string) => ({ scryfall_id: id, type: 'Basic Land — Forest' })),
}));

const cubeCards = {
  mainboard: [],
  maybeboard: [],
  basics: [
    {
      cardID: 'forest-id',
      board: 'basics',
      index: 0,
      imgUrl: 'https://example.com/forest.png',
      imgBackUrl: 'https://example.com/forest-back.png',
      finish: 'Foil',
    },
  ],
} as unknown as CubeCards;

describe('getBasicCardsFromCube', () => {
  it('returns the cube cards from the basics board', () => {
    const basics = getBasicCardsFromCube(cubeCards, 'Basics');
    expect(basics).toHaveLength(1);
    expect(basics[0]!.imgUrl).toBe('https://example.com/forest.png');
  });

  it('wraps legacy basics ids when the board is missing', () => {
    expect(getBasicCardsFromCube({ mainboard: [] } as any, 'Basics', ['legacy-id'])).toEqual([{ cardID: 'legacy-id' }]);
  });

  it('returns nothing for the None opt-out', () => {
    expect(getBasicCardsFromCube(cubeCards, 'None', ['legacy-id'])).toEqual([]);
  });
});

describe('basicsBoardFor', () => {
  it('defaults to the conventional Basics board when the cube never set one', () => {
    expect(basicsBoardFor({})).toBe('Basics');
  });

  it('uses a renamed board', () => {
    expect(basicsBoardFor({ basicsBoard: 'My Lands' })).toBe('My Lands');
  });

  it('preserves the None opt-out', () => {
    expect(basicsBoardFor({ basicsBoard: 'None' })).toBe('None');
  });
});

describe('addBasics', () => {
  it('keeps custom images and finish from the basics board', () => {
    const doc = { cards: [{ cardID: 'other', index: 0, type_line: 'Instant' }], basics: [] as number[] };

    addBasics(doc, getBasicCardsFromCube(cubeCards, 'Basics'));

    expect(doc.basics).toEqual([1]);
    expect(doc.cards[1]).toMatchObject({
      cardID: 'forest-id',
      index: 1,
      isUnlimited: true,
      type_line: 'Basic Land — Forest',
      imgUrl: 'https://example.com/forest.png',
      imgBackUrl: 'https://example.com/forest-back.png',
      finish: 'Foil',
    });
  });
});

import { CubeCards } from '@utils/datatypes/Cube';
import { addBasics, getBasicCardsFromCube, getMissingDraftBasics } from 'serverutils/cube';

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

describe('getMissingDraftBasics', () => {
  const lands = { mainboard: [], lands: [{ cardID: 'lands-forest' }] } as unknown as CubeCards;

  it('uses the board the draft was created with', () => {
    expect(getMissingDraftBasics(lands, { draftBasicsBoard: 'Lands' })).toEqual([{ cardID: 'lands-forest' }]);
  });

  it('honors a draft created with None', () => {
    expect(getMissingDraftBasics(cubeCards, { draftBasicsBoard: 'None' })).toEqual([]);
  });

  it('falls back to the Basics board when the draft recorded no board', () => {
    expect(getMissingDraftBasics(cubeCards, {})[0]!.cardID).toBe('forest-id');
  });

  it('prefers the cube basics board setting when the draft recorded no board', () => {
    const both = { ...cubeCards, lands: [{ cardID: 'lands-forest' }] } as unknown as CubeCards;
    expect(getMissingDraftBasics(both, { cubeBasicsBoard: 'Lands' })).toEqual([{ cardID: 'lands-forest' }]);
  });

  // A cube setting naming a board that no longer exists (e.g. "Basics-") must not hide the Basics board.
  it('skips a cube setting that names a missing board', () => {
    expect(getMissingDraftBasics(cubeCards, { cubeBasicsBoard: 'Basics-' })[0]!.cardID).toBe('forest-id');
  });

  it('honors a cube set to None when the draft recorded no board', () => {
    expect(getMissingDraftBasics(cubeCards, { cubeBasicsBoard: 'None' })).toEqual([]);
  });

  it('falls back to legacy basics when no board matches', () => {
    expect(getMissingDraftBasics({ mainboard: [] } as any, { legacyBasics: ['legacy-id'] })).toEqual([
      { cardID: 'legacy-id' },
    ]);
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

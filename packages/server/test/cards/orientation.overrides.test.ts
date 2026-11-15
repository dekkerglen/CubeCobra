import { cardFaceOrientations } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';

// A synthetic override table: the shipped file's `landscape` map is empty, since no
// printing today is one we fail to rotate. Mocking is the only way to prove that half
// of the hatch works, and the precedence when an id is listed in both maps.
// `jest.mock` is hoisted above these imports, so cardutil picks up the mock.
jest.mock('@utils/res/OrientationOverrides.json', () => ({
  portrait: { 'portrait-id': 'Forced Portrait', 'both-id': 'Listed Twice' },
  landscape: { 'landscape-id': 'Forced Landscape', 'both-id': 'Listed Twice' },
}));

const details = (overrides: Partial<CardDetails>): CardDetails =>
  ({ layout: 'normal', type: 'Creature — Goblin', keywords: [], ...overrides }) as CardDetails;

describe('cardFaceOrientations with a mocked override table', () => {
  it('forces landscape for a listed printing whose layout would be portrait', () => {
    expect(cardFaceOrientations(details({ scryfall_id: 'landscape-id' }))).toEqual({
      front: 'landscape',
      back: 'portrait',
    });
  });

  it('forces portrait for a listed printing whose layout would be landscape', () => {
    expect(cardFaceOrientations(details({ layout: 'split', scryfall_id: 'portrait-id' })).front).toBe('portrait');
  });

  it('prefers portrait when a printing is listed in both maps', () => {
    expect(cardFaceOrientations(details({ layout: 'split', scryfall_id: 'both-id' })).front).toBe('portrait');
  });
});

import { cardFaceOrientations } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';

import { createCard, createCardDetails } from '../test-utils/data';

const details = (overrides: Partial<CardDetails>): CardDetails =>
  ({ layout: 'normal', type: 'Creature — Goblin', keywords: [], ...overrides }) as CardDetails;

describe('cardFaceOrientations', () => {
  it('treats planar and scheme cards as landscape', () => {
    expect(cardFaceOrientations(details({ layout: 'planar' })).front).toBe('landscape');
    expect(cardFaceOrientations(details({ layout: 'scheme' })).front).toBe('landscape');
  });

  it('treats split cards as landscape unless they are Aftermath', () => {
    expect(cardFaceOrientations(details({ layout: 'split' })).front).toBe('landscape');
    expect(cardFaceOrientations(details({ layout: 'split', keywords: ['Fuse'] })).front).toBe('landscape');
    expect(cardFaceOrientations(details({ layout: 'split', type: 'Enchantment — Room' })).front).toBe('landscape');
    expect(cardFaceOrientations(details({ layout: 'split', keywords: ['Aftermath'] })).front).toBe('portrait');
  });

  it('treats battles as landscape whatever their layout', () => {
    expect(cardFaceOrientations(details({ layout: 'transform', type: 'Battle — Siege' })).front).toBe('landscape');
    expect(cardFaceOrientations(details({ layout: 'normal', type: 'Battle — Control Point' })).front).toBe('landscape');
  });

  it('leaves ordinary cards portrait', () => {
    expect(cardFaceOrientations(details({})).front).toBe('portrait');
    expect(cardFaceOrientations(details({ layout: 'transform', type: 'Creature — Phyrexian' })).front).toBe('portrait');
    expect(cardFaceOrientations(details({ layout: 'flip' })).front).toBe('portrait');
    expect(cardFaceOrientations(details({ layout: 'adventure' })).front).toBe('portrait');
    expect(cardFaceOrientations(details({ layout: 'art_series' })).front).toBe('portrait');
  });

  it('reports the back face as portrait even for a landscape front', () => {
    expect(cardFaceOrientations(details({ layout: 'transform', type: 'Battle — Siege' })).back).toBe('portrait');
    expect(cardFaceOrientations(details({ layout: 'planar' })).back).toBe('portrait');
  });

  it('accepts a Card as well as bare details', () => {
    const card = createCard({ details: createCardDetails({ layout: 'planar' }) });
    expect(cardFaceOrientations(card).front).toBe('landscape');
  });

  it('ignores the image and follows the card, so a custom image is still rotated', () => {
    const card = createCard({
      imgUrl: 'https://example.com/my-own-plane.png',
      details: createCardDetails({ layout: 'planar' }),
    });
    expect(cardFaceOrientations(card).front).toBe('landscape');
  });

  it('is portrait, and does not throw, when the card carries no layout data', () => {
    expect(cardFaceOrientations(undefined)).toEqual({ front: 'portrait', back: 'portrait' });
    expect(cardFaceOrientations(null)).toEqual({ front: 'portrait', back: 'portrait' });
    // What markdown card links and the autocomplete dropdown pass.
    expect(cardFaceOrientations({ details: { image_normal: '/tool/cardimage/x' } } as any).front).toBe('portrait');
  });

  it('does not throw when keywords or type are missing', () => {
    expect(cardFaceOrientations({ layout: 'split' } as CardDetails).front).toBe('landscape');
    expect(cardFaceOrientations({ layout: 'normal' } as CardDetails).front).toBe('portrait');
  });
});

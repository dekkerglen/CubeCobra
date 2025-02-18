import { CardDetails } from '../../src/datatypes/Card';
import { reasonableCard } from '../../src/util/carddb';
import { createCardDetails } from '../test-utils/data';

describe('reasonableCard', () => {
  const overridesForNormalDetails: Partial<CardDetails> = {
    isExtra: false,
    promo: false,
    digital: false,
    isToken: false,
    border_color: 'black',
    promo_types: undefined,
    language: 'en',
    tcgplayer_id: '12345',
    collector_number: '270',
    layout: 'normal',
  };

  it('Regular details are reasonable', async () => {
    const details = createCardDetails(overridesForNormalDetails);

    expect(reasonableCard(details)).toBeTruthy();
  });

  it('Extras are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, isExtra: true });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Promos are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, promo: true });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Digital cards are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, digital: true });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Tokens are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, isToken: true });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Gold borders are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, border_color: 'gold' });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Promo variants are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, promo_types: ['boosterfun'] });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Non-english cards are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, language: 'fr' });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Must have TGC player ID to be reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, tcgplayer_id: undefined });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Must not be a promo based on collector number to be reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, collector_number: '177★' });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Must not be an art series card to be reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, layout: 'art_series' });

    expect(reasonableCard(details)).toBeFalsy();
  });
});

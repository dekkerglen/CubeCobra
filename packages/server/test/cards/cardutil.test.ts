import { cardFullName, cardName, cardNameLower } from '@utils/cardutil';
import { createCard, createCardDetails } from '../test-utils/data';

describe('cardName', () => {
  it('returns the card name from details', () => {
    const card = createCard({ details: createCardDetails({ name: 'Lightning Bolt' }) });
    expect(cardName(card)).toBe('Lightning Bolt');
  });

  it('returns custom_name for custom cards', () => {
    const card = createCard({
      cardID: 'custom-card',
      custom_name: 'My Custom Card',
      details: createCardDetails({ name: 'Fallback Name' }),
    });
    expect(cardName(card)).toBe('My Custom Card');
  });

  it('returns details name for custom-card if custom_name is not set', () => {
    const card = createCard({
      cardID: 'custom-card',
      details: createCardDetails({ name: 'Fallback Name' }),
    });
    expect(cardName(card)).toBe('Fallback Name');
  });

  it('returns empty string if no name is present', () => {
    const card = createCard({ details: createCardDetails({ name: undefined }) });
    expect(cardName(card)).toBe('');
  });
});

describe('cardNameLower', () => {
  it('returns the lowercased card name from details', () => {
    const card = createCard({ details: createCardDetails({ name_lower: 'lightning bolt' }) });
    expect(cardNameLower(card)).toBe('lightning bolt');
  });

  it('returns lowercased custom_name for custom cards', () => {
    const card = createCard({
      cardID: 'custom-card',
      custom_name: 'My Custom Card',
      details: createCardDetails({ name_lower: 'fallback name' }),
    });
    expect(cardNameLower(card)).toBe('my custom card');
  });

  it('returns details name_lower for custom-card if custom_name is not set', () => {
    const card = createCard({
      cardID: 'custom-card',
      details: createCardDetails({ name_lower: 'fallback name' }),
    });
    expect(cardNameLower(card)).toBe('fallback name');
  });

  it('returns empty string if no name_lower is present', () => {
    const card = createCard({ details: createCardDetails({ name_lower: undefined }) });
    expect(cardNameLower(card)).toBe('');
  });
});

describe('cardFullName', () => {
  it('returns the full_name from details', () => {
    const card = createCard({ details: createCardDetails({ full_name: 'Lightning Bolt [SET-123]' }) });
    expect(cardFullName(card)).toBe('Lightning Bolt [SET-123]');
  });

  it('returns custom full name for custom cards', () => {
    const card = createCard({
      cardID: 'custom-card',
      custom_name: 'My Custom Card',
      details: createCardDetails({ full_name: 'Fallback Full Name [CST-001]', set: 'CST', collector_number: '001' }),
    });
    expect(cardFullName(card)).toBe('My Custom Card [CST-001]');
  });

  it('returns details.full_name for custom-card if custom_name is not set', () => {
    const card = createCard({
      cardID: 'custom-card',
      details: createCardDetails({ full_name: 'Fallback Full Name [CST-005]', set: 'CST', collector_number: '005' }),
    });
    expect(cardFullName(card)).toBe('Fallback Full Name [CST-005]');
  });

  it('returns empty string if no full_name is present', () => {
    const card = createCard({ details: createCardDetails({ full_name: undefined }) });
    expect(cardFullName(card)).toBe('');
  });
});

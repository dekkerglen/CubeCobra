import { cardFullName, cardName, cardNameLower, isManaFixingLand } from '@utils/cardutil';

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

describe('isManaFixingLand', () => {
  const land = (overrides: Partial<Parameters<typeof createCardDetails>[0]>) =>
    createCardDetails({ type: 'Land', oracle_text: '', produced_mana: [], ...overrides });

  it('flags multi-color producers (shocks, triomes, City of Brass)', () => {
    expect(isManaFixingLand(land({ name: 'Steam Vents', produced_mana: ['U', 'R'] }))).toBe(true);
    expect(isManaFixingLand(land({ name: 'Raugrin Triome', produced_mana: ['U', 'R', 'W'] }))).toBe(true);
    expect(isManaFixingLand(land({ name: 'Mana Confluence', produced_mana: ['W', 'U', 'B', 'R', 'G'] }))).toBe(true);
  });

  it('flags traditional fetches via search/library/basic-land-type', () => {
    expect(
      isManaFixingLand(
        land({
          name: 'Scalding Tarn',
          oracle_text: '{T}, Pay 1 life, Sacrifice this land: Search your library for an Island or Mountain card.',
        }),
      ),
    ).toBe(true);
  });

  it('flags generic basic-land fetches (Evolving Wilds, Fabled Passage)', () => {
    expect(
      isManaFixingLand(
        land({
          name: 'Evolving Wilds',
          oracle_text: '{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
        }),
      ),
    ).toBe(true);
  });

  it('flags multi-basic-type fetches (Krosan Verge)', () => {
    expect(
      isManaFixingLand(
        land({
          name: 'Krosan Verge',
          oracle_text: '{4}, {T}, Sacrifice Krosan Verge: Search your library for a Forest card and a Plains card.',
        }),
      ),
    ).toBe(true);
  });

  it('does not flag utility lands without search text', () => {
    expect(
      isManaFixingLand(
        land({
          name: 'Wasteland',
          oracle_text: '{T}: Add {C}.\n{T}, Sacrifice Wasteland: Destroy target nonbasic land.',
          produced_mana: ['C'],
        }),
      ),
    ).toBe(false);
    expect(
      isManaFixingLand(
        land({
          name: "Mishra's Factory",
          type: 'Land',
          oracle_text: '{T}: Add {C}. {1}: Mishra\'s Factory becomes a 2/2 Assembly-Worker artifact creature.',
          produced_mana: ['C'],
        }),
      ),
    ).toBe(false);
  });

  it('does not flag basic lands', () => {
    expect(
      isManaFixingLand(
        land({
          name: 'Plains',
          type: 'Basic Land — Plains',
          produced_mana: ['W'],
        }),
      ),
    ).toBe(false);
  });

  it('does not flag non-land cards even if their oracle text matches', () => {
    expect(
      isManaFixingLand(
        createCardDetails({
          name: 'Path to Exile',
          type: 'Instant',
          oracle_text: 'Exile target creature. Its controller may search their library for a basic land card.',
        }),
      ),
    ).toBe(false);
  });
});

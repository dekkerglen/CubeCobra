import Card, { CardDetails } from 'datatypes/Card';

/**
 * Create a Card for testing by providing sane defaults but allow for overriding
 *
 * @param overrides
 */
const createCard = (overrides?: Partial<Card>): Card => ({
  cardID: 'cardId',
  ...overrides,
});

/**
 * Create a CardDetails for testing by providing sane defaults but allow for overriding
 * @param overrides
 */
const createCardDetails = (overrides?: Partial<CardDetails>): CardDetails => ({
  error: false,
  language: 'en',
  layout: '',
  isToken: false,
  name: 'card name',
  scryfall_id: 'scryfall-id',
  oracle_id: 'oracle-id',
  set: 'abc',
  collector_number: '123',
  released_at: '',
  promo: false,
  reprint: false,
  digital: false,
  full_name: 'full card name',
  name_lower: 'lower name',
  artist: 'artist name',
  scryfall_uri: 'https://scryfall.com/my-card',
  rarity: 'rare',
  legalities: {
    'modern': 'banned',
    'standard': 'not_legal',
    'vintage': 'restricted',
    'commander': 'legal'
  },
  oracle_text: 'oracle text goes here',
  cmc: 5,
  type: 'Instant',
  colors: ['w', 'b'],
  color_identity: ['w', 'b', 'r'],
  colorcategory: 'Lands',
  parsed_cost: ['1', 'w', 'b'],
  finishes: ['nonfoil', 'etched'],
  border_color: 'black',
  mtgo_id: 12345,
  full_art: true,
  prices: {
    usd: 10.10,
    eur: 9.00,
    tix: 3,
    usd_etched: 12.50,
    usd_foil: 15.25,
  },
  tokens: [],
  set_name: 'cool set',
  ...overrides,
});

export { createCard, createCardDetails };

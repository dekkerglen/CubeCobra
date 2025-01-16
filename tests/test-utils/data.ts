import Card, { CardDetails } from 'datatypes/Card';
import Cube, { CubeImage } from 'datatypes/Cube';
import User from 'datatypes/User';

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
    modern: 'banned',
    standard: 'not_legal',
    vintage: 'restricted',
    commander: 'legal',
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
    usd: 10.1,
    eur: 9.0,
    tix: 3,
    usd_etched: 12.5,
    usd_foil: 15.25,
  },
  tokens: [],
  set_name: 'cool set',
  ...overrides,
});

const createCube = (overrides?: Partial<Cube>): Cube => ({
  id: '34c888d0-493a-4613-b38e-595076c23af2',
  shortId: 'test-cube',
  owner: createUser(),
  name: 'test cube',
  visibility: '',
  priceVisibility: '',
  featured: false,
  categoryPrefixes: [],
  tagColors: [],
  defaultFormat: 0,
  numDecks: 0,
  description: '',
  imageName: '',
  date: 0,
  defaultSorts: [],
  formats: [],
  following: [],
  defaultStatus: 'Not Owned',
  defaultPrinting: '',
  disableAlerts: false,
  basics: [],
  tags: [],
  keywords: [],
  cardCount: 0,
  image: createCubeImage(),
  version: 0,
  ...overrides,
});

const createUser = (overrides?: Partial<User>): User => ({
  id: 'test-user',
  username: 'test-user',
  ...overrides,
});

const createCubeImage = (overrides?: Partial<CubeImage>): CubeImage => ({
  uri: '/content/images/card.png',
  artist: 'magic artist',
  id: '12345',
  imageName: 'card name',
  ...overrides,
});

export { createCard, createCardDetails, createCube, createCubeImage, createUser };

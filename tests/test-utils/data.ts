//Ensure we use the real uuid rather than any mocked version if it is relevant to a test
const uuid = jest.requireActual('uuid');
const uuidv4 = uuid.v4;

import { BASIC_LAND_MANA_MAPPING } from '../../src/client/utils/cardutil';
import Article from '../../src/datatypes/Article';
import BlogPost from '../../src/datatypes/BlogPost';
import Card, {
  BasicLand,
  BoardChanges,
  CardDetails,
  Changes,
  CubeCardEdit,
  CubeCardRemove,
  CubeCardSwap,
  SUPPORTED_FORMATS,
} from '../../src/datatypes/Card';
import Content, { ContentStatus, ContentType } from '../../src/datatypes/Content';
import Cube, { CubeImage } from '../../src/datatypes/Cube';
import Draft, { DraftStep } from '../../src/datatypes/Draft';
import DraftSeat from '../../src/datatypes/DraftSeat';
import Episode from '../../src/datatypes/Episode';
import Image from '../../src/datatypes/Image';
import Podcast from '../../src/datatypes/Podcast';
import User from '../../src/datatypes/User';
import Video from '../../src/datatypes/Video';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const ALPHANUMERIC = `${LETTERS}${NUMBERS}`;

export const generateRandomString = (alphabet: string, minLength: number, maxLength?: number): string => {
  const length = maxLength ? Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength : minLength;

  return Array.from({ length }, () => alphabet.charAt(Math.floor(Math.random() * alphabet.length))).join('');
};

export const generateRandomNumber = (minLength: number, maxLength?: number): number => {
  return Number.parseInt(generateRandomString(NUMBERS, minLength, maxLength));
};

/**
 * Create a Card for testing by providing sane defaults but allow for overriding
 *
 * @param overrides
 */
export const createCard = (overrides?: Partial<Card>): Card => ({
  index: generateRandomNumber(1, 3),
  cardID: uuidv4(),
  details: createCardDetails(),
  ...overrides,
});

export const createCardWithoutDetails = (overrides?: Partial<Omit<Card, 'details'>>): Card => ({
  index: generateRandomNumber(1, 3),
  cardID: uuidv4(),
  ...overrides,
});

export const createCardFromDetails = (overrides?: Partial<CardDetails>): Card => {
  return createCard({ details: createCardDetails(overrides) });
};

/**
 * Create a CardDetails for testing by providing sane defaults but allow for overriding
 * @param overrides
 */
export const createCardDetails = (overrides?: Partial<CardDetails>): CardDetails => ({
  error: false,
  language: generateRandomString(LETTERS, 2).toLowerCase(),
  layout: '',
  isToken: false,
  name: generateRandomString(ALPHANUMERIC, 10, 25),
  scryfall_id: uuidv4(),
  oracle_id: uuidv4(),
  set: generateRandomString(ALPHANUMERIC, 3).toLowerCase(),
  setIndex: 0,
  collector_number: '123',
  released_at: '',
  promo: false,
  promo_types: undefined,
  reprint: false,
  digital: false,
  full_name: generateRandomString(LETTERS, 10, 25),
  name_lower: generateRandomString(LETTERS, 10, 25).toLowerCase(),
  artist: `${generateRandomString(LETTERS, 3, 10)} ${generateRandomString(LETTERS, 5, 15)}`,
  scryfall_uri: `https://scryfall.com/${uuidv4()}`,
  rarity: 'rare',
  legalities: Object.fromEntries(SUPPORTED_FORMATS.map((format) => [format, 'not_legal' as const])),
  oracle_text: 'oracle text goes here',
  cmc: 5,
  type: 'Instant',
  colors: ['w', 'b'],
  color_identity: ['w', 'b', 'r'],
  keywords: [],
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
  games: ['paper'],
  reserved: false,
  ...overrides,
});

export const createCustomCardDetails = (overrides?: Partial<CardDetails>): CardDetails => {
  //See custom-card in update_cards.ts
  const customSettings = {
    scryfall_id: 'custom-card',
    oracle_id: 'custom-card',
    name: 'Custom Card',
    full_name: 'Custom Card [-]',
    printed_name: undefined,
    lang: 'en',
    set: '',
    set_name: '',
    collector_number: '',
    released_at: '',
    reprint: false,
    border_color: 'black' as 'black' | 'white' | 'silver' | 'gold',
    promo: false,
    promo_types: [],
    digital: false,
    finishes: [],
    prices: {
      usd: undefined,
      usd_foil: undefined,
      usd_etched: undefined,
      eur: undefined,
      tix: undefined,
    },
    image_small: '',
    image_normal: '/content/custom_card.png',
    image_flip: '',
    card_faces: undefined,
    loyalty: undefined,
    power: undefined,
    toughness: undefined,
    type_line: '',
    oracle_text: '',
    mana_cost: '',
    cmc: 0,
    colors: [],
    color_identity: [],
    keywords: [],
    produced_mana: [],
    legalities: {
      standard: 'not_legal',
      historic: 'not_legal',
      pioneer: 'not_legal',
      modern: 'not_legal',
      legacy: 'not_legal',
      pauper: 'not_legal',
      vintage: 'not_legal',
      penny: 'not_legal',
      commander: 'not_legal',
      brawl: 'not_legal',
    } as Record<string, 'legal' | 'not_legal' | 'banned' | 'restricted'>,
    layout: 'normal',
    rarity: 'common',
    artist: '',
    scryfall_uri: '',
    mtgo_id: 0,
    textless: false,
    tcgplayer_id: '',
    full_art: false,
    flavor_text: '',
    frame_effects: [],
    frame: '',
    card_back_id: '',
    artist_id: '',
    illustration_id: '',
    content_warning: false,
    variation: false,
    preview: {
      source: '',
      source_uri: '',
      previewed_at: '',
    },
    related_uris: {
      gatherer: '',
      tcgplayer_decks: '',
      edhrec: '',
      mtgtop8: '',
    },
    all_parts: [],
    object: 'card',
  };
  return createCardDetails({ ...customSettings, ...overrides });
};

export const createCube = (overrides?: Partial<Cube>): Cube => ({
  id: uuidv4(),
  shortId: generateRandomString(ALPHANUMERIC, 10).toLowerCase(),
  owner: createUser(),
  name: generateRandomString(LETTERS, 20),
  visibility: 'pu',
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
  cardCount: 360,
  image: createCubeImage(),
  version: 0,
  ...overrides,
});

export const createUser = (overrides?: Partial<User>): User => ({
  id: uuidv4(),
  username: generateRandomString(LETTERS, 5, 10).toLowerCase(),
  imageName: 'Ambush Viper',
  ...overrides,
});

export const createCubeImage = (overrides?: Partial<CubeImage>): CubeImage => ({
  uri: `/content/images/${uuidv4()}.png`,
  artist: `${generateRandomString(LETTERS, 3, 10)} ${generateRandomString(LETTERS, 5, 15)}`,
  id: uuidv4(),
  imageName: `${generateRandomString(LETTERS, 5, 10)} ${generateRandomString(LETTERS, 5, 15)}`,
  ...overrides,
});

export const createBlogPost = (overrides?: Partial<BlogPost>): BlogPost => {
  return {
    id: uuidv4(),
    cube: createCube().id,
    ...overrides,
  } as BlogPost;
};

export const createBasicLand = (name: BasicLand): Card => {
  return createCard({
    type_line: `Basic Land - ${name}`,
    details: createCardDetails({
      name: name,
      type: `Basic Land - ${name}`,
      produced_mana: [BASIC_LAND_MANA_MAPPING[name]],
    }),
  });
};

export const createDraftSeat = (isBot: boolean, overrides?: Partial<DraftSeat>): DraftSeat => {
  return {
    description: generateRandomString(ALPHANUMERIC, 10, 20),
    mainboard: [],
    sideboard: [],
    pickorder: [],
    trashorder: [],
    owner: isBot ? null : createUser(),
    bot: isBot,
    name: generateRandomString(ALPHANUMERIC, 10, 20),
    ...overrides,
  } as DraftSeat;
};

export const createBasicsSet = (): Card[] => {
  return [
    createCardFromDetails({ type: 'Land', name: 'Island' }),
    createCardFromDetails({ type: 'Land', name: 'Forest' }),
    createCardFromDetails({ type: 'Land', name: 'Plains' }),
    createCardFromDetails({ type: 'Land', name: 'Mountain' }),
    createCardFromDetails({ type: 'Land', name: 'Swamp' }),
  ];
};

export const createBasicsIds = (): string[] => {
  return createBasicsSet().map((c) => c.cardID);
};

/**
 * Two seats, 3 packs, 30 cards total (5 cards per pack)
 */
export const createCompletedSoloDraft = (overrides?: Partial<Draft>): Draft => {
  // Create 30 unique cards
  const cards = Array.from({ length: 30 }, () => createCard());
  //Add 5 basics
  const basics = createBasicsSet();

  const standardPickSteps: DraftStep[] = [];
  for (let i = 0; i < 5; i++) {
    standardPickSteps.push({
      action: 'pick',
      amount: 1,
    });
    standardPickSteps.push({
      action: 'pass',
      amount: null,
    });
  }
  standardPickSteps.pop();

  // Create draft states with 5 cards each
  const createPackState = (
    startIndex: number,
  ): {
    cards: number[];
    steps: DraftStep[];
  } => {
    return {
      cards: cards.slice(startIndex, startIndex + 5).map((_, idx) => startIndex + idx) as number[],
      steps: standardPickSteps,
    };
  };

  const allCards = cards.concat(basics);
  return {
    seats: [createDraftSeat(false), createDraftSeat(true)],
    cards: allCards,
    cube: uuidv4(),
    InitialState: [
      // First seat's packs
      [
        createPackState(0), // Pack 1: cards 0-4
        createPackState(5), // Pack 2: cards 5-9
        createPackState(10), // Pack 3: cards 10-14
      ],
      // Second seat's packs
      [
        createPackState(15), // Pack 1: cards 15-19
        createPackState(20), // Pack 2: cards 20-24
        createPackState(25), // Pack 3: cards 25-29
      ],
    ],
    basics: [30, 31, 32, 33, 34],
    id: uuidv4(),
    type: 'd',
    owner: createUser(),
    cubeOwner: createUser(),
    date: 0,
    name: generateRandomString(ALPHANUMERIC, 10, 25),
    complete: false,
    ...overrides,
  } as Draft;
};

export const createChangelog = (mainboard?: BoardChanges, maybeboard?: BoardChanges, version: number = 1): Changes => {
  const changes: Changes = {};

  //All fields can be missing (though logically at least one should be set)
  if (version) {
    changes.version = version;
  }
  if (mainboard) {
    changes.mainboard = mainboard;
  }
  if (maybeboard) {
    changes.maybeboard = maybeboard;
  }

  return changes;
};

export const createChangelogCardAdd = (overrides?: Partial<Card>): Card => {
  return { ...createCardWithoutDetails(), ...overrides } as Card;
};

export const createChangelogCardRemove = (overrides?: Partial<CubeCardRemove>): CubeCardRemove => {
  return { index: generateRandomNumber(1, 3), oldCard: createCardWithoutDetails(), ...overrides } as CubeCardRemove;
};

export const createChangelogCardEdit = (overrides?: Partial<CubeCardEdit>): CubeCardEdit => {
  return {
    index: generateRandomNumber(1, 3),
    oldCard: createCardWithoutDetails(),
    newCard: createCardWithoutDetails(),
    ...overrides,
  } as CubeCardEdit;
};

export const createChangelogCardSwap = (overrides?: Partial<CubeCardSwap>): CubeCardSwap => {
  return {
    index: generateRandomNumber(1, 3),
    oldCard: createCardWithoutDetails(),
    card: createCardWithoutDetails(),
    ...overrides,
  } as CubeCardSwap;
};

export const createCardImage = (overrides?: Partial<Image>): Image => {
  return {
    uri: `/content/images/${uuidv4()}.png`,
    artist: `${generateRandomString(LETTERS, 3, 10)} ${generateRandomString(LETTERS, 5, 15)}`,
    id: uuidv4(),
    imageName: `${generateRandomString(LETTERS, 5, 10)} ${generateRandomString(LETTERS, 5, 15)}`,
    ...overrides,
  } as Image;
};

const createContent = (type: ContentType, overrides?: Partial<Content>): Content => {
  const status = overrides?.status || ContentStatus.PUBLISHED;
  const user = overrides?.owner || createUser();
  const userId = user.id;

  return {
    id: uuidv4(),
    type,
    typeStatusComp: `${type}:${status}`,
    typeOwnerComp: `${type}:${userId}`,
    status: status,
    date: new Date('2024-03-24').valueOf(),
    body: generateRandomString(LETTERS, 10, 20),
    owner: user,
    short: generateRandomString(LETTERS, 5, 10),
    username: 'user-1',
    ...overrides,
  } as Content;
};

export const createArticle = (overrides?: Partial<Article>): Article => {
  return createContent(ContentType.ARTICLE, {
    imageName: 'Stock Up',
    image: createCardImage({ imageName: 'Stock Up' }),
    ...overrides,
  }) as Article;
};

export const createEpisode = (overrides?: Partial<Episode>): Episode => {
  return createContent(ContentType.EPISODE, {
    podcastName: 'This is a podcast',
    image: 'https://example.com/podcast.png',
    podcast: 'https://example.com/podcast.rss',
    podcastGuid: uuidv4(),
    ...overrides,
  }) as Episode;
};

export const createPodcast = (overrides?: Partial<Podcast>): Podcast => {
  return createContent(ContentType.PODCAST, {
    image: 'https://example.com/podcast.png',
    title: 'This is a podcast',
    url: 'https://example.com/podcast.rss',
    description: 'The best cubers around',
    ...overrides,
  }) as Podcast;
};

export const createVideo = (overrides?: Partial<Video>): Video => {
  return createContent(ContentType.VIDEO, {
    imageName: 'Stock Up',
    image: createCardImage({ imageName: 'Stock Up' }),
    url: 'https://youtube.example.com/video/abcdefg',
    ...overrides,
  }) as Video;
};

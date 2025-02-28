import { TagColor } from 'datatypes/Cube';

import Card, {
  CardDetails as CardDetailsType,
  COLOR_CATEGORIES,
  ColorCategory,
  DefaultElo,
} from '../../datatypes/Card';
import {
  isGenericHybridManaSymbol,
  isHybridManaSymbol,
  isManaSymbol,
  isPhyrexianManaSymbol,
  ManaSymbol,
} from '../../datatypes/Mana';
import CategoryOverrides from '../res/CategoryOverrides.json';
import LandCategories from '../res/LandCategories.json';
import { arraysEqual } from './Util';

export const COLOR_COMBINATIONS: string[][] = [
  [],
  ['W'],
  ['U'],
  ['B'],
  ['R'],
  ['G'],
  ['W', 'U'],
  ['U', 'B'],
  ['B', 'R'],
  ['R', 'G'],
  ['G', 'W'],
  ['W', 'B'],
  ['U', 'R'],
  ['B', 'G'],
  ['R', 'W'],
  ['G', 'U'],
  ['G', 'W', 'U'],
  ['W', 'U', 'B'],
  ['U', 'B', 'R'],
  ['B', 'R', 'G'],
  ['R', 'G', 'W'],
  ['R', 'W', 'B'],
  ['G', 'U', 'R'],
  ['W', 'B', 'G'],
  ['U', 'R', 'W'],
  ['B', 'G', 'U'],
  ['U', 'B', 'R', 'G'],
  ['B', 'R', 'G', 'W'],
  ['R', 'G', 'W', 'U'],
  ['G', 'W', 'U', 'B'],
  ['W', 'U', 'B', 'R'],
  ['W', 'U', 'B', 'R', 'G'],
];

export const BASIC_LAND_MANA_MAPPING: { [key: string]: ManaSymbol } = {
  Plains: 'W',
  Island: 'U',
  Swamp: 'B',
  Mountain: 'R',
  Forest: 'G',
  Waste: 'C',
};

// export const COLOR_INCLUSION_MAP: Record<string, Record<string, boolean>> = fromEntries(
//   COLOR_COMBINATIONS.map((colors) => [
//     colors.join(''),
//     fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), arrayIsSubset(comb, colors)])),
//   ]),
// );
// for (const colorsIncluded of Object.values(COLOR_INCLUSION_MAP)) {
//   colorsIncluded.includes = Object.keys(colorsIncluded).filter((c) => colorsIncluded[c]);
// }

export function normalizeName(name: string): string {
  return name
    .trim()
    .normalize('NFD') // convert to consistent unicode format
    .replace(/[\u0300-\u036f]/g, '') // remove unicode
    .toLowerCase();
}

export function encodeName(name: string): string {
  return encodeURIComponent(name.toLowerCase());
}

export function decodeName(name: string): string {
  return decodeURIComponent(name.toLowerCase());
}

export function cardsAreEquivalent(a?: Card, b?: Card): boolean {
  if (!a || !b) {
    return false;
  }
  return (
    a.cardID === b.cardID &&
    a.type_line === b.type_line &&
    a.status === b.status &&
    a.cmc === b.cmc &&
    arraysEqual(cardColors(a), cardColors(b)) &&
    arraysEqual(a.tags, b.tags) &&
    a.finish === b.finish &&
    a.imgUrl === b.imgUrl &&
    a.imgBackUrl === b.imgBackUrl &&
    a.notes === b.notes &&
    a.colorCategory === b.colorCategory &&
    a.rarity === b.rarity
  );
}

export const mainboardRate = ({ mainboards, sideboards }: { mainboards: number; sideboards: number }): number => {
  return mainboards + sideboards > 0 ? mainboards / (mainboards + sideboards) : 0;
};

export const pickRate = ({ picks, passes }: { picks: number; passes: number }): number => {
  return picks + passes > 0 ? picks / (picks + passes) : 0;
};

export const cardTags = (card: Card): string[] => card.tags || [];

export const cardFinish = (card: Card): string => card.finish ?? 'Non-foil';

export const cardStatus = (card: Card): any => card.status;

export const cardColorIdentity = (card: Card): string[] => {
  if (card.colors) {
    if (typeof card.colors === 'string') {
      return [...card.colors];
    }

    return card.colors;
  }

  if (card.details) {
    if (typeof card.details.color_identity === 'string') {
      return [...card.details.color_identity];
    }

    return card.details.color_identity;
  }

  return [];
};

export const cardIndex = (card: Card): number => (card.index === undefined ? -1 : card.index);

export const CardDetails = (card: Card): CardDetailsType =>
  card.details ?? {
    scryfall_id: '',
    oracle_id: '',
    name: 'Invalid Card',
    set: '',
    collector_number: '',
    released_at: '',
    promo: false,
    reprint: false,
    digital: false,
    isToken: false,
    full_name: 'Invalid Card',
    name_lower: 'invalid card',
    artist: '',
    scryfall_uri: '',
    rarity: '',
    legalities: {},
    oracle_text: '',
    cmc: 0,
    type: '',
    colors: [],
    color_identity: [],
    keywords: [],
    colorcategory: 'Colorless',
    parsed_cost: [],
    border_color: 'black',
    language: '',
    mtgo_id: -1,
    layout: '',
    full_art: false,
    error: true,
    prices: {},
    tokens: [],
    set_name: '',
    finishes: [],
    promo_types: [],
  };

export const cardCmc = (card: Card): number => {
  if (card.cmc) {
    // if it's a string
    if (typeof card.cmc === 'string') {
      // if it includes a dot, parse as float, otherwise parse as int
      return card.cmc.includes('.') ? parseFloat(card.cmc) : parseInt(card.cmc);
    }
    return card.cmc;
  }

  return card.details?.cmc ?? 0;
};

export const cardId = (card: Card): string => card.cardID ?? card.details?.scryfall_id;

export const cardType = (card: Partial<Card>): string => card.type_line ?? card.details?.type ?? '';

export const cardRarity = (card: Card): string => card.rarity ?? card.details?.rarity ?? '';

export const cardAddedTime = (card: Card): Date | null => {
  if (!card.addedTmsp) {
    return null;
  }

  //Stored as a date formatted string. This is what the backend does when adding cards via Text/Names
  const fromString = Date.parse(card.addedTmsp);
  if (!Number.isNaN(fromString)) {
    return new Date(fromString);
  }

  //Stored as a string of a unix timestamp. This is what the UI does when adding cards
  const n = Number(card.addedTmsp);
  //addedTmsp is a unix timestamp number
  if (!Number.isNaN(n)) {
    return new Date(n);
  }

  return null;
};

export const cardImageUrl = (card: Card): string =>
  card.imgUrl ?? card.details?.image_normal ?? card.details?.image_small ?? '';

export const cardImageBackUrl = (card: Card): string => card.imgBackUrl ?? card.details?.image_flip ?? '';

export const cardNotes = (card: Card): string | null => card.notes ?? null;

/*
 * Helper to convert the old color category types into current Type. Existing cards may have their colorCategory
 * set to the legacy value and used in places such as CSV export, which then can import instead of the current values.
 */
export const convertFromLegacyCardColorCategory = (colorCategory: string): ColorCategory | null => {
  const legacyColorCategoryToCurrentMap = new Map([
    ['w', 'White'],
    ['u', 'Blue'],
    ['b', 'Black'],
    ['r', 'Red'],
    ['g', 'Green'],
    ['c', 'Colorless'],
    ['m', 'Multicolored'],
    ['h', 'Hybrid'],
    ['l', 'Lands'],
  ]);

  //If it is a valid current color category, return it.
  //In order to check if a string is contained in the array, Typescript requires us to "widen" it by casting as readonly array of string
  if ((COLOR_CATEGORIES as ReadonlyArray<string>).includes(colorCategory)) {
    return colorCategory as ColorCategory;
    //If it is a legacy cateogry, convert to the current version
  } else if (legacyColorCategoryToCurrentMap.get(colorCategory) !== undefined) {
    return legacyColorCategoryToCurrentMap.get(colorCategory)! as ColorCategory;
    //Else, not much we can do but return the same value
  } else {
    return null;
  }
};

/*
 * Hybrid color category is explicitly set on cards by cube owners. This function therefore won't
 * return Hybrid as an option, those cards will be funneled into the Multicolored category
 */
export const cardColorCategory = (card: Card): ColorCategory => {
  if (card.colorCategory) {
    const converted = convertFromLegacyCardColorCategory(card.colorCategory);
    if (converted !== null) {
      return converted;
    }
  }

  return cardColorIdentityCategory(card);
};

/// Get the color category from the color identity instead of what the user has set
/// for the color category. This is helpful for rendering the color of the card background
/// regardless of what column the card is in.
export const cardColorIdentityCategory = (card: Card): ColorCategory => {
  if (cardType(card).includes('Land')) {
    return 'Lands';
  }

  const colors = cardColorIdentity(card);

  if (colors.length === 0) {
    return 'Colorless';
  }
  if (colors.length > 1) {
    return 'Multicolored';
  }

  if (colors.length === 1) {
    if (colors.includes('W')) {
      return 'White';
    }
    if (colors.includes('U')) {
      return 'Blue';
    }
    if (colors.includes('B')) {
      return 'Black';
    }
    if (colors.includes('R')) {
      return 'Red';
    }
    if (colors.includes('G')) {
      return 'Green';
    }
  }

  return 'Colorless';
};

// prices being null causes unwanted coercing behaviour in price filters,
// so nullish price values are transformed to undefined instead
export const cardNormalPrice = (card: Card): number | undefined => card.details?.prices.usd ?? undefined;

export const cardFoilPrice = (card: Card): number | undefined => card.details?.prices.usd_foil ?? undefined;

export const cardEtchedPrice = (card: Card): number | undefined => card.details?.prices.usd_etched ?? undefined;

export const cardPrice = (card: Card): number | undefined => {
  let prices: (number | undefined)[];
  switch (cardFinish(card)) {
    case 'Foil':
      prices = [cardFoilPrice(card), cardNormalPrice(card), cardEtchedPrice(card)];
      break;
    case 'Non-foil':
      prices = [cardNormalPrice(card), cardFoilPrice(card), cardEtchedPrice(card)];
      break;
    case 'Etched':
      prices = [cardEtchedPrice(card), cardFoilPrice(card), cardNormalPrice(card)];
      break;
    default:
      prices = [cardNormalPrice(card), cardFoilPrice(card), cardEtchedPrice(card)];
  }

  return prices.find((p) => typeof p !== 'undefined');
};

export const cardPriceEur = (card: Card): number | undefined => card.details?.prices.eur ?? undefined;

export const cardPriceManaPool = (card: Card): number | undefined => card.details?.prices.mp ?? undefined;

export const cardPriceCardKingdom = (card: Card): number | undefined => card.details?.prices.ck ?? undefined;

export const cardTix = (card: Card): number | undefined => card.details?.prices.tix ?? undefined;

export const cardIsFullArt = (card: Card): boolean => card.details?.full_art ?? false;

export const cardCost = (card: Card): string[] => card.details?.parsed_cost ?? [];

export const cardSet = (card: Card): string => card.details?.set ?? '';

export const cardSetName = (card: Card): string => card.details?.set_name ?? '';

export const cardCollectorNumber = (card: Card): string => card.details?.collector_number ?? '';

export const cardPromo = (card: Card): boolean => card.details?.promo ?? false;

export const cardDigital = (card: Card): boolean => card.details?.digital ?? false;

export const cardIsToken = (card: Card): boolean => card.details?.isToken ?? false;

export const cardBorderColor = (card: Card): string => card.details?.border_color ?? 'black';

export const cardName = (card: Card): string => card.details?.name ?? '';

export const cardNameLower = (card: Card): string => card.details?.name_lower ?? '';

export const cardFullName = (card: Card): string => card.details?.full_name ?? '';

export const cardArtist = (card: Card): string => card.details?.artist ?? '';

export const cardScryfallUri = (card: Card): string => card.details?.scryfall_uri ?? '';

export const cardOracleText = (card: Card): string => card.details?.oracle_text ?? '';

export const cardOracleId = (card: Card): string => card.details?.oracle_id ?? '';

export const cardLegalities = (card: Card): Record<string, string> => card.details?.legalities ?? {};

const cardLegalityFilter = (card: Card, legality: string): string[] => {
  const legalities = cardLegalities(card);
  return Object.keys(legalities).filter((format) => legalities[format] === legality);
};

export const cardLegalIn = (card: Card): string[] => cardLegalityFilter(card, 'legal');
export const cardBannedIn = (card: Card): string[] => cardLegalityFilter(card, 'banned');
export const cardRestrictedIn = (card: Card): string[] => cardLegalityFilter(card, 'restricted');

export const detailsToCard = (details: CardDetailsType): Card => {
  return {
    cardID: details.scryfall_id,
    type_line: details.type,
    status: details.error ? 'Not Found' : 'Not Owned',
    cmc: details.cmc,
    tags: [],
    finish: 'Non-foil',
    imgUrl: details.image_normal,
    imgBackUrl: details.image_flip,
    notes: '',
    colorCategory: details.colorcategory,
    rarity: details.rarity,
    details,
  };
};

export const cardColors = (card: Card): string[] => {
  //Old data may have colors (or details.colors) as a string like WBG instead of [W, B, G]
  if (card.colors) {
    if (typeof card.colors === 'string') {
      return [...card.colors];
    }

    return card.colors;
  }

  if (card.details) {
    if (typeof card.details.colors === 'string') {
      return [...card.details.colors];
    }

    return card.details.colors;
  }

  return [];
};

export const cardColorsAsManaSymbols = (card: Card): ManaSymbol[] => {
  return cardColors(card).map((symbol: string) => symbol.toUpperCase() as ManaSymbol);
};

export const cardLanguage = (card: Card): string => card.details?.language ?? '';

export const cardMtgoId = (card: Card): number => card.details?.mtgo_id ?? -1;

export const cardTcgplayerId = (card: Card): string => card.details?.tcgplayer_id ?? '';

export const cardLoyalty = (card: Card): number => parseInt(card.details?.loyalty ?? '0');

export const cardPower = (card: Card): number => parseFloat(card.details?.power ?? '0');

export const cardToughness = (card: Card): number => parseFloat(card.details?.toughness ?? '0');

export const cardImageSmall = (card: Card): string => card.details?.image_small ?? '';

export const cardImageNormal = (card: Card): string => card.details?.image_normal ?? '';

export const cardArtCrop = (card: Card): string => card.details?.art_crop ?? '';

export const cardImageFlip = (card: Card): string => card.details?.image_flip ?? '';

export const cardTokens = (card: Card): string[] => card.details?.tokens ?? [];

export const cardElo = (card: Card): number => (card.details ? card.details?.elo || DefaultElo : DefaultElo);

export const cardPopularity = (card: Card): number => card.details?.popularity ?? 0;

export const cardCubeCount = (card: Card): number => (card.details ? (card.details?.cubeCount ?? 0) : 0);

export const cardPickCount = (card: Card): number => (card.details ? (card.details?.pickCount ?? 0) : 0);

export const cardLayout = (card: Card): string => card.details?.layout ?? '';

export const cardReleaseDate = (card: Card): string => card.details?.released_at ?? '';

const BYTE_SIZE = 8;
const CHINESE_MAX_CODE_POINT = 205743;
const BITMAP = [' ', '\n', '\t', '\v', '*', '/', '&', ':', ';', '.', ',', '?', '='].reduce(
  (bitmap, char) => {
    const charCode = char.charCodeAt(0);
    const byteIndex = Math.floor(charCode / BYTE_SIZE);
    const bitIndex = charCode % BYTE_SIZE;
    bitmap[byteIndex] = bitmap[byteIndex] ^ (1 << bitIndex);
    return bitmap;
  },
  new Uint8Array(CHINESE_MAX_CODE_POINT / BYTE_SIZE + 1),
);

/**
 * Derived from "the fastest multilingual word counter" {@link https://github.com/thecodrr/alfaaz}
 * @license MIT
 */
function countWords(str: string) {
  let count = 0;
  let shouldCount = false;

  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const byteIndex = (charCode / BYTE_SIZE) | 0;
    const bitIndex = charCode % BYTE_SIZE;
    const byteAtIndex = BITMAP[byteIndex];
    const isMatch = ((byteAtIndex >> bitIndex) & 1) === 1;
    if (isMatch && (shouldCount || byteAtIndex === 255)) count++;
    shouldCount = !isMatch;
  }

  if (shouldCount) count++;

  return count;
}

export const cardWordCount = (card: Card): number => {
  if (!card.details?.oracle_text) {
    return 0;
  }
  if (card.details.wordCount == undefined) {
    card.details.wordCount = countWords(card.details.oracle_text);
  }
  return card.details.wordCount;
};

export const cardDevotion = (card: Card, color: string): number => {
  let cost = cardCost(card);
  if (cost && cardLayout(card) === 'adventure') cost = cost.slice(cost.findIndex((x) => x === 'split') + 1);
  return cost?.reduce((count, symbol) => count + (symbol.includes(color.toLowerCase()) ? 1 : 0), 0) ?? 0;
};

export const cardManaSymbols = (card: Card): ManaSymbol[] => {
  const cost = cardCost(card);
  if (!cost) {
    return [];
  }

  return cost
    .map((part: string) => {
      part = part.toUpperCase();

      if (isManaSymbol(part)) {
        return part as ManaSymbol;
      }

      if (isHybridManaSymbol(part)) {
        return part.split('-').map((part: string) => part as ManaSymbol);
      }

      if (isGenericHybridManaSymbol(part)) {
        return part.split('-')[1] as ManaSymbol;
      }

      if (isPhyrexianManaSymbol(part)) {
        return part
          .split('-')
          .filter((part) => part !== 'P')
          .map((part: string) => part as ManaSymbol);
      }
    })
    .flat()
    .filter(Boolean) as ManaSymbol[];
};

const typeIsSpecialZoneType = (type: string): boolean =>
  /\b(plane|phenomenon|vanguard|scheme|conspiracy|contraption)\b/i.test(type);

export const cardIsSpecialZoneType = (card: Card): boolean => typeIsSpecialZoneType(cardType(card));

const isCreatureLand = (details: any): boolean =>
  details.type.includes('Land') && details.oracle_text.match(/\bbecomes? a .*\bcreature\b/);

export const cardManaProduced = (card: Card): ManaSymbol[] => card.details?.produced_mana ?? [];

export const cardIsLand = (card: Card): boolean => {
  return cardType(card).includes('Land') || card.colorCategory === 'Lands';
};

export const CARD_CATEGORY_DETECTORS: Record<string, (details: CardDetailsType, card?: Card) => boolean> = {
  gold: (details) => details.colors.length > 1 && details.parsed_cost.every((symbol) => !symbol.includes('-')),
  twobrid: (details) => details.parsed_cost.some((symbol) => symbol.includes('-') && symbol.includes('2')),
  hybrid: (details) =>
    details.colors.length > 1 && details.parsed_cost.some((symbol) => symbol.includes('-') && !symbol.includes('-p')),
  phyrexian: (details) => details.parsed_cost.some((symbol) => symbol.includes('-p')),
  promo: (details) => details.promo,
  reprint: (details) => details.reprint,
  firstprint: (details) => !details.reprint,
  firstprinting: (details) => !details.reprint,
  digital: (details) => details.digital,
  reasonable: (details) =>
    !details.promo &&
    !details.digital &&
    details.border_color !== 'gold' &&
    details.promo_types === undefined &&
    details.language === 'en' &&
    details.tcgplayer_id !== undefined &&
    details.collector_number.indexOf('★') === -1,
  dfc: (details) => ['transform', 'modal_dfc', 'meld', 'double_faced_token', 'double_sided'].includes(details.layout),
  mdfc: (details) => details.layout === 'modal_dfc',
  meld: (details) => details.layout === 'meld',
  tdfc: (details) => details.layout === 'transform',
  transform: (details) => details.layout === 'transform',
  flip: (details) => details.layout === 'flip',
  split: (details) => details.layout === 'split',
  leveler: (details) => details.layout === 'leveler',
  commander: (details) =>
    details.legalities.Commander === 'legal' &&
    ((details.type.includes('Legendary') && details.type.includes('Creature')) ||
      details.oracle_text.includes('can be your commander') ||
      CategoryOverrides.commander.includes(details.name)),
  spell: (details) => !details.type.includes('Land') && !typeIsSpecialZoneType(details.type),
  permanent: (details) =>
    !details.type.includes('Instant') && !details.type.includes('Sorcery') && !typeIsSpecialZoneType(details.type),
  historic: (details) =>
    details.type.includes('Legendary') || details.type.includes('Artifact') || details.type.includes('Saga'),
  vanilla: (details) => !details.oracle_text,
  modal: (details) => details.oracle_text.includes('•'),
  creatureland: isCreatureLand,
  manland: isCreatureLand,
  foil: (details, card) => (card && cardFinish(card) ? cardFinish(card) === 'Foil' : details.finishes.includes('foil')),
  nonfoil: (details, card) =>
    card && cardFinish(card) ? cardFinish(card) === 'Non-foil' : details.finishes.includes('nonfoil'),
  etched: (details, card) =>
    card && cardFinish(card) ? cardFinish(card) === 'Etched' : details.finishes.includes('etched'),
  fullart: (details) => details.full_art,

  bikeland: (details) => LandCategories.CYCLE.includes(details.name),
  cycleland: (details) => LandCategories.CYCLE.includes(details.name),
  bicycleland: (details) => LandCategories.CYCLE.includes(details.name),
  bounceland: (details) => LandCategories.BOUNCE.includes(details.name),
  karoo: (details) => LandCategories.BOUNCE.includes(details.name),
  canopyland: (details) => LandCategories.CANOPY.includes(details.name),
  canland: (details) => LandCategories.CANOPY.includes(details.name),
  checkland: (details) => LandCategories.CHECK.includes(details.name),
  dual: (details) => LandCategories.DUAL.includes(details.name),
  fastland: (details) => LandCategories.FAST.includes(details.name),
  filterland: (details) => LandCategories.FILTER.includes(details.name),
  fetchland: (details) => LandCategories.FETCH.includes(details.name),
  gainland: (details) => LandCategories.GAIN.includes(details.name),
  painland: (details) => LandCategories.PAIN.includes(details.name),
  scryland: (details) => LandCategories.SCRY.includes(details.name),
  shadowland: (details) => LandCategories.SHADOW.includes(details.name),
  shockland: (details) => LandCategories.SHOCK.includes(details.name),
  storageland: (details) => LandCategories.STORAGE.includes(details.name),
  triland: (details) => LandCategories.TRI.includes(details.name),
  tangoland: (details) => LandCategories.TANGO.includes(details.name),
  battleland: (details) => LandCategories.TANGO.includes(details.name),

  // Others from Scryfall:
  //   reserved, new, old, hires,
  //   spotlight, unique, masterpiece,
  //   funny,
  //   booster, datestamped, prerelease, planeswalker_deck,
  //   league, buyabox, giftbox, intro_pack, gameday, release,
};

export const CARD_CATEGORIES: string[] = Object.keys(CARD_CATEGORY_DETECTORS);

export const makeSubtitle = (cards: any[]): string => {
  const numCards = cards.length;
  const numLands = cards.filter((card) => /land/i.test(cardType(card))).length;
  const numNonlands = cards.filter((card) => !/land/i.test(cardType(card)) && !cardIsSpecialZoneType(card)).length;
  const numCreatures = cards.filter((card) => /creature/i.test(cardType(card))).length;
  const numNonCreatures = numNonlands - numCreatures;
  const numSpecial = cards.filter(cardIsSpecialZoneType).length;
  return (
    `${numCards} card${numCards === 1 ? '' : 's'}: ` +
    `${numLands} land${numLands === 1 ? '' : 's'}, ` +
    `${numNonlands} nonland: ` +
    `${numCreatures} creature${numCreatures === 1 ? '' : 's'}, ` +
    `${numNonCreatures} noncreature${numNonCreatures === 1 ? '' : 's'}` +
    `${numSpecial > 0 ? ` ${numSpecial} special${numSpecial === 1 ? '' : 's'}` : ''}`
  );
};

export function cmcColumn(card: Card): number {
  const cmc = cardCmc(card);
  // Round to half-integer then take ceiling to support Little Girl
  const cmcDoubleInt = Math.round(cmc * 2);
  let cmcInt = Math.round((cmcDoubleInt + (cmcDoubleInt % 2)) / 2);
  if (cmcInt < 0) {
    cmcInt = 0;
  }
  if (cmcInt > 7) {
    cmcInt = 7;
  }
  return cmcInt;
}

export function sortInto(card: Card, result: Card[][][]) {
  const typeLine = cardType(card).toLowerCase();
  const row = typeLine.includes('creature') ? 0 : 1;
  const column = cmcColumn(card);
  if (result[row][column].length === 0) {
    result[row][column] = [card];
  } else {
    result[row][column].push(card);
  }
}

export function sortDeck(deck: (any | any[])[]): any[][] {
  const result = [new Array(8).fill([]), new Array(8).fill([])];
  for (const item of deck) {
    if (Array.isArray(item)) {
      for (const card of item) {
        sortInto(card, result);
      }
    } else {
      sortInto(item, result);
    }
  }
  return result;
}

export const colorToColorClass: {
  [key in ColorCategory]: string;
} = {
  White: 'white',
  Blue: 'blue',
  Black: 'black',
  Red: 'red',
  Green: 'green',
  Colorless: 'colorless',
  Multicolored: 'multi',
  Hybrid: 'multi',
  Lands: 'lands',
};

export function getCardColorClass(card: Card): string {
  if (!card) {
    return 'colorless';
  }

  return colorToColorClass[cardColorIdentityCategory(card)];
}

export function getCardTagColorClass(tagColors: TagColor[], card: Card): string {
  if (tagColors) {
    const tagColor = tagColors.find(({ tag }) => (card.tags || []).includes(tag));
    if (tagColor && tagColor.color && tagColor.color !== 'no-color' && tagColor.color !== 'None') {
      return `tag-color tag-${tagColor.color}`;
    }
  }
  return getCardColorClass(card);
}

export default {
  cardTags,
  cardFinish,
  cardStatus,
  cardColorIdentity,
  cardCmc,
  cardId,
  cardType,
  cardRarity,
  cardAddedTime,
  cardImageUrl,
  cardNotes,
  cardColorCategory,
  cardCost,
  cardIsFullArt,
  cardPrice,
  cardFoilPrice,
  cardNormalPrice,
  cardSet,
  cardCollectorNumber,
  cardPromo,
  cardDigital,
  cardIsToken,
  cardBorderColor,
  cardName,
  cardNameLower,
  cardFullName,
  cardArtist,
  cardScryfallUri,
  cardOracleText,
  cardOracleId,
  cardLegalities,
  cardLegalIn,
  cardColors,
  cardLanguage,
  cardMtgoId,
  cardTcgplayerId,
  cardLoyalty,
  cardPower,
  cardToughness,
  cardImageSmall,
  cardImageNormal,
  cardArtCrop,
  cardImageFlip,
  cardTokens,
  cardDevotion,
  cardWordCount,
  cardLayout,
  cardIsSpecialZoneType,
  cardElo,
  cardPopularity,
  cardCubeCount,
  cardPickCount,
  COLOR_COMBINATIONS,
  convertFromLegacyCardColorCategory,
  normalizeName,
  encodeName,
  decodeName,
  cardsAreEquivalent,
  makeSubtitle,
  cmcColumn,
  sortInto,
  sortDeck,
  getCardColorClass,
  getCardTagColorClass,
};

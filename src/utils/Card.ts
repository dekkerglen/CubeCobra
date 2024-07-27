import { arraysEqual } from 'utils/Util';
import LandCategories from 'res/LandCategories.json';
import CategoryOverrides from 'res/CategoryOverrides.json';
import CardDetails from 'datatypes/CardDetails';
import Card from 'datatypes/Card';

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

export function cardsAreEquivalent(a: any, b: any): boolean {
  return (
    a.cardID === b.cardID &&
    a.type_line === b.type_line &&
    a.status === b.status &&
    a.cmc === b.cmc &&
    arraysEqual(a.colors, b.colors) &&
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

export const cardTags = (card: any): string[] => card.tags || [];

export const cardFinish = (card: any): string => card.finish || 'Non-foil';

export const cardStatus = (card: any): any => card.status;

export const cardColorIdentity = (card: any): string[] => card.colors ?? card.details.color_identity;

export const cardCmc = (card: any): number => parseInt(card.cmc ?? card.details.cmc, 10);

export const cardId = (card: any): string => card.cardID ?? card.details.scryfall_id;

export const cardType = (card: any): string => card.type_line ?? card.details.type;

export const cardRarity = (card: any): string => card.rarity ?? card.details.rarity;

export const cardAddedTime = (card: any): any => card.addedTmsp;

export const cardImageUrl = (card: any): string => card.imgUrl ?? card.details.image_normal ?? card.details.image_small;

export const cardImageBackUrl = (card: any): string => card.imgBackUrl ?? card.details.image_flip;

export const cardNotes = (card: any): any => card.notes;

export const cardColorCategory = (card: any): any => card.colorCategory ?? card.details.color_category;

// prices being null causes unwanted coercing behaviour in price filters,
// so nullish price values are transformed to undefined instead
export const cardNormalPrice = (card: any): number | undefined => card.details.prices.usd ?? undefined;

export const cardFoilPrice = (card: any): number | undefined => card.details.prices.usd_foil ?? undefined;

export const cardEtchedPrice = (card: any): number | undefined => card.details.prices.usd_etched ?? undefined;

export const cardPrice = (card: any): number | undefined => {
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

export const cardPriceEur = (card: any): number | undefined => card.details.prices.eur ?? undefined;

export const cardTix = (card: any): number | undefined => card.details.prices.tix ?? undefined;

export const cardIsFullArt = (card: any): boolean => card.details.full_art;

export const cardCost = (card: any): string[] => card.details.parsed_cost;

export const cardSet = (card: any): string => card.details.set;

export const cardCollectorNumber = (card: any): string => card.details.collector_number;

export const cardPromo = (card: any): boolean => card.details.promo;

export const cardDigital = (card: any): boolean => card.details.digital;

export const cardIsToken = (card: any): boolean => card.details.is_token;

export const cardBorderColor = (card: any): string => card.details.border_color;

export const cardName = (card: any): string => card.details.name;

export const cardNameLower = (card: any): string => card.details.name_lower;

export const cardFullName = (card: any): string => card.details.full_name;

export const cardArtist = (card: any): string => card.details.artist;

export const cardScryfallUri = (card: any): string => card.details.scryfall_uri;

export const cardOracleText = (card: any): string => card.details.oracle_text;

export const cardOracleId = (card: any): string => card.details.oracle_id;

export const cardLegalities = (card: any): Record<string, string> => card.details.legalities;

const cardLegalityFilter = (card: any, legality: string): string[] => {
  const legalities = cardLegalities(card);
  return Object.keys(legalities).filter((format) => legalities[format] === legality);
};

export const cardLegalIn = (card: any): string[] => cardLegalityFilter(card, 'legal');
export const cardBannedIn = (card: any): string[] => cardLegalityFilter(card, 'banned');
export const cardRestrictedIn = (card: any): string[] => cardLegalityFilter(card, 'restricted');

export const cardColors = (card: any): string[] => card.details.colors;

export const cardLanguage = (card: any): string => card.details.language;

export const cardMtgoId = (card: any): number => card.details.mtgo_id;

export const cardTcgplayerId = (card: any): number => card.details.tcgplayer_id;

export const cardLoyalty = (card: any): number => card.details.loyalty;

export const cardPower = (card: any): string => card.details.power;

export const cardToughness = (card: any): string => card.details.toughness;

export const cardImageSmall = (card: any): string => card.details.image_small;

export const cardImageNormal = (card: any): string => card.details.image_normal;

export const cardArtCrop = (card: any): string => card.details.art_crop;

export const cardImageFlip = (card: any): string => card.details.image_flip;

export const cardTokens = (card: any): any => card.details.tokens;

export const cardElo = (card: any): number => (card.details ? card.details.elo || 1200 : 1200);

export const cardPopularity = (card: any): string => parseFloat(card.details.popularity || 0).toFixed(2);

export const cardCubeCount = (card: any): number => (card.details ? card.details.cubeCount || 0 : 0);

export const cardPickCount = (card: any): number => (card.details ? card.details.pickCount || 0 : 0);

export const cardLayout = (card: any): string => card.details.layout;

export const cardReleaseDate = (card: any): string => card.details.released_at;

export const cardDevotion = (card: any, color: string): number => {
  let cost = cardCost(card);
  if (cost && cardLayout(card) === 'adventure') cost = cost.slice(cost.findIndex((x) => x === 'split') + 1);
  return cost?.reduce((count, symbol) => count + (symbol.includes(color.toLowerCase()) ? 1 : 0), 0) ?? 0;
};

export const cardIsSpecialZoneType = (card: any): boolean =>
  /\b(plane|phenomenon|vanguard|scheme|conspiracy|contraption)\b/i.test(cardType(card));

const isCreatureLand = (details: any): boolean =>
  details.type.includes('Land') && details.oracle_text.match(/\bbecomes? a .*\bcreature\b/);

export const CARD_CATEGORY_DETECTORS: Record<string, (details: CardDetails, card?: Card) => boolean> = {
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
    details.language === 'en' &&
    details.tcgplayer_id !== undefined &&
    details.set !== 'myb' &&
    details.set !== 'mb1' &&
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
  spell: (details) => !details.type.includes('Land') && !cardIsSpecialZoneType({ details }),
  permanent: (details) =>
    !details.type.includes('Instant') && !details.type.includes('Sorcery') && !cardIsSpecialZoneType({ details }),
  historic: (details) =>
    details.type.includes('Legendary') || details.type.includes('Artifact') || details.type.includes('Saga'),
  vanilla: (details) => !details.oracle_text,
  modal: (details) => details.oracle_text.includes('•'),
  creatureland: isCreatureLand,
  manland: isCreatureLand,
  foil: (details, card) => (cardFinish(card) ? cardFinish(card) === 'Foil' : details.finishes.includes('foil')),
  nonfoil: (details, card) =>
    cardFinish(card) ? cardFinish(card) === 'Non-foil' : details.finishes.includes('nonfoil'),
  etched: (details, card) => (cardFinish(card) ? cardFinish(card) === 'Etched' : details.finishes.includes('etched')),
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
  cardLayout,
  cardIsSpecialZoneType,
  cardElo,
  cardPopularity,
  cardCubeCount,
  cardPickCount,
  COLOR_COMBINATIONS,
  normalizeName,
  encodeName,
  decodeName,
  cardsAreEquivalent,
  makeSubtitle,
};

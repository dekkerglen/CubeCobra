import { arraysEqual, fromEntries, arrayIsSubset } from 'utils/Util';
import LandCategories from 'utils/LandCategories';

export const COLOR_COMBINATIONS = [
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

export const COLOR_INCLUSION_MAP = fromEntries(
  COLOR_COMBINATIONS.map((colors) => [
    colors.join(''),
    fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), arrayIsSubset(comb, colors)])),
  ]),
);
for (const colorsIncluded of Object.values(COLOR_INCLUSION_MAP)) {
  colorsIncluded.includes = Object.keys(colorsIncluded).filter((c) => colorsIncluded[c]);
}

export function normalizeName(name) {
  return name
    .trim()
    .normalize('NFD') // convert to consistent unicode format
    .replace(/[\u0300-\u036f]/g, '') // remove unicode
    .toLowerCase();
}

export function encodeName(name) {
  return encodeURIComponent(name.toLowerCase());
}

export function decodeName(name) {
  return decodeURIComponent(name.toLowerCase());
}

export function cardsAreEquivalent(a, b) {
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

export const cardTags = (card) => card.tags;

export const cardFinish = (card) => card.finish;

export const cardStatus = (card) => card.status;

export const cardColorIdentity = (card) => card.colors ?? card.details.color_identity;

export const cardCmc = (card) => card.cmc ?? card.details.cmc;

export const cardId = (card) => card.cardID ?? card.details._id;

export const cardType = (card) => card.type_line ?? card.details.type;

export const cardRarity = (card) => card.rarity ?? card.details.rarity;

export const cardAddedTime = (card) => card.addedTmsp;

export const cardImageUrl = (card) => card.imgUrl ?? card.details.image_normal ?? card.details.image_small;

export const cardImageBackUrl = (card) => card.imgBackUrl ?? card.details.image_flip;

export const cardNotes = (card) => card.notes;

export const cardColorCategory = (card) => card.colorCategory ?? card.details.color_category;

export const cardPrice = (card) =>
  cardFinish(card) === 'Foil'
    ? card.details.prices.usd_foil ?? card.details.prices.usd
    : card.details.prices.usd ?? card.details.prices.usd_foil;

export const cardNormalPrice = (card) => card.details.prices.usd;

export const cardFoilPrice = (card) => card.details.prices.usd_foil;

export const cardPriceEur = (card) => card.details.prices.eur;

export const cardTix = (card) => card.details.prices.tix;

export const cardIsFullArt = (card) => card.details.full_art;

export const cardCost = (card) => card.details.parsed_cost;

export const cardSet = (card) => card.details.set;

export const cardCollectorNumber = (card) => card.details.collector_number;

export const cardPromo = (card) => card.details.promo;

export const cardDigital = (card) => card.details.digital;

export const cardIsToken = (card) => card.details.is_token;

export const cardBorderColor = (card) => card.details.border_color;

export const cardName = (card) => card.details.name;

export const cardNameLower = (card) => card.details.name_lower;

export const cardFullName = (card) => card.details.full_name;

export const cardArtist = (card) => card.details.artist;

export const cardScryfallUri = (card) => card.details.scryfall_uri;

export const cardOracleText = (card) => card.details.oracle_text;

export const cardOracleId = (card) => card.details.oracle_id;

export const cardLegalities = (card) => card.details.legalities;

export const cardLegalIn = (card) => {
  const legalities = cardLegalities(card);
  return Object.keys(legalities).filter((format) => legalities[format] === 'legal');
};

export const cardColors = (card) => card.details.colors;

export const cardLanguage = (card) => card.details.language;

export const cardMtgoId = (card) => card.details.mtgo_id;

export const cardTcgplayerId = (card) => card.details.tcgplayer_id;

export const cardLoyalty = (card) => card.details.loyalty;

export const cardPower = (card) => card.details.power;

export const cardToughness = (card) => card.details.toughness;

export const cardImageSmall = (card) => card.details.image_small;

export const cardImageNormal = (card) => card.details.image_normal;

export const cardArtCrop = (card) => card.details.art_crop;

export const cardImageFlip = (card) => card.details.image_flip;

export const cardTokens = (card) => card.details.tokens;

export const cardElo = (card) => card.details.elo;

export const cardLayout = (card) => card.details.layout;

export const cardDevotion = (card, color) => {
  let cost = cardCost(card);
  if (cost && cardLayout(card) === 'adventure') cost = cost.slice(cost.findIndex((x) => x === 'split') + 1);
  return cost?.reduce((count, symbol) => count + (symbol.includes(color.toLowerCase()) ? 1 : 0), 0) ?? 0;
};

export const cardIsSpecialZoneType = (card) => {
  return (
    /(plane|phenomenon|vanguard|scheme|conspiracy|contraption)/i.test(cardType(card)) &&
    !/planeswalker/i.test(cardType(card))
  );
};

const isCreatureLand = (details) =>
  details.type.includes('Land') && details.oracle_text.match(/\bbecomes? a .*\bcreature\b/);

export const CARD_CATEGORY_DETECTORS = {
  gold: (details) => details.colors.length > 1 && details.parsed_cost.every((symbol) => !symbol.includes('-')),
  twobrid: (details) => details.parsed_cost.some((symbol) => symbol.includes('-') && symbol.includes('2')),
  hybrid: (details) =>
    details.colors.length > 1 && details.parsed_cost.some((symbol) => symbol.includes('-') && !symbol.includes('-p')),
  phyrexian: (details) => details.parsed_cost.some((symbol) => symbol.includes('-p')),
  promo: (details) => details.promo,
  digital: (details) => details.digital,
  reasonable: (details) =>
    !details.promo &&
    !details.digital &&
    details.border_color !== 'gold' &&
    details.language === 'en' &&
    details.tcgplayer_id &&
    details.set !== 'myb' &&
    details.set !== 'mb1' &&
    details.collector_number.indexOf('★') === -1,
  dfc: (details) => ['transform', 'modal_dfc', 'meld', 'double_faced_token', 'double_sided'].includes(details.layout),
  mdfc: (details) => details.layout === 'modal_dfc',
  meld: (details) => details.layout === 'meld',
  transform: (details) => details.layout === 'transform',
  flip: (details) => details.layout === 'flip',
  split: (details) => details.layout === 'split',
  leveler: (details) => details.layout === 'leveler',
  commander: (details) =>
    details.legalities.Commander === 'legal' &&
    ((details.type.includes('Legendary') && details.type.includes('Creature')) ||
      details.oracle_text.includes('can be your commander')),
  spell: (details) => !details.type.includes('Land') && !cardIsSpecialZoneType({ details }),
  permanent: (details) =>
    !details.type.includes('Instant') && !details.type.includes('Sorcery') && !cardIsSpecialZoneType({ details }),
  historic: (details) =>
    details.type.includes('Legendary') || details.type.includes('Artifact') || details.type.includes('Saga'),
  vanilla: (details) => !details.oracle_text,
  modal: (details) => details.oracle_text.includes('•'),
  creatureland: isCreatureLand,
  manland: isCreatureLand,

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
  //   reserved, reprint, new, old, hires, foil,
  //   spotlight, unique, masterpiece,
  //   funny,
  //   booster, datestamped, prerelease, planeswalker_deck,
  //   league, buyabox, giftbox, intro_pack, gameday, release,
  //   foil, nonfoil, full,
};

export const CARD_CATEGORIES = Object.keys(CARD_CATEGORY_DETECTORS);

export const makeSubtitle = (cards) => {
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
  COLOR_COMBINATIONS,
  normalizeName,
  encodeName,
  decodeName,
  cardsAreEquivalent,
  makeSubtitle,
};

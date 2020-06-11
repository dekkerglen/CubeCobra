import { arraysEqual, fromEntries, arrayIsSubset } from 'utils/Util';

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
  // Others from Scryfall:
  //   commander, reserved, reprint, new, old, hires, foil,
  //   spotlight, unique, bikeland, cycleland, bicycleland,
  //   bounceland, Karoo, canopyland, canland, checkland,
  //   dual, fastland, fetchland, filterland, gainland,
  //   painland, scryland, shadowland, shockland, storageland,
  //   creatureland, triland, tangoland, battleland, masterpiece,
  //   spell, permanent, historic, modal, vanilla, funny,
  //   booster, datestamped, prerelease, planeswalker_deck,
  //   league, buyabox, giftbox, intro_pack, gameday, release,
  //   foil, nonfoil, full, split, meld, transform, flip,
  //   leveler,
};

export const CARD_CATEGORIES = Object.keys(CARD_CATEGORY_DETECTORS);

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

export const cardNotes = (card) => card.notes;

export const cardColorCategory = (card) => card.colorCategory ?? card.details.color_category;

export const cardPrice = (card) =>
  cardFinish(card) === 'Foil'
    ? card.details.price_foil ?? card.details.price
    : card.details.price ?? card.details.price_foil;

export const cardNormalPrice = (card) => card.details.price;

export const cardFoilPrice = (card) => card.details.price_foil;

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

export const cardDevotion = (card, color) =>
  cardCost(card)?.reduce((count, symbol) => count + (symbol.includes(color.toLowerCase()) ? 1 : 0), 0) ?? 0;

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
  cardElo,
  COLOR_COMBINATIONS,
  normalizeName,
  encodeName,
  decodeName,
  cardsAreEquivalent,
};

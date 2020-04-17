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

export const getTags = (card) => card.tags;

export const getFinish = (card) => card.finish;

export const getStatus = (card) => card.status;

export const getColorIdentity = (card) => card.colors ?? card.details.color_identity;

export const getCmc = (card) => card.cmc ?? card.details.cmc;

export const getId = (card) => card.cardID ?? card.details._id;

export const getType = (card) => card.type_line ?? card.details.type;

export const getRarity = (card) => card.rarity ?? card.details.rarity;

export const getAddedTime = (card) => card.addedTmsp;

export const getImg = (card) => card.imgUrl ?? card.details.image_normal ?? card.details.image_small;

export const getNotes = (card) => card.notes;

export const getColorCategory = (card) => card.colorCategory;

export const getPrice = (card) =>
  getFinish() === 'Foil'
    ? card.details.price_foil ?? card.details.price
    : card.details.price ?? card.details.price_foil;

export const getNormalPrice = (card) => card.details.price;

export const getFoilPrice = (card) => card.details.price_foil;

export const getIsFullArt = (card) => card.details.full_art;

export const getCost = (card) => card.details.parsed_cost;

export const getSet = (card) => card.details.set;

export const getCollectorNumber = (card) => card.details.collector_number;

export const getPromo = (card) => card.details.promo;

export const getDigital = (card) => card.details.digital;

export const getIsToken = (card) => card.details.is_token;

export const getBorderColor = (card) => card.details.border_color;

export const getName = (card) => card.details.name;

export const getNameLower = (card) => card.details.name_lower;

export const getFullName = (card) => card.details.full_name;

export const getArtist = (card) => card.details.artist;

export const getScryfallUri = (card) => card.details.scryfall_uri;

export const getOracleText = (card) => card.details.oracle_text;

export const getOracleId = (card) => card.details.oracle_id;

export const getLegalities = (card) => card.details.legalities;

export const getColors = (card) => card.details.colors;

export const getLanguage = (card) => card.details.language;

export const getMtgoId = (card) => card.details.mtgo_id;

export const getTcgplayerId = (card) => card.details.tcgplayer_id;

export const getLoyalty = (card) => card.details.loyalty;

export const getPower = (card) => card.details.power;

export const getToughness = (card) => card.details.toughness;

export const getImageSmall = (card) => card.details.image_small;

export const getImageNormal = (card) => card.details.image_normal;

export const getArtCrop = (card) => card.details.art_crop;

export const getImageFlip = (card) => card.details.image_flip;

export const getTokens = (card) => card.details.tokens;

export const getElo = (card) => card.details.elo;

export default {
  getTags,
  getFinish,
  getStatus,
  getColorIdentity,
  getCmc,
  getId,
  getType,
  getRarity,
  getAddedTime,
  getImg,
  getNotes,
  getColorCategory,
  getCost,
  getIsFullArt,
  getPrice,
  getFoilPrice,
  getNormalPrice,
  getSet,
  getCollectorNumber,
  getPromo,
  getDigital,
  getIsToken,
  getBorderColor,
  getName,
  getNameLower,
  getFullName,
  getArtist,
  getScryfallUri,
  getOracleText,
  getOracleId,
  getLegalities,
  getColors,
  getLanguage,
  getMtgoId,
  getTcgplayerId,
  getLoyalty,
  getPower,
  getToughness,
  getImageSmall,
  getImageNormal,
  getArtCrop,
  getImageFlip,
  getTokens,
  getElo,
  COLOR_COMBINATIONS,
  normalizeName,
  encodeName,
  decodeName,
  cardsAreEquivalent,
};

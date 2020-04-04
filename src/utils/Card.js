import { arraysEqual, findProperty, fromEntries, arrayIsSubset } from 'utils/Util';

const CUBE_CARD_PROPERTIES = {
  color_identity: ['colors', 'details.color_identity', 'details.color'],
  colors: ['details.colors'],
  imgUrl: ['imgUrl', 'details.image_normal'],
  type_line: ['type_line', 'details.type'],
  // Not overridable yet.
  price: ['price', 'details.price', 'details.price_foil'],
};

export function propertyForCard(card, property) {
  const paths = CUBE_CARD_PROPERTIES[property] ?? [property, `details.${property}`];
  return findProperty(card, ...paths);
}

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

export function inclusiveCount(combination, cards) {
  return cards.reduce(
    (sum, card) => sum + (arrayIsSubset(card.colors ?? card.details.color_identity ?? [], combination) ? 1 : 0),
    0,
  );
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
    a.finish === b.finish
  );
}

export default { COLOR_COMBINATIONS, propertyForCard, normalizeName, encodeName, decodeName, cardsAreEquivalent };

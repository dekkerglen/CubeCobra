import { arraysEqual, findProperty } from 'utils/Util';

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

export default { propertyForCard, normalizeName, encodeName, decodeName, cardsAreEquivalent };

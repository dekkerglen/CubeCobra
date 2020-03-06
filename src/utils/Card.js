import { arraysEqual } from 'utils/Util';

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
  //   bounceland, karoo, canopyland, canland, checkland,
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
    a.finish === b.finish
  );
}

export function getCmc(card) {
  return card.cmc !== undefined ? card.cmc : card.details.cmc;
}

export default {
  CARD_CATEGORY_DETECTORS,
  CARD_CATEGORIES,
  normalizeName,
  encodeName,
  decodeName,
  cardsAreEquivalent,
  getCmc,
};

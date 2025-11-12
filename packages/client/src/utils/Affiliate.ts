import Card from '@utils/datatypes/Card';
import slugify from 'slugify';

import { cardCollectorNumber, cardName, cardSet, cardSetName } from '../../../utils/src/cardutil';

export const tcgplayerAffiliate = 'https://tcgplayer.pxf.io/c/5760114/1830156/21018';
export const tcgMassEntryUrl = 'https://store.tcgplayer.com/massentry';

export function getTCGLink(card: Card): string {
  if (card.details === undefined) return '#';

  const { name, isToken } = card.details;
  const tcgplayerId = card.details.tcgplayer_id;
  let tcgplayerLink = 'https://shop.tcgplayer.com/';
  if (tcgplayerId) {
    tcgplayerLink += `product/productsearch?id=${tcgplayerId}`;
  } else {
    const tcgplayerName = isToken ? `${name} Token` : name;
    tcgplayerLink += `productcatalog/product/show?ProductName=${tcgplayerName}`;
  }

  return `${tcgplayerAffiliate}?u=${encodeURI(tcgplayerLink)}`;
}

export const getCardMarketLink = (card: Card): string =>
  `https://www.cardmarket.com/en/Magic/Products/Singles/${cardSetName(card)
    .replace(/ /g, '-')
    .replace(/[:,."']/g, '')}/${cardName(card).replace(/ /g, '-').replace(/:/g, '').replace(/\./g, '')}`;

export const getCardHoarderLink = (card: Card): string =>
  `https://www.cardhoarder.com/cards?data%5Bsearch%5D=${encodeURIComponent(cardName(card))}?affiliate_id=cubecobra&utm_source=cubecobra&utm_campaign=affiliate&utm_medium=card`;

const ck = (str: string): string =>
  str
    .replace(' - ', '-')
    .replace(/ /g, '-')
    .replace(/[:,."']/g, '')
    .toLowerCase();

export const nameToDashedUrlComponent = ck;

export const getCardKingdomLink = (card: Card): string =>
  `https://www.cardkingdom.com/mtg/${ck(cardSetName(card))}/${ck(
    cardName(card),
  )}?partner=CubeCobra&utm_source=CubeCobra&utm_medium=affiliate&utm_campaign=CubeCobra`;

export const cardKingdomBulkLink = `https://www.cardkingdom.com/builder?utm_source=CubeCobra&utm_medium=deck&utm_campaign=CubeCobra`;

export const getManaPoolLink = (card: Card): string =>
  `https://manapool.com/card/${cardSet(card).toLowerCase()}/${cardCollectorNumber(card)}/${slugify(cardName(card), {
    lower: true,
  })}?ref=cubecobra`;

export const getBulkManaPoolLink = (cards: Card[]): string => {
  const cardString = cards
    .map((card) => `${cardName(card)} [${cardSet(card)}] ${cardCollectorNumber(card)}`)
    .join('\n');

  /* base64 encode the card string
   * Because the collector number may contain non-latin characters like ★ and btoa only works with latin1 character set,
   * we use the solution in https://stackoverflow.com/a/70714541 to encode before btoa in order to have valid characters.
   * Even though unescape is deprecated, it works in all browsers at this time
   */
  const encodedCardString = btoa(unescape(encodeURIComponent(cardString)));
  return `https://manapool.com/add-deck?ref=cubecobra&deck=${encodedCardString}`;
};

export default { getTCGLink, tcgMassEntryUrl, tcgplayerAffiliate };

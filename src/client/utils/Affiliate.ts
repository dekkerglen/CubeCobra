import Card from '../../datatypes/Card';
import { cardName,cardSetName } from './cardutil';

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
  `https://www.cardhoarder.com/cards?data%5Bsearch%5D=${cardName(card)}?affiliate_id=cubecobra&utm_source=cubecobra&utm_campaign=affiliate&utm_medium=card`;

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

export default { getTCGLink, tcgMassEntryUrl, tcgplayerAffiliate };

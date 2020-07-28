export function getTCGLink(card) {
  const { name, isToken } = card.details;
  const tcgplayerId = card.details.tcgplayer_id;
  let tcgplayerLink = 'https://shop.tcgplayer.com/';
  if (tcgplayerId) {
    tcgplayerLink += `product/productsearch?id=${tcgplayerId}`;
  } else {
    const tcgplayerName = isToken ? `${name} Token` : name;
    tcgplayerLink += `productcatalog/product/show?ProductName=${tcgplayerName}`;
  }
  tcgplayerLink += '&partner=CubeCobra&utm_campaign=affiliate&utm_medium=CubeCobra&utm_source=CubeCobra';

  return tcgplayerLink;
}

export const getCardMarketLink = (card) =>
  `https://www.cardmarket.com/en/Magic/Products/Singles/${card.details.set_name
    .replace(/ /g, '-')
    .replace(/:/g, '')
    .replace(/\./g, '')}/${card.details.name.replace(/ /g, '-').replace(/:/g, '').replace(/\./g, '')}`;

export const getCardHoarderLink = (card) => `https://www.cardhoarder.com/cards?data%5Bsearch%5D=${card.details.name}`;

export const tcgMassEntryUrl =
  'https://store.tcgplayer.com/massentry?partner=CubeCobra' +
  '&utm_campaign=affiliate&utm_medium=CubeCobra&utm_source=CubeCobra';

export default { getTCGLink, tcgMassEntryUrl };

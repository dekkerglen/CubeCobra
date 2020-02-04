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

export const tcgMassEntryUrl =
  'https://store.tcgplayer.com/massentry?partner=CubeCobra' +
  '&utm_campaign=affiliate&utm_medium=CubeCobra&utm_source=CubeCobra';

export default { getTCGLink, tcgMassEntryUrl };

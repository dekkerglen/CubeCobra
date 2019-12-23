export function getTCGLink(card) {
  const { tcgplayer_id, name, isToken } = card.details;
  let tcgplayerLink = 'https://shop.tcgplayer.com/';
  if (tcgplayer_id) {
    tcgplayerLink += `product/productsearch?id=${tcgplayer_id}`;
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
